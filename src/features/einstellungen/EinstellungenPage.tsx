import { useState } from 'react'
import { db } from '../../db/db'
import type { FreigabeRegeln, Organisation, QualifikationTyp } from '../../db/types'
import { Button, Card, Checkbox, NurAnsichtHinweis, PageHeader, Select, TextInput } from '../../components/ui'
import { QUALIFIKATION_LABEL } from '../../lib/stats'
import { useOrg } from '../../lib/useOrg'
import { useDarf } from '../auth/kontext'
import { BackupCard } from '../auswertung/BackupCard'
import { ORG_TYPEN } from './orgTypen'

export function EinstellungenPage() {
  const org = useOrg()
  const darfEinstellungen = useDarf('org.einstellungen')
  if (!org) return null
  return (
    <>
      <PageHeader title="Einstellungen" subtitle="Organisation, Freigaberegeln für Einsatzpiloten, Datensicherung" />
      <div className="grid gap-4 lg:grid-cols-2">
        <OrgForm key={org.id + 'o'} org={org} nurAnsicht={!darfEinstellungen} />
        <RegelnForm key={org.id + 'r'} org={org} nurAnsicht={!darfEinstellungen} />
        <div className="lg:col-span-2">
          <BackupCard />
        </div>
      </div>
    </>
  )
}

function OrgForm({ org, nurAnsicht }: { org: Organisation; nurAnsicht: boolean }) {
  const [o, setO] = useState(org)
  const [gespeichertStand, setGespeichertStand] = useState<Organisation | null>(null)
  const gespeichert = gespeichertStand === o
  return (
    <Card title="Organisation">
      {nurAnsicht && <NurAnsichtHinweis className="mb-4" text="Keine Berechtigung – Einstellungen ändert nur der Administrator." />}
      <fieldset disabled={nurAnsicht} className="flex min-w-0 flex-col gap-4">
        <Select label="Typ" value={o.typ} onChange={(e) => setO({ ...o, typ: e.target.value as Organisation['typ'] })} options={ORG_TYPEN} />
        <TextInput label="Name" value={o.name} onChange={(e) => setO({ ...o, name: e.target.value })} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Bezirk" value={o.bezirk ?? ''} onChange={(e) => setO({ ...o, bezirk: e.target.value })} />
          <TextInput label="Bundesland" value={o.bundesland ?? ''} onChange={(e) => setO({ ...o, bundesland: e.target.value })} />
        </div>
        <TextInput label="Kontakt (Kommandant / Drohnenverantwortlicher)" value={o.kontakt ?? ''} onChange={(e) => setO({ ...o, kontakt: e.target.value })} />
        {!nurAnsicht && (
          <div className="flex items-center gap-3">
            <Button
              disabled={!o.name.trim()}
              onClick={async () => {
                await db.organisationen.put(o)
                setGespeichertStand(o)
              }}
            >
              Speichern
            </Button>
            {gespeichert && <span className="text-sm text-ok">Gespeichert</span>}
          </div>
        )}
      </fieldset>
    </Card>
  )
}

function RegelnForm({ org, nurAnsicht }: { org: Organisation; nurAnsicht: boolean }) {
  const [r, setR] = useState<FreigabeRegeln>(org.freigabeRegeln)
  const [gespeichertStand, setGespeichertStand] = useState<FreigabeRegeln | null>(null)
  const gespeichert = gespeichertStand === r
  const toggle = (t: QualifikationTyp, an: boolean) =>
    setR({ ...r, pflichtQualifikationen: an ? [...r.pflichtQualifikationen, t] : r.pflichtQualifikationen.filter((x) => x !== t) })
  const zahl = (v: string) => Math.max(0, parseInt(v, 10) || 0)
  return (
    <Card title="Freigaberegeln Einsatzpilot">
      <p className="mb-3 text-sm text-gray-600">
        Daraus ergibt sich die Ampel bei jedem Piloten: <b>rot</b> ohne Freigabe oder bei fehlender/abgelaufener Pflicht-Qualifikation,{' '}
        <b>gelb</b> bei zu wenig Flugpraxis oder bald ablaufenden Nachweisen.
      </p>
      <fieldset disabled={nurAnsicht} className="min-w-0">
        <span className="label">Pflicht-Qualifikationen</span>
        <div className="mb-4 grid sm:grid-cols-2">
          {(Object.keys(QUALIFIKATION_LABEL) as QualifikationTyp[])
            .filter((t) => t !== 'SONSTIGE')
            .map((t) => (
              <Checkbox key={t} label={QUALIFIKATION_LABEL[t]} checked={r.pflichtQualifikationen.includes(t)} onChange={(v) => toggle(t, v)} disabled={nurAnsicht} />
            ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextInput label="Mindestflüge" type="number" min={0} value={r.mindestFluege} onChange={(e) => setR({ ...r, mindestFluege: zahl(e.target.value) })} />
          <TextInput label="im Zeitraum (Tage)" type="number" min={1} value={r.zeitraumTage} onChange={(e) => setR({ ...r, zeitraumTage: Math.max(1, zahl(e.target.value)) })} />
          <TextInput label="Warnung vor Ablauf (Tage)" type="number" min={0} value={r.warnungTageVorAblauf} onChange={(e) => setR({ ...r, warnungTageVorAblauf: zahl(e.target.value) })} />
        </div>
        {!nurAnsicht && (
          <div className="mt-4 flex items-center gap-3">
            <Button
              onClick={async () => {
                await db.organisationen.update(org.id, { freigabeRegeln: r })
                setGespeichertStand(r)
              }}
            >
              Speichern
            </Button>
            {gespeichert && <span className="text-sm text-ok">Gespeichert</span>}
          </div>
        )}
      </fieldset>
    </Card>
  )
}
