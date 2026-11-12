import { describe, expect, it } from 'vitest'
import type { Einsatz, Geraet, Mangel, WartungsPruefung } from '../../db/types'
import { akkuPruefId, WARTUNG_V2 } from '../../templates/wartung_v2'
import {
  akkuVerwendet,
  geraetVerwendet,
  istFaellig,
  neueMaengelAusPruefung,
  serviceFaelligkeit,
  vorbelegung,
  wartungImMonatErledigt,
  wartungsMatrix,
  wartungsPunkte,
} from './logic'

const geraet = (g: Partial<Geraet> = {}): Geraet => ({
  id: 'g1',
  orgId: 'o',
  name: 'Hornisse 1',
  hersteller: 'DJI',
  modell: 'M30T',
  status: 'einsatzbereit',
  akkus: [
    { id: 'fb1', nummer: '1', art: 'fernbedienung', status: 'ok' },
    { id: 'a2', nummer: '2', art: 'drohne', status: 'ok' },
    { id: 'a1', nummer: '1', art: 'drohne', status: 'ok' },
    { id: 'alt', nummer: '9', art: 'drohne', status: 'ausgemustert' },
  ],
  erstelltAm: '2026-01-01',
  ...g,
})

const pruefung = (monat: number, ergebnisse: WartungsPruefung['ergebnisse'], jahr = 2026): WartungsPruefung => ({
  id: `w${jahr}-${monat}`,
  orgId: 'o',
  geraetId: 'g1',
  datum: `${jahr}-${String(monat).padStart(2, '0')}-10T10:00:00Z`,
  jahr,
  monat,
  pruefer: 'Muster',
  ergebnisse,
})

describe('Wartungspunkte', () => {
  it('Vorlage + Akkus (Drohne vor Fernbedienung, numerisch), ohne ausgemusterte', () => {
    const p = wartungsPunkte(geraet())
    expect(p.length).toBe(WARTUNG_V2.length + 3)
    expect(p.slice(-3).map((x) => x.id)).toEqual([akkuPruefId('a1'), akkuPruefId('a2'), akkuPruefId('fb1')])
    expect(p.at(-1)!.label).toBe('Sichtkontrolle und Ladezustand Akku Nr. 1 (Fernbed.)')
  })
  it('ausgemusterter Akku bleibt sichtbar, wenn er im Jahr geprüft wurde', () => {
    const p = wartungsPunkte(geraet(), [pruefung(1, { [akkuPruefId('alt')]: 'ok' })])
    expect(p.some((x) => x.id === akkuPruefId('alt'))).toBe(true)
  })
})

describe('Fälligkeit Intervalle', () => {
  it('quartal und halbjahr', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((m) => istFaellig('quartal', m))).toEqual([3, 6, 9, 12])
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((m) => istFaellig('halbjahr', m))).toEqual([6, 12])
    expect(istFaellig('monatlich', 5)).toBe(true)
  })
  it('Vorbelegung: nicht fällige Punkte n. a., bestehende Werte bleiben', () => {
    const punkte = wartungsPunkte(geraet())
    const v = vorbelegung(punkte, 5)
    expect(v.funktion).toBe('na')
    expect(v.herstellerservice).toBe('na')
    expect(v.vollstaendigkeit).toBeUndefined()
    expect(vorbelegung(punkte, 6).funktion).toBeUndefined()
    expect(vorbelegung(punkte, 5, pruefung(5, { funktion: 'mangel' })).funktion).toBe('mangel')
  })
})

describe('Wartungsmatrix', () => {
  it('Jahresansicht: Zeilen = Punkte, 12 Monatsspalten, nur gewähltes Jahr', () => {
    const m = wartungsMatrix(
      geraet(),
      [pruefung(1, { vollstaendigkeit: 'ok' }), pruefung(3, { vollstaendigkeit: 'mangel', funktion: 'ok' }), pruefung(3, { vollstaendigkeit: 'ok' }, 2025)],
      2026,
    )
    expect(m.pruefungen.filter(Boolean).length).toBe(2)
    const z = m.zeilen.find((x) => x.punkt.id === 'vollstaendigkeit')!
    expect(z.zellen).toHaveLength(12)
    expect(z.zellen[0]).toBe('ok')
    expect(z.zellen[1]).toBeUndefined()
    expect(z.zellen[2]).toBe('mangel')
    expect(m.zeilen.find((x) => x.punkt.id === 'funktion')!.zellen[2]).toBe('ok')
  })
})

describe('Mängel aus Prüfung', () => {
  it('legt je Mangel-Punkt einen Mangel an, ohne Duplikate', () => {
    const g = geraet()
    const punkte = wartungsPunkte(g)
    const p = pruefung(4, { vollstaendigkeit: 'mangel', sicht_drohne: 'ok', [akkuPruefId('a1')]: 'mangel' })
    const neu = neueMaengelAusPruefung(p, punkte, [])
    expect(neu).toHaveLength(2)
    expect(neu[0].beschreibung).toContain('04/2026')
    expect(neu[1].beschreibung).toContain('Akku Nr. 1 (Drohne)')
    const bestehend = [{ ...neu[0], id: 'm', orgId: 'o', erstelltAm: '' } as Mangel]
    expect(neueMaengelAusPruefung(p, punkte, bestehend)).toHaveLength(1)
  })
})

describe('Herstellerservice / Monat erledigt', () => {
  const heute = new Date(2026, 10, 12, 12)
  it('überfällig, bald, ok', () => {
    expect(serviceFaelligkeit(undefined, heute)).toBeUndefined()
    expect(serviceFaelligkeit(new Date(2026, 10, 1, 12).toISOString(), heute)).toBe('ueberfaellig')
    expect(serviceFaelligkeit(new Date(2026, 10, 12, 12).toISOString(), heute)).toBe('bald')
    expect(serviceFaelligkeit(new Date(2026, 11, 1, 12).toISOString(), heute)).toBe('bald')
    expect(serviceFaelligkeit(new Date(2027, 5, 1, 12).toISOString(), heute)).toBe('ok')
  })
  it('Prüfung im aktuellen Monat', () => {
    expect(wartungImMonatErledigt([pruefung(11, {})], 'g1', heute)).toBe(true)
    expect(wartungImMonatErledigt([pruefung(10, {})], 'g1', heute)).toBe(false)
  })
})

describe('Verwendung in Flügen', () => {
  const e = { geraetIds: ['g1'], fluege: [{ geraetId: 'g1', akkuId: 'a1', pilotId: 'p' }] } as unknown as Einsatz
  it('Gerät und Akku', () => {
    expect(geraetVerwendet('g1', [e])).toBe(true)
    expect(geraetVerwendet('g2', [e])).toBe(false)
    expect(akkuVerwendet('a1', [e])).toBe(true)
    expect(akkuVerwendet('a2', [e])).toBe(false)
  })
})
