import type { Einsatz, EinsatzArt, Geraet, Pilot } from '../../db/types'
import { pilotName } from '../../lib/format'
import { alleFluege, type FlugZeile } from '../../lib/stats'
import { einsatzleiterText, rolleName } from '../einsatz/logic/einsatz'

/** Flugbuch v2 – Zeilen werden vollständig aus den Einsätzen abgeleitet. */

export interface FlugbuchZeile extends FlugZeile {
  /** laufende Nummer im Flugbuch (chronologisch, ältester Flug = 1) */
  lfdNr: number
  pilot: string
  geraet: string
  einsatzort: string
  beschreibung: string
  einsatzleiter: string
  bemerkung: string
}

export interface FlugbuchFilter {
  von?: string // yyyy-mm-dd
  bis?: string // yyyy-mm-dd
  pilotId?: string
  geraetId?: string
  art?: EinsatzArt | ''
  suche?: string
}

const lokalesDatum = (iso: string) => {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function flugbuchZeilen(einsaetze: Einsatz[], piloten: Pilot[], geraete: Geraet[]): FlugbuchZeile[] {
  const pm = new Map(piloten.map((p) => [p.id, p]))
  const gm = new Map(geraete.map((g) => [g.id, g]))
  const fluege = alleFluege(einsaetze) // neueste zuerst
  const n = fluege.length
  return fluege.map((f, i) => {
    const e = f.einsatz
    const flug = e.fluege.find((x) => x.id === f.flugId)
    const p = pm.get(f.pilotId)
    return {
      ...f,
      lfdNr: n - i,
      pilot: p ? pilotName(p) : rolleName(e.rollen.pilot),
      geraet: gm.get(f.geraetId)?.name ?? '',
      einsatzort: [e.fluggebiet, e.gemeinde].filter(Boolean).join(', '),
      beschreibung: e.beschreibung || e.grund || '',
      einsatzleiter: einsatzleiterText(e),
      bemerkung: [flug?.bemerkung, e.anmerkungen].filter(Boolean).join(' · '),
    }
  })
}

export function filtereFlugbuch(zeilen: FlugbuchZeile[], f: FlugbuchFilter): FlugbuchZeile[] {
  const q = f.suche?.trim().toLowerCase() ?? ''
  return zeilen.filter((z) => {
    const d = lokalesDatum(z.start)
    if (f.von && d < f.von) return false
    if (f.bis && d > f.bis) return false
    if (f.pilotId && z.pilotId !== f.pilotId) return false
    if (f.geraetId && z.geraetId !== f.geraetId) return false
    if (f.art && z.art !== f.art) return false
    if (q && ![z.pilot, z.geraet, z.einsatzort, z.beschreibung, z.einsatzleiter, z.bemerkung].some((t) => t.toLowerCase().includes(q))) return false
    return true
  })
}

export function flugbuchSumme(zeilen: FlugbuchZeile[]) {
  return { fluege: zeilen.length, minuten: zeilen.reduce((s, z) => s + z.minuten, 0) }
}
