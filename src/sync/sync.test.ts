import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AKTIVE_ORG_KEY, db } from '../db/db'
import type { Geraet, Mangel, Organisation, Pilot } from '../db/types'
import { setzeErfassungAktiv } from './erfassung'
import {
  __test,
  ausstehendeAenderungen,
  konfiguriereSync,
  lokaleDatenLoeschen,
  lokaleDatenUebernehmen,
  startSync,
  stopSync,
  syncJetzt,
} from './index'

// ------------------------------------------------------------------ Fake-Supabase

interface Zeile {
  id: string
  org_id: string
  data: Record<string, unknown>
  deleted: boolean
  updated_at: string
}
interface Fehler {
  message: string
  code: string
}
type Regel = (tabelle: string, zeile: Partial<Zeile> & { id: string }, op: 'upsert' | 'update') => Fehler | null

interface Aufruf {
  tabelle: string
  op: string
  gte?: string
  or?: string
}

class FakeServer {
  tabellen = new Map<string, Map<string, Zeile>>()
  private uhr = 0
  offline = false
  /** Anfragen ohne gültige Sitzung (nur anon-Key): PostgREST antwortet 401 / 42501 */
  ohneSitzung = false
  regel: Regel | null = null
  aufrufe: Aufruf[] = []
  beimUpsert: (() => Promise<void>) | null = null

  tab(t: string) {
    let m = this.tabellen.get(t)
    if (!m) this.tabellen.set(t, (m = new Map()))
    return m
  }
  zeit() {
    this.uhr++
    const s = String(this.uhr).padStart(6, '0')
    return `2026-11-12T10:00:00.${s}+00:00`
  }
  /** Direkt am Server (z. B. anderes Gerät) schreiben */
  setze(t: string, data: { id: string; orgId?: string } & Record<string, unknown>, deleted = false) {
    this.tab(t).set(data.id, { id: data.id, org_id: t === 'organisationen' ? data.id : data.orgId!, data, deleted, updated_at: this.zeit() })
  }

  client(): SupabaseClient {
    const fake = {
      from: (t: string) => new Abfrage(this, t),
      channel: () => {
        const ch = { on: () => ch, subscribe: () => ch }
        return ch
      },
      removeChannel: async () => 'ok',
    }
    return fake as unknown as SupabaseClient
  }
}

class Abfrage {
  private op: 'select' | 'upsert' | 'update' = 'select'
  private payload: unknown
  private filter: ((z: Zeile) => boolean)[] = []
  private mitRueckgabe = false
  private grenze = Infinity
  private aufruf: Aufruf
  private server: FakeServer
  private t: string
  constructor(server: FakeServer, t: string) {
    this.server = server
    this.t = t
    this.aufruf = { tabelle: t, op: 'select' }
    server.aufrufe.push(this.aufruf)
  }
  select() {
    if (this.op === 'update') this.mitRueckgabe = true
    return this
  }
  upsert(rows: Zeile[]) {
    this.op = 'upsert'
    this.aufruf.op = 'upsert'
    this.payload = rows
    return this
  }
  update(p: Partial<Zeile>) {
    this.op = 'update'
    this.aufruf.op = 'update'
    this.payload = p
    return this
  }
  eq(col: keyof Zeile, v: unknown) {
    this.filter.push((z) => z[col] === v)
    return this
  }
  gte(col: keyof Zeile, v: string) {
    this.aufruf.gte = v
    this.filter.push((z) => Date.parse(String(z[col])) >= Date.parse(v) || String(z[col]) >= v)
    return this
  }
  in(col: keyof Zeile, vs: unknown[]) {
    this.filter.push((z) => vs.includes(z[col]))
    return this
  }
  or(s: string) {
    this.aufruf.or = s
    const m = /^updated_at\.gt\."(.+?)",and\(updated_at\.eq\."(.+?)",id\.gt\.(.+)\)$/.exec(s)
    if (!m) throw new Error('unbekannter or-Filter ' + s)
    const [, u, , id] = m
    this.filter.push((z) => z.updated_at > u || (z.updated_at === u && z.id > id))
    return this
  }
  order() {
    return this
  }
  limit(n: number) {
    this.grenze = n
    return this
  }
  then<A, B>(ok?: (v: { data: unknown; error: Fehler | null; status?: number }) => A, fail?: (e: unknown) => B) {
    return this.ausfuehren().then(ok, fail)
  }
  private async ausfuehren(): Promise<{ data: unknown; error: Fehler | null; status?: number }> {
    const s = this.server
    if (s.offline) return { data: null, error: { message: 'TypeError: Failed to fetch', code: '' } }
    if (s.ohneSitzung) return { data: null, error: { message: `permission denied for table ${this.t}`, code: '42501' }, status: 401 }
    const tab = s.tab(this.t)
    if (this.op === 'upsert') {
      const rows = this.payload as Zeile[]
      for (const r of rows) {
        const f = s.regel?.(this.t, r, 'upsert')
        if (f) return { data: null, error: f }
      }
      if (s.beimUpsert) await s.beimUpsert()
      for (const r of rows) tab.set(r.id, { ...r, data: structuredClone(r.data), updated_at: s.zeit() })
      return { data: null, error: null }
    }
    const treffer = [...tab.values()].filter((z) => this.filter.every((f) => f(z)))
    if (this.op === 'update') {
      const geaendert: Zeile[] = []
      for (const z of treffer) {
        const f = s.regel?.(this.t, z, 'update')
        if (f?.code === '42501') continue // RLS: stillschweigend nicht sichtbar
        if (f) return { data: null, error: f }
        geaendert.push(z)
      }
      for (const z of geaendert) Object.assign(z, this.payload, { updated_at: s.zeit() })
      return { data: this.mitRueckgabe ? geaendert.map((z) => ({ id: z.id })) : null, error: null }
    }
    treffer.sort((a, b) => (a.updated_at < b.updated_at ? -1 : a.updated_at > b.updated_at ? 1 : a.id < b.id ? -1 : 1))
    return { data: treffer.slice(0, this.grenze).map((z) => structuredClone(z)), error: null }
  }
}

// ------------------------------------------------------------------ Testdaten

const ORG = 'org-1'
const org = (id = ORG): Organisation => ({
  id,
  name: 'FF Test',
  typ: 'FF',
  freigabeRegeln: { pflichtQualifikationen: [], mindestFluege: 0, zeitraumTage: 90, warnungTageVorAblauf: 30 },
  erstelltAm: '2026-01-01',
})
const pilot = (id: string, nachname = 'Muster', orgId = ORG): Pilot => ({
  id,
  orgId,
  vorname: 'Max',
  nachname,
  qualifikationen: [],
  freigabe: { erteilt: false },
  aktiv: true,
  erstelltAm: '2026-01-01',
})
const geraet = (id: string, name = 'Hornisse 1', orgId = ORG): Geraet => ({
  id,
  orgId,
  name,
  hersteller: 'DJI',
  modell: 'M30T',
  status: 'einsatzbereit',
  akkus: [],
  erstelltAm: '2026-01-01',
})
const mangel = (id: string, orgId = ORG): Mangel => ({
  id,
  orgId,
  geraetId: 'g1',
  erstelltAm: '2026-01-01',
  quelle: 'manuell',
  beschreibung: 'Propeller',
})

const outbox = () => db.outbox.orderBy('seq').toArray()

let server: FakeServer

beforeEach(async () => {
  await lokaleDatenLoeschen()
  server = new FakeServer()
  konfiguriereSync({ client: server.client(), cloud: true, intervallMs: 3_600_000 })
})

afterEach(() => {
  stopSync()
  setzeErfassungAktiv(false)
})

// ------------------------------------------------------------------ Erfassung

describe('Änderungserfassung (Outbox)', () => {
  it('lokaler Modus erzeugt keine Outbox-Einträge', async () => {
    konfiguriereSync({ cloud: false })
    startSync(ORG)
    await db.piloten.add(pilot('p1'))
    await db.piloten.update('p1', { nachname: 'Neu' })
    await db.piloten.delete('p1')
    expect(await db.outbox.count()).toBe(0)
    expect(server.aufrufe).toHaveLength(0)
  })

  it('erfasst add/put/update/delete/bulkPut/modify – auch in Transaktionen ohne outbox', async () => {
    setzeErfassungAktiv(true)
    await db.piloten.add(pilot('p1'))
    await db.geraete.put(geraet('g1'))
    await db.piloten.update('p1', { nachname: 'Neu' })
    await db.maengel.bulkPut([mangel('m1'), mangel('m2')])
    await db.transaction('rw', db.geraete, db.wartungen, async () => {
      await db.geraete.put(geraet('g2'))
      await db.geraete.delete('g1')
    })
    await db.maengel.where('orgId').equals(ORG).modify({ behobenAm: '2026-11-12' })
    await db.einstellungen.put({ key: 'egal', value: 1 }) // nicht synchronisiert

    const e = await outbox()
    expect(e.map((x) => `${x.tabelle}:${x.id}:${x.op}`)).toEqual([
      'piloten:p1:put',
      'geraete:g1:delete',
      'maengel:m1:put',
      'maengel:m2:put',
      'geraete:g2:put',
    ])
    expect(e.every((x) => x.status === 'offen' && x.versuche === 0)).toBe(true)
    expect(await ausstehendeAenderungen()).toBe(5)
  })

  it('fasst mehrere Änderungen am selben Datensatz zusammen', async () => {
    setzeErfassungAktiv(true)
    await db.piloten.add(pilot('p1'))
    await db.piloten.add(pilot('p2'))
    await db.piloten.update('p1', { nachname: 'A' })
    await db.piloten.update('p1', { nachname: 'B' })
    let e = await outbox()
    expect(e).toHaveLength(2)
    expect(e[0]).toMatchObject({ id: 'p1', op: 'put', rev: 3 })
    const seq = e[0].seq
    await db.piloten.delete('p1')
    e = await outbox()
    expect(e).toHaveLength(2)
    expect(e[0]).toMatchObject({ id: 'p1', op: 'delete', seq })
  })

  it('clear (Backup-Wiederherstellung) wird als Löschen aller Datensätze erfasst', async () => {
    await db.geraete.bulkAdd([geraet('g1'), geraet('g2')])
    setzeErfassungAktiv(true)
    await db.transaction('rw', db.geraete, async () => {
      await db.geraete.clear()
      await db.geraete.add(geraet('g2', 'neu'))
    })
    const e = await outbox()
    expect(e.map((x) => `${x.id}:${x.op}`).sort()).toEqual(['g1:delete', 'g2:put'])
  })

  it('Rollback einer Transaktion verwirft auch den Outbox-Eintrag', async () => {
    setzeErfassungAktiv(true)
    await expect(
      db.transaction('rw', db.piloten, async () => {
        await db.piloten.add(pilot('p1'))
        throw new Error('abbrechen')
      }),
    ).rejects.toThrow('abbrechen')
    expect(await db.outbox.count()).toBe(0)
  })
})

// ------------------------------------------------------------------ Push

describe('Push', () => {
  it('sendet Outbox per upsert/Grabstein und leert sie bei Erfolg', async () => {
    server.setze('organisationen', { ...org() })
    server.setze('geraete', { ...geraet('g9') })
    await db.geraete.add(geraet('g9'))
    setzeErfassungAktiv(true)
    await db.piloten.add(pilot('p1'))
    await db.organisationen.put(org())
    await db.geraete.delete('g9')

    startSync(ORG)
    await syncJetzt()

    expect(await db.outbox.count()).toBe(0)
    const p = server.tab('piloten').get('p1')!
    expect(p).toMatchObject({ id: 'p1', org_id: ORG, deleted: false })
    expect(p.data).toMatchObject({ nachname: 'Muster' })
    expect(server.tab('organisationen').get(ORG)).toMatchObject({ org_id: ORG, deleted: false })
    expect(server.tab('geraete').get('g9')!.deleted).toBe(true)
    // Pull nach Push erzeugt keine neuen Outbox-Einträge
    expect(await db.outbox.count()).toBe(0)
    expect(await db.piloten.get('p1')).toBeTruthy()
  })

  it('Netzwerkfehler: Einträge bleiben offen, Versuche werden gezählt', async () => {
    setzeErfassungAktiv(true)
    await db.piloten.add(pilot('p1'))
    server.offline = true
    await expect(__test.push()).rejects.toThrow(/nicht erreichbar/)
    const [e] = await outbox()
    expect(e).toMatchObject({ status: 'offen', versuche: 1 })
  })

  it('ohne gültige Sitzung (HTTP 401/42501): Einträge bleiben offen, nichts wird verworfen', async () => {
    server.setze('piloten', { ...pilot('p1', 'Server') })
    await db.piloten.add(pilot('p1', 'Server'))
    setzeErfassungAktiv(true)
    await db.piloten.update('p1', { nachname: 'Lokal' })
    await db.piloten.delete('p1')
    await db.geraete.add(geraet('g1'))
    server.ohneSitzung = true
    await expect(__test.push()).rejects.toThrow(/nicht erreichbar/)
    expect((await outbox()).every((e) => e.status === 'offen')).toBe(true)
    expect(await ausstehendeAenderungen()).toBe(2)
    // nach erneuter Anmeldung kommt alles an
    server.ohneSitzung = false
    await __test.push()
    await __test.push()
    expect(await ausstehendeAenderungen()).toBe(0)
    expect(server.tab('piloten').get('p1')!.deleted).toBe(true)
    expect(server.tab('geraete').get('g1')).toBeTruthy()
  })

  it('Ablehnung (RLS 42501): Eintrag abgelehnt, Server-Stand wird lokal wiederhergestellt', async () => {
    server.setze('piloten', { ...pilot('p1', 'Server') })
    await db.piloten.add(pilot('p1', 'Server'))
    server.regel = (t, z) =>
      t === 'piloten' && (z.data as { nachname?: string } | undefined)?.nachname === 'Verboten'
        ? { message: 'new row violates row-level security policy', code: '42501' }
        : null
    setzeErfassungAktiv(true)
    await db.piloten.update('p1', { nachname: 'Verboten' })
    await db.piloten.add(pilot('p2', 'Verboten')) // neu, am Server unbekannt
    await db.piloten.add(pilot('p3', 'Erlaubt'))

    await __test.push()

    const e = await outbox()
    expect(e).toHaveLength(2)
    expect(e.every((x) => x.status === 'abgelehnt' && /Berechtigung/.test(x.fehler ?? ''))).toBe(true)
    expect((await db.piloten.get('p1'))!.nachname).toBe('Server')
    expect(await db.piloten.get('p2')).toBeUndefined()
    expect(server.tab('piloten').get('p3')).toBeTruthy()
    expect(await ausstehendeAenderungen()).toBe(0)
  })

  it('Ablehnung durch Trigger (P0001) beim Löschen: Datensatz kommt zurück', async () => {
    server.setze('einsaetze', { id: 'e1', orgId: ORG, status: 'abgeschlossen' })
    await db.einsaetze.put({ id: 'e1', orgId: ORG, status: 'abgeschlossen' } as never)
    server.regel = (t, _z, op) => (t === 'einsaetze' && op === 'update' ? { message: 'Abgeschlossene Einsätze dürfen nicht gelöscht werden', code: 'P0001' } : null)
    setzeErfassungAktiv(true)
    await db.einsaetze.delete('e1')
    await __test.push()
    const [e] = await outbox()
    expect(e).toMatchObject({ status: 'abgelehnt', op: 'delete' })
    expect(e.fehler).toMatch(/nicht gelöscht/)
    expect(await db.einsaetze.get('e1')).toBeTruthy()
  })

  it('stillschweigend verweigertes Löschen (RLS ohne Fehler) wird als abgelehnt erkannt', async () => {
    server.setze('geraete', { ...geraet('g1') })
    await db.geraete.put(geraet('g1'))
    server.regel = (t, _z, op) => (t === 'geraete' && op === 'update' ? { message: 'rls', code: '42501' } : null)
    setzeErfassungAktiv(true)
    await db.geraete.delete('g1')
    await __test.push()
    const [e] = await outbox()
    expect(e.status).toBe('abgelehnt')
    expect(await db.geraete.get('g1')).toBeTruthy()
  })
})

// ------------------------------------------------------------------ Pull

describe('Pull', () => {
  it('Vollabzug, gelöschte Datensätze werden lokal entfernt, keine Outbox', async () => {
    setzeErfassungAktiv(true)
    server.setze('organisationen', { ...org() })
    server.setze('piloten', { ...pilot('p1') })
    server.setze('geraete', { ...geraet('g1') })
    server.setze('geraete', { ...geraet('g2', 'x', 'andere-org') }) // fremde Organisation
    await __test.pull(ORG)
    expect(await db.piloten.get('p1')).toBeTruthy()
    expect(await db.geraete.get('g1')).toBeTruthy()
    expect(await db.geraete.get('g2')).toBeUndefined()
    expect(await db.organisationen.get(ORG)).toBeTruthy()
    expect(await db.outbox.count()).toBe(0)

    server.setze('geraete', { ...geraet('g1') }, true) // am Server gelöscht
    await __test.pull(ORG)
    expect(await db.geraete.get('g1')).toBeUndefined()
    expect(await db.outbox.count()).toBe(0)
  })

  it('überspringt Datensätze mit offenem Outbox-Eintrag', async () => {
    server.setze('piloten', { ...pilot('p1', 'Server') })
    server.setze('piloten', { ...pilot('p2', 'Server') })
    setzeErfassungAktiv(true)
    await db.piloten.put(pilot('p1', 'Lokal'))
    await __test.pull(ORG)
    expect((await db.piloten.get('p1'))!.nachname).toBe('Lokal')
    expect((await db.piloten.get('p2'))!.nachname).toBe('Server')
    expect(await ausstehendeAenderungen()).toBe(1)
  })

  it('lokale Änderung während des Push bleibt erhalten (Rennen Push/Pull)', async () => {
    setzeErfassungAktiv(true)
    await db.piloten.put(pilot('p1', 'Erste'))
    server.beimUpsert = async () => {
      server.beimUpsert = null
      await db.piloten.update('p1', { nachname: 'Zweite' })
    }
    startSync(ORG)
    await syncJetzt()
    expect((await db.piloten.get('p1'))!.nachname).toBe('Zweite')
    // beim nächsten Push geht der neue Stand hinaus
    await syncJetzt()
    expect(server.tab('piloten').get('p1')!.data).toMatchObject({ nachname: 'Zweite' })
    expect(await db.outbox.count()).toBe(0)
  })

  it('Cursor schreitet fort, Paginierung über 1000 Zeilen', async () => {
    for (let i = 0; i < 1500; i++) server.setze('geraete', { ...geraet(`g${String(i).padStart(4, '0')}`) })
    await __test.pull(ORG)
    expect(await db.geraete.count()).toBe(1500)
    const cursor = (await db.einstellungen.get('sync:cursor:geraete'))!.value as string
    const maxServer = [...server.tab('geraete').values()].map((z) => z.updated_at).sort().at(-1)
    expect(cursor).toBe(maxServer)
    const seiten = server.aufrufe.filter((a) => a.tabelle === 'geraete' && a.op === 'select')
    expect(seiten).toHaveLength(2)
    expect(seiten[1].or).toContain('updated_at.gt.')

    server.aufrufe = []
    server.setze('geraete', { ...geraet('neu') })
    await __test.pull(ORG)
    expect(await db.geraete.get('neu')).toBeTruthy()
    const abruf = server.aufrufe.find((a) => a.tabelle === 'geraete' && a.op === 'select')!
    expect(abruf.gte).toBeDefined()
    expect(Date.parse(abruf.gte!)).toBeLessThanOrEqual(Date.parse(cursor))
    expect(Date.parse(abruf.gte!)).toBeGreaterThan(Date.parse(cursor) - 60_000)
    const neuerCursor = (await db.einstellungen.get('sync:cursor:geraete'))!.value as string
    expect(neuerCursor > cursor).toBe(true)
  })

  it('Organisationswechsel setzt den Cursor zurück (Vollabzug)', async () => {
    server.setze('piloten', { ...pilot('p1') })
    await __test.pull(ORG)
    server.setze('piloten', { ...pilot('p2', 'B', 'org-2') })
    await __test.pull('org-2')
    expect(server.aufrufe.filter((a) => a.tabelle === 'piloten' && a.op === 'select').at(-1)!.gte).toBeUndefined()
    expect(await db.piloten.get('p2')).toBeTruthy()
  })
})

// ------------------------------------------------------------------ Lokale Daten

describe('Lokale Daten', () => {
  it('lokaleDatenUebernehmen: orgId umschreiben, alles außer Organisation in die Outbox', async () => {
    await db.organisationen.put(org('lokal'))
    await db.einstellungen.put({ key: AKTIVE_ORG_KEY, value: 'lokal' })
    await db.piloten.bulkAdd([pilot('p1', 'A', 'lokal'), pilot('p2', 'B', 'lokal')])
    await db.geraete.add(geraet('g1', 'H1', 'lokal'))
    await db.maengel.add(mangel('m1', 'lokal'))

    await lokaleDatenUebernehmen('cloud-org')

    expect((await db.piloten.toArray()).every((p) => p.orgId === 'cloud-org')).toBe(true)
    expect((await db.geraete.get('g1'))!.orgId).toBe('cloud-org')
    expect((await db.maengel.get('m1'))!.orgId).toBe('cloud-org')
    expect(await db.organisationen.get('lokal')).toBeUndefined()
    expect((await db.organisationen.get('cloud-org'))!.name).toBe('FF Test')
    expect((await db.einstellungen.get(AKTIVE_ORG_KEY))!.value).toBe('cloud-org')
    const e = await outbox()
    expect(e.map((x) => `${x.tabelle}:${x.id}:${x.op}`).sort()).toEqual([
      'geraete:g1:put',
      'maengel:m1:put',
      'piloten:p1:put',
      'piloten:p2:put',
    ])

    // Push lädt alles mit neuer org_id hoch, die Organisation nicht
    startSync('cloud-org')
    await syncJetzt()
    expect(server.tab('piloten').get('p1')!.org_id).toBe('cloud-org')
    expect(server.tab('organisationen').size).toBe(0)
    expect(await db.outbox.count()).toBe(0)
  })

  it('lokaleDatenLoeschen: Fachdaten, Outbox, sync:-Keys und aktiveOrgId weg', async () => {
    setzeErfassungAktiv(true)
    await db.organisationen.put(org())
    await db.piloten.add(pilot('p1'))
    await db.einstellungen.bulkPut([
      { key: AKTIVE_ORG_KEY, value: ORG },
      { key: 'sync:cursor:piloten', value: 'x' },
      { key: 'sync:org', value: ORG },
      { key: 'kartenStil', value: 'osm' },
    ])
    expect(await db.outbox.count()).toBeGreaterThan(0)

    await lokaleDatenLoeschen()

    expect(await db.organisationen.count()).toBe(0)
    expect(await db.piloten.count()).toBe(0)
    expect(await db.outbox.count()).toBe(0)
    const keys = (await db.einstellungen.toArray()).map((e) => e.key)
    expect(keys).toContain('kartenStil')
    expect(keys.filter((k) => k.startsWith('sync:') || k === AKTIVE_ORG_KEY)).toEqual([])
  })
})
