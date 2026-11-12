import type { Einsatz, FreigabeRegeln, Geraet, Mangel, Pilot } from '../../db/types'
import { alleFluege, geraetStatistik, pilotStatistik, pilotStatus, type Ampel } from '../../lib/stats'

/** Zeitraum als lokale Kalendertage (inklusive), Format YYYY-MM-DD */
export interface Zeitraum {
  von: string
  bis: string
}

const p2 = (n: number) => String(n).padStart(2, '0')
export const lokalesDatum = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`

export const jahresZeitraum = (jahr: number): Zeitraum => ({ von: `${jahr}-01-01`, bis: `${jahr}-12-31` })

/** ISO-Zeitpunkt liegt (in lokaler Zeit) im Zeitraum? */
export function imZeitraum(iso: string, z: Zeitraum): boolean {
  const tag = lokalesDatum(new Date(iso))
  return tag >= z.von && tag <= z.bis
}

/** Lesbare Bezeichnung, z. B. "2026" oder "01.03.2026 – 30.06.2026" */
export function zeitraumText(z: Zeitraum): string {
  const [vj, vm, vt] = z.von.split('-')
  const [bj, bm, bt] = z.bis.split('-')
  if (vm === '01' && vt === '01' && bm === '12' && bt === '31' && vj === bj) return vj
  return `${vt}.${vm}.${vj} – ${bt}.${bm}.${bj}`
}

/** für Dateinamen: "2026" oder "2026-03-01_2026-06-30" */
export function zeitraumDatei(z: Zeitraum): string {
  const t = zeitraumText(z)
  return /^\d{4}$/.test(t) ? t : `${z.von}_${z.bis}`
}

export function einsaetzeImZeitraum(einsaetze: Einsatz[], z: Zeitraum): Einsatz[] {
  return einsaetze.filter((e) => imZeitraum(e.datum, z))
}

export interface Kennzahlen {
  einsaetze: number
  einsaetzeOffen: number
  /** nach Art */
  anzahlEinsatz: number
  anzahlTraining: number
  anzahlCheckflug: number
  fluege: number
  minuten: number
  minutenEinsatz: number
  /** Training + Checkflug */
  minutenTraining: number
  unfaelle: number
  notfallEreignisse: number
  uebersteuerungen: number
}

export function kennzahlen(einsaetze: Einsatz[]): Kennzahlen {
  const k: Kennzahlen = {
    einsaetze: einsaetze.length,
    einsaetzeOffen: 0,
    anzahlEinsatz: 0,
    anzahlTraining: 0,
    anzahlCheckflug: 0,
    fluege: 0,
    minuten: 0,
    minutenEinsatz: 0,
    minutenTraining: 0,
    unfaelle: 0,
    notfallEreignisse: 0,
    uebersteuerungen: 0,
  }
  for (const e of einsaetze) {
    if (e.status !== 'abgeschlossen') k.einsaetzeOffen++
    if (e.art === 'einsatz') k.anzahlEinsatz++
    else if (e.art === 'training') k.anzahlTraining++
    else k.anzahlCheckflug++
    if (e.unfall) k.unfaelle++
    k.notfallEreignisse += (e.ereignisse ?? []).filter((x) => x.typ === 'notfall').length
    k.uebersteuerungen += e.uebersteuerungen?.length ?? 0
  }
  for (const f of alleFluege(einsaetze)) {
    if (!f.landung) continue
    k.fluege++
    k.minuten += f.minuten
    if (f.art === 'einsatz') k.minutenEinsatz += f.minuten
    else k.minutenTraining += f.minuten
  }
  return k
}

export interface MonatsWert {
  /** "2026-03" */
  schluessel: string
  jahr: number
  monat: number // 1–12
  minutenEinsatz: number
  minutenTraining: number
  fluege: number
}

export const MONATE_KURZ = ['Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']
export const MONATE_LANG = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']

/**
 * Flugminuten je Kalendermonat im Zeitraum (gestapelt Einsatz / Training+Checkflug).
 * Liefert jeden Monat des Zeitraums – auch leere –, maximal 36 Monate (die letzten).
 */
export function monatsAggregation(einsaetze: Einsatz[], z: Zeitraum): MonatsWert[] {
  const [vj, vm] = z.von.split('-').map(Number)
  const [bj, bm] = z.bis.split('-').map(Number)
  const werte: MonatsWert[] = []
  const index = new Map<string, MonatsWert>()
  for (let j = vj, m = vm; j < bj || (j === bj && m <= bm); m === 12 ? ((j += 1), (m = 1)) : (m += 1)) {
    const w: MonatsWert = { schluessel: `${j}-${p2(m)}`, jahr: j, monat: m, minutenEinsatz: 0, minutenTraining: 0, fluege: 0 }
    werte.push(w)
    index.set(w.schluessel, w)
  }
  for (const f of alleFluege(einsaetze)) {
    if (!f.landung || !imZeitraum(f.einsatz.datum, z)) continue
    const d = new Date(f.start)
    const w = index.get(`${d.getFullYear()}-${p2(d.getMonth() + 1)}`) ?? index.get(lokalesDatum(new Date(f.einsatz.datum)).slice(0, 7))
    if (!w) continue
    w.fluege++
    if (f.art === 'einsatz') w.minutenEinsatz += f.minuten
    else w.minutenTraining += f.minuten
  }
  return werte.slice(-36)
}

export interface PilotZeile {
  pilot: Pilot
  fluege: number
  minuten: number
  minutenEinsatz: number
  minutenTraining: number
  /** gesamt inkl. vorerfasster Werte, unabhängig vom Zeitraum */
  gesamtMinuten: number
  gesamtFluege: number
  ampel: Ampel
  gruende: string[]
}

/** Je Pilot: Flüge/Stunden im Zeitraum + aktueller Ampelstatus (aus allen Einsätzen). */
export function pilotTabelle(piloten: Pilot[], alle: Einsatz[], imZeitraum: Einsatz[], regeln: FreigabeRegeln, heute = new Date()): PilotZeile[] {
  return piloten
    .map((p) => {
      const z = pilotStatistik(p, imZeitraum, regeln.zeitraumTage, heute)
      const g = pilotStatistik(p, alle, regeln.zeitraumTage, heute)
      const st = pilotStatus(p, alle, regeln, heute)
      return {
        pilot: p,
        fluege: z.einsatz.fluege + z.training.fluege,
        minuten: z.einsatz.minuten + z.training.minuten,
        minutenEinsatz: z.einsatz.minuten,
        minutenTraining: z.training.minuten,
        gesamtMinuten: g.gesamt.minuten,
        gesamtFluege: g.gesamt.fluege,
        ampel: st.ampel,
        gruende: st.gruende,
      }
    })
    .sort((a, b) => b.minuten - a.minuten || a.pilot.nachname.localeCompare(b.pilot.nachname, 'de'))
}

export interface GeraetZeile {
  geraet: Geraet
  fluege: number
  minuten: number
  /** gesamt inkl. vorerfasster Minuten */
  gesamtMinuten: number
  offeneMaengel: number
  akkuZyklen: Record<string, number>
}

export function geraetTabelle(geraete: Geraet[], alle: Einsatz[], imZeitraum: Einsatz[], maengel: Mangel[]): GeraetZeile[] {
  return [...geraete].sort((a, b) => a.name.localeCompare(b.name, 'de', { numeric: true })).map((g) => {
    const z = geraetStatistik({ ...g, vorerfassteMinuten: 0 }, imZeitraum)
    const ges = geraetStatistik(g, alle)
    return {
      geraet: g,
      fluege: z.fluege,
      minuten: z.minuten,
      gesamtMinuten: ges.minuten,
      offeneMaengel: maengel.filter((m) => m.geraetId === g.id && !m.behobenAm).length,
      akkuZyklen: ges.akkuZyklen,
    }
  })
}

/** Minuten -> Stunden als Zahl mit einer Nachkommastelle (für Diagramm/Excel) */
export const stunden = (min: number) => Math.round((min / 60) * 10) / 10

/** Achsen-Teilung: "schöne" Obergrenze und Schrittweite */
export function achse(max: number, schritte = 4): { max: number; schritt: number } {
  if (max <= 0) return { max: 1, schritt: 0.25 }
  const roh = max / schritte
  const pot = Math.pow(10, Math.floor(Math.log10(roh)))
  const n = roh / pot
  const schritt = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * pot
  return { max: Math.ceil(max / schritt - 1e-9) * schritt, schritt }
}
