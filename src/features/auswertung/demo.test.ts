import { describe, expect, it } from 'vitest'
import { BosDb } from '../../db/db'
import { STANDARD_FREIGABE_REGELN } from '../../lib/useOrg'
import { geraetStatistik, pilotStatus } from '../../lib/stats'
import { VORLAGEN } from '../../templates/checkliste_v9'
import { demodatenLaden, erzeugeDemodaten } from './demo'

const heute = new Date('2026-11-12T12:00:00')

describe('Demodaten', () => {
  const d = erzeugeDemodaten('org1', heute)

  it('Umfang', () => {
    expect(d.piloten).toHaveLength(3)
    expect(d.geraete.map((g) => g.name)).toEqual(['Hornisse 1', 'Hornisse 2'])
    expect(d.einsaetze.length).toBeGreaterThanOrEqual(8)
    expect(d.maengel.filter((m) => !m.behobenAm)).toHaveLength(1)
    expect(d.wartungen.length).toBeGreaterThan(0)
  })

  it('alle Verweise sind konsistent und gehören zur Organisation', () => {
    const pIds = new Set(d.piloten.map((p) => p.id))
    const gMap = new Map(d.geraete.map((g) => [g.id, g]))
    const eIds = new Set(d.einsaetze.map((e) => e.id))
    const alle = [...d.piloten, ...d.geraete, ...d.einsaetze, ...d.wartungen, ...d.maengel]
    expect(new Set(alle.map((x) => x.id)).size).toBe(alle.length)
    expect(alle.every((x) => x.orgId === 'org1')).toBe(true)
    for (const e of d.einsaetze) {
      expect(VORLAGEN[e.vorlageId]).toBeDefined()
      expect(e.status).toBe('abgeschlossen')
      expect(new Date(e.datum).getTime()).toBeLessThan(heute.getTime())
      for (const f of e.fluege) {
        expect(pIds.has(f.pilotId)).toBe(true)
        const g = gMap.get(f.geraetId)
        expect(g && e.geraetIds.includes(g.id)).toBe(true)
        expect(g?.akkus.some((a) => a.id === f.akkuId)).toBe(true)
        expect(f.landung! > f.start).toBe(true)
      }
      expect(e.unterschrift?.dataUrl.startsWith('data:image/png;base64,')).toBe(true)
    }
    for (const m of d.maengel) {
      expect(gMap.has(m.geraetId)).toBe(true)
      if (m.einsatzId) expect(eIds.has(m.einsatzId)).toBe(true)
    }
    for (const w of d.wartungen) expect(gMap.has(w.geraetId)).toBe(true)
  })

  it('Piloten zeigen alle drei Ampelzustände (Standardregeln)', () => {
    const ampeln = d.piloten.map((p) => pilotStatus(p, d.einsaetze, STANDARD_FREIGABE_REGELN, heute).ampel)
    expect(ampeln).toEqual(['gruen', 'gelb', 'rot'])
  })

  it('Akkuzyklen zählen hoch', () => {
    const g = d.geraete[0]
    const s = geraetStatistik(g, d.einsaetze)
    expect(s.fluege).toBeGreaterThan(0)
    expect(s.akkuZyklen[g.akkus[0].id]).toBeGreaterThan(g.akkus[0].vorerfassteZyklen ?? 0)
  })

  it('wird nur in eine leere Organisation geladen', async () => {
    const db = new BosDb('demo-test')
    await demodatenLaden(db, 'org1', heute)
    expect(await db.einsaetze.count()).toBe(d.einsaetze.length)
    await expect(demodatenLaden(db, 'org1', heute)).rejects.toThrow(/bereits Daten/)
    expect(await db.piloten.count()).toBe(3)
    db.close()
  })
})
