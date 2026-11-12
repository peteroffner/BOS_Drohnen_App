/**
 * Zentrale Änderungserfassung (Outbox) als Dexie-DBCore-Middleware.
 *
 * Jede Schreiboperation auf eine synchronisierte Tabelle (add, put, update,
 * delete, bulk*, modify, clear …) wird – unabhängig davon, wie das
 * Feature-Modul schreibt – in derselben IndexedDB-Transaktion als
 * Outbox-Eintrag vermerkt. Dazu erweitert die Middleware jede
 * readwrite-Transaktion, die eine synchronisierte Tabelle enthält, um die
 * Tabelle `outbox`.
 *
 * Diese Datei darf `src/db/db.ts` NICHT importieren (db.ts registriert die Middleware).
 */
import type {
  DBCore,
  DBCoreIndex,
  DBCoreMutateRequest,
  DBCoreMutateResponse,
  DBCoreTable,
  DBCoreTransaction,
  Middleware,
} from 'dexie'

/** Synchronisierte Tabellen (Name = Supabase-Tabelle), in Push-Reihenfolge */
export const SYNC_TABELLEN = ['organisationen', 'piloten', 'geraete', 'einsaetze', 'wartungen', 'maengel'] as const
export type SyncTabelle = (typeof SYNC_TABELLEN)[number]

export const OUTBOX = 'outbox'

export interface OutboxEintrag {
  /** Reihenfolge (auto-increment); bleibt beim Zusammenfassen erhalten */
  seq?: number
  tabelle: SyncTabelle
  id: string
  op: 'put' | 'delete'
  /** ISO-Zeitpunkt der letzten Änderung */
  zeit: string
  /** Zähler, der bei jeder (zusammengefassten) Änderung steigt – schützt vor Rennen mit dem Push */
  rev: number
  /** Fehlgeschlagene Push-Versuche (Netzwerk/Server vorübergehend) */
  versuche: number
  status: 'offen' | 'abgelehnt'
  fehler?: string
}

const SYNC_SET = new Set<string>(SYNC_TABELLEN)
export const istSyncTabelle = (t: string): t is SyncTabelle => SYNC_SET.has(t)

// ------------------------------------------------------------------ Zustand

let erfassungAktiv = false

/** Erfassung ein-/ausschalten (nur im Cloud-Modus bei laufendem Sync aktiv). */
export function setzeErfassungAktiv(aktiv: boolean): void {
  erfassungAktiv = aktiv
}
export const istErfassungAktiv = (): boolean => erfassungAktiv

let aenderungsHoerer: (() => void) | null = null
/** Wird nach jeder erfassten Änderung aufgerufen (z. B. um einen Push einzuplanen). */
export function setzeAenderungsHoerer(fn: (() => void) | null): void {
  aenderungsHoerer = fn
}

/** IDB-Transaktionen, deren Schreibvorgänge NICHT erfasst werden (Pull, Server-Wiederherstellung …). */
const ohneErfassung = new WeakSet<object>()

/**
 * Markiert eine laufende Dexie-Transaktion als „ohne Erfassung“.
 * Aufruf innerhalb von `db.transaction(...)` mit `Dexie.currentTransaction`.
 */
export function markiereOhneErfassung(trans: { idbtrans: unknown } | null | undefined): void {
  const idb = trans?.idbtrans
  if (idb && typeof idb === 'object') ohneErfassung.add(idb)
}

// ------------------------------------------------------------------ Outbox-Schreiben (DBCore)

const RANGE_EQUAL = 1 // DBCoreRangeType.Equal

function outboxIndex(outbox: DBCoreTable): DBCoreIndex {
  const idx = outbox.schema.indexes.find((i) => i.name === '[tabelle+id]')
  if (!idx) throw new Error('outbox: Index [tabelle+id] fehlt')
  return idx
}

/**
 * Vermerkt Änderungen in der Outbox (innerhalb der übergebenen Transaktion).
 * Mehrere Änderungen am selben Datensatz werden zusammengefasst (letzter Stand zählt).
 */
export async function inOutboxVermerken(
  outbox: DBCoreTable,
  trans: DBCoreTransaction,
  tabelle: SyncTabelle,
  aenderungen: Map<string, 'put' | 'delete'>,
): Promise<void> {
  if (aenderungen.size === 0) return
  const idx = outboxIndex(outbox)
  const zeit = new Date().toISOString()
  const ids = [...aenderungen.keys()]
  const vorhandene = await Promise.all(
    ids.map((id) =>
      outbox
        .query({
          trans,
          values: true,
          limit: 1,
          query: { index: idx, range: { type: RANGE_EQUAL, lower: [tabelle, id], upper: [tabelle, id] } },
        })
        .then((r) => r.result[0] as OutboxEintrag | undefined),
    ),
  )
  const werte: OutboxEintrag[] = ids.map((id, i) => {
    const alt = vorhandene[i]
    const neu: OutboxEintrag = {
      tabelle,
      id,
      op: aenderungen.get(id)!,
      zeit,
      rev: (alt?.rev ?? 0) + 1,
      versuche: 0,
      status: 'offen',
    }
    if (alt?.seq !== undefined) neu.seq = alt.seq
    return neu
  })
  const res = await outbox.mutate({ trans, type: 'put', values: werte })
  if (res.numFailures) throw res.failures[0] ?? new Error('outbox: Schreiben fehlgeschlagen')
  aenderungsHoerer?.()
}

// ------------------------------------------------------------------ Middleware

function schluesselAusPut(req: Extract<DBCoreMutateRequest, { type: 'add' | 'put' }>, res: DBCoreMutateResponse): string[] {
  const ids: string[] = []
  req.values.forEach((v, i) => {
    if (res.failures[i]) return
    const key = (v as { id?: unknown } | null)?.id ?? req.keys?.[i] ?? res.results?.[i]
    if (typeof key === 'string') ids.push(key)
  })
  return ids
}

function erstelleMiddleware(down: DBCore): Partial<DBCore> {
  return {
    transaction(stores, mode, options) {
      if (mode === 'readwrite' && !stores.includes(OUTBOX) && stores.some(istSyncTabelle)) {
        return down.transaction([...stores, OUTBOX], mode, options)
      }
      return down.transaction(stores, mode, options)
    },
    table(name) {
      const downTable = down.table(name)
      if (!istSyncTabelle(name)) return downTable
      const tabelle = name
      return {
        ...downTable,
        async mutate(req) {
          if (!erfassungAktiv || ohneErfassung.has(req.trans)) return downTable.mutate(req)

          // Bei deleteRange (z. B. clear) vorher die betroffenen Schlüssel ermitteln
          let geloeschteKeys: string[] = []
          if (req.type === 'deleteRange') {
            const r = await downTable.query({
              trans: req.trans,
              values: false,
              query: { index: downTable.schema.primaryKey, range: req.range },
            })
            geloeschteKeys = r.result.filter((k): k is string => typeof k === 'string')
          }

          const res = await downTable.mutate(req)

          const aenderungen = new Map<string, 'put' | 'delete'>()
          if (req.type === 'add' || req.type === 'put') {
            for (const id of schluesselAusPut(req, res)) aenderungen.set(id, 'put')
          } else if (req.type === 'delete') {
            req.keys.forEach((k, i) => {
              if (!res.failures[i] && typeof k === 'string') aenderungen.set(k, 'delete')
            })
          } else {
            for (const k of geloeschteKeys) aenderungen.set(k, 'delete')
          }
          await inOutboxVermerken(down.table(OUTBOX), req.trans, tabelle, aenderungen)
          return res
        },
      }
    },
  }
}

export const erfassungsMiddleware: Middleware<DBCore> = {
  stack: 'dbcore',
  name: 'SyncOutbox',
  create: erstelleMiddleware,
}
