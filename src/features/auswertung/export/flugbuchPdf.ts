import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import { formatStunden } from '../../../lib/calc'
import type { FlugbuchZeile } from './flugbuchZeilen'
import { fusszeile, LINIEN_LAYOUT, PDF_FARBE, PDF_STILE } from './pdf'

/** Dokumentdefinition „Flugbuch“ im Aufbau von Flugbuch v2 (A4 quer). */
export function flugbuchPdfDoc(zeilen: FlugbuchZeile[], org: { name: string }, zeitraum: string, erstellt = new Date()): TDocumentDefinitions {
  const kopf: TableCell[] = [
    '#',
    'Datum',
    'Pilot / Gerät',
    'Einsatzort',
    'Start / Landung / Dauer',
    'Durch-\nführung',
    'Payload',
    'Einsatz/Ausbildung – Beschreibung',
    'Einsatzleiter\n(Gesamt-EL / Drohne)',
    'Unfall',
    'Bemerkungen',
  ].map((t) => ({ text: t, style: 'th' }))

  const body: TableCell[][] = [kopf]
  for (const z of zeilen) {
    body.push([
      { text: String(z.nr), alignment: 'right' },
      z.datum,
      { stack: [{ text: z.pilot, bold: true }, z.geraet] },
      z.einsatzort,
      { stack: [`${z.start} – ${z.landung}`, { text: z.dauer, bold: true }] },
      z.durchfuehrung,
      z.payload,
      { stack: [{ text: z.art, bold: true }, z.beschreibung] },
      { stack: [z.gesamtEinsatzleiter || '–', z.einsatzleiterDrohne || '–'] },
      { stack: [{ text: z.unfall, bold: z.unfall === 'ja', color: z.unfall === 'ja' ? PDF_FARBE.rot : undefined }, z.unfallMeldung] },
      z.bemerkungen,
    ])
  }
  const summe = zeilen.reduce((s, z) => s + z.minuten, 0)

  const inhalt: Content[] = [
    {
      columns: [
        { stack: [{ text: 'Flugbuch', style: 'titel' }, { text: org.name, fontSize: 11, bold: true }] },
        {
          stack: [
            { text: `Zeitraum: ${zeitraum}`, bold: true },
            { text: `${zeilen.length} Flüge · Flugzeit gesamt ${formatStunden(summe)}`, style: 'untertitel' },
          ],
          alignment: 'right',
        },
      ],
      margin: [0, 0, 0, 8],
    },
    zeilen.length
      ? {
          table: { headerRows: 1, dontBreakRows: true, widths: [14, 40, 85, 65, 52, 34, 52, '*', 78, 48, 75], body },
          layout: LINIEN_LAYOUT,
          fontSize: 7.5,
        }
      : { text: 'Im gewählten Zeitraum sind keine Flüge erfasst.', italics: true },
  ]

  return {
    pageSize: 'A4',
    pageOrientation: 'landscape',
    pageMargins: [40, 36, 40, 40],
    info: { title: `Flugbuch ${org.name} ${zeitraum}`, creator: 'BOS Drohnen-App' },
    defaultStyle: { font: 'Roboto', fontSize: 8, color: PDF_FARBE.anthrazit },
    styles: PDF_STILE,
    footer: fusszeile(erstellt),
    content: inhalt,
  }
}
