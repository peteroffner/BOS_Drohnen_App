import type { Position } from '../../db/types'
import { sicherheitsabstaende } from '../../lib/calc'

/** Offizielle Luftraumkarte von Austro Control (verbindliche Prüfung). */
export const DRONESPACE_URL = 'https://map.dronespace.at/'

/** Mindestabstand zu Flugplätzen ohne Sicherheitszone (Checkliste v9, Punkt 11). */
export const FLUGPLATZ_RADIUS_M = 2500

/** Mitte Österreichs – Startansicht ohne Position. */
export const OESTERREICH_MITTE: [number, number] = [47.6, 13.8]
export const OESTERREICH_ZOOM = 7

export const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'

export type SchutzkreisId = 'grb' | 'menschen' | 'flugplatz'

export interface Schutzkreis {
  id: SchutzkreisId
  label: string
  beschreibung: string
  radiusM: number
  /** Tailwind-Klassen (Theme-Tokens) für Leaflet-Pfad und Legende */
  pfadKlasse: string
  legendeKlasse: string
  gestrichelt: boolean
}

/**
 * Kreise um den Startpunkt nach Checkliste v9: Ground Risk Buffer,
 * Abstand Menschenansammlungen und optional 2,5 km Flugplatz-Abstand.
 * Reihenfolge: groß → klein (damit kleine Kreise oben liegen).
 */
export function schutzkreise(flughoeheM: number, mitFlugplatz: boolean): Schutzkreis[] {
  const s = sicherheitsabstaende(flughoeheM)
  const out: Schutzkreis[] = []
  if (mitFlugplatz) {
    out.push({
      id: 'flugplatz',
      label: 'Flugplatz-Abstand',
      beschreibung: 'Flugplatz ohne Sicherheitszone näher als 2,5 km? (Punkt 11)',
      radiusM: FLUGPLATZ_RADIUS_M,
      pfadKlasse: 'stroke-anthrazit fill-anthrazit',
      legendeKlasse: 'border-anthrazit bg-anthrazit/10 border-dashed',
      gestrichelt: true,
    })
  }
  if (s.flughoehe > 0) {
    out.push({
      id: 'menschen',
      label: 'Abstand Menschenansammlungen',
      beschreibung: `GRB + CV + 120 m`,
      radiusM: s.abstandMenschenansammlung,
      pfadKlasse: 'stroke-warn fill-warn',
      legendeKlasse: 'border-warn bg-warn-bg border-dashed',
      gestrichelt: true,
    })
    out.push({
      id: 'grb',
      label: 'Ground Risk Buffer',
      beschreibung: `Flughöhe + Contingency Volume (${fmtMeter(s.contingencyVolume)})`,
      radiusM: s.groundRiskBuffer,
      pfadKlasse: 'stroke-rot-700 fill-rot-700',
      legendeKlasse: 'border-rot-700 bg-rot-100',
      gestrichelt: false,
    })
  }
  return out
}

/** 132.5 -> "132,5 m", 2500 -> "2,5 km" */
export function fmtMeter(m: number): string {
  if (m >= 1000) return `${(m / 1000).toLocaleString('de-AT', { maximumFractionDigits: 2 })} km`
  return `${m.toLocaleString('de-AT', { maximumFractionDigits: 1 })} m`
}

/** Dezimalgrad mit 5 Nachkommastellen (~1 m) */
export function fmtKoordinaten(p: Position): string {
  return `${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}`
}

/** Grenzen (SW/NO) eines Kreises – für fitBounds ohne Leaflet-Abhängigkeit. */
export function kreisGrenzen(p: Position, radiusM: number): [[number, number], [number, number]] {
  const dLat = radiusM / 111320
  const dLng = radiusM / (111320 * Math.max(0.01, Math.cos((p.lat * Math.PI) / 180)))
  return [
    [p.lat - dLat, p.lng - dLng],
    [p.lat + dLat, p.lng + dLng],
  ]
}

/** Gültige WGS84-Position? */
export function istPosition(p: unknown): p is Position {
  if (!p || typeof p !== 'object') return false
  const { lat, lng } = p as Position
  return typeof lat === 'number' && typeof lng === 'number' && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !Number.isNaN(lat + lng)
}
