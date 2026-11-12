import type { Einsatz, EinsatzArt, FreigabeRegeln, Geraet, Pilot, QualifikationTyp } from '../db/types'
import { dauerMinuten } from './calc'

/**
 * Abgeleitete Kennzahlen. Alles wird aus den Einsätzen berechnet –
 * die Flugbuch-Daten sind die einzige Quelle der Wahrheit.
 */

export interface FlugZeile {
  einsatz: Einsatz
  flugId: string
  nr: number
  pilotId: string
  geraetId: string
  akkuId?: string
  start: string
  landung?: string
  minuten: number
  art: EinsatzArt
}

/** Alle Flüge aller Einsätze als flache Liste (neueste zuerst). */
export function alleFluege(einsaetze: Einsatz[]): FlugZeile[] {
  const out: FlugZeile[] = []
  for (const e of einsaetze) {
    for (const f of e.fluege) {
      out.push({
        einsatz: e,
        flugId: f.id,
        nr: f.nr,
        pilotId: f.pilotId,
        geraetId: f.geraetId,
        akkuId: f.akkuId,
        start: f.start,
        landung: f.landung,
        minuten: dauerMinuten(f.start, f.landung),
        art: e.art,
      })
    }
  }
  return out.sort((a, b) => b.start.localeCompare(a.start))
}

export interface Summe {
  fluege: number
  minuten: number
}

const leer = (): Summe => ({ fluege: 0, minuten: 0 })
const add = (s: Summe, m: number) => {
  s.fluege++
  s.minuten += m
}

export interface PilotStatistik {
  gesamt: Summe // inkl. vorerfasster Werte
  einsatz: Summe
  training: Summe // training + checkflug
  letzte90Tage: Summe
  letzte12Monate: Summe
  /** im Zeitraum laut Freigaberegeln */
  imRegelZeitraum: Summe
  letzterFlug?: string
  /** geraetId -> Summe */
  jeGeraet: Record<string, Summe>
}

export function pilotStatistik(
  pilot: Pilot,
  einsaetze: Einsatz[],
  regelZeitraumTage = 90,
  heute = new Date(),
): PilotStatistik {
  const tag = 86400000
  const t90 = heute.getTime() - 90 * tag
  const t365 = heute.getTime() - 365 * tag
  const tRegel = heute.getTime() - regelZeitraumTage * tag
  const s: PilotStatistik = {
    gesamt: { fluege: pilot.vorerfassteFluege ?? 0, minuten: pilot.vorerfassteMinuten ?? 0 },
    einsatz: leer(),
    training: leer(),
    letzte90Tage: leer(),
    letzte12Monate: leer(),
    imRegelZeitraum: leer(),
    jeGeraet: {},
  }
  for (const f of alleFluege(einsaetze)) {
    if (f.pilotId !== pilot.id || !f.landung) continue
    const t = new Date(f.start).getTime()
    add(s.gesamt, f.minuten)
    add(f.art === 'einsatz' ? s.einsatz : s.training, f.minuten)
    if (t >= t90) add(s.letzte90Tage, f.minuten)
    if (t >= t365) add(s.letzte12Monate, f.minuten)
    if (t >= tRegel) add(s.imRegelZeitraum, f.minuten)
    add((s.jeGeraet[f.geraetId] ??= leer()), f.minuten)
    if (!s.letzterFlug || f.start > s.letzterFlug) s.letzterFlug = f.start
  }
  return s
}

export type Ampel = 'gruen' | 'gelb' | 'rot'

export interface PilotStatus {
  ampel: Ampel
  /** Begründungen, warum nicht grün */
  gruende: string[]
}

export const QUALIFIKATION_LABEL: Record<QualifikationTyp, string> = {
  A1_A3: 'EU-Kompetenznachweis A1/A3',
  A2: 'EU-Fernpilotenzeugnis A2',
  STS: 'STS-Zeugnis',
  BOS_GRUND: 'BOS Drohnenausbildung Grundmodul',
  BOS_EINSATZ: 'BOS Drohnenausbildung Einsatzpilot',
  BOS_WAERMEBILD: 'Wärmebild / Thermografie',
  FUNK: 'Funk / Tetra',
  SONSTIGE: 'Sonstige',
}

const schlechter = (a: Ampel, b: Ampel): Ampel => (a === 'rot' || b === 'rot' ? 'rot' : a === 'gelb' || b === 'gelb' ? 'gelb' : 'gruen')

/** Ampel-Status „Einsatzpilot“ nach konfigurierbaren Freigaberegeln. */
export function pilotStatus(
  pilot: Pilot,
  einsaetze: Einsatz[],
  regeln: FreigabeRegeln,
  heute = new Date(),
): PilotStatus {
  let ampel: Ampel = 'gruen'
  const gruende: string[] = []
  const tag = 86400000
  const warnGrenze = heute.getTime() + regeln.warnungTageVorAblauf * tag
  const pruefeDatum = (bis: string | undefined, was: string) => {
    if (!bis) return
    const t = new Date(bis).getTime()
    if (t < heute.getTime()) {
      ampel = 'rot'
      gruende.push(`${was} abgelaufen`)
    } else if (t < warnGrenze) {
      ampel = schlechter(ampel, 'gelb')
      gruende.push(`${was} läuft bald ab`)
    }
  }

  if (!pilot.aktiv) return { ampel: 'rot', gruende: ['Pilot inaktiv'] }

  if (!pilot.freigabe.erteilt) {
    ampel = 'rot'
    gruende.push('Keine Freigabe als Einsatzpilot')
  } else {
    pruefeDatum(pilot.freigabe.gueltigBis, 'Freigabe')
  }

  for (const typ of regeln.pflichtQualifikationen) {
    const q = pilot.qualifikationen
      .filter((x) => x.typ === typ)
      .sort((a, b) => (b.gueltigBis ?? '9999').localeCompare(a.gueltigBis ?? '9999'))[0]
    if (!q) {
      ampel = 'rot'
      gruende.push(`${QUALIFIKATION_LABEL[typ]} fehlt`)
    } else {
      pruefeDatum(q.gueltigBis, QUALIFIKATION_LABEL[typ])
    }
  }

  if (regeln.mindestFluege > 0) {
    const st = pilotStatistik(pilot, einsaetze, regeln.zeitraumTage, heute)
    const n = st.imRegelZeitraum.fluege
    if (n < regeln.mindestFluege) {
      ampel = schlechter(ampel, 'gelb')
      gruende.push(`Flugpraxis: ${n} von ${regeln.mindestFluege} Flügen in ${regeln.zeitraumTage} Tagen`)
    }
  }

  return { ampel, gruende }
}

export interface GeraetStatistik {
  fluege: number
  minuten: number
  /** akkuId -> Zyklen (inkl. vorerfasster) */
  akkuZyklen: Record<string, number>
}

export function geraetStatistik(geraet: Geraet, einsaetze: Einsatz[]): GeraetStatistik {
  const s: GeraetStatistik = { fluege: 0, minuten: geraet.vorerfassteMinuten ?? 0, akkuZyklen: {} }
  for (const a of geraet.akkus) s.akkuZyklen[a.id] = a.vorerfassteZyklen ?? 0
  for (const f of alleFluege(einsaetze)) {
    if (f.geraetId !== geraet.id || !f.landung) continue
    s.fluege++
    s.minuten += f.minuten
    if (f.akkuId && f.akkuId in s.akkuZyklen) s.akkuZyklen[f.akkuId]++
  }
  return s
}
