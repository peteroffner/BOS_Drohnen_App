import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { STANDARD_FREIGABE_REGELN } from '../../../lib/useOrg'
import { WARTUNG_V2 } from '../../../templates/wartung_v2'
import { einsaetzeImZeitraum, geraetTabelle, jahresZeitraum, pilotTabelle } from '../auswertung'
import { erzeugeDemodaten } from '../demo'
import { blattName, erzeugeExcel } from './excel'
import { einsatzPdfDoc } from './einsatzPdf'
import { flugbuchPdfDoc } from './flugbuchPdf'
import { flugbuchZeilen } from './flugbuchZeilen'

const heute = new Date('2026-11-12T12:00:00')
const d = erzeugeDemodaten('org', heute)
const z = jahresZeitraum(2026)
const imZr = einsaetzeImZeitraum(d.einsaetze, z)

describe('Excel-Export', () => {
  it('Blattnamen sind gültig und eindeutig', () => {
    const s = new Set<string>()
    expect(blattName('Wartung a/b:c', s)).toBe('Wartung a b c')
    expect(blattName('X'.repeat(40), s)).toHaveLength(31)
    expect(blattName('X'.repeat(40), s)).toBe('X'.repeat(28) + ' 2')
  })

  it('erzeugt Arbeitsmappe mit allen Blättern, wieder einlesbar', async () => {
    const buf = await erzeugeExcel(
      {
        orgName: 'FF Test',
        zeitraum: '2026',
        wartungsJahr: 2026,
        flugbuch: flugbuchZeilen(imZr, d),
        piloten: pilotTabelle(d.piloten, d.einsaetze, imZr, STANDARD_FREIGABE_REGELN, heute),
        geraete: geraetTabelle(d.geraete, d.einsaetze, imZr, d.maengel),
        alleGeraete: d.geraete,
        wartungen: d.wartungen,
        maengel: d.maengel,
      },
      ExcelJS,
    )
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Flugbuch', 'Pilotenstunden', 'Geräte', 'Wartung Hornisse 1', 'Wartung Hornisse 2', 'Mängel'])
    const fb = wb.getWorksheet('Flugbuch')!
    expect(fb.getRow(3).getCell(1).value).toBe('Nr.')
    expect(fb.getRow(3).font?.bold).toBe(true)
    expect(fb.rowCount).toBe(3 + imZr.reduce((s, e) => s + e.fluege.length, 0))
    expect(fb.autoFilter).toBeTruthy()
    const w1 = wb.getWorksheet('Wartung Hornisse 1')!
    expect(w1.getRow(4).getCell(2).value).toBe('Jänner')
    expect(w1.getRow(5).getCell(1).value).toBe(WARTUNG_V2[0].label)
    // Akku-Zeilen nach den Prüfpunkten
    expect(String(w1.getRow(5 + WARTUNG_V2.length).getCell(1).value)).toMatch(/^Akku 1/)
    const okZellen = w1.getRow(5).values as unknown[]
    expect(okZellen.filter((v) => v === 'OK').length).toBeGreaterThan(0)
    const m = wb.getWorksheet('Mängel')!
    expect(m.rowCount).toBe(3 + d.maengel.length)
  })
})

describe('PDF-Dokumentdefinitionen', () => {
  it('Flugbuch quer mit Kopf und Fußzeile', () => {
    const doc = flugbuchPdfDoc(flugbuchZeilen(imZr, d), { name: 'FF Test' }, '2026', heute)
    expect(doc.pageOrientation).toBe('landscape')
    const fuss = (doc.footer as (a: number, b: number) => unknown)(2, 5)
    expect(JSON.stringify(fuss)).toContain('Seite 2 von 5')
    expect(JSON.stringify(fuss)).toContain('Erstellt mit BOS Drohnen-App')
  })
  it('Einsatzprotokoll enthält Sektionen, Flüge, Unterschrift', () => {
    const e = d.einsaetze.find((x) => x.uebersteuerungen?.length)!
    const json = JSON.stringify(einsatzPdfDoc({ einsatz: e, org: { name: 'FF Test' }, piloten: d.piloten, geraete: d.geraete }).content)
    for (const t of ['Einsatzdaten', 'Rechtsgrundlage', 'Vorbereitung', 'Vorflugkontrolle', 'Betriebskontrolle', 'Nachkontrolle', 'Übersteuerte Pflichtpunkte', 'Verwendete Akkus', 'Einsatzende', 'Unterschrift Pilot', 'Nachträge', 'GPS-Stärke'])
      expect(json).toContain(t)
    expect(json).toContain('"image":"data:image/png;base64,')
  })
})
