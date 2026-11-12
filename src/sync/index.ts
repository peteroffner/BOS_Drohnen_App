/**
 * Öffentliche API der Synchronisation (Vertrag zwischen Sync-Modul und UI).
 *
 * Offline-first: Dexie bleibt die Datenquelle der UI. Lokale Änderungen landen
 * über die Middleware in `src/sync/erfassung.ts` in der Outbox, werden per Push
 * zu Supabase gesendet; per Pull (Cursor `updated_at`) kommen Server-Änderungen
 * zurück. Design: docs/BACKEND.md, Abschnitt „Offline-Sync“.
 */
import Dexie from 'dexie'
import type { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js'
import { useSyncExternalStore } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { AKTIVE_ORG_KEY, db, jetzt } from '../db/db'
import { CLOUD, supabase } from '../lib/supabase'
import {
  SYNC_TABELLEN,
  markiereOhneErfassung,
  setzeAenderungsHoerer,
  setzeErfassungAktiv,
  type OutboxEintrag,
  type SyncTabelle,
} from './erfassung'

export { SYNC_TABELLEN, type OutboxEintrag, type SyncTabelle } from './erfassung'

export interface SyncStatus {
  online: boolean
  laeuft: boolean
  /** Anzahl lokaler Änderungen, die noch nicht beim Server sind */
  ausstehend: number
  /** ISO-Zeitpunkt des letzten erfolgreichen Syncs */
  letzterSync?: string
  fehler?: string
  /** Änderungen, die der Server abgelehnt hat (keine Berechtigung) */
  abgelehnt: number
}

// ------------------------------------------------------------------ Konfiguration

const INTERVALL_MS = 60_000
const SEITE = 1000
const PUSH_BATCH = 200
/** Pull überlappt um diese Spanne, damit spät committete Transaktionen nicht verloren gehen */
const PULL_UEBERLAPPUNG_MS = 10_000
const DEBOUNCE_REALTIME_MS = 1_500
const DEBOUNCE_AENDERUNG_MS = 2_000

const SYNC_ORG_KEY = 'sync:org'
const LETZTER_SYNC_KEY = 'sync:letzterSync'
const cursorKey = (t: SyncTabelle) => `sync:cursor:${t}`

let client: SupabaseClient | null = supabase
let cloud = CLOUD
let intervallMs = INTERVALL_MS

/**
 * Intern/Tests: Supabase-Client (z. B. Fake) und Cloud-Modus setzen.
 * Ohne Aufruf gelten `supabase` und `CLOUD` aus src/lib/supabase.ts.
 */
export function konfiguriereSync(opt: { client?: SupabaseClient | null; cloud?: boolean; intervallMs?: number }): void {
  if (opt.client !== undefined) client = opt.client
  if (opt.cloud !== undefined) cloud = opt.cloud
  if (opt.intervallMs !== undefined) intervallMs = opt.intervallMs
}

// ------------------------------------------------------------------ Status-Store

type BasisStatus = Pick<SyncStatus, 'online' | 'laeuft' | 'letzterSync' | 'fehler'>

let status: BasisStatus = { online: typeof navigator === 'undefined' ? true : navigator.onLine, laeuft: false }
const hoerer = new Set<() => void>()

function setzeStatus(p: Partial<BasisStatus>): void {
  status = { ...status, ...p }
  hoerer.forEach((h) => h())
}
function abonniere(h: () => void): () => void {
  hoerer.add(h)
  return () => hoerer.delete(h)
}
const leseStatus = () => status

// ------------------------------------------------------------------ Laufzeit-Zustand

let aktiveOrg: string | null = null
/** Wird bei stopSync/lokaleDatenLoeschen erhöht – laufende Durchläufe schreiben danach nichts mehr. */
let generation = 0
let laufend: Promise<void> | null = null
let laufendGen = -1
let nochmal = false
let fehlversuche = 0
let intervall: ReturnType<typeof setInterval> | null = null
let geplant: ReturnType<typeof setTimeout> | null = null
let kanal: RealtimeChannel | null = null
let aufraeumen: (() => void)[] = []

function planeSync(ms: number): void {
  if (!aktiveOrg) return
  if (geplant) clearTimeout(geplant)
  geplant = setTimeout(() => {
    geplant = null
    void syncJetzt()
  }, ms)
}

class TemporaerFehler extends Error {}

interface PgFehler {
  message: string
  code?: string
  details?: string | null
  hint?: string | null
}

/** Endgültige Ablehnung durch den Server (RLS, Trigger, Integrität) – alles andere gilt als vorübergehend. */
function istAblehnung(e: PgFehler): boolean {
  return /^(42501|P0\d{3}|23\d{3}|22\d{3})$/.test(e.code ?? '')
}

function fehlerText(e: PgFehler): string {
  if (e.code === '42501') return `Keine Berechtigung (${e.message})`
  return e.code ? `${e.message} [${e.code}]` : e.message
}

const tabelle = (t: SyncTabelle) => db.table(t)
type Datensatz = { id: string; orgId?: string } & Record<string, unknown>
interface ServerZeile {
  id: string
  data: Datensatz
  deleted: boolean
  updated_at: string
}

// ------------------------------------------------------------------ Start/Stop

/** Nach Login: Synchronisation für die Organisation starten (Pull, Push, Realtime, Intervall). */
export function startSync(orgId: string): void {
  if (!cloud || !client) return
  if (aktiveOrg === orgId) {
    void syncJetzt()
    return
  }
  if (aktiveOrg) stopSync()
  aktiveOrg = orgId
  setzeErfassungAktiv(true)
  setzeAenderungsHoerer(() => planeSync(DEBOUNCE_AENDERUNG_MS))

  if (typeof window !== 'undefined') {
    const online = () => {
      setzeStatus({ online: true })
      planeSync(0)
    }
    const offline = () => setzeStatus({ online: false })
    const sichtbar = () => {
      if (document.visibilityState === 'visible') planeSync(0)
    }
    window.addEventListener('online', online)
    window.addEventListener('offline', offline)
    document.addEventListener('visibilitychange', sichtbar)
    aufraeumen.push(() => {
      window.removeEventListener('online', online)
      window.removeEventListener('offline', offline)
      document.removeEventListener('visibilitychange', sichtbar)
    })
  }
  intervall = setInterval(() => void syncJetzt(), intervallMs)

  // Realtime: Server-Änderungen → (entprellter) Sync
  try {
    let ch = client.channel(`sync:${orgId}`)
    for (const t of SYNC_TABELLEN) {
      ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: t, filter: `org_id=eq.${orgId}` }, () =>
        planeSync(DEBOUNCE_REALTIME_MS),
      )
    }
    kanal = ch.subscribe()
  } catch (e) {
    console.warn('Sync: Realtime nicht verfügbar', e)
  }

  void db.einstellungen
    .get(LETZTER_SYNC_KEY)
    .then((e) => {
      if (typeof e?.value === 'string' && !status.letzterSync) setzeStatus({ letzterSync: e.value })
    })
    .catch(() => {})
  void syncJetzt()
}

/** Beim Abmelden: alle Timer/Realtime-Kanäle beenden. */
export function stopSync(): void {
  generation++
  setzeErfassungAktiv(false)
  setzeAenderungsHoerer(null)
  if (intervall) clearInterval(intervall)
  if (geplant) clearTimeout(geplant)
  intervall = geplant = null
  aufraeumen.forEach((f) => f())
  aufraeumen = []
  if (kanal && client) void client.removeChannel(kanal).catch(() => {})
  kanal = null
  aktiveOrg = null
  nochmal = false
  fehlversuche = 0
  setzeStatus({ laeuft: false, fehler: undefined })
}

/** Sofort synchronisieren (Push, dann Pull). Es läuft immer nur ein Sync gleichzeitig. */
export async function syncJetzt(): Promise<void> {
  if (!cloud || !client || !aktiveOrg) return
  if (laufend) {
    if (laufendGen === generation) {
      nochmal = true
      return laufend
    }
    // Durchlauf einer beendeten Sitzung (stopSync) – abwarten, dann neu starten
    await laufend.catch(() => {})
    return syncJetzt()
  }
  const gen = generation
  laufendGen = gen
  laufend = (async () => {
    do {
      nochmal = false
      await durchlauf(gen)
    } while (nochmal && gen === generation)
  })().finally(() => {
    laufend = null
  })
  return laufend
}

async function durchlauf(gen: number): Promise<void> {
  const org = aktiveOrg
  if (!org || gen !== generation) return
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setzeStatus({ online: false })
    return
  }
  setzeStatus({ laeuft: true, online: true })
  try {
    await push(gen)
    await pull(org, gen)
    if (gen !== generation) return
    const t = jetzt()
    await db.einstellungen.put({ key: LETZTER_SYNC_KEY, value: t })
    fehlversuche = 0
    setzeStatus({ letzterSync: t, fehler: undefined })
  } catch (e) {
    if (gen !== generation) return
    fehlversuche++
    const text = e instanceof Error ? e.message : String(e)
    setzeStatus({ fehler: text || 'Synchronisation fehlgeschlagen' })
    // Backoff: 2 s, 4 s, 8 s … max. 60 s (zusätzlich zum Intervall)
    planeSync(Math.min(60_000, 2_000 * 2 ** (fehlversuche - 1)))
  } finally {
    setzeStatus({ laeuft: false })
  }
}

// ------------------------------------------------------------------ Push

async function push(gen: number): Promise<void> {
  const offen = await db.outbox.where('status').equals('offen').sortBy('seq')
  for (const t of SYNC_TABELLEN) {
    if (gen !== generation) return
    const eintraege = offen.filter((e) => e.tabelle === t)
    if (!eintraege.length) continue
    for (let i = 0; i < eintraege.length; i += PUSH_BATCH) {
      const chunk = eintraege.slice(i, i + PUSH_BATCH)
      const datensaetze = (await tabelle(t).bulkGet(chunk.map((e) => e.id))) as (Datensatz | undefined)[]
      const puts: { e: OutboxEintrag; d: Datensatz }[] = []
      const deletes: OutboxEintrag[] = []
      chunk.forEach((e, j) => {
        const d = datensaetze[j]
        if (e.op === 'put' && d) puts.push({ e, d })
        else deletes.push(e) // op delete oder Datensatz lokal nicht mehr vorhanden
      })
      await pushPuts(t, puts)
      await pushDeletes(t, deletes)
    }
  }
}

const zeile = (t: SyncTabelle, d: Datensatz) => ({
  id: d.id,
  org_id: t === 'organisationen' ? d.id : d.orgId,
  data: d,
  deleted: false,
})

async function pushPuts(t: SyncTabelle, puts: { e: OutboxEintrag; d: Datensatz }[]): Promise<void> {
  if (!puts.length) return
  const c = client!
  const { error } = await c.from(t).upsert(
    puts.map((p) => zeile(t, p.d)),
    { onConflict: 'id' },
  )
  if (!error) return erledigt(puts.map((p) => p.e))
  if (!istAblehnung(error)) return temporaer(puts.map((p) => p.e), error)
  // Mindestens ein Datensatz abgelehnt → einzeln senden, um ihn zu finden
  for (const p of puts) {
    const r = await c.from(t).upsert([zeile(t, p.d)], { onConflict: 'id' })
    if (!r.error) await erledigt([p.e])
    else if (istAblehnung(r.error)) await ablehnen(t, p.e, fehlerText(r.error))
    else return temporaer([p.e], r.error)
  }
}

async function pushDeletes(t: SyncTabelle, eintraege: OutboxEintrag[]): Promise<void> {
  if (!eintraege.length) return
  const c = client!
  const ids = eintraege.map((e) => e.id)
  const { data, error } = await c.from(t).update({ deleted: true }).in('id', ids).select('id')
  if (error) {
    if (!istAblehnung(error)) return temporaer(eintraege, error)
    if (eintraege.length > 1) {
      for (const e of eintraege) await pushDeletes(t, [e])
      return
    }
    return ablehnen(t, eintraege[0], fehlerText(error))
  }
  // RLS verweigert UPDATE stillschweigend (0 Zeilen) → prüfen, ob die Zeile am Server noch lebt
  const getroffen = new Set(((data ?? []) as { id: string }[]).map((r) => r.id))
  const rest = eintraege.filter((e) => !getroffen.has(e.id))
  const ok = eintraege.filter((e) => getroffen.has(e.id))
  if (rest.length) {
    const r = await c.from(t).select('id, data, deleted, updated_at').in('id', rest.map((e) => e.id))
    if (r.error) {
      await erledigt(ok)
      return temporaer(rest, r.error)
    }
    const lebend = new Map(((r.data ?? []) as ServerZeile[]).filter((z) => !z.deleted).map((z) => [z.id, z]))
    for (const e of rest) {
      const z = lebend.get(e.id)
      if (z) await ablehnen(t, e, 'Keine Berechtigung zum Löschen', z)
      else ok.push(e) // nie am Server gewesen oder bereits gelöscht
    }
  }
  await erledigt(ok)
}

/** Erfolgreich gesendete Einträge entfernen – nur, wenn sie seither nicht erneut geändert wurden. */
async function erledigt(eintraege: OutboxEintrag[]): Promise<void> {
  if (!eintraege.length) return
  await db.transaction('rw', db.outbox, async () => {
    const aktuell = await db.outbox.bulkGet(eintraege.map((e) => e.seq!))
    const weg = eintraege.filter((e, i) => aktuell[i] && aktuell[i]!.rev === e.rev).map((e) => e.seq!)
    await db.outbox.bulkDelete(weg)
  })
}

async function temporaer(eintraege: OutboxEintrag[], e: PgFehler): Promise<never> {
  await db.transaction('rw', db.outbox, async () => {
    for (const x of eintraege) {
      const a = await db.outbox.get(x.seq!)
      if (a && a.rev === x.rev) await db.outbox.update(x.seq!, { versuche: a.versuche + 1, fehler: fehlerText(e) })
    }
  })
  throw new TemporaerFehler(e.message ? `Server nicht erreichbar: ${e.message}` : 'Server nicht erreichbar')
}

/** Server hat abgelehnt: Eintrag markieren, Server-Stand lokal wiederherstellen (Server gewinnt). */
async function ablehnen(t: SyncTabelle, e: OutboxEintrag, text: string, server?: ServerZeile): Promise<void> {
  let z: ServerZeile | undefined | null = server
  if (!z) {
    const r = await client!.from(t).select('id, data, deleted, updated_at').in('id', [e.id])
    z = r.error ? null : (((r.data ?? []) as ServerZeile[])[0] ?? undefined)
  }
  await db.transaction('rw', tabelle(t), db.outbox, async () => {
    markiereOhneErfassung(Dexie.currentTransaction)
    const a = await db.outbox.get(e.seq!)
    if (!a || a.rev !== e.rev) return // inzwischen erneut geändert → nächster Push
    await db.outbox.update(e.seq!, { status: 'abgelehnt', fehler: text })
    if (z === null) return // Server-Stand nicht abrufbar – lokal belassen
    if (z && !z.deleted) await tabelle(t).put({ ...z.data, id: z.id })
    else await tabelle(t).delete(e.id)
  })
}

// ------------------------------------------------------------------ Pull

function mitUeberlappung(cursor: string): string {
  const ms = Date.parse(cursor)
  return Number.isNaN(ms) ? cursor : new Date(ms - PULL_UEBERLAPPUNG_MS).toISOString()
}

async function pull(org: string, gen: number): Promise<void> {
  const gespeichert = (await db.einstellungen.get(SYNC_ORG_KEY))?.value
  if (gespeichert !== org) {
    // andere Organisation → Vollabzug
    await db.einstellungen.bulkDelete(SYNC_TABELLEN.map(cursorKey))
    await db.einstellungen.put({ key: SYNC_ORG_KEY, value: org })
  }
  for (const t of SYNC_TABELLEN) {
    if (gen !== generation) return
    await pullTabelle(t, org, gen)
  }
}

async function pullTabelle(t: SyncTabelle, org: string, gen: number): Promise<void> {
  const cursor = (await db.einstellungen.get(cursorKey(t)))?.value as string | undefined
  let letzte: ServerZeile | undefined
  for (;;) {
    let q = client!.from(t).select('id, data, deleted, updated_at').eq('org_id', org)
    if (letzte) {
      // Keyset-Paginierung (updated_at, id) – robust gegen gleichzeitige Änderungen
      q = q.or(`updated_at.gt."${letzte.updated_at}",and(updated_at.eq."${letzte.updated_at}",id.gt.${letzte.id})`)
    } else if (cursor) {
      q = q.gte('updated_at', mitUeberlappung(cursor))
    }
    const { data, error } = await q.order('updated_at', { ascending: true }).order('id', { ascending: true }).limit(SEITE)
    if (error) throw new TemporaerFehler(`Abruf ${t} fehlgeschlagen: ${error.message}`)
    const zeilen = (data ?? []) as ServerZeile[]
    if (gen !== generation) return
    if (zeilen.length) await anwenden(t, zeilen, gen)
    if (zeilen.length < SEITE) return
    letzte = zeilen[zeilen.length - 1]
  }
}

/** Server-Zeilen lokal schreiben – ohne Outbox; Datensätze mit offener lokaler Änderung bleiben. */
async function anwenden(t: SyncTabelle, zeilen: ServerZeile[], gen: number): Promise<void> {
  await db.transaction('rw', tabelle(t), db.outbox, db.einstellungen, async () => {
    markiereOhneErfassung(Dexie.currentTransaction)
    if (gen !== generation) return
    const offen = await db.outbox
      .where('[tabelle+id]')
      .anyOf(zeilen.map((z) => [t, z.id]))
      .filter((e) => e.status === 'offen')
      .toArray()
    const lokalGeaendert = new Set(offen.map((e) => e.id))
    const puts: Datensatz[] = []
    const loeschen: string[] = []
    for (const z of zeilen) {
      if (lokalGeaendert.has(z.id)) continue
      if (z.deleted) loeschen.push(z.id)
      else puts.push({ ...z.data, id: z.id })
    }
    if (puts.length) await tabelle(t).bulkPut(puts)
    if (loeschen.length) await tabelle(t).bulkDelete(loeschen)
    const max = zeilen[zeilen.length - 1].updated_at
    const alt = (await db.einstellungen.get(cursorKey(t)))?.value as string | undefined
    if (!alt || alt < max) await db.einstellungen.put({ key: cursorKey(t), value: max })
  })
}

// ------------------------------------------------------------------ UI-Status

const OHNE_ZAEHLER = { ausstehend: 0, abgelehnt: 0 }

export function useSyncStatus(): SyncStatus {
  const basis = useSyncExternalStore(abonniere, leseStatus, leseStatus)
  const zaehler =
    useLiveQuery(
      async () => ({
        ausstehend: await db.outbox.where('status').equals('offen').count(),
        abgelehnt: await db.outbox.where('status').equals('abgelehnt').count(),
      }),
      [],
    ) ?? OHNE_ZAEHLER
  return { ...basis, ...zaehler }
}

/** Abgelehnte Änderungen (live) – für die Detailanzeige */
export function useAbgelehnteAenderungen(): OutboxEintrag[] {
  return useLiveQuery(() => db.outbox.where('status').equals('abgelehnt').sortBy('seq'), []) ?? []
}

/** Abgelehnte Änderung verwerfen (der Server-Stand ist bereits lokal wiederhergestellt). */
export async function abgelehnteVerwerfen(seq: number): Promise<void> {
  await db.transaction('rw', db.outbox, async () => {
    const e = await db.outbox.get(seq)
    if (e?.status === 'abgelehnt') await db.outbox.delete(seq)
  })
}

export async function ausstehendeAenderungen(): Promise<number> {
  return db.outbox.where('status').equals('offen').count()
}

// ------------------------------------------------------------------ Lokale Daten

const ALLE_TABELLEN = () => [...SYNC_TABELLEN.map(tabelle), db.outbox, db.einstellungen]

/**
 * Löscht alle lokalen Fachdaten, Outbox und Sync-Cursor (z. B. beim Abmelden).
 * Beendet auch einen laufenden Sync (stopSync) und entfernt `aktiveOrgId`.
 */
export async function lokaleDatenLoeschen(): Promise<void> {
  stopSync()
  await laufend?.catch(() => {})
  await db.transaction('rw', ALLE_TABELLEN(), async () => {
    markiereOhneErfassung(Dexie.currentTransaction)
    for (const t of SYNC_TABELLEN) await tabelle(t).clear()
    await db.outbox.clear()
    const keys = (await db.einstellungen.toCollection().primaryKeys()) as string[]
    await db.einstellungen.bulkDelete(keys.filter((k) => k.startsWith('sync:') || k === AKTIVE_ORG_KEY))
  })
  setzeStatus({ letzterSync: undefined, fehler: undefined })
}

/** Outbox-Eintrag (put) für Datensätze anlegen bzw. zusammenfassen – innerhalb einer Transaktion mit `outbox`. */
async function vormerken(t: SyncTabelle, ids: string[]): Promise<void> {
  const zeit = jetzt()
  for (const id of ids) {
    const alt = await db.outbox.where('[tabelle+id]').equals([t, id]).first()
    const neu: OutboxEintrag = { tabelle: t, id, op: 'put', zeit, rev: (alt?.rev ?? 0) + 1, versuche: 0, status: 'offen' }
    if (alt?.seq !== undefined) neu.seq = alt.seq
    await db.outbox.put(neu)
  }
}

/**
 * Übernimmt lokal vorhandene Phase-1-Daten in die neue Cloud-Organisation:
 * orgId aller Datensätze umschreiben und alles zum Hochladen vormerken.
 * Die Organisation selbst wird NICHT hochgeladen (der Server hat sie per RPC
 * angelegt); lokal wird sie bis zum nächsten Pull unter der neuen ID weitergeführt.
 */
export async function lokaleDatenUebernehmen(neueOrgId: string): Promise<void> {
  await db.transaction('rw', ALLE_TABELLEN(), async () => {
    markiereOhneErfassung(Dexie.currentTransaction)
    const altOrgId = (await db.einstellungen.get(AKTIVE_ORG_KEY))?.value as string | undefined
    const gehoertZurAltenOrg = (d: Datensatz) => (altOrgId ? d.orgId === altOrgId : d.orgId !== neueOrgId)

    for (const t of SYNC_TABELLEN) {
      if (t === 'organisationen') continue
      const alle = (await tabelle(t).toArray()) as Datensatz[]
      const betroffen = alle.filter(gehoertZurAltenOrg).map((d) => ({ ...d, orgId: neueOrgId }))
      if (!betroffen.length) continue
      await tabelle(t).bulkPut(betroffen)
      await vormerken(
        t,
        betroffen.map((d) => d.id),
      )
    }

    if (altOrgId && altOrgId !== neueOrgId) {
      const alteOrg = (await db.organisationen.get(altOrgId)) as Datensatz | undefined
      if (alteOrg && !(await db.organisationen.get(neueOrgId))) {
        await tabelle('organisationen').put({ ...alteOrg, id: neueOrgId })
      }
      await db.organisationen.delete(altOrgId)
      await db.outbox.where('[tabelle+id]').equals(['organisationen', altOrgId]).delete()
    }
    await db.einstellungen.put({ key: AKTIVE_ORG_KEY, value: neueOrgId })
  })
  planeSync(0)
}

/** Nur für Tests: einzelne Sync-Schritte direkt ausführen. */
export const __test = {
  push: () => push(generation),
  pull: (org: string) => pull(org, generation),
}
