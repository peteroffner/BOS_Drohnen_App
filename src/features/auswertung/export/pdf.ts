import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces'
import { fmtDatumZeit } from '../../../lib/format'
import { downloadBlob } from './download'

type PdfMake = typeof import('pdfmake/build/pdfmake')

let cache: Promise<PdfMake> | undefined

/** pdfmake (0.3) + Roboto-Schriften erst bei Bedarf laden (eigener Chunk). */
export function ladePdfMake(): Promise<PdfMake> {
  cache ??= (async () => {
    const mod = (await import('pdfmake/build/pdfmake')) as unknown as { default?: PdfMake } & PdfMake
    const pdfMake = mod.default ?? mod
    const vfsMod = (await import('pdfmake/build/vfs_fonts')) as unknown as { default?: Record<string, string> } & Record<string, string>
    pdfMake.addVirtualFileSystem(vfsMod.default ?? vfsMod)
    return pdfMake
  })()
  cache.catch(() => (cache = undefined))
  return cache
}

/** Farben (Theme: Feuerwehrrot / Anthrazit) – im PDF als Hex nötig */
export const PDF_FARBE = {
  rot: '#a81010',
  anthrazit: '#333333',
  linie: '#e1e1e1',
  flaeche: '#f6f6f6',
  grau: '#666666',
}

export function fusszeile(erstellt = new Date()) {
  const text = `Erstellt mit BOS Drohnen-App, ${fmtDatumZeit(erstellt.toISOString())}`
  return (seite: number, seiten: number): Content => ({
    margin: [40, 8, 40, 0],
    columns: [
      { text, fontSize: 7, color: PDF_FARBE.grau },
      { text: `Seite ${seite} von ${seiten}`, alignment: 'right', fontSize: 7, color: PDF_FARBE.grau },
    ],
  })
}

export const PDF_STILE: TDocumentDefinitions['styles'] = {
  titel: { fontSize: 16, bold: true, color: PDF_FARBE.rot },
  untertitel: { fontSize: 9, color: PDF_FARBE.grau },
  h2: { fontSize: 11, bold: true, color: PDF_FARBE.rot, margin: [0, 10, 0, 4] },
  th: { bold: true, fontSize: 7.5, fillColor: PDF_FARBE.flaeche },
  klein: { fontSize: 7.5 },
  label: { bold: true },
}

/** schlichte Linien-Tabelle */
export const LINIEN_LAYOUT = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => '#bbbbbb',
  vLineColor: () => '#bbbbbb',
  paddingLeft: () => 3,
  paddingRight: () => 3,
  paddingTop: () => 2,
  paddingBottom: () => 2,
}

export async function pdfErzeugen(doc: TDocumentDefinitions): Promise<Blob> {
  const pdfMake = await ladePdfMake()
  return pdfMake.createPdf(doc).getBlob()
}

export async function pdfHerunterladen(doc: TDocumentDefinitions, dateiname: string) {
  downloadBlob(await pdfErzeugen(doc), dateiname)
}
