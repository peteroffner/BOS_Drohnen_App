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

// ---------------------------------------------------------------- Abstände je Rechtsgrundlage

/**
 * Welche Abstandsregeln gelten:
 * - formular: Rechnung laut Checkliste v9 (Bescheid / SPECIFIC BOS, auch wenn noch nichts gewählt ist)
 * - A1/A2/A3: feste Abstände der Kategorie OPEN (VO (EU) 2019/947, UAS.OPEN.020/030/040)
 * - open_offen: OPEN gewählt, aber noch keine Unterkategorie
 */
export type AbstandsModus = 'formular' | 'A1' | 'A2' | 'A3' | 'open_offen'

export function abstandsModus(
  rechtsgrundlage?: 'bescheid' | 'open' | 'specific_bos',
  openUnterkategorie?: 'A1' | 'A2' | 'A3',
): AbstandsModus {
  if (rechtsgrundlage !== 'open') return 'formular'
  return openUnterkategorie ?? 'open_offen'
}

export interface AbstandsWert {
  id: string
  label: string
  /** Herleitung / Bedingung */
  sub: string
  meter: number
  /** Als Kreis um den Startpunkt zeichnen: rot = innerer Schutzbereich, gelb = äußerer */
  kreis?: 'rot' | 'gelb'
}

export interface AbstandsRegel {
  modus: AbstandsModus
  titel: string
  werte: AbstandsWert[]
  hinweise: string[]
  hoeheUeberschritten: boolean
}

export const ABSTAND_HINWEIS_OHNE_GEWAEHR = 'Angaben ohne Gewähr – maßgeblich sind die Vorgaben von Austro Control und der Bescheid.'

export function abstandsRegel(modus: AbstandsModus, flughoeheM: number): AbstandsRegel {
  const s = sicherheitsabstaende(flughoeheM)
  const h = s.flughoehe
  const basis = { modus, hoeheUeberschritten: s.hoeheUeberschritten }
  const einsZuEins = Math.max(30, h)
  switch (modus) {
    case 'A1':
      return {
        ...basis,
        titel: 'Kategorie OPEN · A1',
        werte: [],
        hinweise: [
          'Kein Überflug von Menschenansammlungen.',
          'Unbeteiligte Personen nicht überfliegen (bei Drohnen unter 250 g / Klasse C0: Überflug möglichst vermeiden).',
        ],
      }
    case 'A2':
      return {
        ...basis,
        titel: 'Kategorie OPEN · A2',
        werte: [
          {
            id: 'unbeteiligte',
            label: 'Abstand zu Unbeteiligten',
            sub: 'mind. 30 m horizontal, mindestens aber die Flughöhe (1:1-Regel)',
            meter: einsZuEins,
            kreis: 'rot',
          },
          {
            id: 'langsamflug',
            label: 'Mit Langsamflug-Modus',
            sub: 'bis auf 5 m horizontal, nur bei aktivem Langsamflug-Modus (Klasse C2)',
            meter: 5,
          },
        ],
        hinweise: ['Kein Überflug unbeteiligter Personen und keine Menschenansammlungen.'],
      }
    case 'A3':
      return {
        ...basis,
        titel: 'Kategorie OPEN · A3',
        werte: [
          {
            id: 'gebiete',
            label: 'Abstand zu Wohn-, Gewerbe-, Industrie- und Erholungsgebieten',
            sub: 'mind. 150 m horizontal',
            meter: 150,
            kreis: 'gelb',
          },
          {
            id: 'unbeteiligte',
            label: 'Richtwert Abstand zu Unbeteiligten',
            sub: 'mind. 30 m, mindestens aber die Flughöhe (1:1-Regel)',
            meter: einsZuEins,
            kreis: 'rot',
          },
        ],
        hinweise: ['Im gesamten Flugbereich dürfen sich keine unbeteiligten Personen aufhalten.'],
      }
    case 'open_offen':
      return {
        ...basis,
        titel: 'Kategorie OPEN',
        werte: [],
        hinweise: ['Unterkategorie A1, A2 oder A3 wählen – die Abstände hängen davon ab.'],
      }
    default:
      return {
        ...basis,
        titel: 'Berechnung laut Checkliste Drohnenflug v9 (Bescheid / SPECIFIC)',
        werte:
          h > 0
            ? [
                { id: 'cv', label: 'Contingency Volume', sub: '10 % der Flughöhe', meter: s.contingencyVolume },
                { id: 'grb', label: 'Ground Risk Buffer', sub: 'Flughöhe + CV', meter: s.groundRiskBuffer, kreis: 'rot' },
                {
                  id: 'menschen',
                  label: 'Abstand Menschenansammlung',
                  sub: 'GRB + CV + 120 m',
                  meter: s.abstandMenschenansammlung,
                  kreis: 'gelb',
                },
              ]
            : [],
        hinweise: [
          'Ein Flug über Menschenansammlungen ist nicht erlaubt.',
          `1:1-Regel: horizontaler Mindestabstand zu unbeteiligten Personen = Flughöhe${h > 0 ? ` (${h.toLocaleString('de-AT')} m)` : ''}.`,
        ],
      }
  }
}

/** Kurzfassung für Protokoll/PDF, z. B. "Abstand zu Unbeteiligten 80 m; …" */
export function abstandsKurztext(regel: AbstandsRegel): string {
  const werte = regel.werte.map((w) => `${w.label}: ${w.meter.toLocaleString('de-AT')} m (${w.sub})`)
  return [...werte, ...regel.hinweise].join(' · ')
}
