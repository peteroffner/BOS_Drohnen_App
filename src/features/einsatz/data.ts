import { useLiveQuery } from 'dexie-react-hooks'
import { db, jetzt, neueId } from '../../db/db'
import type { ChecklistAntwort, Einsatz, Geraet, Mangel, Pilot } from '../../db/types'
import { VORLAGEN } from '../../templates/checkliste_v9'
import { maengelAbgleich } from './logic/maengel'

/** Datenzugriff des Einsatz-Moduls (Dexie). */

export const useEinsaetze = (orgId: string) =>
  useLiveQuery(() => (orgId ? db.einsaetze.where('orgId').equals(orgId).toArray() : []), [orgId])

export const usePiloten = (orgId: string) =>
  useLiveQuery(
    async () =>
      (orgId ? await db.piloten.where('orgId').equals(orgId).toArray() : []).sort((a, b) =>
        `${a.nachname} ${a.vorname}`.localeCompare(`${b.nachname} ${b.vorname}`, 'de'),
      ),
    [orgId],
  )

export const useGeraete = (orgId: string) =>
  useLiveQuery(
    async () => (orgId ? await db.geraete.where('orgId').equals(orgId).toArray() : []).sort((a, b) => a.name.localeCompare(b.name, 'de')),
    [orgId],
  )

export const useMaengel = (orgId: string) => useLiveQuery(() => (orgId ? db.maengel.where('orgId').equals(orgId).toArray() : []), [orgId])

export const pilotMap = (ps: Pilot[] = []) => new Map(ps.map((p) => [p.id, p]))
export const geraetMap = (gs: Geraet[] = []) => new Map(gs.map((g) => [g.id, g]))

export class EinsatzGesperrtError extends Error {
  constructor() {
    super('Einsatz ist abgeschlossen und schreibgeschützt.')
  }
}

/**
 * Einsatz in einer Transaktion ändern. Abgeschlossene Einsätze sind gesperrt
 * (außer `erlaubeAbgeschlossen` für Nachträge).
 */
export async function aendereEinsatz(id: string, fn: (e: Einsatz) => void, erlaubeAbgeschlossen = false): Promise<void> {
  await db.transaction('rw', db.einsaetze, async () => {
    const e = await db.einsaetze.get(id)
    if (!e) return
    if (e.status === 'abgeschlossen' && !erlaubeAbgeschlossen) throw new EinsatzGesperrtError()
    fn(e)
    e.geaendertAm = jetzt()
    await db.einsaetze.put(e)
  })
}

/** Checklisten-Antwort speichern (autosave) inkl. Mangel-Abgleich bei der Nachkontrolle. */
export async function speichereAntwort(id: string, itemId: string, wert: ChecklistAntwort | undefined, extra?: (e: Einsatz) => void) {
  await aendereEinsatz(id, (e) => {
    if (wert === undefined || wert === null || wert === '') delete e.antworten[itemId]
    else e.antworten[itemId] = wert
    extra?.(e)
  })
  await gleicheMaengelAb(id)
}

/** Mängel aus der Nachkontrolle mit den Antworten abgleichen (idempotent). */
export async function gleicheMaengelAb(id: string) {
  await db.transaction('rw', db.einsaetze, db.maengel, async () => {
    const e = await db.einsaetze.get(id)
    if (!e) return
    const vorlage = VORLAGEN[e.vorlageId]
    if (!vorlage) return
    const bestehend: Mangel[] = await db.maengel.where('einsatzId').equals(id).toArray()
    const { anlegen, loeschen } = maengelAbgleich(e, vorlage, bestehend, neueId, jetzt())
    if (anlegen.length) await db.maengel.bulkAdd(anlegen)
    if (loeschen.length) await db.maengel.bulkDelete(loeschen)
  })
}

/** Einsatz löschen (nur solange nicht abgeschlossen) – inkl. offener Nachkontroll-Mängel. */
export async function loescheEinsatz(id: string) {
  await db.transaction('rw', db.einsaetze, db.maengel, async () => {
    const e = await db.einsaetze.get(id)
    if (!e) return
    if (e.status === 'abgeschlossen') throw new EinsatzGesperrtError()
    const ms = await db.maengel.where('einsatzId').equals(id).toArray()
    await db.maengel.bulkDelete(ms.filter((m) => !m.behobenAm && m.quelle === 'nachkontrolle').map((m) => m.id))
    await db.einsaetze.delete(id)
  })
}
