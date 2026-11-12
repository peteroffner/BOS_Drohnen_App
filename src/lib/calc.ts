/** Berechnungen laut Checkliste Drohnenflug v9, Seite 1. */

export const MAX_FLUGHOEHE_M = 120

export interface Sicherheitsabstaende {
  flughoehe: number
  /** Contingency Volume = 10 % der Flughöhe */
  contingencyVolume: number
  /** Ground Risk Buffer = Flughöhe + Contingency Volume */
  groundRiskBuffer: number
  /** Abstand zu Menschenansammlungen = GRB + CV + 120 m */
  abstandMenschenansammlung: number
  /** Horizontaler Mindestabstand zu unbeteiligten Personen (1:1-Regel) */
  abstandUnbeteiligte: number
  hoeheUeberschritten: boolean
}

const r1 = (n: number) => Math.round(n * 10) / 10

export function sicherheitsabstaende(flughoeheM: number): Sicherheitsabstaende {
  const h = Math.max(0, flughoeheM || 0)
  const cv = r1(h * 0.1)
  const grb = r1(h + cv)
  return {
    flughoehe: h,
    contingencyVolume: cv,
    groundRiskBuffer: grb,
    abstandMenschenansammlung: r1(grb + cv + 120),
    abstandUnbeteiligte: h,
    hoeheUeberschritten: h > MAX_FLUGHOEHE_M,
  }
}

/** Dauer in Minuten zwischen zwei ISO-Zeitpunkten (gerundet, nie negativ). */
export function dauerMinuten(start: string, ende?: string): number {
  if (!ende) return 0
  const ms = new Date(ende).getTime() - new Date(start).getTime()
  return ms > 0 ? Math.round(ms / 60000) : 0
}

/** 95 -> "1:35 h" */
export function formatStunden(minuten: number): string {
  const m = Math.round(minuten)
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h`
}
