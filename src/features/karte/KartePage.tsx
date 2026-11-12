import { useLiveQuery } from 'dexie-react-hooks'
import { Crosshair, ExternalLink, LocateFixed, MapPin, Save, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { MapContainer, useMapEvents } from 'react-leaflet'
import { Link, useSearchParams } from 'react-router-dom'
import { db, jetzt } from '../../db/db'
import type { Einsatz, Position } from '../../db/types'
import { Badge, Button, Card, Checkbox, PageHeader, Select, TextInput } from '../../components/ui'
import { MAX_FLUGHOEHE_M, sicherheitsabstaende } from '../../lib/calc'
import { fmtDatum } from '../../lib/format'
import { useOrgId } from '../../lib/useOrg'
import { DRONESPACE_URL, fmtKoordinaten, fmtMeter, istPosition, OESTERREICH_MITTE, OESTERREICH_ZOOM, schutzkreise } from './geo'
import { EigenePositionLayer, GroesseBeobachten, OsmKacheln, SchutzkreiseLayer, ZoomAuf } from './KartenLayer'
import { KartenLegende } from './KartenLegende'

const ART: Record<Einsatz['art'], string> = { einsatz: 'Einsatz', training: 'Training', checkflug: 'Checkflug' }
const einsatzLabel = (e: Einsatz) => `${fmtDatum(e.datum)} · ${ART[e.art]} · ${e.fluggebiet || e.gemeinde || e.grund || 'ohne Bezeichnung'}`

export function DronespaceButton({ className }: { className?: string }) {
  return (
    <a
      href={DRONESPACE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-rot-700 px-4 font-semibold text-white hover:bg-rot-800 ${className ?? ''}`}
    >
      <ExternalLink size={20} /> Dronespace (Austro Control) öffnen
    </a>
  )
}

function KlickAufKarte({ onKlick }: { onKlick: (p: Position) => void }) {
  useMapEvents({ click: (e) => onKlick({ lat: e.latlng.lat, lng: e.latlng.lng }) })
  return null
}

type GeoStatus = { art: 'leer' } | { art: 'suche' } | { art: 'ok' } | { art: 'fehler'; text: string }

export function KartePage() {
  const orgId = useOrgId()
  const [params, setParams] = useSearchParams()
  const einsatzId = params.get('einsatz') ?? ''

  const offene = useLiveQuery(
    async () => (orgId ? (await db.einsaetze.where('orgId').equals(orgId).toArray()).filter((e) => e.status !== 'abgeschlossen').sort((a, b) => b.datum.localeCompare(a.datum)) : []),
    [orgId],
  )
  const einsatz = useLiveQuery(async () => (einsatzId ? ((await db.einsaetze.get(einsatzId)) ?? null) : null), [einsatzId])

  const [start, setStart] = useState<Position | undefined>()
  const [hoeheText, setHoeheText] = useState('50')
  const [mitFlugplatz, setMitFlugplatz] = useState(false)
  const [eigene, setEigene] = useState<Position | undefined>()
  const [geo, setGeo] = useState<GeoStatus>({ art: 'leer' })
  const [zoomZiel, setZoomZiel] = useState('')
  const [geladenFuer, setGeladenFuer] = useState('')
  const [gespeichert, setGespeichert] = useState<Position | undefined>()

  // Einsatzdaten übernehmen, sobald ein (anderer) Einsatz geladen ist
  if (einsatz && einsatz.orgId === orgId && geladenFuer !== einsatz.id) {
    setGeladenFuer(einsatz.id)
    if (einsatz.geplanteFlughoeheM != null) setHoeheText(String(einsatz.geplanteFlughoeheM))
    if (istPosition(einsatz.position)) {
      setStart(einsatz.position)
      setZoomZiel(`einsatz:${einsatz.id}`)
    }
  }

  const hoehe = Math.max(0, parseFloat(hoeheText.replace(',', '.')) || 0)
  const abst = sicherheitsabstaende(hoehe)
  const kreise = schutzkreise(hoehe, mitFlugplatz)
  const groessterKreis = kreise[0]?.radiusM ?? 100
  const einsatzOffen = !!einsatz && einsatz.status !== 'abgeschlossen'
  const positionImEinsatz = einsatz?.position
  const unveraendert = !!start && !!positionImEinsatz && start.lat === positionImEinsatz.lat && start.lng === positionImEinsatz.lng

  const ortung = () => {
    if (!('geolocation' in navigator)) {
      setGeo({ art: 'fehler', text: 'Dieses Gerät unterstützt keine Standortbestimmung.' })
      return
    }
    setGeo({ art: 'suche' })
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const pos = { lat: p.coords.latitude, lng: p.coords.longitude, genauigkeit: Math.round(p.coords.accuracy) }
        setEigene(pos)
        setGeo({ art: 'ok' })
        setZoomZiel(`eigen:${pos.lat},${pos.lng},${Date.now()}`)
      },
      (err) =>
        setGeo({
          art: 'fehler',
          text: err.code === err.PERMISSION_DENIED ? 'Standortzugriff verweigert – bitte in den Browser-Einstellungen erlauben.' : 'Position konnte nicht ermittelt werden.',
        }),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 },
    )
  }

  const einsatzWaehlen = (id: string) => {
    const next = new URLSearchParams(params)
    if (id) next.set('einsatz', id)
    else next.delete('einsatz')
    setParams(next, { replace: true })
    setGeladenFuer('')
    setGespeichert(undefined)
  }

  const speichern = async () => {
    if (!einsatz || !start || !einsatzOffen) return
    await db.einsaetze.update(einsatz.id, { position: start, geaendertAm: jetzt() })
    setGespeichert(start)
  }

  const mitte: [number, number] = start ? [start.lat, start.lng] : OESTERREICH_MITTE

  const einsatzOptionen = (offene ?? []).map((e) => ({ value: e.id, label: einsatzLabel(e) }))
  if (einsatz && !einsatzOptionen.some((o) => o.value === einsatz.id)) einsatzOptionen.unshift({ value: einsatz.id, label: `${einsatzLabel(einsatz)} (abgeschlossen)` })

  return (
    <>
      <PageHeader title="Karte" subtitle="Standort, Startpunkt und Sicherheitsabstände" actions={<div className="hidden sm:block"><DronespaceButton /></div>} />

      <div role="note" className="mb-3 flex items-start gap-3 rounded-lg border border-amber-200 bg-warn-bg p-3 text-warn">
        <TriangleAlert size={22} className="mt-0.5 shrink-0" />
        <p className="text-sm font-semibold">Verbindliche Luftraumprüfung (Geozonen, NOTAM) in Dronespace – diese Karte ersetzt sie nicht.</p>
      </div>
      <div className="mb-3 sm:hidden"><DronespaceButton className="w-full" /></div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative isolate z-0 h-[58dvh] min-h-[320px] overflow-hidden rounded-lg border border-linie lg:h-[calc(100dvh-13rem)] lg:min-h-[480px]">
          <MapContainer center={mitte} zoom={start ? 16 : OESTERREICH_ZOOM} className="h-full w-full" aria-label="Karte">
            <OsmKacheln />
            <GroesseBeobachten />
            <KlickAufKarte
              onKlick={(p) => {
                setStart(p)
                setGespeichert(undefined)
              }}
            />
            {eigene && <EigenePositionLayer pos={eigene} />}
            {start && <SchutzkreiseLayer start={start} kreise={kreise} />}
            <ZoomAuf pos={zoomZiel.startsWith('eigen') ? eigene : start} radiusM={zoomZiel.startsWith('eigen') ? Math.max(eigene?.genauigkeit ?? 0, 150) : groessterKreis} ziel={zoomZiel} />
          </MapContainer>
          {!start && (
            <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[450] flex justify-center px-3">
              <span className="rounded-full bg-dunkel/80 px-3 py-1.5 text-center text-sm font-semibold text-white">Tippen Sie auf die Karte, um den Startpunkt zu setzen</span>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <Card title="Position">
            <div className="flex flex-col gap-3">
              <Button variant="secondary" icon={<LocateFixed size={20} />} onClick={ortung} disabled={geo.art === 'suche'}>
                {geo.art === 'suche' ? 'Position wird ermittelt …' : 'Meine Position'}
              </Button>
              {geo.art === 'fehler' && <p className="text-sm font-semibold text-fehler">{geo.text}</p>}
              {eigene && (
                <p className="text-sm text-gray-600">
                  Eigene Position: {fmtKoordinaten(eigene)}
                  {eigene.genauigkeit ? ` (± ${fmtMeter(eigene.genauigkeit)})` : ''}
                </p>
              )}
              <Button
                variant="secondary"
                icon={<Crosshair size={20} />}
                disabled={!eigene}
                onClick={() => {
                  if (!eigene) return
                  setStart(eigene)
                  setGespeichert(undefined)
                  setZoomZiel(`start:${Date.now()}`)
                }}
              >
                Aktuelle Position als Startpunkt
              </Button>
              <div className="rounded-md bg-flaeche p-3 text-sm">
                <div className="flex items-center gap-2 font-semibold">
                  <MapPin size={16} /> Startpunkt
                </div>
                {start ? (
                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                    <span className="tabular-nums">{fmtKoordinaten(start)}</span>
                    <Button size="sm" variant="ghost" onClick={() => setZoomZiel(`start:${Date.now()}`)}>
                      Hinzoomen
                    </Button>
                  </div>
                ) : (
                  <p className="mt-1 text-gray-600">noch nicht gesetzt – auf die Karte tippen</p>
                )}
              </div>
            </div>
          </Card>

          <Card title="Sicherheitsabstände">
            <div className="flex flex-col gap-3">
              <TextInput
                label="Geplante Flughöhe (m)"
                type="number"
                inputMode="decimal"
                min={0}
                max={500}
                value={hoeheText}
                onChange={(e) => setHoeheText(e.target.value)}
                error={abst.hoeheUeberschritten ? `Maximal ${MAX_FLUGHOEHE_M} m in der Kategorie OPEN – Genehmigung erforderlich.` : undefined}
              />
              <Checkbox label="2,5-km-Kreis (Abstand Flugplatz) anzeigen" checked={mitFlugplatz} onChange={setMitFlugplatz} />
              {kreise.length > 0 ? <KartenLegende kreise={kreise} /> : <p className="text-sm text-gray-600">Flughöhe eingeben, um die Abstände zu berechnen.</p>}
              {hoehe > 0 && (
                <p className="text-xs text-gray-600">
                  Contingency Volume {fmtMeter(abst.contingencyVolume)} · Abstand zu unbeteiligten Personen (1:1-Regel) {fmtMeter(abst.abstandUnbeteiligte)}
                </p>
              )}
            </div>
          </Card>

          <Card title="Einsatz">
            <div className="flex flex-col gap-3">
              <Select label="Einsatz verknüpfen" value={einsatz ? einsatz.id : ''} onChange={(e) => einsatzWaehlen(e.target.value)} options={einsatzOptionen} placeholder="– kein Einsatz –" />
              {einsatz && (
                <>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    {einsatzOffen ? <Badge color="gruen">offen</Badge> : <Badge>abgeschlossen – schreibgeschützt</Badge>}
                    <Link to={`/einsaetze/${einsatz.id}`} className="font-semibold text-rot-700 underline">
                      Zum Einsatz
                    </Link>
                  </div>
                  {einsatzOffen && (
                    <Button icon={<Save size={20} />} disabled={!start || unveraendert} onClick={speichern}>
                      Startpunkt im Einsatz speichern
                    </Button>
                  )}
                  {gespeichert && unveraendert && <p className="text-sm font-semibold text-ok">Startpunkt im Einsatz gespeichert.</p>}
                </>
              )}
              {einsatzId && einsatz === null && <p className="text-sm text-fehler">Einsatz nicht gefunden.</p>}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
