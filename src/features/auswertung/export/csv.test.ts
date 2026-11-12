import { describe, expect, it } from 'vitest'
import { erzeugeDemodaten } from '../demo'
import { csvFeld, csvText, flugbuchCsv, FLUGBUCH_CSV_KOPF } from './csv'
import { flugbuchZeilen } from './flugbuchZeilen'

describe('CSV', () => {
  it('maskiert Semikolon, Anführungszeichen und Zeilenumbrüche', () => {
    expect(csvFeld('a;b')).toBe('"a;b"')
    expect(csvFeld('sagt "hallo"')).toBe('"sagt ""hallo"""')
    expect(csvFeld('zwei\nZeilen')).toBe('"zwei\nZeilen"')
    expect(csvFeld(1.5)).toBe('1,5')
    expect(csvFeld(undefined)).toBe('')
  })
  it('BOM, Semikolon, CRLF', () => {
    const t = csvText(['A', 'B'], [['ä', 'ö;ü']])
    expect(t.startsWith('﻿')).toBe(true)
    expect(t).toBe('﻿A;B\r\nä;"ö;ü"\r\n')
  })
  it('Flugbuch aus Demodaten: chronologisch nummeriert, alle Spalten', () => {
    const d = erzeugeDemodaten('org', new Date('2026-11-12T12:00:00'))
    const z = flugbuchZeilen(d.einsaetze, d)
    const anzahl = d.einsaetze.reduce((s, e) => s + e.fluege.length, 0)
    expect(z).toHaveLength(anzahl)
    expect(z.map((x) => x.nr)).toEqual(Array.from({ length: anzahl }, (_, i) => i + 1))
    expect(z[0].startIso < z[z.length - 1].startIso).toBe(true)
    expect(z.every((x) => x.pilot !== 'unbekannt' && x.geraet !== 'unbekannt')).toBe(true)
    const zeilen = flugbuchCsv(z).slice(1).trimEnd().split('\r\n')
    expect(zeilen).toHaveLength(anzahl + 1)
    expect(zeilen[0].split(';')).toEqual(FLUGBUCH_CSV_KOPF)
    expect(zeilen.some((l) => l.includes('Hornisse 1') && l.includes('VLOS'))).toBe(true)
  })
})
