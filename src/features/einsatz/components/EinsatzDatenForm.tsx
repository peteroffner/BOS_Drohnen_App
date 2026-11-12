import { LocateFixed, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Einsatz, Geraet, Mangel, OpenUnterkategorie, Organisation, Pilot, Rechtsgrundlage } from '../../../db/types'
import { AmpelBadge, Badge, Button, Card, Checkbox, Segmented, TextInput } from '../../../components/ui'
import { fromLocalInput, toLocalInput } from '../../../lib/format'
import { pilotStatus } from '../../../lib/stats'
import { ART_OPTIONEN, FLUGARTEN, GERAET_STATUS_LABEL, OPEN_UNTERKATEGORIEN, parseZahl, RECHTSGRUNDLAGE_LABEL } from '../logic/einsatz'
import { RolleAuswahl } from './RolleAuswahl'
import { Sicherheitsabstaende } from './Sicherheitsabstaende'

interface Props {
  start: Einsatz
  org: Organisation
  piloten: Pilot[]
  geraete: Geraet[]
  maengel: Mangel[]
  einsaetze: Einsatz[]
  speichernLabel: string
  onSpeichern: (e: Einsatz) => Promise<void> | void
  onAbbrechen?: () => void
  gesperrt?: boolean
}

/** Einsatzdaten laut Checkliste v9, Seite 1 */
export function EinsatzDatenForm({ start, org, piloten, geraete, maengel, einsaetze, speichernLabel, onSpeichern, onAbbrechen, gesperrt }: Props) {
  const [e, setE] = useState<Einsatz>(start)
  const [hoeheText, setHoeheText] = useState(start.geplanteFlughoeheM?.toString() ?? '')
  const [gps, setGps] = useState<{ laedt: boolean; fehler?: string }>({ laedt: false })
  const [speichert, setSpeichert] = useState(false)
  const [fehler, setFehler] = useState<string>()

  const set = (patch: Partial<Einsatz>) => setE((x) => ({ ...x, ...patch }))
  const setRolle = <K extends keyof Einsatz['rollen']>(k: K, r: Einsatz['rollen'][K]) => setE((x) => ({ ...x, rollen: { ...x.rollen, [k]: r } }))

  const offeneMaengel = (gid: string) => maengel.filter((m) => m.geraetId === gid && !m.behobenAm).length

  const pilotRolle = e.rollen.pilot
  const pilot = pilotRolle?.pilotId ? piloten.find((p) => p.id === pilotRolle.pilotId) : undefined
  const status = pilot ? pilotStatus(pilot, einsaetze, org.freigabeRegeln) : undefined

  const toggleGeraet = (g: Geraet, an: boolean) => {
    const ids = an ? [...e.geraetIds, g.id] : e.geraetIds.filter((x) => x !== g.id)
    const patch: Partial<Einsatz> = { geraetIds: ids }
    if (an && !e.payload && g.payload) patch.payload = g.payload
    set(patch)
  }

  const holePosition = () => {
    if (!('geolocation' in navigator)) {
      setGps({ laedt: false, fehler: 'Standortbestimmung wird von diesem Gerät nicht unterstützt.' })
      return
    }
    setGps({ laedt: true })
    navigator.geolocation.getCurrentPosition(
      (p) => {
        set({ position: { lat: p.coords.latitude, lng: p.coords.longitude, genauigkeit: Math.round(p.coords.accuracy) } })
        setGps({ laedt: false })
      },
      (err) => setGps({ laedt: false, fehler: `Position nicht verfügbar (${err.message || 'Berechtigung verweigert'})` }),
      { enableHighAccuracy: true, timeout: 15000 },
    )
  }

  const speichern = async () => {
    if (!e.datum) {
      setFehler('Bitte Datum und Uhrzeit angeben.')
      return
    }
    setFehler(undefined)
    setSpeichert(true)
    try {
      const lb = (e.rollen.luftraumbeobachter ?? []).filter((r) => r.name.trim())
      await onSpeichern({ ...e, geplanteFlughoeheM: parseZahl(hoeheText), rollen: { ...e.rollen, luftraumbeobachter: lb } })
    } finally {
      setSpeichert(false)
    }
  }

  const hoehe = parseZahl(hoeheText)
  const lb = e.rollen.luftraumbeobachter ?? []

  return (
    <fieldset disabled={gesperrt} className="flex min-w-0 flex-col gap-4">
      <Card title="Allgemein">
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput
              label="Datum / Uhrzeit"
              type="datetime-local"
              required
              value={toLocalInput(e.datum)}
              onChange={(ev) => set({ datum: fromLocalInput(ev.target.value) ?? '' })}
            />
            <TextInput label="Alarmierung / Auftrag von" value={e.alarmierungVon ?? ''} onChange={(ev) => set({ alarmierungVon: ev.target.value })} placeholder="z. B. LWZ, Einsatzleiter" />
          </div>
          <Segmented label="Art des Fluges" value={e.art} options={ART_OPTIONEN} onChange={(art) => set({ art })} disabled={gesperrt} />
          <TextInput label="Grund des Fluges" value={e.grund ?? ''} onChange={(ev) => set({ grund: ev.target.value })} placeholder="z. B. Personensuche, Lageerkundung" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput label="Bezeichnung Fluggebiet" value={e.fluggebiet ?? ''} onChange={(ev) => set({ fluggebiet: ev.target.value })} />
            <TextInput label="Gemeindegebiet" value={e.gemeinde ?? ''} onChange={(ev) => set({ gemeinde: ev.target.value })} />
          </div>
          <div>
            <span className="label">GPS-Position Startpunkt (optional)</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" icon={<LocateFixed size={18} />} onClick={holePosition} disabled={gesperrt || gps.laedt}>
                {gps.laedt ? 'Position wird ermittelt …' : e.position ? 'Position aktualisieren' : 'Aktuelle Position übernehmen'}
              </Button>
              {e.position && (
                <>
                  <span className="text-sm tabular-nums">
                    {e.position.lat.toFixed(5)}, {e.position.lng.toFixed(5)}
                    {e.position.genauigkeit !== undefined && ` (± ${e.position.genauigkeit} m)`}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => set({ position: undefined })}>
                    entfernen
                  </Button>
                </>
              )}
            </div>
            {gps.fehler && <p className="mt-1 text-sm font-semibold text-fehler">{gps.fehler}</p>}
          </div>
        </div>
      </Card>

      <Card title="Fluggerät(e)">
        {geraete.length === 0 ? (
          <p className="text-sm">
            Noch keine Geräte angelegt.{' '}
            <Link to="/geraete" className="font-semibold text-rot-700 underline">
              Geräte verwalten
            </Link>
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-linie">
            {geraete.map((g) => {
              const gewaehlt = e.geraetIds.includes(g.id)
              const nm = offeneMaengel(g.id)
              return (
                <div key={g.id} className="py-1">
                  <Checkbox
                    checked={gewaehlt}
                    disabled={gesperrt || (g.status === 'ausser_dienst' && !gewaehlt)}
                    onChange={(v) => toggleGeraet(g, v)}
                    label={
                      <span className="flex flex-wrap items-center gap-2">
                        <b>{g.name}</b>
                        <span className="text-sm text-gray-600">
                          {g.hersteller} {g.modell}
                          {g.registrierungsnummer && ` · Reg.-Nr. ${g.registrierungsnummer}`}
                        </span>
                        {g.status !== 'einsatzbereit' && <Badge color={g.status === 'wartung' ? 'gelb' : 'rot'}>{GERAET_STATUS_LABEL[g.status]}</Badge>}
                        {nm > 0 && <Badge color="gelb">{nm} offene{nm === 1 ? 'r' : ''} Mangel{nm === 1 ? '' : 'e'}</Badge>}
                      </span>
                    }
                  />
                  {gewaehlt && g.status !== 'einsatzbereit' && (
                    <p className="ml-9 text-sm font-semibold text-warn">Achtung: Gerät ist nicht als einsatzbereit gemeldet.</p>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <TextInput className="mt-3" label="Payload" value={e.payload ?? ''} onChange={(ev) => set({ payload: ev.target.value })} placeholder="z. B. Wärmebildkamera, Scheinwerfer" />
      </Card>

      <Card title="Rechtsgrundlage & Flugbetrieb">
        <div className="flex flex-col gap-4">
          <Segmented<Rechtsgrundlage>
            label="Rechtsgrundlage"
            value={e.rechtsgrundlage}
            options={(Object.keys(RECHTSGRUNDLAGE_LABEL) as Rechtsgrundlage[]).map((value) => ({ value, label: RECHTSGRUNDLAGE_LABEL[value] }))}
            onChange={(rechtsgrundlage) => set({ rechtsgrundlage })}
            disabled={gesperrt}
          />
          {e.rechtsgrundlage === 'open' && (
            <Segmented<OpenUnterkategorie>
              label="Unterkategorie OPEN"
              value={e.openUnterkategorie}
              options={OPEN_UNTERKATEGORIEN.map((value) => ({ value, label: value }))}
              onChange={(openUnterkategorie) => set({ openUnterkategorie })}
              disabled={gesperrt}
            />
          )}
          {(e.rechtsgrundlage === 'bescheid' || e.rechtsgrundlage === 'specific_bos') && (
            <TextInput label="Bescheid-Nr." value={e.bescheidNr ?? ''} onChange={(ev) => set({ bescheidNr: ev.target.value })} />
          )}
          <Segmented label="Flugart" value={e.flugart} options={FLUGARTEN.map((value) => ({ value, label: value }))} onChange={(flugart) => set({ flugart })} disabled={gesperrt} />
          <TextInput
            label="Geplante Flughöhe (m)"
            inputMode="decimal"
            value={hoeheText}
            onChange={(ev) => setHoeheText(ev.target.value)}
            hint="Maximal 120 m über Grund"
            className="sm:max-w-xs"
          />
          <Sicherheitsabstaende flughoehe={hoehe} />
        </div>
      </Card>

      <Card title="Rollen">
        <div className="flex flex-col gap-4">
          <RolleAuswahl label="Gesamt-Einsatzleiter" rolle={e.rollen.gesamtEinsatzleiter} piloten={piloten} onChange={(r) => setRolle('gesamtEinsatzleiter', r)} disabled={gesperrt} />
          <RolleAuswahl label="Drohnen-Teamleiter" rolle={e.rollen.teamleiter} piloten={piloten} onChange={(r) => setRolle('teamleiter', r)} disabled={gesperrt} />
          <RolleAuswahl label="Drohnen-Abschnittsleiter" rolle={e.rollen.abschnittsleiter} piloten={piloten} onChange={(r) => setRolle('abschnittsleiter', r)} disabled={gesperrt} />
          <RolleAuswahl
            label={
              <span className="flex items-center gap-2">
                Pilot {status && <AmpelBadge ampel={status.ampel} title={status.gruende.join(', ')} />}
              </span>
            }
            rolle={e.rollen.pilot}
            piloten={piloten}
            onChange={(r) => setRolle('pilot', r)}
            disabled={gesperrt}
            extra={
              status && status.ampel !== 'gruen' ? (
                <div
                  role="alert"
                  className={
                    status.ampel === 'rot'
                      ? 'mt-2 flex items-start gap-2 rounded-md border-2 border-fehler bg-fehler-bg p-3 text-fehler'
                      : 'mt-2 flex items-start gap-2 rounded-md border border-warn bg-warn-bg p-3 text-warn'
                  }
                >
                  <TriangleAlert size={22} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="font-bold">{status.ampel === 'rot' ? 'Pilot ist nicht als Einsatzpilot freigegeben!' : 'Einsatzpilot eingeschränkt'}</p>
                    <ul className="list-disc pl-5 text-sm">
                      {status.gruende.map((g) => (
                        <li key={g}>{g}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              ) : undefined
            }
          />
          <div className="flex flex-col gap-3">
            {lb.map((r, i) => (
              <div key={i} className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <RolleAuswahl
                    label={`Luftraumbeobachter / Helfer ${lb.length > 1 ? i + 1 : ''}`}
                    rolle={r.name || r.pilotId ? r : undefined}
                    piloten={piloten}
                    disabled={gesperrt}
                    onChange={(nr) => setRolle('luftraumbeobachter', lb.map((x, j) => (j === i ? (nr ?? { name: '' }) : x)))}
                  />
                </div>
                <Button
                  variant="secondary"
                  aria-label="Luftraumbeobachter entfernen"
                  onClick={() => setRolle('luftraumbeobachter', lb.filter((_, j) => j !== i))}
                  disabled={gesperrt}
                >
                  <Trash2 size={18} />
                </Button>
              </div>
            ))}
            <div>
              <Button variant="secondary" icon={<Plus size={18} />} onClick={() => setRolle('luftraumbeobachter', [...lb, { name: '' }])} disabled={gesperrt}>
                Luftraumbeobachter / Helfer
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {!gesperrt && (
        <div className="flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={speichern} disabled={speichert}>
            {speichernLabel}
          </Button>
          {onAbbrechen && (
            <Button size="lg" variant="secondary" onClick={onAbbrechen}>
              Abbrechen
            </Button>
          )}
          {fehler && <span className="font-semibold text-fehler">{fehler}</span>}
        </div>
      )}
    </fieldset>
  )
}
