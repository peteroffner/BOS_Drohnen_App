import { describe, expect, it } from 'vitest'
import type { Einsatz } from '../../db/types'
import { achse, einsaetzeImZeitraum, jahresZeitraum, kennzahlen, monatsAggregation, zeitraumDatei, zeitraumText } from './auswertung'

const einsatz = (datum: string, minuten: number[], art: Einsatz['art'] = 'einsatz', extra: Partial<Einsatz> = {}): Einsatz =>
  ({
    id: datum + art,
    orgId: 'o',
    art,
    status: 'abgeschlossen',
    datum,
    unfall: false,
    ereignisse: [],
    fluege: minuten.map((m, i) => {
      const start = new Date(new Date(datum).getTime() + i * 3600000)
      return { id: `${datum}-${i}`, nr: i + 1, pilotId: 'p', geraetId: 'g', start: start.toISOString(), landung: new Date(start.getTime() + m * 60000).toISOString(), zwischencheck: false }
    }),
    ...extra,
  }) as unknown as Einsatz

describe('Zeitraum', () => {
  it('Texte und Filter', () => {
    expect(zeitraumText(jahresZeitraum(2026))).toBe('2026')
    expect(zeitraumText({ von: '2026-03-01', bis: '2026-06-30' })).toBe('01.03.2026 – 30.06.2026')
    expect(zeitraumDatei({ von: '2026-03-01', bis: '2026-06-30' })).toBe('2026-03-01_2026-06-30')
    const e = [einsatz('2025-12-31T10:00:00', [10]), einsatz('2026-01-01T10:00:00', [10]), einsatz('2026-12-31T22:00:00', [10]), einsatz('2027-01-01T10:00:00', [10])]
    expect(einsaetzeImZeitraum(e, jahresZeitraum(2026))).toHaveLength(2)
  })
})

describe('Kennzahlen', () => {
  it('zählt Einsätze, Flüge, Minuten nach Art, Unfälle und Notfälle', () => {
    const e = [
      einsatz('2026-02-01T10:00:00', [20, 10]),
      einsatz('2026-02-03T10:00:00', [30], 'training', { unfall: true }),
      einsatz('2026-03-01T10:00:00', [15], 'checkflug', {
        status: 'laufend',
        ereignisse: [
          { id: '1', zeit: '2026-03-01T10:05:00', text: 'x', typ: 'notfall' },
          { id: '2', zeit: '2026-03-01T10:06:00', text: 'y', typ: 'info' },
        ],
      }),
    ]
    const k = kennzahlen(e)
    expect(k).toMatchObject({ einsaetze: 3, einsaetzeOffen: 1, anzahlEinsatz: 1, anzahlTraining: 1, anzahlCheckflug: 1, fluege: 4, minuten: 75, minutenEinsatz: 30, minutenTraining: 45, unfaelle: 1, notfallEreignisse: 1 })
  })
  it('ignoriert laufende Flüge ohne Landung', () => {
    const e = einsatz('2026-02-01T10:00:00', [20])
    e.fluege.push({ id: 'x', nr: 2, pilotId: 'p', geraetId: 'g', start: '2026-02-01T12:00:00', zwischencheck: false })
    expect(kennzahlen([e]).fluege).toBe(1)
  })
})

describe('Monatsaggregation', () => {
  it('liefert alle Monate des Zeitraums, gestapelt nach Art', () => {
    const e = [einsatz('2026-02-01T10:00:00', [20, 10]), einsatz('2026-02-20T10:00:00', [30], 'training'), einsatz('2026-05-05T10:00:00', [45], 'checkflug')]
    const m = monatsAggregation(e, jahresZeitraum(2026))
    expect(m).toHaveLength(12)
    expect(m[1]).toMatchObject({ schluessel: '2026-02', minutenEinsatz: 30, minutenTraining: 30, fluege: 3 })
    expect(m[4]).toMatchObject({ monat: 5, minutenEinsatz: 0, minutenTraining: 45 })
    expect(m[0].fluege).toBe(0)
  })
  it('über Jahreswechsel und maximal 36 Monate', () => {
    const m = monatsAggregation([], { von: '2025-11-15', bis: '2026-02-01' })
    expect(m.map((x) => x.schluessel)).toEqual(['2025-11', '2025-12', '2026-01', '2026-02'])
    expect(monatsAggregation([], { von: '2020-01-01', bis: '2026-12-31' })).toHaveLength(36)
  })
})

describe('Achse', () => {
  it('rundet auf schöne Werte', () => {
    expect(achse(3.2)).toEqual({ max: 4, schritt: 1 })
    expect(achse(0)).toEqual({ max: 1, schritt: 0.25 })
    expect(achse(17).max).toBe(20)
  })
})
