import type { Column, Content, ContentText, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces'
import { db } from '../../../db/db'
import type { ChecklistAntwort, ChecklistItem, ChecklistSektion, ChecklistVorlage, Einsatz, Geraet, Organisation, Pilot, Rolle } from '../../../db/types'
import { dauerMinuten, formatStunden, sicherheitsabstaende } from '../../../lib/calc'
import { fmtDatum, fmtDatumZeit, fmtZeit, pilotName } from '../../../lib/format'
import { alleItems, VORLAGEN } from '../../../templates/checkliste_v9'
import { dateiSicher } from './download'
import { rollenName } from './flugbuchZeilen'
import { fusszeile, LINIEN_LAYOUT, pdfHerunterladen, PDF_FARBE, PDF_STILE } from './pdf'

export interface EinsatzPdfDaten {
  einsatz: Einsatz
  org?: Pick<Organisation, 'name'>
  piloten: Pilot[]
  geraete: Geraet[]
  vorlage?: ChecklistVorlage
}

// ------------------------------------------------------------ Bausteine

/** Kästchen (Vektor, da Roboto keine ☑/☐-Glyphen enthält) */
function kaestchen(an: boolean): Column {
  return {
    width: 10,
    canvas: [
      { type: 'rect', x: 0, y: 1.5, w: 7, h: 7, lineWidth: 0.7, lineColor: PDF_FARBE.anthrazit },
      ...(an
        ? [
            {
              type: 'polyline' as const,
              points: [
                { x: 1.2, y: 5 },
                { x: 3, y: 7.2 },
                { x: 6.2, y: 2.4 },
              ],
              lineWidth: 1.3,
              lineColor: PDF_FARBE.rot,
            },
          ]
        : []),
    ],
  }
}

const cb = (an: boolean, text: string, margin = 0): Content => ({
  columns: [kaestchen(an), { width: '*', text }],
  columnGap: 3,
  margin: [margin, 1, 0, 1],
})

const optionenSpalten = (optionen: { label: string; an: boolean }[]): Column[] =>
  optionen.flatMap((o): Column[] => [kaestchen(o.an), { width: 'auto', text: o.label, margin: [0, 0, 10, 0] }])

const optionenZeile = (optionen: { label: string; an: boolean }[]): Content => ({ columns: optionenSpalten(optionen), columnGap: 2 })

const h2 = (text: string): Content => ({ text, style: 'h2' })

/** Zwei-Spalten-Tabelle Bezeichnung | Wert */
function kvTabelle(zeilen: [string, Content | string | undefined][]): Content {
  return {
    table: {
      widths: [150, '*'],
      body: zeilen.map(([k, v]) => [{ text: k, bold: true, fillColor: PDF_FARBE.flaeche }, v === undefined || v === '' ? { text: '–', color: PDF_FARBE.grau } : v] as TableCell[]),
    },
    layout: LINIEN_LAYOUT,
  }
}

function tabelle(kopf: string[], zeilen: TableCell[][], widths: (number | string)[]): Content {
  return {
    table: { headerRows: 1, dontBreakRows: true, widths, body: [kopf.map((t) => ({ text: t, style: 'th' })), ...zeilen] },
    layout: LINIEN_LAYOUT,
    fontSize: 8,
  }
}

// ------------------------------------------------------------ Checklisten-Items (generisch)

function wertText(item: ChecklistItem, a: ChecklistAntwort | undefined): string {
  if (a === undefined || a === null || a === '') return ''
  switch (item.typ) {
    case 'zeit':
      return typeof a === 'string' ? fmtDatumZeit(a) : String(a)
    case 'zahl':
      return `${typeof a === 'number' ? a.toLocaleString('de-AT') : String(a)}${item.einheit ? ` ${item.einheit}` : ''}`
    case 'mehrfach':
      return Array.isArray(a) ? a.map((id) => item.optionen?.find((o) => o.id === id)?.label ?? id).join(', ') : String(a)
    default:
      return Array.isArray(a) ? a.join(', ') : String(a)
  }
}

const nrLabel = (it: ChecklistItem) => (it.nr ? `${it.nr}. ` : '') + it.label

/** Rendert ein Checklisten-Item inkl. Unterpunkten und Folgefeldern. */
export function itemInhalt(it: ChecklistItem, antworten: Record<string, ChecklistAntwort>, uebersteuert: Set<string>, ebene = 0): Content[] {
  const a = antworten[it.id]
  const einzug = ebene * 14
  const out: Content[] = []
  const marke = uebersteuert.has(it.id) ? { text: '  [übersteuert]', color: PDF_FARBE.rot, bold: true } : ''
  const label: ContentText = { text: [{ text: nrLabel(it), bold: ebene === 0 }, marke] }

  switch (it.typ) {
    case 'check': {
      const an = a === true || (a === undefined && !!it.unterpunkte?.length && it.unterpunkte.every((u) => u.typ !== 'check' || antworten[u.id] === true))
      out.push({ columns: [kaestchen(an), { width: '*', ...label }], columnGap: 3, margin: [einzug, 1.5, 0, 1.5] })
      break
    }
    case 'janein':
      out.push({
        columns: [{ width: '*', ...label }, ...optionenSpalten([{ label: 'ja', an: a === 'ja' || a === true }, { label: 'nein', an: a === 'nein' || a === false }])],
        columnGap: 2,
        margin: [einzug, 1.5, 0, 1.5],
      })
      break
    case 'auswahl':
    case 'mehrfach': {
      const gewaehlt = (id: string) => (Array.isArray(a) ? a.includes(id) : a === id)
      out.push({ ...label, margin: [einzug, 2, 0, 1] })
      for (const o of it.optionen ?? []) {
        out.push(cb(gewaehlt(o.id), o.label + (o.erzeugtMangel && gewaehlt(o.id) ? '  → Mangel/Wartung' : ''), einzug + 12))
        if (gewaehlt(o.id)) for (const f of o.folgeFelder ?? []) out.push(...itemInhalt(f, antworten, uebersteuert, ebene + 2))
      }
      break
    }
    default: {
      const w = wertText(it, a)
      out.push({
        columns: [
          { width: '45%', ...label },
          { width: '*', text: w || '________________', color: w ? PDF_FARBE.anthrazit : '#aaaaaa', bold: !!w },
        ],
        columnGap: 6,
        margin: [einzug, 1.5, 0, 1.5],
      })
    }
  }
  if (it.hinweis && ebene === 0 && it.typ !== 'check') out.push({ text: it.hinweis, fontSize: 7, color: PDF_FARBE.grau, italics: true, margin: [einzug + 12, 0, 0, 1] })
  for (const u of it.unterpunkte ?? []) out.push(...itemInhalt(u, antworten, uebersteuert, ebene + 1))
  return out
}

function sektionInhalt(s: ChecklistSektion, e: Einsatz, uebersteuert: Set<string>): Content[] {
  const out: Content[] = [h2(s.titel)]
  if (s.hinweis) out.push({ text: s.hinweis, italics: true, fontSize: 8, color: PDF_FARBE.grau, margin: [0, 0, 0, 3] })
  for (const it of s.items) out.push({ stack: itemInhalt(it, e.antworten ?? {}, uebersteuert), unbreakable: !it.unterpunkte || it.unterpunkte.length < 6 })
  return out
}

// ------------------------------------------------------------ Dokument

const ART: Record<Einsatz['art'], string> = { einsatz: 'Einsatzflug', training: 'Trainingsflug', checkflug: 'Checkflug' }
const STATUS: Record<Einsatz['status'], string> = { vorbereitung: 'in Vorbereitung', laufend: 'laufend', nachbereitung: 'in Nachbereitung', abgeschlossen: 'abgeschlossen' }

function unterschriftBild(dataUrl: string): Content | undefined {
  if (/^data:image\/(png|jpe?g);base64,/i.test(dataUrl)) return { image: dataUrl, fit: [220, 80] }
  const svg = dataUrl.match(/^data:image\/svg\+xml(;base64)?,(.*)$/i)
  if (svg) {
    try {
      const text = svg[1] ? atob(svg[2]) : decodeURIComponent(svg[2])
      return { svg: text, fit: [220, 80] }
    } catch {
      return undefined
    }
  }
  return undefined
}

export function einsatzPdfDoc({ einsatz: e, org, piloten, geraete, vorlage }: EinsatzPdfDaten, erstellt = new Date()): TDocumentDefinitions {
  const v = vorlage ?? VORLAGEN[e.vorlageId]
  const gMap = new Map(geraete.map((g) => [g.id, g]))
  const pMap = new Map(piloten.map((p) => [p.id, p]))
  const uebersteuert = new Set((e.uebersteuerungen ?? []).map((u) => u.itemId))
  const rolle = (r?: Rolle) => rollenName(r, piloten)
  const abst = sicherheitsabstaende(e.geplanteFlughoeheM ?? 0)
  const m = (x: number) => `${x.toLocaleString('de-AT')} m`
  const inhalt: Content[] = []

  // Kopf
  inhalt.push({
    columns: [
      {
        stack: [
          { text: 'Einsatzprotokoll Drohnenflug', style: 'titel' },
          { text: org?.name ?? '', fontSize: 11, bold: true },
        ],
      },
      {
        alignment: 'right',
        stack: [
          { text: `${ART[e.art]} · ${fmtDatumZeit(e.datum)}`, bold: true },
          { text: `Status: ${STATUS[e.status]}${e.abgeschlossenAm ? ` am ${fmtDatumZeit(e.abgeschlossenAm)}` : ''}`, style: 'untertitel' },
          { text: v ? `Vorlage: ${v.name} ${v.version}` : `Vorlage: ${e.vorlageId}`, style: 'untertitel' },
        ],
      },
    ],
    margin: [0, 0, 0, 6],
  })

  // Einsatzdaten
  inhalt.push(h2('Einsatzdaten'))
  inhalt.push(
    kvTabelle([
      ['Datum / Uhrzeit', fmtDatumZeit(e.datum)],
      ['Art', optionenZeile((['einsatz', 'training', 'checkflug'] as const).map((a) => ({ label: ART[a], an: e.art === a })))],
      ['Alarmierung / Auftrag von', e.alarmierungVon],
      ['Grund des Fluges', e.grund],
      ['Beschreibung (Flugbuch)', e.beschreibung],
      ['Bezeichnung Fluggebiet', e.fluggebiet],
      ['Gemeindegebiet', e.gemeinde],
      ['Startpunkt (GPS)', e.position ? `${e.position.lat.toFixed(5)}, ${e.position.lng.toFixed(5)}${e.position.genauigkeit ? ` (± ${Math.round(e.position.genauigkeit)} m)` : ''}` : undefined],
      [
        'Fluggerät(e)',
        e.geraetIds.length
          ? {
              stack: e.geraetIds.map((id) => {
                const g = gMap.get(id)
                return g ? `${g.name} – ${g.hersteller} ${g.modell}${g.registrierungsnummer ? `, Reg.-Nr. ${g.registrierungsnummer}` : ''}` : 'unbekanntes Gerät'
              }),
            }
          : undefined,
      ],
      ['Payload', e.payload || e.geraetIds.map((id) => gMap.get(id)?.payload).filter(Boolean).join(', ')],
      ['Durchführung', optionenZeile((['VLOS', 'EVLOS', 'BVLOS'] as const).map((f) => ({ label: f, an: e.flugart === f })))],
    ]),
  )

  // Rechtsgrundlage
  inhalt.push(h2('Rechtsgrundlage'))
  inhalt.push({
    stack: [
      cb(e.rechtsgrundlage === 'bescheid', `Bescheid Austro Control${e.rechtsgrundlage === 'bescheid' && e.bescheidNr ? ` – Nr. ${e.bescheidNr}` : ''}`),
      cb(e.rechtsgrundlage === 'open', `Kategorie OPEN${e.rechtsgrundlage === 'open' && e.openUnterkategorie ? ` – Unterkategorie ${e.openUnterkategorie}` : ' (A1 / A2 / A3)'}`),
      cb(e.rechtsgrundlage === 'specific_bos', `SPECIFIC BOS${e.rechtsgrundlage === 'specific_bos' && e.bescheidNr ? ` – Bescheid-Nr. ${e.bescheidNr}` : ''}`),
      cb(!!e.dronespaceGeprueft, `Luftraum in Dronespace geprüft${e.dronespaceGeprueft ? ` am ${fmtDatumZeit(e.dronespaceGeprueft)}` : ''}`),
    ],
  })

  // Sicherheitsabstände
  inhalt.push(h2('Flughöhe und Sicherheitsabstände'))
  inhalt.push(
    kvTabelle([
      ['Geplante Flughöhe', e.geplanteFlughoeheM != null ? m(abst.flughoehe) + (abst.hoeheUeberschritten ? '  (über 120 m!)' : '') : undefined],
      ['Contingency Volume (10 %)', e.geplanteFlughoeheM != null ? m(abst.contingencyVolume) : undefined],
      ['Ground Risk Buffer (Höhe + CV)', e.geplanteFlughoeheM != null ? m(abst.groundRiskBuffer) : undefined],
      ['Abstand Menschenansammlungen (GRB + CV + 120 m)', e.geplanteFlughoeheM != null ? m(abst.abstandMenschenansammlung) : undefined],
      ['Abstand unbeteiligte Personen (1:1-Regel)', e.geplanteFlughoeheM != null ? m(abst.abstandUnbeteiligte) : undefined],
    ]),
  )

  // Rollen
  inhalt.push(h2('Rollen'))
  inhalt.push(
    kvTabelle([
      ['Gesamt-Einsatzleiter', rolle(e.rollen?.gesamtEinsatzleiter)],
      ['Drohnen-Teamleiter', rolle(e.rollen?.teamleiter)],
      ['Drohnen-Abschnittsleiter', rolle(e.rollen?.abschnittsleiter)],
      ['Pilot', rolle(e.rollen?.pilot)],
      ['Luftraumbeobachter / Helfer', (e.rollen?.luftraumbeobachter ?? []).map(rolle).filter(Boolean).join(', ')],
    ]),
  )

  // Checkliste (ohne Nachkontrolle / Einsatzende)
  const spaet = (s: ChecklistSektion) => s.phase === 'nachkontrolle' || s.phase === 'einsatzende'
  if (v) for (const s of v.sektionen.filter((s) => !spaet(s))) inhalt.push(...sektionInhalt(s, e, uebersteuert))
  else inhalt.push({ text: `Checklisten-Vorlage „${e.vorlageId}“ ist nicht verfügbar – Antworten können nicht dargestellt werden.`, italics: true })

  // Übersteuerungen
  if (e.uebersteuerungen?.length) {
    const items = v ? alleItems(v) : []
    inhalt.push(h2('Übersteuerte Pflichtpunkte'))
    inhalt.push(
      tabelle(
        ['Zeit', 'Punkt', 'Begründung'],
        e.uebersteuerungen.map((u) => {
          const it = items.find((x) => x.id === u.itemId)
          return [fmtDatumZeit(u.zeit), it ? nrLabel(it) : u.itemId, u.begruendung]
        }),
        [70, 180, '*'],
      ),
    )
  }

  // Ereignisse
  inhalt.push(h2('Ereignisse / Informationsweitergabe'))
  inhalt.push(
    e.ereignisse?.length
      ? tabelle(
          ['Zeit', 'Typ', 'Bezug', 'Text'],
          [...e.ereignisse]
            .sort((a, b) => a.zeit.localeCompare(b.zeit))
            .map((x) => [fmtDatumZeit(x.zeit), x.typ === 'notfall' ? { text: 'NOTFALL', bold: true, color: PDF_FARBE.rot } : x.typ === 'meldung' ? 'Meldung' : 'Info', x.bezug ?? '', x.text]),
          [70, 45, 40, '*'],
        )
      : { text: 'keine', color: PDF_FARBE.grau },
  )

  // Flüge / Akkus
  inhalt.push(h2('Verwendete Akkus / Flüge'))
  const fluege = [...(e.fluege ?? [])].sort((a, b) => a.nr - b.nr)
  if (fluege.length) {
    const summe = fluege.reduce((s, f) => s + dauerMinuten(f.start, f.landung), 0)
    inhalt.push(
      tabelle(
        ['Nr.', 'Pilot', 'Gerät', 'Akku', 'Spannung vor / nach', 'Start', 'Landung', 'Dauer', 'Zw.-Check', 'Bemerkung'],
        [
          ...fluege.map((f): TableCell[] => {
            const g = gMap.get(f.geraetId)
            const akku = g?.akkus.find((a) => a.id === f.akkuId)
            return [
              String(f.nr),
              pilotName(pMap.get(f.pilotId)),
              g?.name ?? '',
              akku?.nummer ?? '',
              f.spannungVor != null || f.spannungNach != null ? `${f.spannungVor?.toLocaleString('de-AT') ?? '–'} V / ${f.spannungNach?.toLocaleString('de-AT') ?? '–'} V` : '',
              fmtZeit(f.start),
              f.landung ? fmtZeit(f.landung) : 'läuft',
              f.landung ? formatStunden(dauerMinuten(f.start, f.landung)) : '',
              f.zwischencheck ? 'ja' : 'nein',
              f.bemerkung ?? '',
            ]
          }),
          [{ text: 'Summe', colSpan: 7, bold: true, alignment: 'right' }, '', '', '', '', '', '', { text: formatStunden(summe), bold: true }, '', ''],
        ],
        [18, 80, 55, 28, 55, 32, 38, 34, 32, '*'],
      ),
    )
  } else inhalt.push({ text: 'keine Flüge erfasst', color: PDF_FARBE.grau })

  // Einsatzende
  inhalt.push(h2('Einsatzende – Abmeldung'))
  const ende = e.einsatzende ?? {}
  inhalt.push({
    stack: [
      cb(!!ende.einsatzleiter, `Abmeldung beim Einsatzleiter${ende.einsatzleiter ? ` – ${fmtDatumZeit(ende.einsatzleiter)}` : ''}`),
      cb(!!ende.leitstelle, `Abmeldung bei der Leitstelle${ende.leitstelle ? ` – ${fmtDatumZeit(ende.leitstelle)}` : ''}`),
      cb(!!ende.tower, `Abmeldung beim Tower${ende.tower ? ` – ${fmtDatumZeit(ende.tower)}` : ''}`),
      cb(!!ende.andereLfz, `Abmeldung bei anderen LFZ-Betreibern${ende.andereLfz ? ` – ${fmtDatumZeit(ende.andereLfz)}` : ''}`),
    ],
  })

  // Nachkontrolle (und weitere späte Sektionen)
  if (v) for (const s of v.sektionen.filter(spaet)) inhalt.push(...sektionInhalt(s, e, uebersteuert))

  // Anmerkungen / Unfall
  inhalt.push(h2('Anmerkungen / Vorfälle'))
  inhalt.push({ text: e.anmerkungen?.trim() || 'keine', color: e.anmerkungen?.trim() ? PDF_FARBE.anthrazit : PDF_FARBE.grau })
  inhalt.push(h2('Unfall'))
  inhalt.push(
    kvTabelle([
      ['Unfall', optionenZeile([{ label: 'ja', an: e.unfall }, { label: 'nein', an: !e.unfall }])],
      ...(e.unfall
        ? ([
            ['Datum der Meldung', e.unfallMeldungDatum ? fmtDatum(e.unfallMeldungDatum) : undefined],
            ['Meldung an', e.unfallMeldungAn],
          ] as [string, string | undefined][])
        : []),
    ]),
  )

  // Unterschrift
  inhalt.push(h2('Unterschrift Pilot'))
  if (e.unterschrift) {
    const bild = unterschriftBild(e.unterschrift.dataUrl)
    inhalt.push({
      unbreakable: true,
      stack: [
        ...(bild ? [bild] : [{ text: '(Unterschrift digital erfasst)', italics: true }]),
        { canvas: [{ type: 'line', x1: 0, y1: 2, x2: 220, y2: 2, lineWidth: 0.5 }] },
        { text: `${e.unterschrift.name}, ${fmtDatumZeit(e.unterschrift.zeit)}`, fontSize: 8 },
      ],
    })
  } else inhalt.push({ text: 'nicht unterschrieben', color: PDF_FARBE.grau })

  // Nachträge
  if (e.nachtraege?.length) {
    inhalt.push(h2('Nachträge (nach Abschluss)'))
    inhalt.push(tabelle(['Zeit', 'Autor', 'Text'], e.nachtraege.map((n) => [fmtDatumZeit(n.zeit), n.autor, n.text]), [70, 90, '*']))
  }

  const titel = `Einsatzprotokoll ${fmtDatum(e.datum)} ${e.fluggebiet ?? ''}`.trim()
  return {
    pageSize: 'A4',
    pageMargins: [40, 36, 40, 40],
    info: { title: titel, creator: 'BOS Drohnen-App' },
    defaultStyle: { font: 'Roboto', fontSize: 8.5, color: PDF_FARBE.anthrazit },
    styles: PDF_STILE,
    footer: fusszeile(erstellt),
    content: inhalt,
  }
}

export function einsatzPdfDateiname(e: Einsatz): string {
  const d = e.datum.slice(0, 10)
  return `Einsatzprotokoll_${d}_${dateiSicher(e.fluggebiet || e.gemeinde || e.grund || e.art)}.pdf`
}

/**
 * Erzeugt das Einsatzprotokoll (Aufbau Checkliste v9) als PDF und lädt es herunter.
 * Lädt alle nötigen Daten selbst aus der Datenbank.
 */
export async function exportEinsatzPdf(einsatzId: string): Promise<void> {
  const einsatz = await db.einsaetze.get(einsatzId)
  if (!einsatz) throw new Error('Einsatz nicht gefunden')
  const [org, piloten, geraete] = await Promise.all([
    db.organisationen.get(einsatz.orgId),
    db.piloten.where('orgId').equals(einsatz.orgId).toArray(),
    db.geraete.where('orgId').equals(einsatz.orgId).toArray(),
  ])
  await pdfHerunterladen(einsatzPdfDoc({ einsatz, org, piloten, geraete }), einsatzPdfDateiname(einsatz))
}
