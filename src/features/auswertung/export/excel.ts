import type { Workbook, Worksheet } from 'exceljs'
import type { Geraet, Mangel, WartungsPruefung } from '../../../db/types'
import { fmtDatum } from '../../../lib/format'
import { akkuPruefId, WARTUNG_V2 } from '../../../templates/wartung_v2'
import { MONATE_LANG, stunden, type GeraetZeile, type PilotZeile } from '../auswertung'
import type { FlugbuchZeile } from './flugbuchZeilen'

type ExcelJsModul = typeof import('exceljs')

/** exceljs erst bei Bedarf laden (eigener Chunk). */
export async function ladeExcelJs(): Promise<ExcelJsModul> {
  const mod = (await import('exceljs')) as unknown as { default?: ExcelJsModul } & ExcelJsModul
  return mod.default?.Workbook ? mod.default : mod
}

export interface ExcelDaten {
  orgName: string
  zeitraum: string
  /** Jahr für die Wartungsbuch-Matrix */
  wartungsJahr: number
  flugbuch: FlugbuchZeile[]
  piloten: PilotZeile[]
  geraete: GeraetZeile[]
  alleGeraete: Geraet[]
  wartungen: WartungsPruefung[]
  maengel: Mangel[]
}

const AMPEL: Record<PilotZeile['ampel'], string> = { gruen: 'grün – einsatzbereit', gelb: 'gelb – eingeschränkt', rot: 'rot – nicht freigegeben' }
const STATUS: Record<Geraet['status'], string> = { einsatzbereit: 'einsatzbereit', wartung: 'Wartung', ausser_dienst: 'außer Dienst' }
const QUELLE: Record<Mangel['quelle'], string> = { nachkontrolle: 'Nachkontrolle', wartung: 'Wartung', manuell: 'manuell' }
const ERGEBNIS: Record<string, string> = { ok: 'OK', mangel: 'Mangel', na: 'n. a.' }

const FARBE = { rot: 'FFA81010', flaeche: 'FFF6F6F6', ok: 'FFE5F4EA', mangel: 'FFFBE3E3', grau: 'FFE1E1E1' }

/** Blattname: max. 31 Zeichen, ohne : \ / ? * [ ] */
export function blattName(name: string, vergeben: Set<string>): string {
  const basis = name.replace(/[:\\/?*[\]]/g, ' ').trim().slice(0, 31) || 'Blatt'
  let n = basis
  for (let i = 2; vergeben.has(n.toLowerCase()); i++) n = `${basis.slice(0, 28)} ${i}`
  vergeben.add(n.toLowerCase())
  return n
}

function tabellenBlatt(wb: Workbook, name: string, titel: string, spalten: { header: string; key: string; width: number; fmt?: string }[], zeilen: Record<string, unknown>[]): Worksheet {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 3 }] })
  ws.getCell('A1').value = titel
  ws.getCell('A1').font = { bold: true, size: 13, color: { argb: FARBE.rot } }
  const kopf = ws.getRow(3)
  spalten.forEach((s, i) => {
    ws.getColumn(i + 1).width = s.width
    if (s.fmt) ws.getColumn(i + 1).numFmt = s.fmt
    kopf.getCell(i + 1).value = s.header
  })
  kopf.font = { bold: true }
  kopf.alignment = { vertical: 'middle', wrapText: true }
  kopf.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FARBE.grau } }
  })
  for (const z of zeilen) ws.addRow(spalten.map((s) => z[s.key] ?? ''))
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3 + zeilen.length, column: spalten.length } }
  return ws
}

/** Arbeitsmappe mit Flugbuch, Pilotenstunden, Geräte, Wartungsbuch (je Gerät) und Mängeln. */
export async function erzeugeExcel(d: ExcelDaten, ExcelJS?: ExcelJsModul): Promise<ArrayBuffer> {
  const X = ExcelJS ?? (await ladeExcelJs())
  const wb = new X.Workbook()
  wb.creator = 'BOS Drohnen-App'
  wb.created = new Date()
  const namen = new Set<string>()
  const kopf = (was: string) => `${was} – ${d.orgName} – ${d.zeitraum}`

  // Flugbuch
  tabellenBlatt(
    wb,
    blattName('Flugbuch', namen),
    kopf('Flugbuch'),
    [
      { header: 'Nr.', key: 'nr', width: 6 },
      { header: 'Datum', key: 'datum', width: 11 },
      { header: 'Pilot', key: 'pilot', width: 24 },
      { header: 'Gerät', key: 'geraet', width: 24 },
      { header: 'Einsatzort', key: 'einsatzort', width: 26 },
      { header: 'Start', key: 'start', width: 8 },
      { header: 'Landung', key: 'landung', width: 9 },
      { header: 'Dauer (min)', key: 'minuten', width: 11 },
      { header: 'Durchführung', key: 'durchfuehrung', width: 13 },
      { header: 'Payload', key: 'payload', width: 18 },
      { header: 'Einsatz/Ausbildung', key: 'art', width: 20 },
      { header: 'Beschreibung', key: 'beschreibung', width: 36 },
      { header: 'Gesamt-Einsatzleiter', key: 'gesamtEinsatzleiter', width: 22 },
      { header: 'Einsatzleiter Drohne', key: 'einsatzleiterDrohne', width: 22 },
      { header: 'Unfall', key: 'unfall', width: 8 },
      { header: 'Unfallmeldung', key: 'unfallMeldung', width: 20 },
      { header: 'Bemerkungen', key: 'bemerkungen', width: 30 },
    ],
    d.flugbuch as unknown as Record<string, unknown>[],
  )

  // Pilotenstunden
  tabellenBlatt(
    wb,
    blattName('Pilotenstunden', namen),
    kopf('Pilotenstunden'),
    [
      { header: 'Pilot', key: 'name', width: 28 },
      { header: 'Flüge (Zeitraum)', key: 'fluege', width: 14 },
      { header: 'Stunden (Zeitraum)', key: 'stunden', width: 16, fmt: '0.0' },
      { header: 'davon Einsatz (h)', key: 'einsatz', width: 16, fmt: '0.0' },
      { header: 'davon Training/Checkflug (h)', key: 'training', width: 18, fmt: '0.0' },
      { header: 'Flüge gesamt', key: 'gesamtFluege', width: 13 },
      { header: 'Stunden gesamt (inkl. vorerfasst)', key: 'gesamtStunden', width: 20, fmt: '0.0' },
      { header: 'Status (Ampel)', key: 'ampel', width: 22 },
      { header: 'Hinweise', key: 'gruende', width: 50 },
    ],
    d.piloten.map((p) => ({
      name: `${p.pilot.dienstgrad ? p.pilot.dienstgrad + ' ' : ''}${p.pilot.vorname} ${p.pilot.nachname}`,
      fluege: p.fluege,
      stunden: stunden(p.minuten),
      einsatz: stunden(p.minutenEinsatz),
      training: stunden(p.minutenTraining),
      gesamtFluege: p.gesamtFluege,
      gesamtStunden: stunden(p.gesamtMinuten),
      ampel: AMPEL[p.ampel],
      gruende: p.gruende.join('; '),
    })),
  )

  // Geräte
  tabellenBlatt(
    wb,
    blattName('Geräte', namen),
    kopf('Geräte'),
    [
      { header: 'Name', key: 'name', width: 18 },
      { header: 'Hersteller', key: 'hersteller', width: 12 },
      { header: 'Modell', key: 'modell', width: 18 },
      { header: 'Payload', key: 'payload', width: 18 },
      { header: 'Registrierungsnr.', key: 'reg', width: 20 },
      { header: 'Seriennr.', key: 'sn', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'Flüge (Zeitraum)', key: 'fluege', width: 14 },
      { header: 'Stunden (Zeitraum)', key: 'stunden', width: 16, fmt: '0.0' },
      { header: 'Betriebsstunden gesamt', key: 'gesamt', width: 18, fmt: '0.0' },
      { header: 'Akkus (Zyklen)', key: 'akkus', width: 40 },
      { header: 'Offene Mängel', key: 'maengel', width: 13 },
      { header: 'Nächstes Herstellerservice', key: 'service', width: 20 },
    ],
    d.geraete.map((z) => ({
      name: z.geraet.name,
      hersteller: z.geraet.hersteller,
      modell: z.geraet.modell,
      payload: z.geraet.payload ?? '',
      reg: z.geraet.registrierungsnummer ?? '',
      sn: z.geraet.seriennummer ?? '',
      status: STATUS[z.geraet.status],
      fluege: z.fluege,
      stunden: stunden(z.minuten),
      gesamt: stunden(z.gesamtMinuten),
      akkus: z.geraet.akkus.map((a) => `${a.nummer}: ${z.akkuZyklen[a.id] ?? 0}`).join(', '),
      maengel: z.offeneMaengel,
      service: fmtDatum(z.geraet.naechstesHerstellerservice),
    })),
  )

  // Wartungsbuch je Gerät (Jahresmatrix wie Wartungsbuch v2)
  for (const g of d.alleGeraete) wartungsBlatt(wb, blattName(`Wartung ${g.name}`, namen), g, d)

  // Mängel
  const gName = new Map(d.alleGeraete.map((g) => [g.id, g.name]))
  tabellenBlatt(
    wb,
    blattName('Mängel', namen),
    `Mängel – ${d.orgName}`,
    [
      { header: 'Gerät', key: 'geraet', width: 18 },
      { header: 'Erfasst am', key: 'erstellt', width: 12 },
      { header: 'Quelle', key: 'quelle', width: 14 },
      { header: 'Beschreibung', key: 'beschreibung', width: 50 },
      { header: 'Status', key: 'status', width: 10 },
      { header: 'Behoben am', key: 'behoben', width: 12 },
      { header: 'Behoben von', key: 'von', width: 18 },
      { header: 'Maßnahme', key: 'massnahme', width: 40 },
    ],
    [...d.maengel]
      .sort((a, b) => b.erstelltAm.localeCompare(a.erstelltAm))
      .map((m) => ({
        geraet: gName.get(m.geraetId) ?? 'unbekannt',
        erstellt: fmtDatum(m.erstelltAm),
        quelle: QUELLE[m.quelle],
        beschreibung: m.beschreibung,
        status: m.behobenAm ? 'behoben' : 'offen',
        behoben: fmtDatum(m.behobenAm),
        von: m.behobenVon ?? '',
        massnahme: m.massnahme ?? '',
      })),
  )

  return wb.xlsx.writeBuffer() as Promise<ArrayBuffer>
}

function wartungsBlatt(wb: Workbook, name: string, g: Geraet, d: ExcelDaten) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', xSplit: 1, ySplit: 4 }] })
  ws.getCell('A1').value = `Wartungsbuch ${d.wartungsJahr} – ${g.name} (${g.hersteller} ${g.modell})`
  ws.getCell('A1').font = { bold: true, size: 13, color: { argb: FARBE.rot } }
  ws.getCell('A2').value = [d.orgName, g.registrierungsnummer ? `Reg.-Nr. ${g.registrierungsnummer}` : '', g.verantwortlicher ? `Verantwortlich: ${g.verantwortlicher}` : ''].filter(Boolean).join(' · ')
  ws.getColumn(1).width = 58
  for (let m = 1; m <= 12; m++) ws.getColumn(m + 1).width = 11

  const pruef = new Map<number, WartungsPruefung>()
  for (const w of d.wartungen) if (w.geraetId === g.id && w.jahr === d.wartungsJahr) pruef.set(w.monat, w)

  const kopf = ws.getRow(4)
  kopf.values = ['Prüfpunkt', ...MONATE_LANG]
  kopf.font = { bold: true }
  kopf.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FARBE.grau } }
  })

  const zeilen = [
    ...WARTUNG_V2.map((w) => ({ id: w.id, label: `${w.label}${w.intervall !== 'monatlich' ? ` (${w.intervall === 'quartal' ? 'Quartal' : 'Halbjahr'})` : ''}` })),
    ...g.akkus.filter((a) => a.status !== 'ausgemustert').map((a) => ({ id: akkuPruefId(a.id), label: `Akku ${a.nummer} (${a.art === 'drohne' ? 'Drohne' : 'Fernbedienung'})` })),
  ]
  for (const z of zeilen) {
    const row = ws.addRow([z.label, ...Array.from({ length: 12 }, (_, i) => ERGEBNIS[pruef.get(i + 1)?.ergebnisse[z.id] ?? ''] ?? '')])
    row.eachCell((c, col) => {
      if (col === 1) return
      c.alignment = { horizontal: 'center' }
      if (c.value === 'OK') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FARBE.ok } }
      if (c.value === 'Mangel') c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: FARBE.mangel } }
    })
  }
  const pr = ws.addRow(['Prüfer', ...Array.from({ length: 12 }, (_, i) => pruef.get(i + 1)?.pruefer ?? '')])
  const da = ws.addRow(['Datum', ...Array.from({ length: 12 }, (_, i) => fmtDatum(pruef.get(i + 1)?.datum))])
  const be = ws.addRow(['Bemerkung', ...Array.from({ length: 12 }, (_, i) => pruef.get(i + 1)?.bemerkung ?? '')])
  for (const r of [pr, da, be]) r.font = { italic: true }
  be.alignment = { wrapText: true, vertical: 'top' }
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4 + zeilen.length, column: 13 } }
}
