import { AKTIVE_ORG_KEY, type BosDb } from '../../db/db'

/** Kennung der Backup-Datei */
export const BACKUP_FORMAT = 'bos-drohnen-backup'
export const BACKUP_VERSION = 1
export const LETZTES_BACKUP_KEY = 'letztesBackup'
/** Ab so vielen Tagen ohne Backup wird erinnert */
export const BACKUP_ERINNERUNG_TAGE = 30

export const TABELLEN = ['organisationen', 'piloten', 'geraete', 'einsaetze', 'wartungen', 'maengel', 'einstellungen'] as const
export type Tabelle = (typeof TABELLEN)[number]

export const TABELLEN_LABEL: Record<Tabelle, string> = {
  organisationen: 'Organisationen',
  piloten: 'Piloten',
  geraete: 'Geräte',
  einsaetze: 'Einsätze',
  wartungen: 'Wartungsprüfungen',
  maengel: 'Mängel',
  einstellungen: 'Einstellungen',
}

export interface BackupDatei {
  format: typeof BACKUP_FORMAT
  version: number
  erstelltAm: string
  /** Dexie-Schemaversion zum Zeitpunkt des Backups */
  dbVersion: number
  app: string
  tabellen: Record<Tabelle, Record<string, unknown>[]>
}

export type Validierung = { ok: true; daten: BackupDatei; anzahl: Record<Tabelle, number> } | { ok: false; fehler: string }

/** Liest alle Tabellen der Datenbank in ein Backup-Objekt. */
export async function backupErzeugen(db: BosDb, jetzt = new Date()): Promise<BackupDatei> {
  const tabellen = {} as BackupDatei['tabellen']
  await db.transaction('r', TABELLEN.map((t) => db.table(t)), async () => {
    for (const t of TABELLEN) tabellen[t] = (await db.table(t).toArray()) as Record<string, unknown>[]
  })
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, erstelltAm: jetzt.toISOString(), dbVersion: db.verno, app: 'BOS Drohnen-App', tabellen }
}

const istObjekt = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)

/** Prüft eine eingelesene Backup-Datei (JSON-Text oder bereits geparst). */
export function backupValidieren(eingabe: unknown): Validierung {
  let roh = eingabe
  if (typeof eingabe === 'string') {
    try {
      roh = JSON.parse(eingabe)
    } catch {
      return { ok: false, fehler: 'Die Datei ist keine gültige JSON-Datei.' }
    }
  }
  if (!istObjekt(roh) || roh.format !== BACKUP_FORMAT) return { ok: false, fehler: 'Die Datei ist kein Backup der BOS Drohnen-App.' }
  if (typeof roh.version !== 'number' || roh.version > BACKUP_VERSION)
    return { ok: false, fehler: `Backup-Version ${String(roh.version)} wird von dieser App-Version nicht unterstützt. Bitte App aktualisieren.` }
  if (!istObjekt(roh.tabellen)) return { ok: false, fehler: 'Backup enthält keine Tabellen.' }
  const tabellen = roh.tabellen
  const unbekannt = Object.keys(tabellen).filter((k) => !(TABELLEN as readonly string[]).includes(k))
  if (unbekannt.length) return { ok: false, fehler: `Unbekannte Tabelle(n) im Backup: ${unbekannt.join(', ')}` }

  const anzahl = {} as Record<Tabelle, number>
  const daten = {} as BackupDatei['tabellen']
  for (const t of TABELLEN) {
    const liste = tabellen[t] ?? []
    if (!Array.isArray(liste)) return { ok: false, fehler: `Tabelle „${TABELLEN_LABEL[t]}“ ist ungültig.` }
    const schluessel = t === 'einstellungen' ? 'key' : 'id'
    const gesehen = new Set<string>()
    for (const [i, z] of liste.entries()) {
      if (!istObjekt(z) || typeof z[schluessel] !== 'string' || !z[schluessel])
        return { ok: false, fehler: `Tabelle „${TABELLEN_LABEL[t]}“, Datensatz ${i + 1}: ${schluessel} fehlt.` }
      if (gesehen.has(z[schluessel] as string)) return { ok: false, fehler: `Tabelle „${TABELLEN_LABEL[t]}“: doppelter Schlüssel ${String(z[schluessel])}.` }
      gesehen.add(z[schluessel] as string)
      if (t !== 'einstellungen' && t !== 'organisationen' && typeof z.orgId !== 'string')
        return { ok: false, fehler: `Tabelle „${TABELLEN_LABEL[t]}“, Datensatz ${i + 1}: Organisation fehlt.` }
    }
    daten[t] = liste as Record<string, unknown>[]
    anzahl[t] = liste.length
  }
  if (anzahl.organisationen === 0) return { ok: false, fehler: 'Backup enthält keine Organisation.' }
  return {
    ok: true,
    anzahl,
    daten: {
      format: BACKUP_FORMAT,
      version: roh.version,
      erstelltAm: typeof roh.erstelltAm === 'string' ? roh.erstelltAm : '',
      dbVersion: typeof roh.dbVersion === 'number' ? roh.dbVersion : 1,
      app: typeof roh.app === 'string' ? roh.app : '',
      tabellen: daten,
    },
  }
}

/**
 * Ersetzt ALLE Daten durch das Backup – in einer Transaktion (alles oder nichts).
 * Die aktive Organisation wird beibehalten bzw. auf die erste Organisation gesetzt.
 */
export async function backupWiederherstellen(db: BosDb, b: BackupDatei, jetzt = new Date()): Promise<void> {
  await db.transaction('rw', TABELLEN.map((t) => db.table(t)), async () => {
    for (const t of TABELLEN) await db.table(t).clear()
    for (const t of TABELLEN) if (b.tabellen[t].length) await db.table(t).bulkAdd(b.tabellen[t])
    const aktiv = (await db.einstellungen.get(AKTIVE_ORG_KEY))?.value as string | undefined
    if (!aktiv || !(await db.organisationen.get(aktiv))) {
      const erste = (b.tabellen.organisationen[0] as { id: string }).id
      await db.einstellungen.put({ key: AKTIVE_ORG_KEY, value: erste })
    }
    // gilt als gesichert: der eingespielte Stand liegt als Datei vor
    await db.einstellungen.put({ key: LETZTES_BACKUP_KEY, value: b.erstelltAm || jetzt.toISOString() })
  })
}

export function backupDateiname(orgName: string | undefined, jetzt = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const d = `${jetzt.getFullYear()}-${p(jetzt.getMonth() + 1)}-${p(jetzt.getDate())}_${p(jetzt.getHours())}${p(jetzt.getMinutes())}`
  const org = (orgName ?? '').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '_').slice(0, 40)
  return `BOS-Drohnen-Backup_${org ? org + '_' : ''}${d}.json`
}

/** Tage seit dem letzten Backup (undefined = noch nie) */
export function tageSeit(iso: string | undefined, jetzt = new Date()): number | undefined {
  if (!iso) return undefined
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return undefined
  return Math.floor((jetzt.getTime() - t) / 86400000)
}
