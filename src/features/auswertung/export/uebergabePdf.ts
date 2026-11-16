import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import type { Ausleihe, Geraet, VerleihPosition } from '../../../db/types'
import { fmtDatum, fmtDatumZeit } from '../../../lib/format'
import { dateiSicher } from './download'
import { fusszeile, LINIEN_LAYOUT, pdfHerunterladen, PDF_FARBE, PDF_STILE } from './pdf'

const RUECKGABE: Record<NonNullable<VerleihPosition['rueckgabe']>, string> = { ok: 'zurück, in Ordnung', beschaedigt: 'BESCHÄDIGT', fehlt: 'FEHLT' }

const kv = (zeilen: [string, string | undefined][]): Content => ({
  table: {
    widths: [130, '*'],
    body: zeilen.map(([k, v]) => [{ text: k, bold: true, fillColor: PDF_FARBE.flaeche }, v ? { text: v } : { text: '–', color: PDF_FARBE.grau }] as TableCell[]),
  },
  layout: LINIEN_LAYOUT,
})

const unterschriftFeld = (titel: string, name?: string): Content => ({
  stack: [
    { text: ' ', margin: [0, 22, 0, 0] },
    { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 220, y2: 0, lineWidth: 0.7, lineColor: PDF_FARBE.anthrazit }] },
    { text: `${titel}${name ? `: ${name}` : ''}`, fontSize: 8, color: PDF_FARBE.grau, margin: [0, 2, 0, 0] },
  ],
})

/** Übergabeprotokoll (Ausgabe und – falls erfolgt – Rückgabe) mit Inventar-Checkliste und Unterschriftsfeldern */
export function uebergabePdfDoc(a: Ausleihe, geraet: Geraet, orgName?: string, erstellt = new Date()): TDocumentDefinitions {
  const zurueck = a.status === 'zurueck'
  const kopf = [
    { text: 'Inv.-Nr.', style: 'th' },
    { text: 'Teil', style: 'th' },
    { text: 'Serien-Nr.', style: 'th' },
    { text: 'Ausgegeben', style: 'th' },
    { text: 'Rückgabe', style: 'th' },
    { text: 'Bemerkung', style: 'th' },
  ]
  const zeilen = a.positionen.map((p) => [
    p.inventarnummer ?? '–',
    `${p.bezeichnung}${p.anzahl ? ` (${p.anzahl} Stk.)` : ''}`,
    p.seriennummer ?? '–',
    p.ausgegeben ? 'ja' : 'nein',
    !p.ausgegeben ? '–' : p.rueckgabe ? { text: RUECKGABE[p.rueckgabe], bold: p.rueckgabe !== 'ok', color: p.rueckgabe === 'ok' ? PDF_FARBE.anthrazit : PDF_FARBE.rot } : zurueck ? '?' : '',
    p.bemerkung ?? '',
  ])

  const inhalt: Content[] = [
    {
      columns: [
        { stack: [{ text: 'Übergabeprotokoll Drohne', style: 'titel' }, { text: orgName ?? '', fontSize: 11, bold: true }] },
        {
          alignment: 'right',
          stack: [
            { text: zurueck ? 'Ausgabe und Rückgabe' : 'Ausgabe (verliehen)', bold: true },
            { text: `Ausgabe am ${fmtDatumZeit(a.ausgabeZeit)}`, style: 'untertitel' },
          ],
        },
      ],
      margin: [0, 0, 0, 8],
    },
    { text: 'Gerät', style: 'h2' },
    kv([
      ['Gerät', `${geraet.name} – ${[geraet.hersteller, geraet.modell].filter(Boolean).join(' ')}`],
      ['Inventarnummer', geraet.inventarnummer],
      ['Registrierungsnummer', geraet.registrierungsnummer],
      ['Seriennummer', geraet.seriennummer],
    ]),
    { text: 'Übernehmende Organisation', style: 'h2' },
    kv([
      ['Organisation / Feuerwehr', a.empfaenger],
      ['Ansprechperson', a.ansprechperson],
      ['Telefon', a.telefon],
      ['E-Mail', a.email],
      ['Zweck', a.zweck],
      ['Geplante Rückgabe', a.geplanteRueckgabe ? fmtDatum(a.geplanteRueckgabe) : undefined],
    ]),
    { text: 'Ausgabe', style: 'h2' },
    kv([
      ['Zeitpunkt', fmtDatumZeit(a.ausgabeZeit)],
      ['Übergeben durch', a.ausgabeDurch],
      ['Bemerkung', a.ausgabeBemerkung],
    ]),
    { text: 'Inventar-Checkliste', style: 'h2' },
    {
      table: { headerRows: 1, widths: [55, '*', 70, 45, 70, 90], body: [kopf, ...zeilen] as TableCell[][] },
      layout: LINIEN_LAYOUT,
      fontSize: 8,
    },
    {
      columns: [unterschriftFeld('Übergeben (Verleiher)', a.ausgabeDurch), unterschriftFeld('Übernommen (Entleiher)', a.ansprechperson)],
      columnGap: 30,
      margin: [0, 6, 0, 0],
    },
  ]

  if (zurueck) {
    inhalt.push(
      { text: 'Rückgabe', style: 'h2' },
      kv([
        ['Zeitpunkt', fmtDatumZeit(a.rueckgabeZeit)],
        ['Zurückgegeben von', a.rueckgabeUebergebenVon],
        ['Zurückgenommen durch', a.rueckgabeDurch],
        ['Bemerkung', a.rueckgabeBemerkung],
      ]),
      {
        columns: [unterschriftFeld('Zurückgegeben (Entleiher)', a.rueckgabeUebergebenVon), unterschriftFeld('Zurückgenommen (Verleiher)', a.rueckgabeDurch)],
        columnGap: 30,
        margin: [0, 6, 0, 0],
      },
    )
  }

  return {
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    content: inhalt,
    footer: fusszeile(erstellt),
    styles: PDF_STILE,
    defaultStyle: { fontSize: 9, color: PDF_FARBE.anthrazit },
    info: { title: `Übergabeprotokoll ${geraet.name}` },
  }
}

export function uebergabePdfDateiname(a: Ausleihe, geraet: Geraet): string {
  return `Uebergabe_${dateiSicher(geraet.name)}_${dateiSicher(a.empfaenger)}_${a.ausgabeZeit.slice(0, 10)}.pdf`
}

export async function exportUebergabePdf(a: Ausleihe, geraet: Geraet, orgName?: string): Promise<void> {
  await pdfHerunterladen(uebergabePdfDoc(a, geraet, orgName), uebergabePdfDateiname(a, geraet))
}
