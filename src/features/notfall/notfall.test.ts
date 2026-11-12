import { describe, expect, it } from 'vitest'
import { NOTFALL_V2 } from '../../templates/notfall_v2'
import { notfallEreignis } from './notfall'

describe('Notfall', () => {
  it('erzeugt Ereignis typ notfall mit Bezug', () => {
    const s = NOTFALL_V2.find((x) => x.nr === 7)!
    expect(notfallEreignis(s, 'id1', '2026-11-12T10:00:00Z')).toEqual({
      id: 'id1',
      zeit: '2026-11-12T10:00:00Z',
      typ: 'notfall',
      bezug: 'Notfall 7',
      text: 'Drohne stürzt ab',
    })
  })

  it('alle „siehe“-Verweise zeigen auf vorhandene Szenarien', () => {
    const nrn = new Set(NOTFALL_V2.map((s) => s.nr))
    for (const s of NOTFALL_V2) for (const r of s.reaktionen) if (r.siehe) expect(nrn.has(r.siehe)).toBe(true)
  })
})
