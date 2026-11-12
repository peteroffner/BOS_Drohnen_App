import type { FlugbuchZeile } from './flugbuchZeilen'

/** Feld für CSV (Excel AT: Semikolon) maskieren. */
export function csvFeld(v: string | number | null | undefined): string {
  if (v == null) return ''
  const s = typeof v === 'number' ? String(v).replace('.', ',') : v
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

/** CSV mit Semikolon, CRLF und UTF-8-BOM (damit Excel Umlaute korrekt erkennt). */
export function csvText(kopf: string[], zeilen: (string | number | null | undefined)[][]): string {
  const rows = [kopf, ...zeilen].map((r) => r.map(csvFeld).join(';'))
  return '﻿' + rows.join('\r\n') + '\r\n'
}

export const FLUGBUCH_CSV_KOPF = [
  'Nr.',
  'Datum',
  'Pilot',
  'Gerät',
  'Einsatzort',
  'Start',
  'Landung',
  'Dauer (h:mm)',
  'Dauer (min)',
  'Durchführung',
  'Payload',
  'Einsatz/Ausbildung',
  'Beschreibung',
  'Gesamt-Einsatzleiter',
  'Einsatzleiter Drohne',
  'Unfall',
  'Unfallmeldung',
  'Bemerkungen',
]

export function flugbuchCsv(zeilen: FlugbuchZeile[]): string {
  return csvText(
    FLUGBUCH_CSV_KOPF,
    zeilen.map((z) => [
      z.nr,
      z.datum,
      z.pilot,
      z.geraet,
      z.einsatzort,
      z.start,
      z.landung,
      z.dauer.replace(' h', ''),
      z.minuten,
      z.durchfuehrung,
      z.payload,
      z.art,
      z.beschreibung,
      z.gesamtEinsatzleiter,
      z.einsatzleiterDrohne,
      z.unfall,
      z.unfallMeldung,
      z.bemerkungen,
    ]),
  )
}
