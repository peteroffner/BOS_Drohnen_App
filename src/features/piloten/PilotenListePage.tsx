import { Plus, Search, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db, jetzt, neueId } from '../../db/db'
import type { Pilot } from '../../db/types'
import { AmpelBadge, Button, Checkbox, EmptyState, Modal, PageHeader, Select, TextInput } from '../../components/ui'
import { formatStunden } from '../../lib/calc'
import { fmtDatum, pilotName } from '../../lib/format'
import { pilotStatistik, pilotStatus } from '../../lib/stats'
import { useOrg } from '../../lib/useOrg'
import { useDarf } from '../auth/kontext'
import { useEinsaetze, usePiloten } from '../geraete/daten'
import { pilotPasst, sortierePiloten, type PilotSortierung, type PilotZeile } from './logic'

const SORTIERUNGEN: { value: PilotSortierung; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'status', label: 'Status (Ampel)' },
  { value: 'stunden', label: 'Flugstunden' },
  { value: 'letzterFlug', label: 'Letzter Flug' },
]

export function PilotenListePage() {
  const org = useOrg()
  const piloten = usePiloten(org?.id)
  const einsaetze = useEinsaetze(org?.id)
  const [inaktive, setInaktive] = useState(false)
  const [suche, setSuche] = useState('')
  const [sortierung, setSortierung] = useState<PilotSortierung>('name')
  const [neu, setNeu] = useState(false)
  const darfVerwalten = useDarf('pilot.verwalten')

  const zeilen = useMemo<PilotZeile[]>(() => {
    if (!org || !piloten || !einsaetze) return []
    return piloten.map((p) => ({
      pilot: p,
      status: pilotStatus(p, einsaetze, org.freigabeRegeln),
      stat: pilotStatistik(p, einsaetze, org.freigabeRegeln.zeitraumTage),
    }))
  }, [org, piloten, einsaetze])

  if (!org || !piloten || !einsaetze) return null

  const anzahlInaktiv = zeilen.filter((z) => !z.pilot.aktiv).length
  const sichtbar = sortierePiloten(
    zeilen.filter((z) => (inaktive || z.pilot.aktiv) && pilotPasst(z.pilot, suche)),
    sortierung,
  )
  const aktive = zeilen.filter((z) => z.pilot.aktiv)
  const gruen = aktive.filter((z) => z.status.ampel === 'gruen').length

  return (
    <>
      <PageHeader
        title="Piloten"
        subtitle={`${aktive.length} aktiv · ${gruen} einsatzbereit`}
        actions={
          darfVerwalten && (
            <Button icon={<Plus size={20} />} onClick={() => setNeu(true)}>
              Pilot anlegen
            </Button>
          )
        }
      />

      {zeilen.length === 0 ? (
        <EmptyState
          icon={<Users size={40} />}
          title="Noch keine Piloten erfasst"
          text="Lege die Drohnenpiloten deiner Feuerwehr an. Flugstunden werden danach automatisch aus dem Flugbuch berechnet."
          action={darfVerwalten && <Button onClick={() => setNeu(true)}>Pilot anlegen</Button>}
        />
      ) : (
        <>
          <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="relative">
              <TextInput label="Suche" placeholder="Name, Dienstgrad, Feuerwehr …" value={suche} onChange={(e) => setSuche(e.target.value)} type="search" />
              <Search size={18} className="pointer-events-none absolute right-3 top-[38px] text-gray-400" />
            </div>
            <Select label="Sortierung" value={sortierung} onChange={(e) => setSortierung(e.target.value as PilotSortierung)} options={SORTIERUNGEN} />
          </div>
          <div className="mb-3">
            <Checkbox label={`inaktive anzeigen${anzahlInaktiv ? ` (${anzahlInaktiv})` : ''}`} checked={inaktive} onChange={setInaktive} />
          </div>

          {sichtbar.length === 0 ? (
            <EmptyState title="Keine Piloten gefunden" text="Suchbegriff ändern oder inaktive Piloten anzeigen." />
          ) : (
            <ul className="flex flex-col gap-2">
              {sichtbar.map((z) => (
                <PilotKarte key={z.pilot.id} z={z} orgName={org.name} />
              ))}
            </ul>
          )}
        </>
      )}

      <PilotAnlegenModal open={neu} onClose={() => setNeu(false)} orgId={org.id} />
    </>
  )
}

function PilotKarte({ z, orgName }: { z: PilotZeile; orgName: string }) {
  const { pilot: p, status, stat } = z
  return (
    <li>
      <Link
        to={`/piloten/${p.id}`}
        className="flex flex-col gap-2 rounded-lg border border-linie bg-white p-4 hover:border-rot-200 hover:bg-rot-50 md:flex-row md:items-center md:gap-4"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-lg font-bold text-dunkel">{pilotName(p)}</span>
            {!p.aktiv && <span className="rounded-full border border-linie bg-flaeche px-2 text-xs font-semibold">inaktiv</span>}
          </div>
          <div className="text-sm text-gray-600">{p.feuerwehr || orgName}</div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <AmpelBadge ampel={status.ampel} title={status.gruende.join('\n') || 'Alle Voraussetzungen erfüllt'} />
          </div>
          {status.gruende.length > 0 && <div className="mt-1 text-xs text-gray-600">{status.gruende.join(' · ')}</div>}
        </div>
        <dl className="grid grid-cols-3 gap-2 text-sm md:w-96 md:shrink-0">
          <div>
            <dt className="text-xs text-gray-500">Flugstunden</dt>
            <dd className="font-semibold tabular-nums">{formatStunden(stat.gesamt.minuten)}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Flüge 90 Tage</dt>
            <dd className="font-semibold tabular-nums">{stat.letzte90Tage.fluege}</dd>
          </div>
          <div>
            <dt className="text-xs text-gray-500">Letzter Flug</dt>
            <dd className="font-semibold tabular-nums">{stat.letzterFlug ? fmtDatum(stat.letzterFlug) : '–'}</dd>
          </div>
        </dl>
      </Link>
    </li>
  )
}

function PilotAnlegenModal({ open, onClose, orgId }: { open: boolean; onClose: () => void; orgId: string }) {
  const nav = useNavigate()
  const leer = { vorname: '', nachname: '', dienstgrad: '', feuerwehr: '', telefon: '', email: '' }
  const [f, setF] = useState(leer)
  const ok = f.vorname.trim() && f.nachname.trim()
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const schliessen = () => {
    setF(leer)
    onClose()
  }
  const anlegen = async () => {
    if (!ok) return
    const p: Pilot = {
      id: neueId(),
      orgId,
      vorname: f.vorname.trim(),
      nachname: f.nachname.trim(),
      dienstgrad: f.dienstgrad.trim() || undefined,
      feuerwehr: f.feuerwehr.trim() || undefined,
      telefon: f.telefon.trim() || undefined,
      email: f.email.trim() || undefined,
      qualifikationen: [],
      freigabe: { erteilt: false },
      aktiv: true,
      erstelltAm: jetzt(),
    }
    await db.piloten.add(p)
    schliessen()
    nav(`/piloten/${p.id}`)
  }
  return (
    <Modal
      open={open}
      onClose={schliessen}
      title="Pilot anlegen"
      footer={
        <>
          <Button variant="secondary" onClick={schliessen}>
            Abbrechen
          </Button>
          <Button disabled={!ok} onClick={anlegen}>
            Anlegen
          </Button>
        </>
      }
    >
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          void anlegen()
        }}
      >
        <TextInput label="Vorname *" value={f.vorname} onChange={set('vorname')} autoFocus autoComplete="off" />
        <TextInput label="Nachname *" value={f.nachname} onChange={set('nachname')} autoComplete="off" />
        <TextInput label="Dienstgrad" value={f.dienstgrad} onChange={set('dienstgrad')} placeholder="z. B. OBI, HBM" />
        <TextInput label="Feuerwehr" value={f.feuerwehr} onChange={set('feuerwehr')} hint="nur falls abweichend (z. B. Nachbarwehr)" />
        <TextInput label="Telefon" type="tel" value={f.telefon} onChange={set('telefon')} />
        <TextInput label="E-Mail" type="email" value={f.email} onChange={set('email')} />
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}
