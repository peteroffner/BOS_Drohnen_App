import type { Position } from '../../db/types'
import { abstandsRegel, type AbstandsModus } from '../../lib/calc'

/** Offizielle Luftraumkarte von Austro Control (verbindliche Prüfung). */
export const DRONESPACE_URL = 'https://map.dronespace.at/'
/** Private, unverbindliche Übersichtskarte (W4 Sky Media) – nur als Link, nicht eingebettet */
export const DROHNENKARTE_URL = 'https://drohnenkarte.at/'

/** Mindestabstand zu Flugplätzen ohne Sicherheitszone (Checkliste v9, Punkt 11). */
export const FLUGPLATZ_RADIUS_M = 2500

/** Mitte Österreichs – Startansicht ohne Position. */
export const OESTERREICH_MITTE: [number, number] = [47.6, 13.8]
export const OESTERREICH_ZOOM = 7

export const OSM_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende'

/** 'flugplatz' oder die ID eines Abstandswerts aus abstandsRegel (z. B. 'grb', 'menschen', 'unbeteiligte', 'gebiete') */
export type SchutzkreisId = string

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
 * Kreise um den Startpunkt, passend zur Rechtsgrundlage (siehe abstandsRegel):
 * Bescheid/SPECIFIC → Ground Risk Buffer + Abstand Menschenansammlungen,
 * OPEN A2/A3 → feste OPEN-Abstände; optional 2,5 km Flugplatz-Abstand.
 * Reihenfolge: groß → klein (damit kleine Kreise oben liegen).
 */
export function schutzkreise(flughoeheM: number, mitFlugplatz: boolean, modus: AbstandsModus = 'formular'): Schutzkreis[] {
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
  const kreise = abstandsRegel(modus, flughoeheM)
    .werte.filter((w) => w.kreis && w.meter > 0)
    .sort((a, b) => b.meter - a.meter)
  for (const w of kreise) {
    const gelb = w.kreis === 'gelb'
    out.push({
      id: w.id,
      label: w.label,
      beschreibung: w.sub,
      radiusM: w.meter,
      pfadKlasse: gelb ? 'stroke-warn fill-warn' : 'stroke-rot-700 fill-rot-700',
      legendeKlasse: gelb ? 'border-warn bg-warn-bg border-dashed' : 'border-rot-700 bg-rot-100',
      gestrichelt: gelb,
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
