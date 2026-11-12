import { describe, expect, it } from 'vitest'
import { fmtKoordinaten, fmtMeter, istPosition, kreisGrenzen, schutzkreise } from './geo'

describe('Schutzkreise', () => {
  it('liefert GRB und Menschenansammlung aus der Flughöhe (groß → klein)', () => {
    const k = schutzkreise(100, false)
    expect(k.map((x) => x.id)).toEqual(['menschen', 'grb'])
    expect(k.find((x) => x.id === 'grb')?.radiusM).toBe(110)
    expect(k.find((x) => x.id === 'menschen')?.radiusM).toBe(240)
  })
  it('optional 2,5-km-Kreis, ohne Flughöhe nur dieser', () => {
    expect(schutzkreise(50, true)[0]).toMatchObject({ id: 'flugplatz', radiusM: 2500 })
    expect(schutzkreise(0, true).map((x) => x.id)).toEqual(['flugplatz'])
    expect(schutzkreise(0, false)).toEqual([])
  })
})

describe('Formatierung / Geometrie', () => {
  it('Meter und Kilometer de-AT', () => {
    expect(fmtMeter(132.5)).toBe('132,5 m')
    expect(fmtMeter(2500)).toBe('2,5 km')
  })
  it('Koordinaten und Grenzen', () => {
    expect(fmtKoordinaten({ lat: 48.2, lng: 16.371234 })).toBe('48.20000, 16.37123')
    const [[s, w], [n, o]] = kreisGrenzen({ lat: 48, lng: 16 }, 1113.2)
    expect(n - s).toBeCloseTo(0.02, 4)
    expect(o - w).toBeGreaterThan(0.02)
  })
  it('istPosition', () => {
    expect(istPosition({ lat: 48, lng: 16 })).toBe(true)
    expect(istPosition({ lat: 100, lng: 16 })).toBe(false)
    expect(istPosition(undefined)).toBe(false)
    expect(istPosition({ lat: '48', lng: 16 })).toBe(false)
  })
})
