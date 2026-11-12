import type { ChecklistItem, ChecklistVorlage, Einsatz, Mangel } from '../../../db/types'
import { gewaehlteOptionen } from './checkliste'

/**
 * Mängel aus der Nachkontrolle: Wird eine Option mit `erzeugtMangel` gewählt,
 * entsteht je Gerät des Einsatzes ein offener Mangel. Reine Funktion – liefert
 * nur, was anzulegen bzw. zu löschen ist (idempotent).
 */

export interface SollMangel {
  geraetId: string
  beschreibung: string
}

export const mangelBeschreibung = (item: ChecklistItem, optionLabel: string) =>
  `${item.nr ? `${item.nr}. ` : ''}${item.label}: ${optionLabel}`

/** Welche Mängel sollen laut aktuellen Antworten der Nachkontrolle existieren? */
export function sollMaengel(einsatz: Pick<Einsatz, 'antworten' | 'geraetIds'>, vorlage: ChecklistVorlage): SollMangel[] {
  const out: SollMangel[] = []
  const walk = (items: ChecklistItem[]) => {
    for (const it of items) {
      for (const o of gewaehlteOptionen(it, einsatz.antworten[it.id])) {
        if (!o.erzeugtMangel) continue
        for (const g of einsatz.geraetIds) out.push({ geraetId: g, beschreibung: mangelBeschreibung(it, o.label) })
      }
      if (it.unterpunkte) walk(it.unterpunkte)
      for (const o of it.optionen ?? []) if (o.folgeFelder) walk(o.folgeFelder)
    }
  }
  for (const s of vorlage.sektionen) if (s.phase === 'nachkontrolle') walk(s.items)
  return out
}

export interface MangelAbgleich {
  anlegen: Mangel[]
  loeschen: string[]
}

/**
 * Vergleicht Soll mit den bestehenden Nachkontroll-Mängeln dieses Einsatzes.
 * - fehlende werden angelegt
 * - nicht mehr gewählte (und noch nicht behobene) werden gelöscht
 * - bei abgeschlossenem Einsatz wird nichts verändert
 */
export function maengelAbgleich(
  einsatz: Pick<Einsatz, 'id' | 'orgId' | 'status' | 'antworten' | 'geraetIds'>,
  vorlage: ChecklistVorlage,
  bestehend: Mangel[],
  neueId: () => string,
  jetzt: string,
): MangelAbgleich {
  if (einsatz.status === 'abgeschlossen') return { anlegen: [], loeschen: [] }
  const eigene = bestehend.filter((m) => m.einsatzId === einsatz.id && m.quelle === 'nachkontrolle')
  const key = (g: string, b: string) => `${g}\u0000${b}`
  const soll = sollMaengel(einsatz, vorlage)
  const sollKeys = new Set(soll.map((s) => key(s.geraetId, s.beschreibung)))
  const istKeys = new Set(eigene.map((m) => key(m.geraetId, m.beschreibung)))

  const anlegen: Mangel[] = []
  for (const s of soll) {
    const k = key(s.geraetId, s.beschreibung)
    if (istKeys.has(k)) continue
    istKeys.add(k)
    anlegen.push({
      id: neueId(),
      orgId: einsatz.orgId,
      geraetId: s.geraetId,
      erstelltAm: jetzt,
      quelle: 'nachkontrolle',
      einsatzId: einsatz.id,
      beschreibung: s.beschreibung,
    })
  }
  const loeschen = eigene.filter((m) => !m.behobenAm && !sollKeys.has(key(m.geraetId, m.beschreibung))).map((m) => m.id)
  return { anlegen, loeschen }
}
