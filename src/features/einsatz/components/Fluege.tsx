import { PlaneLanding, PlaneTakeoff, Pencil, ShieldAlert, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Einsatz, Flug, Geraet, Pilot } from '../../../db/types'
import { Badge, Button, Card, Checkbox, EmptyState, Modal, Select, TextInput } from '../../../components/ui'
import { jetzt, neueId } from '../../../db/db'
import { dauerMinuten } from '../../../lib/calc'
import { fmtZeit, fromLocalInput, pilotName, toLocalInput } from '../../../lib/format'
import type { FlugFreigabe } from '../logic/checkliste'
import { akkuNummer, formatLaufzeit, laufenderFlug, naechsteFlugNr, parseZahl } from '../logic/einsatz'
import { aendereEinsatz } from '../data'
import { UebersteuernModal, UebersteuerungenListe } from './Uebersteuern'

interface Props {
  einsatz: Einsatz
  piloten: Pilot[]
  geraete: Geraet[]
  freigabe: FlugFreigabe
  gesperrt: boolean
}

const fmtV = (v?: number) => (v === undefined ? '' : `${v.toLocaleString('de-AT')} V`)

/** Schritt 5: Flüge starten/landen, Flüge-Tabelle */
export function FluegeSchritt({ einsatz, piloten, geraete, freigabe, gesperrt }: Props) {
  const [startOffen, setStartOffen] = useState(false)
  const [landungOffen, setLandungOffen] = useState(false)
  const [uebOffen, setUebOffen] = useState(false)
  const [bearbeite, setBearbeite] = useState<Flug | null>(null)
  const laufend = laufenderFlug(einsatz)
  const einsatzGeraete = geraete.filter((g) => einsatz.geraetIds.includes(g.id))

  return (
    <div className="flex flex-col gap-4">
      {!gesperrt && laufend && (
        <LaufenderFlug flug={laufend} einsatz={einsatz} piloten={piloten} geraete={geraete} onLanden={() => setLandungOffen(true)} />
      )}

      {!gesperrt && !laufend && (
        <Card>
          {!freigabe.frei ? (
            <div className="flex flex-col gap-3">
              <div role="alert" className="rounded-md border-2 border-fehler bg-fehler-bg p-3 text-fehler">
                <p className="font-bold">Flug noch nicht freigegeben</p>
                <p className="text-sm">
                  {freigabe.offen.length} Pflichtpunkt{freigabe.offen.length === 1 ? '' : 'e'} in Vorbereitung, Vorflug- oder Betriebskontrolle offen.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" icon={<ShieldAlert size={18} />} onClick={() => setUebOffen(true)}>
                  Mit Begründung übersteuern
                </Button>
              </div>
            </div>
          ) : einsatzGeraete.length === 0 ? (
            <p>
              Für diesen Einsatz ist kein Fluggerät gewählt. Bitte in <b>Schritt 1 – Einsatzdaten</b> ein Gerät auswählen
              {geraete.length === 0 && (
                <>
                  {' '}
                  (zuerst unter{' '}
                  <Link className="font-semibold text-rot-700 underline" to="/geraete">
                    Geräte
                  </Link>{' '}
                  anlegen)
                </>
              )}
              .
            </p>
          ) : (
            <Button size="lg" className="w-full sm:w-auto" icon={<PlaneTakeoff size={24} />} onClick={() => setStartOffen(true)}>
              Flug {naechsteFlugNr(einsatz)} starten
            </Button>
          )}
          {einsatz.fluege.length > 0 && (
            <p className="mt-3 text-sm text-gray-600">Vor jedem weiteren Flug (Akkuwechsel) die Punkte 12–17 erneut prüfen.</p>
          )}
          <div className="mt-3">
            <UebersteuerungenListe einsatz={einsatz} />
          </div>
        </Card>
      )}

      <Card title="Verwendete Akkus / Flug">
        {einsatz.fluege.length === 0 ? (
          <EmptyState title="Noch keine Flüge" />
        ) : (
          <FlugTabelle einsatz={einsatz} piloten={piloten} geraete={geraete} onBearbeiten={gesperrt ? undefined : setBearbeite} />
        )}
      </Card>

      {startOffen && (
        <FlugStartModal einsatz={einsatz} piloten={piloten} geraete={einsatzGeraete} onClose={() => setStartOffen(false)} />
      )}
      {landungOffen && laufend && <LandungModal einsatz={einsatz} flug={laufend} onClose={() => setLandungOffen(false)} />}
      {bearbeite && (
        <FlugBearbeitenModal einsatz={einsatz} flug={bearbeite} piloten={piloten} geraete={einsatzGeraete.length ? einsatzGeraete : geraete} onClose={() => setBearbeite(null)} />
      )}
      <UebersteuernModal open={uebOffen} onClose={() => setUebOffen(false)} einsatz={einsatz} offen={freigabe.offen} />
    </div>
  )
}

function LaufenderFlug({ flug, einsatz, piloten, geraete, onLanden }: { flug: Flug; einsatz: Einsatz; piloten: Pilot[]; geraete: Geraet[]; onLanden: () => void }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])
  const sek = (now - new Date(flug.start).getTime()) / 1000
  const pilot = piloten.find((p) => p.id === flug.pilotId)
  const geraet = geraete.find((g) => g.id === flug.geraetId)
  return (
    <section className="rounded-lg border-4 border-rot-700 bg-white p-4 text-center" aria-live="polite">
      <div className="text-sm font-bold uppercase tracking-widest text-rot-700">Flug {flug.nr} läuft</div>
      <div className="my-2 text-6xl font-bold tabular-nums text-dunkel sm:text-7xl" data-testid="laufzeit">
        {formatLaufzeit(sek)}
      </div>
      <div className="mb-4 text-sm text-gray-700">
        Start {fmtZeit(flug.start)} · {pilot ? pilotName(pilot) : einsatz.rollen.pilot?.name || 'Pilot ?'} · {geraet?.name ?? ''}
        {flug.akkuId && ` · Akku ${akkuNummer(geraete, flug)}`}
      </div>
      <Button size="lg" className="w-full" icon={<PlaneLanding size={26} />} onClick={onLanden}>
        Gelandet
      </Button>
    </section>
  )
}

function useFlugFormular(einsatz: Einsatz, piloten: Pilot[], geraete: Geraet[], f?: Flug) {
  const vorPilot = f?.pilotId ?? einsatz.rollen.pilot?.pilotId ?? ''
  const letzter = [...einsatz.fluege].sort((a, b) => b.nr - a.nr)[0]
  const vorGeraet = f?.geraetId ?? letzter?.geraetId ?? geraete[0]?.id ?? ''
  const [pilotId, setPilotId] = useState(vorPilot)
  const [geraetId, setGeraetId] = useState(vorGeraet)
  const [akkuId, setAkkuId] = useState(f?.akkuId ?? '')
  const geraet = geraete.find((g) => g.id === geraetId)
  const akkus = (geraet?.akkus ?? []).filter((a) => a.art === 'drohne' && (a.status !== 'ausgemustert' || a.id === akkuId))
  const pilotOptionen = piloten.filter((p) => p.aktiv || p.id === pilotId).map((p) => ({ value: p.id, label: pilotName(p) }))
  const felder = (
    <>
      <Select
        label="Pilot"
        value={pilotId}
        onChange={(e) => setPilotId(e.target.value)}
        options={pilotOptionen}
        placeholder={einsatz.rollen.pilot && !einsatz.rollen.pilot.pilotId ? `${einsatz.rollen.pilot.name} (extern)` : '– wählen –'}
      />
      <Select
        label="Fluggerät"
        value={geraetId}
        onChange={(e) => {
          setGeraetId(e.target.value)
          setAkkuId('')
        }}
        options={geraete.map((g) => ({ value: g.id, label: g.name }))}
      />
      <Select
        label="Akku"
        value={akkuId}
        onChange={(e) => setAkkuId(e.target.value)}
        options={akkus.map((a) => ({ value: a.id, label: `Akku ${a.nummer}${a.status === 'beobachten' ? ' (beobachten)' : ''}` }))}
        placeholder={akkus.length ? '– wählen –' : 'keine Akkus erfasst'}
      />
    </>
  )
  return { pilotId, geraetId, akkuId, felder }
}

function FlugStartModal({ einsatz, piloten, geraete, onClose }: { einsatz: Einsatz; piloten: Pilot[]; geraete: Geraet[]; onClose: () => void }) {
  const form = useFlugFormular(einsatz, piloten, geraete)
  const [spannung, setSpannung] = useState('')
  const [zwischencheck, setZwischencheck] = useState(false)
  const weitererFlug = einsatz.fluege.length > 0
  const ok = !!form.geraetId && (!!form.pilotId || !!einsatz.rollen.pilot?.name)
  return (
    <Modal
      open
      onClose={onClose}
      title={`Flug ${naechsteFlugNr(einsatz)} starten`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            disabled={!ok}
            icon={<PlaneTakeoff size={20} />}
            onClick={async () => {
              const start = jetzt()
              await aendereEinsatz(einsatz.id, (e) => {
                if (laufenderFlug(e)) return
                e.fluege.push({
                  id: neueId(),
                  nr: naechsteFlugNr(e),
                  pilotId: form.pilotId,
                  geraetId: form.geraetId,
                  akkuId: form.akkuId || undefined,
                  spannungVor: parseZahl(spannung),
                  start,
                  zwischencheck: weitererFlug ? zwischencheck : false,
                })
                e.status = 'laufend'
              })
              onClose()
            }}
          >
            Start – Zeit läuft
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {form.felder}
        <TextInput label="Spannung vor dem Flug (V)" inputMode="decimal" value={spannung} onChange={(e) => setSpannung(e.target.value)} />
        {weitererFlug && (
          <div className="rounded-md border border-linie bg-flaeche px-3">
            <Checkbox checked={zwischencheck} onChange={setZwischencheck} label="Zwischenchecks (Punkte 12–17) erledigt" hint="Vor jedem weiteren Flug (Akkuwechsel) prüfen" />
          </div>
        )}
      </div>
    </Modal>
  )
}

function LandungModal({ einsatz, flug, onClose }: { einsatz: Einsatz; flug: Flug; onClose: () => void }) {
  const [spannung, setSpannung] = useState('')
  const [bemerkung, setBemerkung] = useState('')
  return (
    <Modal
      open
      onClose={onClose}
      title={`Flug ${flug.nr} – gelandet`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            icon={<PlaneLanding size={20} />}
            onClick={async () => {
              const landung = jetzt()
              await aendereEinsatz(einsatz.id, (e) => {
                const f = e.fluege.find((x) => x.id === flug.id)
                if (!f || f.landung) return
                f.landung = landung
                f.spannungNach = parseZahl(spannung)
                if (bemerkung.trim()) f.bemerkung = bemerkung.trim()
              })
              onClose()
            }}
          >
            Landung speichern
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p>Landezeit wird beim Speichern auf „jetzt“ gesetzt.</p>
        <TextInput label="Spannung nach dem Flug (V)" inputMode="decimal" value={spannung} onChange={(e) => setSpannung(e.target.value)} autoFocus />
        <TextInput label="Bemerkung (optional)" value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
      </div>
    </Modal>
  )
}

function FlugBearbeitenModal({ einsatz, flug, piloten, geraete, onClose }: { einsatz: Einsatz; flug: Flug; piloten: Pilot[]; geraete: Geraet[]; onClose: () => void }) {
  const form = useFlugFormular(einsatz, piloten, geraete, flug)
  const [start, setStart] = useState(toLocalInput(flug.start))
  const [landung, setLandung] = useState(toLocalInput(flug.landung))
  const [vor, setVor] = useState(flug.spannungVor?.toString().replace('.', ',') ?? '')
  const [nach, setNach] = useState(flug.spannungNach?.toString().replace('.', ',') ?? '')
  const [zc, setZc] = useState(flug.zwischencheck)
  const [bemerkung, setBemerkung] = useState(flug.bemerkung ?? '')
  const [loeschen, setLoeschen] = useState(false)
  const startIso = fromLocalInput(start)
  const landIso = fromLocalInput(landung)
  const fehler = !startIso ? 'Startzeit fehlt' : landIso && landIso < startIso ? 'Landung liegt vor dem Start' : undefined
  return (
    <Modal
      open
      onClose={onClose}
      title={`Flug ${flug.nr} korrigieren`}
      footer={
        <>
          {loeschen ? (
            <Button
              variant="danger"
              onClick={async () => {
                await aendereEinsatz(einsatz.id, (e) => {
                  e.fluege = e.fluege.filter((x) => x.id !== flug.id)
                })
                onClose()
              }}
            >
              Wirklich löschen
            </Button>
          ) : (
            <Button variant="ghost" icon={<Trash2 size={18} />} onClick={() => setLoeschen(true)}>
              Flug löschen
            </Button>
          )}
          <Button
            disabled={!!fehler}
            onClick={async () => {
              await aendereEinsatz(einsatz.id, (e) => {
                const f = e.fluege.find((x) => x.id === flug.id)
                if (!f) return
                Object.assign(f, {
                  pilotId: form.pilotId,
                  geraetId: form.geraetId,
                  akkuId: form.akkuId || undefined,
                  start: startIso!,
                  landung: landIso,
                  spannungVor: parseZahl(vor),
                  spannungNach: parseZahl(nach),
                  zwischencheck: zc,
                  bemerkung: bemerkung.trim() || undefined,
                })
              })
              onClose()
            }}
          >
            Speichern
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {form.felder}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Start" type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} error={!startIso ? fehler : undefined} />
          <TextInput label="Landung" type="datetime-local" value={landung} onChange={(e) => setLandung(e.target.value)} error={startIso ? fehler : undefined} hint="leer = Flug läuft noch" />
          <TextInput label="Spannung vor (V)" inputMode="decimal" value={vor} onChange={(e) => setVor(e.target.value)} />
          <TextInput label="Spannung nach (V)" inputMode="decimal" value={nach} onChange={(e) => setNach(e.target.value)} />
        </div>
        <Checkbox checked={zc} onChange={setZc} label="Zwischencheck (Punkte 12–17) erledigt" />
        <TextInput label="Bemerkung" value={bemerkung} onChange={(e) => setBemerkung(e.target.value)} />
      </div>
    </Modal>
  )
}

export function FlugTabelle({ einsatz, piloten, geraete, onBearbeiten }: { einsatz: Einsatz; piloten: Pilot[]; geraete: Geraet[]; onBearbeiten?: (f: Flug) => void }) {
  const fluege = [...einsatz.fluege].sort((a, b) => a.nr - b.nr)
  const summe = fluege.reduce((s, f) => s + dauerMinuten(f.start, f.landung), 0)
  const mehrereGeraete = new Set(fluege.map((f) => f.geraetId)).size > 1
  return (
    <div className="-mx-4 overflow-x-auto px-4">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b-2 border-linie text-xs uppercase tracking-wide text-gray-600">
            <th className="py-2 pr-2">Nr.</th>
            <th className="py-2 pr-2">Akku</th>
            <th className="py-2 pr-2">Spannung vor</th>
            <th className="py-2 pr-2">Spannung nach</th>
            <th className="py-2 pr-2">Start</th>
            <th className="py-2 pr-2">Landung</th>
            <th className="py-2 pr-2">Dauer</th>
            <th className="py-2 pr-2">Zwischencheck</th>
            <th className="py-2 pr-2">Pilot</th>
            {onBearbeiten && <th className="py-2" />}
          </tr>
        </thead>
        <tbody>
          {fluege.map((f) => {
            const p = piloten.find((x) => x.id === f.pilotId)
            const g = geraete.find((x) => x.id === f.geraetId)
            return (
              <tr key={f.id} className="border-b border-linie">
                <td className="py-2 pr-2 font-bold">{f.nr}</td>
                <td className="py-2 pr-2">
                  {akkuNummer(geraete, f)}
                  {mehrereGeraete && g && <span className="block text-xs text-gray-600">{g.name}</span>}
                </td>
                <td className="py-2 pr-2 tabular-nums">{fmtV(f.spannungVor)}</td>
                <td className="py-2 pr-2 tabular-nums">{fmtV(f.spannungNach)}</td>
                <td className="py-2 pr-2 tabular-nums">{fmtZeit(f.start)}</td>
                <td className="py-2 pr-2 tabular-nums">{f.landung ? fmtZeit(f.landung) : <Badge color="rot">läuft</Badge>}</td>
                <td className="py-2 pr-2 tabular-nums">{f.landung ? `${dauerMinuten(f.start, f.landung)} min` : ''}</td>
                <td className="py-2 pr-2">{f.nr === 1 ? '–' : f.zwischencheck ? '✓' : <Badge color="gelb">nein</Badge>}</td>
                <td className="whitespace-nowrap py-2 pr-2">{p ? pilotName(p) : einsatz.rollen.pilot?.name ?? ''}</td>
                {onBearbeiten && (
                  <td className="py-1 text-right">
                    <Button size="sm" variant="ghost" aria-label={`Flug ${f.nr} korrigieren`} onClick={() => onBearbeiten(f)}>
                      <Pencil size={16} />
                    </Button>
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="font-semibold">
            <td className="py-2 pr-2" colSpan={6}>
              {fluege.length} {fluege.length === 1 ? 'Flug' : 'Flüge'}
            </td>
            <td className="py-2 pr-2 tabular-nums">{summe} min</td>
            <td colSpan={onBearbeiten ? 3 : 2} />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
