import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { db } from '../../db/db'
import type { Pilot } from '../../db/types'
import { Button, Card, Checkbox, EmptyState, Modal, NurAnsichtHinweis, PageHeader, TextInput, cx } from '../../components/ui'
import { pilotName } from '../../lib/format'
import { pilotStatus, type PilotStatus } from '../../lib/stats'
import { useOrg } from '../../lib/useOrg'
import { useDarf, useMitgliedschaft } from '../auth/kontext'
import { useEinsaetze, useGeraete } from '../geraete/daten'
import { pilotVerwendet } from './logic'
import { PilotFlugstunden } from './PilotFlugstunden'
import { PilotFreigabe } from './PilotFreigabe'
import { PilotQualifikationen } from './PilotQualifikationen'

export function PilotDetailPage() {
  const { id } = useParams()
  const org = useOrg()
  const pilot = useLiveQuery(async () => (id ? ((await db.piloten.get(id)) ?? null) : null), [id])
  const einsaetze = useEinsaetze(org?.id)
  const geraete = useGeraete(org?.id)
  const ich = useMitgliedschaft()
  const darfVerwalten = useDarf('pilot.verwalten')
  const darfEigene = useDarf('pilot.eigene_stammdaten')
  const darfFreigabe = useDarf('freigabe.erteilen')

  if (!org || pilot === undefined || !einsaetze || !geraete) return null
  if (!pilot || pilot.orgId !== org.id)
    return <EmptyState title="Pilot nicht gefunden" action={<Link className="font-semibold text-rot-700" to="/piloten">Zur Pilotenliste</Link>} />

  const status = pilotStatus(pilot, einsaetze, org.freigabeRegeln)
  // Rechte: verwalten (Admin/Teamleiter) oder eigener Datensatz (verknüpfter Pilot)
  const eigen = !!ich?.pilotId && ich.pilotId === pilot.id
  const bearbeiten = darfVerwalten || (eigen && darfEigene)
  // aktiv/Freigabe ändert laut Server-Trigger nur der Administrator
  const rechte = { bearbeiten, verwalten: darfVerwalten, aktivSetzen: darfVerwalten && darfFreigabe }

  return (
    <>
      <Link to="/piloten" className="mb-2 inline-flex min-h-11 items-center gap-1 font-semibold text-rot-700">
        <ArrowLeft size={18} /> Piloten
      </Link>
      <PageHeader title={pilotName(pilot)} subtitle={[pilot.feuerwehr || org.name, !pilot.aktiv && 'inaktiv'].filter(Boolean).join(' · ')} />
      <AmpelPanel status={status} />
      {!bearbeiten && <NurAnsichtHinweis className="mt-4" />}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Stammdaten key={pilot.id} pilot={pilot} verwendet={pilotVerwendet(pilot.id, einsaetze)} rechte={rechte} />
        <PilotFreigabe key={pilot.id + 'f'} pilot={pilot} geraete={geraete} warnTage={org.freigabeRegeln.warnungTageVorAblauf} nurAnsicht={!darfFreigabe} />
        <div className="lg:col-span-2">
          <PilotFlugstunden pilot={pilot} einsaetze={einsaetze} geraete={geraete} regelZeitraumTage={org.freigabeRegeln.zeitraumTage} nurAnsicht={!bearbeiten} />
        </div>
        <div className="lg:col-span-2">
          <PilotQualifikationen pilot={pilot} warnTage={org.freigabeRegeln.warnungTageVorAblauf} pflicht={org.freigabeRegeln.pflichtQualifikationen} nurAnsicht={!bearbeiten} />
        </div>
      </div>
    </>
  )
}

const AMPEL_STIL = {
  gruen: { box: 'border-ok bg-ok-bg text-ok', punkt: 'bg-ok', text: 'Einsatzbereit' },
  gelb: { box: 'border-warn bg-warn-bg text-warn', punkt: 'bg-amber-500', text: 'Eingeschränkt einsatzbereit' },
  rot: { box: 'border-fehler bg-fehler-bg text-fehler', punkt: 'bg-fehler', text: 'Nicht freigegeben' },
}

function AmpelPanel({ status }: { status: PilotStatus }) {
  const s = AMPEL_STIL[status.ampel]
  return (
    <div className={cx('flex items-start gap-4 rounded-lg border-2 p-4', s.box)} data-testid="ampel" data-ampel={status.ampel}>
      <span className={cx('mt-1 h-8 w-8 shrink-0 rounded-full', s.punkt)} />
      <div>
        <div className="text-xl font-bold">{s.text}</div>
        {status.gruende.length ? (
          <ul className="mt-1 list-disc pl-5 text-sm">
            {status.gruende.map((g) => (
              <li key={g}>{g}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">Freigabe, Pflicht-Qualifikationen und Flugpraxis in Ordnung.</p>
        )}
      </div>
    </div>
  )
}

type Rechte = { bearbeiten: boolean; verwalten: boolean; aktivSetzen: boolean }

function Stammdaten({ pilot, verwendet, rechte }: { pilot: Pilot; verwendet: boolean; rechte: Rechte }) {
  const nav = useNavigate()
  const [p, setP] = useState(pilot)
  const [gespeichert, setGespeichert] = useState<Pilot | null>(null)
  const [loeschen, setLoeschen] = useState(false)
  const set = (k: 'vorname' | 'nachname' | 'dienstgrad' | 'feuerwehr' | 'telefon' | 'email') => (e: { target: { value: string } }) => setP({ ...p, [k]: e.target.value })
  const ok = p.vorname.trim() && p.nachname.trim()
  const speichern = async () => {
    const opt = (v?: string) => v?.trim() || undefined
    await db.piloten.update(pilot.id, {
      vorname: p.vorname.trim(),
      nachname: p.nachname.trim(),
      dienstgrad: opt(p.dienstgrad),
      feuerwehr: opt(p.feuerwehr),
      telefon: opt(p.telefon),
      email: opt(p.email),
    })
    setGespeichert(p)
  }
  const aktivSetzen = async (aktiv: boolean) => {
    await db.piloten.update(pilot.id, { aktiv })
    setP({ ...p, aktiv })
  }

  return (
    <Card title="Stammdaten">
      <fieldset disabled={!rechte.bearbeiten} className="min-w-0">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Vorname *" value={p.vorname} onChange={set('vorname')} />
          <TextInput label="Nachname *" value={p.nachname} onChange={set('nachname')} />
          <TextInput label="Dienstgrad" value={p.dienstgrad ?? ''} onChange={set('dienstgrad')} />
          <TextInput label="Feuerwehr" value={p.feuerwehr ?? ''} onChange={set('feuerwehr')} hint="leer = eigene Organisation" />
          <TextInput label="Telefon" type="tel" value={p.telefon ?? ''} onChange={set('telefon')} />
          <TextInput label="E-Mail" type="email" value={p.email ?? ''} onChange={set('email')} />
        </div>
        {rechte.bearbeiten && (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button disabled={!ok} onClick={speichern}>
              Speichern
            </Button>
            {gespeichert === p && <span className="text-sm text-ok">Gespeichert</span>}
          </div>
        )}
      </fieldset>
      <div className="mt-4 border-t border-linie pt-3">
        <Checkbox
          label="Pilot aktiv"
          hint={rechte.aktivSetzen ? 'Inaktive Piloten werden bei der Einsatzanlage nicht angeboten.' : 'Aktivieren/Deaktivieren nur durch den Administrator.'}
          checked={pilot.aktiv}
          onChange={aktivSetzen}
          disabled={!rechte.aktivSetzen}
        />
        {rechte.verwalten && (
          <Button variant="ghost" size="sm" className="mt-2" icon={<Trash2 size={16} />} onClick={() => setLoeschen(true)}>
            Pilot löschen
          </Button>
        )}
      </div>

      <Modal
        open={loeschen}
        onClose={() => setLoeschen(false)}
        title="Pilot löschen"
        footer={
          verwendet ? (
            <>
              <Button variant="secondary" onClick={() => setLoeschen(false)}>
                Abbrechen
              </Button>
              {pilot.aktiv && rechte.aktivSetzen && (
                <Button
                  onClick={async () => {
                    await aktivSetzen(false)
                    setLoeschen(false)
                  }}
                >
                  Stattdessen deaktivieren
                </Button>
              )}
            </>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setLoeschen(false)}>
                Abbrechen
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  await db.piloten.delete(pilot.id)
                  nav('/piloten', { replace: true })
                }}
              >
                Endgültig löschen
              </Button>
            </>
          )
        }
      >
        {verwendet ? (
          <p>
            <b>{pilotName(pilot)}</b> kommt in Flügen bzw. Einsätzen vor und kann daher nicht gelöscht werden (Nachweispflicht Flugbuch).
            {pilot.aktiv ? ' Der Pilot kann stattdessen deaktiviert werden.' : ' Der Pilot ist bereits deaktiviert.'}
          </p>
        ) : (
          <p>
            Soll <b>{pilotName(pilot)}</b> mit allen Qualifikationen und Nachweisen endgültig gelöscht werden? Dies kann nicht rückgängig gemacht werden.
          </p>
        )}
      </Modal>
    </Card>
  )
}
