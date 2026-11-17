import { describe, expect, it } from 'vitest'
import type { Ausleihe, Geraet } from '../../db/types'
import { ausgabeFehler, doppelteInventarnummern, inventarGruppen, inventarPositionen, offeneAusleihe, rueckgabeFehler, rueckgabeMaengel, setzeAusgegeben, setzeRueckgabe } from './inventar'

const geraet: Geraet = {
  id: 'g1',
  orgId: 'o',
  name: 'Hornisse 1',
  hersteller: 'DJI',
  modell: 'Matrice 300',
  inventarnummer: 'INV-001',
  status: 'einsatzbereit',
  akkus: [
    { id: 'a1', nummer: '1', art: 'drohne', status: 'ok', inventarnummer: 'INV-010' },
    { id: 'a2', nummer: '2', art: 'drohne', status: 'ausgemustert' },
  ],
  zubehoer: [
    { id: 'z1', kategorie: 'bildschirm', bezeichnung: 'Monitor 7"', inventarnummer: 'INV-020', status: 'ok' },
    { id: 'z2', kategorie: 'propeller', bezeichnung: 'Ersatzpropeller', anzahl: 4, status: 'ok' },
    { id: 'z3', kategorie: 'koffer', bezeichnung: 'Alter Koffer', status: 'ausgemustert' },
  ],
  erstelltAm: '2026-01-01',
}

const ausleihe = (p: Partial<Ausleihe> = {}): Ausleihe => ({
  id: 'l1',
  orgId: 'o',
  geraetId: 'g1',
  status: 'verliehen',
  empfaenger: 'FF Nachbarort',
  ausgabeZeit: '2026-11-01T10:00:00Z',
  ausgabeDurch: 'HBM Huber',
  positionen: inventarPositionen(geraet).map((x) => ({ ...x, ausgegeben: true })),
  erstelltAm: '2026-11-01T10:00:00Z',
  ...p,
})

describe('Inventar', () => {
  it('Positionen: Drohne, aktive Akkus und aktives Zubehör', () => {
    const p = inventarPositionen(geraet)
    expect(p.map((x) => x.teilId)).toEqual(['g1', 'a1', 'z1', 'z2'])
    expect(p[0]).toMatchObject({ art: 'drohne', inventarnummer: 'INV-001' })
    expect(p[3].anzahl).toBe(4)
  })
  it('doppelte Inventarnummern (ohne Groß-/Kleinschreibung)', () => {
    const g2 = { ...geraet, id: 'g2', inventarnummer: 'inv-020', akkus: [], zubehoer: [] }
    expect([...doppelteInventarnummern([geraet, g2])]).toEqual(['inv-020'])
  })
})

describe('Verleih', () => {
  it('offene Ausleihe je Gerät', () => {
    const l = [ausleihe({ id: 'alt', status: 'zurueck' }), ausleihe()]
    expect(offeneAusleihe(l, 'g1')?.id).toBe('l1')
    expect(offeneAusleihe(l, 'g2')).toBeUndefined()
  })
  it('Ausgabe braucht Empfänger, Übergeber und die Drohne', () => {
    expect(ausgabeFehler(ausleihe())).toBeUndefined()
    expect(ausgabeFehler(ausleihe({ empfaenger: ' ' }))).toMatch(/Organisation/)
    const ohneDrohne = ausleihe({ positionen: inventarPositionen(geraet).map((x) => ({ ...x, ausgegeben: x.art !== 'drohne' })) })
    expect(ausgabeFehler(ohneDrohne)).toMatch(/Drohne/)
  })
  it('Rückgabe: jedes ausgegebene Teil braucht einen Status', () => {
    const l = ausleihe({ rueckgabeDurch: 'LM Maier' })
    expect(rueckgabeFehler(l)).toMatch(/4 Teil/)
    const fertig = { ...l, positionen: l.positionen.map((p) => ({ ...p, rueckgabe: 'ok' as const })) }
    expect(rueckgabeFehler(fertig)).toBeUndefined()
  })
  it('Mängel für fehlende und beschädigte Teile', () => {
    const l = ausleihe()
    l.positionen[1].rueckgabe = 'fehlt'
    l.positionen[2].rueckgabe = 'beschaedigt'
    l.positionen[2].bemerkung = 'Display gesprungen'
    let n = 0
    const m = rueckgabeMaengel(l, () => `m${++n}`, '2026-11-05T10:00:00Z')
    expect(m).toHaveLength(2)
    expect(m[0]).toMatchObject({ quelle: 'verleih', ausleiheId: 'l1', geraetId: 'g1' })
    expect(m[0].beschreibung).toContain('INV-010')
    expect(m[1].beschreibung).toContain('Display gesprungen')
  })
})

describe('Koffer', () => {
  const mitKoffer: Geraet = {
    ...geraet,
    akkus: [
      { id: 'a1', nummer: '1', art: 'drohne', status: 'ok', behaelterId: 'k1' },
      { id: 'a3', nummer: '3', art: 'drohne', status: 'ok' },
    ],
    zubehoer: [
      { id: 'z1', kategorie: 'bildschirm', bezeichnung: 'Monitor', status: 'ok', behaelterId: 'k1' },
      { id: 'k1', kategorie: 'koffer', bezeichnung: 'Koffer groß', status: 'ok' },
      { id: 'z4', kategorie: 'ladegeraet', bezeichnung: 'Ladegerät', status: 'ok', behaelterId: 'kAlt' },
      { id: 'kAlt', kategorie: 'koffer', bezeichnung: 'Alter Koffer', status: 'ausgemustert' },
    ],
  }
  it('Inhalt steht nach dem Koffer; Teile in ausgemusterten Koffern sind lose', () => {
    const p = inventarPositionen(mitKoffer)
    expect(p.map((x) => [x.teilId, x.behaelterId ?? null])).toEqual([
      ['g1', null],
      ['a3', null],
      ['k1', null],
      ['a1', 'k1'],
      ['z1', 'k1'],
      ['z4', null],
    ])
    const g = inventarGruppen(p)
    expect(g.map((x) => [x.pos.teilId, x.inhalt.map((y) => y.pos.teilId)])).toEqual([
      ['g1', []],
      ['a3', []],
      ['k1', ['a1', 'z1']],
      ['z4', []],
    ])
  })
  it('Koffer abhaken hakt den Inhalt mit ab, Rückgabe-Status gilt für den Inhalt', () => {
    let p = setzeAusgegeben(inventarPositionen(mitKoffer), 'k1', true)
    expect(p.filter((x) => x.ausgegeben).map((x) => x.teilId)).toEqual(['k1', 'a1', 'z1'])
    p = p.map((x) => (x.teilId === 'z1' ? { ...x, ausgegeben: false } : x))
    p = setzeRueckgabe(p, 'k1', 'ok')
    expect(p.filter((x) => x.rueckgabe).map((x) => x.teilId)).toEqual(['k1', 'a1'])
  })
})
