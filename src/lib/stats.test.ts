import { describe, expect, it } from 'vitest'
import type { Einsatz, FreigabeRegeln, Pilot } from '../db/types'
import { dauerMinuten, formatStunden, sicherheitsabstaende } from './calc'
import { pilotStatistik, pilotStatus } from './stats'

const heute = new Date('2026-11-12T12:00:00Z')

const pilot = (p: Partial<Pilot> = {}): Pilot => ({
  id: 'p1',
  orgId: 'o',
  vorname: 'Max',
  nachname: 'Muster',
  qualifikationen: [{ id: 'q', typ: 'A2', gueltigBis: '2030-01-01' }],
  freigabe: { erteilt: true },
  aktiv: true,
  erstelltAm: '2026-01-01',
  ...p,
})

const einsatz = (start: string, min: number, art: Einsatz['art'] = 'einsatz'): Einsatz =>
  ({
    id: start,
    orgId: 'o',
    art,
    status: 'abgeschlossen',
    datum: start,
    fluege: [
      {
        id: 'f' + start,
        nr: 1,
        pilotId: 'p1',
        geraetId: 'g1',
        start,
        landung: new Date(new Date(start).getTime() + min * 60000).toISOString(),
        zwischencheck: true,
      },
    ],
  }) as unknown as Einsatz

const regeln: FreigabeRegeln = {
  pflichtQualifikationen: ['A2'],
  mindestFluege: 3,
  zeitraumTage: 90,
  warnungTageVorAblauf: 60,
}

describe('Sicherheitsabstände (Checkliste v9)', () => {
  it('berechnet CV, GRB und Abstand Menschenansammlung', () => {
    const s = sicherheitsabstaende(100)
    expect(s.contingencyVolume).toBe(10)
    expect(s.groundRiskBuffer).toBe(110)
    expect(s.abstandMenschenansammlung).toBe(240)
    expect(s.hoeheUeberschritten).toBe(false)
    expect(sicherheitsabstaende(121).hoeheUeberschritten).toBe(true)
  })
})

describe('Zeiten', () => {
  it('Dauer und Formatierung', () => {
    expect(dauerMinuten('2026-01-01T10:00:00Z', '2026-01-01T10:25:00Z')).toBe(25)
    expect(dauerMinuten('2026-01-01T10:00:00Z')).toBe(0)
    expect(formatStunden(95)).toBe('1:35 h')
  })
})

describe('Pilotenstatistik', () => {
  it('summiert Flüge inkl. vorerfasster Werte', () => {
    const e = [einsatz('2026-11-01T10:00:00Z', 20), einsatz('2025-01-01T10:00:00Z', 30, 'training')]
    const s = pilotStatistik(pilot({ vorerfassteMinuten: 60, vorerfassteFluege: 2 }), e, 90, heute)
    expect(s.gesamt).toEqual({ fluege: 4, minuten: 110 })
    expect(s.einsatz.minuten).toBe(20)
    expect(s.training.minuten).toBe(30)
    expect(s.letzte90Tage.fluege).toBe(1)
  })
})

describe('Pilotenstatus (Ampel)', () => {
  const genug = [1, 2, 3].map((i) => einsatz(`2026-11-0${i}T10:00:00Z`, 10))
  it('grün bei Freigabe, Qualifikation und Praxis', () => {
    expect(pilotStatus(pilot(), genug, regeln, heute).ampel).toBe('gruen')
  })
  it('gelb bei zu wenig Praxis', () => {
    expect(pilotStatus(pilot(), genug.slice(0, 1), regeln, heute).ampel).toBe('gelb')
  })
  it('gelb bei bald ablaufender Qualifikation', () => {
    const p = pilot({ qualifikationen: [{ id: 'q', typ: 'A2', gueltigBis: '2026-12-01' }] })
    expect(pilotStatus(p, genug, regeln, heute).ampel).toBe('gelb')
  })
  it('rot ohne Freigabe oder mit abgelaufener Qualifikation', () => {
    expect(pilotStatus(pilot({ freigabe: { erteilt: false } }), genug, regeln, heute).ampel).toBe('rot')
    const p = pilot({ qualifikationen: [{ id: 'q', typ: 'A2', gueltigBis: '2026-01-01' }] })
    expect(pilotStatus(p, genug, regeln, heute).ampel).toBe('rot')
    expect(pilotStatus(pilot({ qualifikationen: [] }), genug, regeln, heute).ampel).toBe('rot')
  })
})
