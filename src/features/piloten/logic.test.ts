import { describe, expect, it } from 'vitest'
import type { Einsatz, Pilot } from '../../db/types'
import type { PilotStatistik } from '../../lib/stats'
import { gueltigkeit, pilotPasst, pilotVerwendet, pruefeAnhang, sortierePiloten, teileMinuten, zuMinuten, type PilotZeile } from './logic'

const heute = new Date('2026-11-12T12:00:00Z')

const pilot = (p: Partial<Pilot> = {}): Pilot => ({
  id: 'p1',
  orgId: 'o',
  vorname: 'Max',
  nachname: 'Muster',
  qualifikationen: [],
  freigabe: { erteilt: false },
  aktiv: true,
  erstelltAm: '2026-01-01',
  ...p,
})

const zeile = (p: Partial<Pilot>, ampel: 'gruen' | 'gelb' | 'rot', minuten: number, letzterFlug?: string): PilotZeile => ({
  pilot: pilot(p),
  status: { ampel, gruende: [] },
  stat: { gesamt: { fluege: 1, minuten }, letzterFlug } as PilotStatistik,
})

describe('Gültigkeit', () => {
  it('abgelaufen / bald / gültig / unbefristet', () => {
    expect(gueltigkeit(undefined, heute)).toBe('unbefristet')
    expect(gueltigkeit('2026-11-01', heute)).toBe('abgelaufen')
    expect(gueltigkeit('2026-12-20', heute, 60)).toBe('bald')
    expect(gueltigkeit('2027-06-01', heute, 60)).toBe('gueltig')
  })
})

describe('Pilot in Verwendung', () => {
  const e = (x: Partial<Einsatz>) => ({ fluege: [], rollen: {}, ...x }) as unknown as Einsatz
  it('über Flug oder Rolle', () => {
    expect(pilotVerwendet('p1', [e({})])).toBe(false)
    expect(pilotVerwendet('p1', [e({ fluege: [{ pilotId: 'p1' }] as Einsatz['fluege'] })])).toBe(true)
    expect(pilotVerwendet('p1', [e({ rollen: { luftraumbeobachter: [{ name: 'x', pilotId: 'p1' }] } })])).toBe(true)
  })
})

describe('Sortierung und Suche', () => {
  const z = [
    zeile({ id: 'a', nachname: 'Zach' }, 'gruen', 10, '2026-10-01'),
    zeile({ id: 'b', nachname: 'Berger' }, 'rot', 100),
    zeile({ id: 'c', nachname: 'Ähre' }, 'gelb', 50, '2026-11-01'),
  ]
  it('sortiert', () => {
    expect(sortierePiloten(z, 'name').map((x) => x.pilot.id)).toEqual(['c', 'b', 'a'])
    expect(sortierePiloten(z, 'status').map((x) => x.pilot.id)).toEqual(['a', 'c', 'b'])
    expect(sortierePiloten(z, 'stunden').map((x) => x.pilot.id)).toEqual(['b', 'c', 'a'])
    expect(sortierePiloten(z, 'letzterFlug').map((x) => x.pilot.id)).toEqual(['c', 'a', 'b'])
  })
  it('sucht über mehrere Felder', () => {
    const p = pilot({ dienstgrad: 'OBI', feuerwehr: 'FF Musterdorf' })
    expect(pilotPasst(p, 'obi muster')).toBe(true)
    expect(pilotPasst(p, 'musterdorf')).toBe(true)
    expect(pilotPasst(p, 'huber')).toBe(false)
  })
})

describe('Hilfsfunktionen', () => {
  it('Anhang prüfen', () => {
    expect(pruefeAnhang({ size: 1000, type: 'application/pdf' })).toBeNull()
    expect(pruefeAnhang({ size: 1000, type: 'text/plain' })).not.toBeNull()
    expect(pruefeAnhang({ size: 3 * 1024 * 1024, type: 'image/png' })).toMatch(/zu groß/)
  })
  it('Minuten umrechnen', () => {
    expect(teileMinuten(125)).toEqual({ stunden: 2, minuten: 5 })
    expect(zuMinuten(2, 5)).toBe(125)
    expect(zuMinuten(-1, 0)).toBe(0)
  })
})
