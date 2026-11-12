import { useLiveQuery } from 'dexie-react-hooks'
import { FileSpreadsheet, FileText, Gauge, Table } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../db/db'
import { AmpelBadge, Badge, Button, Card, EmptyState, PageHeader, Segmented, Select, Stat, TextInput } from '../../components/ui'
import { formatStunden } from '../../lib/calc'
import { fmtDatum, pilotName } from '../../lib/format'
import { STANDARD_FREIGABE_REGELN, useOrg } from '../../lib/useOrg'
import { einsaetzeImZeitraum, geraetTabelle, jahresZeitraum, kennzahlen, lokalesDatum, monatsAggregation, pilotTabelle, zeitraumDatei, zeitraumText, type Zeitraum } from './auswertung'
import { MonatsChart } from './MonatsChart'
import { flugbuchCsv } from './export/csv'
import { dateiSicher, downloadBlob } from './export/download'
import { ART_LABEL, flugbuchZeilen } from './export/flugbuchZeilen'

type Modus = 'jahr' | 'frei'
type ExportArt = 'pdf' | 'einsatz' | 'excel' | 'csv'

export function AuswertungPage() {
  const org = useOrg()
  const orgId = org?.id ?? ''
  const daten = useLiveQuery(async () => {
    if (!orgId) return undefined
    const [einsaetze, piloten, geraete, maengel, wartungen] = await Promise.all([
      db.einsaetze.where('orgId').equals(orgId).toArray(),
      db.piloten.where('orgId').equals(orgId).toArray(),
      db.geraete.where('orgId').equals(orgId).toArray(),
      db.maengel.where('orgId').equals(orgId).toArray(),
      db.wartungen.where('orgId').equals(orgId).toArray(),
    ])
    return { einsaetze, piloten, geraete, maengel, wartungen }
  }, [orgId])

  const [heute] = useState(() => new Date())
  const [modus, setModus] = useState<Modus>('jahr')
  const [jahr, setJahr] = useState(heute.getFullYear())
  const [von, setVon] = useState(`${heute.getFullYear()}-01-01`)
  const [bis, setBis] = useState(lokalesDatum(heute))
  const [einsatzWahl, setEinsatzWahl] = useState('')
  const [laeuft, setLaeuft] = useState<ExportArt | null>(null)
  const [fehler, setFehler] = useState('')

  const zeitraum: Zeitraum = useMemo(
    () => (modus === 'jahr' ? jahresZeitraum(jahr) : { von: von <= bis ? von : bis, bis: von <= bis ? bis : von }),
    [modus, jahr, von, bis],
  )
  const regeln = org?.freigabeRegeln ?? STANDARD_FREIGABE_REGELN

  const auswertung = useMemo(() => {
    if (!daten) return undefined
    const imZr = einsaetzeImZeitraum(daten.einsaetze, zeitraum).sort((a, b) => b.datum.localeCompare(a.datum))
    return {
      imZr,
      k: kennzahlen(imZr),
      monate: monatsAggregation(imZr, zeitraum),
      piloten: pilotTabelle(daten.piloten, daten.einsaetze, imZr, regeln),
      geraete: geraetTabelle(daten.geraete, daten.einsaetze, imZr, daten.maengel),
    }
  }, [daten, zeitraum, regeln])

  const jahre = useMemo(() => {
    const s = new Set<number>([heute.getFullYear(), jahr])
    for (const e of daten?.einsaetze ?? []) s.add(new Date(e.datum).getFullYear())
    return [...s].sort((a, b) => b - a)
  }, [daten, jahr, heute])

  if (!org || !daten || !auswertung) return <PageHeader title="Auswertung" />
  const { imZr, k } = auswertung
  const zText = zeitraumText(zeitraum)
  const basisName = `${dateiSicher(org.name)}_${zeitraumDatei(zeitraum)}`

  const exportieren = async (art: ExportArt, fn: () => Promise<void>) => {
    setLaeuft(art)
    setFehler('')
    try {
      await fn()
    } catch (e) {
      console.error(e)
      setFehler(`Export fehlgeschlagen: ${(e as Error).message}`)
    } finally {
      setLaeuft(null)
    }
  }
  const zeilen = () => flugbuchZeilen(imZr, daten)

  const pdfFlugbuch = () =>
    exportieren('pdf', async () => {
      const [{ flugbuchPdfDoc }, { pdfHerunterladen }] = await Promise.all([import('./export/flugbuchPdf'), import('./export/pdf')])
      await pdfHerunterladen(flugbuchPdfDoc(zeilen(), org, zText), `Flugbuch_${basisName}.pdf`)
    })
  const pdfEinsatz = () =>
    exportieren('einsatz', async () => {
      const { exportEinsatzPdf } = await import('./export/einsatzPdf')
      await exportEinsatzPdf(einsatzWahl)
    })
  const excel = () =>
    exportieren('excel', async () => {
      const { erzeugeExcel } = await import('./export/excel')
      const buf = await erzeugeExcel({
        orgName: org.name,
        zeitraum: zText,
        wartungsJahr: Number(zeitraum.bis.slice(0, 4)),
        flugbuch: zeilen(),
        piloten: auswertung.piloten,
        geraete: auswertung.geraete,
        alleGeraete: daten.geraete,
        wartungen: daten.wartungen,
        maengel: daten.maengel,
      })
      downloadBlob(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `Auswertung_${basisName}.xlsx`)
    })
  const csv = () =>
    exportieren('csv', async () => {
      downloadBlob(new Blob([flugbuchCsv(zeilen())], { type: 'text/csv;charset=utf-8' }), `Flugbuch_${basisName}.csv`)
    })

  const einsatzOptionen = imZr.map((e) => ({ value: e.id, label: `${fmtDatum(e.datum)} · ${ART_LABEL[e.art]} · ${e.fluggebiet || e.grund || 'ohne Bezeichnung'}` }))
  const gewaehlt = einsatzOptionen.some((o) => o.value === einsatzWahl) ? einsatzWahl : ''

  return (
    <>
      <PageHeader title="Auswertung" subtitle={`${org.name} · Zeitraum ${zText}`} />

      <Card title="Zeitraum" className="mb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
          <Segmented
            value={modus}
            onChange={setModus}
            options={[
              { value: 'jahr', label: 'Jahr' },
              { value: 'frei', label: 'Von – bis' },
            ]}
          />
          {modus === 'jahr' ? (
            <Select label="Jahr" className="sm:w-40" value={String(jahr)} onChange={(e) => setJahr(Number(e.target.value))} options={jahre.map((j) => ({ value: String(j), label: String(j) }))} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <TextInput label="von" type="date" value={von} max={bis} onChange={(e) => e.target.value && setVon(e.target.value)} />
              <TextInput label="bis" type="date" value={bis} min={von} onChange={(e) => e.target.value && setBis(e.target.value)} />
            </div>
          )}
        </div>
      </Card>

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Stat label="Einsätze" value={k.einsaetze} sub={k.einsaetzeOffen ? `davon ${k.einsaetzeOffen} offen` : 'alle abgeschlossen'} />
        <Stat label="Flüge" value={k.fluege} />
        <Stat label="Flugstunden" value={formatStunden(k.minuten)} />
        <Stat label="Einsatz / Training" value={`${k.anzahlEinsatz} / ${k.anzahlTraining + k.anzahlCheckflug}`} sub={`${formatStunden(k.minutenEinsatz)} / ${formatStunden(k.minutenTraining)}${k.anzahlCheckflug ? ` · ${k.anzahlCheckflug} Checkflug` : ''}`} />
        <Stat label="Unfälle" value={k.unfaelle} sub={k.uebersteuerungen ? (k.uebersteuerungen === 1 ? '1 übersteuerter Pflichtpunkt' : `${k.uebersteuerungen} übersteuerte Pflichtpunkte`) : undefined} />
        <Stat label="Notfall-Ereignisse" value={k.notfallEreignisse} />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card title="Flugstunden je Monat">
          {k.fluege > 0 ? <MonatsChart werte={auswertung.monate} /> : <EmptyState icon={<Gauge size={28} />} title="Keine Flüge im Zeitraum" text="Flüge werden im Einsatz erfasst und erscheinen hier automatisch." />}
        </Card>

        <Card title="Export">
          <div className="flex flex-col gap-2">
            <ExportButton icon={<FileText size={20} />} onClick={pdfFlugbuch} laeuft={laeuft === 'pdf'} disabled={!!laeuft}>
              PDF Flugbuch
            </ExportButton>
            <ExportButton icon={<FileSpreadsheet size={20} />} onClick={excel} laeuft={laeuft === 'excel'} disabled={!!laeuft}>
              Excel (Flugbuch, Stunden, Wartung)
            </ExportButton>
            <ExportButton icon={<Table size={20} />} onClick={csv} laeuft={laeuft === 'csv'} disabled={!!laeuft}>
              CSV Flugbuch
            </ExportButton>
            <div className="mt-2 border-t border-linie pt-3">
              <Select label="Einsatzprotokoll (Checkliste v9)" value={gewaehlt} onChange={(e) => setEinsatzWahl(e.target.value)} options={einsatzOptionen} placeholder={einsatzOptionen.length ? '– Einsatz wählen –' : 'keine Einsätze im Zeitraum'} />
              <ExportButton className="mt-2 w-full" icon={<FileText size={20} />} onClick={pdfEinsatz} laeuft={laeuft === 'einsatz'} disabled={!!laeuft || !gewaehlt}>
                PDF Einsatzprotokoll
              </ExportButton>
            </div>
            {fehler && <p className="text-sm font-semibold text-fehler">{fehler}</p>}
            <p className="text-xs text-gray-600">Exporte umfassen den gewählten Zeitraum. Das Wartungsbuch im Excel zeigt das Jahr {zeitraum.bis.slice(0, 4)}.</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card title="Piloten">
          {auswertung.piloten.length ? (
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-linie text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-2">Pilot</th>
                    <th className="py-2 pr-2 text-right">Flüge</th>
                    <th className="py-2 pr-2 text-right">Stunden</th>
                    <th className="py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {auswertung.piloten.map((z) => (
                    <tr key={z.pilot.id} className="border-b border-linie">
                      <td className="py-2 pr-2">
                        <Link to={`/piloten/${z.pilot.id}`} className="font-semibold hover:text-rot-700 hover:underline">
                          {pilotName(z.pilot)}
                        </Link>
                        {!z.pilot.aktiv && <span className="ml-1 text-xs text-gray-500">(inaktiv)</span>}
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">{z.fluege}</td>
                      <td className="py-2 pr-2 text-right tabular-nums" title={`Einsatz ${formatStunden(z.minutenEinsatz)}, Training ${formatStunden(z.minutenTraining)}`}>
                        {formatStunden(z.minuten)}
                      </td>
                      <td className="py-2">
                        <AmpelBadge ampel={z.ampel} title={z.gruende.join(' · ') || undefined} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-600">Noch keine Piloten angelegt.</p>
          )}
        </Card>

        <Card title="Geräte">
          {auswertung.geraete.length ? (
            <div className="-mx-4 overflow-x-auto px-4">
              <table className="w-full min-w-[420px] text-sm">
                <thead>
                  <tr className="border-b border-linie text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="py-2 pr-2">Gerät</th>
                    <th className="py-2 pr-2 text-right">Flüge</th>
                    <th className="py-2 pr-2 text-right">Stunden</th>
                    <th className="py-2 text-right">Offene Mängel</th>
                  </tr>
                </thead>
                <tbody>
                  {auswertung.geraete.map((z) => (
                    <tr key={z.geraet.id} className="border-b border-linie">
                      <td className="py-2 pr-2">
                        <Link to={`/geraete/${z.geraet.id}`} className="font-semibold hover:text-rot-700 hover:underline">
                          {z.geraet.name}
                        </Link>
                        <span className="block text-xs text-gray-600">
                          {z.geraet.hersteller} {z.geraet.modell}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-right tabular-nums">{z.fluege}</td>
                      <td className="py-2 pr-2 text-right tabular-nums" title={`gesamt ${formatStunden(z.gesamtMinuten)}`}>
                        {formatStunden(z.minuten)}
                      </td>
                      <td className="py-2 text-right">{z.offeneMaengel ? <Badge color="rot">{z.offeneMaengel}</Badge> : <Badge color="gruen">0</Badge>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-gray-600">Noch keine Geräte angelegt.</p>
          )}
        </Card>
      </div>
    </>
  )
}

function ExportButton({ laeuft, children, className, ...rest }: { laeuft: boolean; children: ReactNode; icon: ReactNode; onClick: () => void; disabled?: boolean; className?: string }) {
  return (
    <Button variant="secondary" className={className ?? 'w-full justify-start'} {...rest}>
      {laeuft ? 'Wird erstellt …' : children}
    </Button>
  )
}
