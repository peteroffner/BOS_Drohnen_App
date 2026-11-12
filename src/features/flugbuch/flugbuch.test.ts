import { describe, expect, it } from 'vitest'
import type { Einsatz, Geraet, Pilot } from '../../db/types'
import { neuerEinsatz } from '../einsatz/logic/einsatz'
import { filtereFlugbuch, flugbuchSumme, flugbuchZeilen } from './flugbuch'

const pilot: Pilot = {
  id: 'p1',
  orgId: 'o',
  vorname: 'Anna',
  nachname: 'Berger',
  dienstgrad: 'OBM',
  qualifikationen: [],
  freigabe: { erteilt: true },
  aktiv: true,
  erstelltAm: '2026-01-01',
}
const geraet: Geraet = { id: 'g1', orgId: 'o', name: 'Hornisse 1', hersteller: 'DJI', modell: 'M30T', status: 'einsatzbereit', akkus: [], erstelltAm: '2026-01-01' }

const einsatz = (id: string, datum: string, extra: Partial<Einsatz> = {}): Einsatz => ({
  ...neuerEinsatz(id, 'o', datum),
  fluggebiet: 'Au',
  gemeinde: 'Tulln',
  grund: 'Personensuche',
  rollen: { gesamtEinsatzleiter: { name: 'HBI Huber' }, teamleiter: { name: 'BM Maier' } },
  fluege: [
    { id: `${id}f1`, nr: 1, pilotId: 'p1', geraetId: 'g1', start: datum, landung: new Date(new Date(datum).getTime() + 20 * 60000).toISOString(), zwischencheck: false },
  ],
  ...extra,
})

describe('Flugbuch', () => {
  const es = [einsatz('a', '2026-03-01T10:00:00Z'), einsatz('b', '2026-06-01T10:00:00Z', { art: 'training', beschreibung: 'Übung Wärmebild' })]
  const z = flugbuchZeilen(es, [pilot], [geraet])

  it('baut Zeilen laut Flugbuch v2', () => {
    expect(z).toHaveLength(2)
    expect(z[0]).toMatchObject({ lfdNr: 2, pilot: 'OBM Anna Berger', geraet: 'Hornisse 1', einsatzort: 'Au, Tulln', beschreibung: 'Übung Wärmebild', einsatzleiter: 'HBI Huber / BM Maier', minuten: 20 })
    expect(z[1].beschreibung).toBe('Personensuche')
    expect(z[1].lfdNr).toBe(1)
  })

  it('filtert und summiert', () => {
    expect(filtereFlugbuch(z, { von: '2026-04-01' })).toHaveLength(1)
    expect(filtereFlugbuch(z, { bis: '2026-03-01' })).toHaveLength(1)
    expect(filtereFlugbuch(z, { art: 'training' })[0].einsatz.id).toBe('b')
    expect(filtereFlugbuch(z, { pilotId: 'x' })).toHaveLength(0)
    expect(filtereFlugbuch(z, { suche: 'wärme' })).toHaveLength(1)
    expect(flugbuchSumme(z)).toEqual({ fluege: 2, minuten: 40 })
  })
})
