import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, Trash2, TriangleAlert, Wrench } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db } from '../../db/db'
import type { Einsatz, Geraet, GeraetStatus, Pilot } from '../../db/types'
import { Badge, Button, Card, EmptyState, Modal, PageHeader, Segmented, Stat, TextInput, cx } from '../../components/ui'
import { formatStunden } from '../../lib/calc'
import { fmtDatum, fmtZeit, fromDateInput, pilotName, toDateInput } from '../../lib/format'
import { alleFluege, geraetStatistik } from '../../lib/stats'
import { useOrg } from '../../lib/useOrg'
import { teileMinuten, zuMinuten } from '../piloten/logic'
import { useEinsaetze, useMaengel, usePiloten, useWartungen } from './daten'
import { GeraetAkkus } from './GeraetAkkus'
import { GeraetMaengel } from './GeraetMaengel'
import { geraetVerwendet, offeneMaengel, serviceFaelligkeit, STATUS_FARBE, STATUS_LABEL } from './logic'
import { Wartungsbuch } from './Wartungsbuch'

type Tab = 'uebersicht' | 'akkus' | 'wartung' | 'maengel'

const STATUS_OPTIONEN = (Object.keys(STATUS_LABEL) as GeraetStatus[]).map((s) => ({ value: s, label: STATUS_LABEL[s] }))

export function GeraetDetailPage() {
  const { id } = useParams()
  const org = useOrg()
  const [params, setParams] = useSearchParams()
  const geraet = useLiveQuery(async () => (id ? ((await db.geraete.get(id)) ?? null) : null), [id])
  const einsaetze = useEinsaetze(org?.id)
  const piloten = usePiloten(org?.id)
  const maengel = useMaengel(org?.id)
  const wartungen = useWartungen(org?.id, id)

  if (!org || geraet === undefined || !einsaetze || !piloten || !maengel || !wartungen) return null
  if (!geraet || geraet.orgId !== org.id)
    return (
      <EmptyState
        title="Gerät nicht gefunden"
        action={
          <Link className="font-semibold text-rot-700" to="/geraete">
            Zur Geräteliste
          </Link>
        }
      />
    )

  const tab = (params.get('tab') as Tab) || 'uebersicht'
  const offen = offeneMaengel(maengel, geraet.id)
  const service = serviceFaelligkeit(geraet.naechstesHerstellerservice)
  const tabs: { value: Tab; label: string }[] = [
    { value: 'uebersicht', label: 'Übersicht' },
    { value: 'akkus', label: `Akkus (${geraet.akkus.filter((a) => a.status !== 'ausgemustert').length})` },
    { value: 'wartung', label: 'Wartungsbuch' },
    { value: 'maengel', label: `Mängel${offen.length ? ` (${offen.length})` : ''}` },
  ]

  return (
    <>
      <Link to="/geraete" className="mb-2 inline-flex min-h-11 items-center gap-1 font-semibold text-rot-700">
        <ArrowLeft size={18} /> Geräte
      </Link>
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {geraet.name} <Badge color={STATUS_FARBE[geraet.status]}>{STATUS_LABEL[geraet.status]}</Badge>
          </span>
        }
        subtitle={[geraet.hersteller, geraet.modell, geraet.registrierungsnummer && `Reg. ${geraet.registrierungsnummer}`].filter(Boolean).join(' · ')}
      />

      <div className="mb-4 flex flex-col gap-2">
        {offen.length > 0 && geraet.status === 'einsatzbereit' && (
          <Hinweis farbe="rot">
            <span className="flex-1">
              {offen.length === 1 ? 'Es besteht 1 offener Mangel' : `Es bestehen ${offen.length} offene Mängel`}, das Gerät ist aber als <b>einsatzbereit</b> markiert.
            </span>
            <Button size="sm" variant="secondary" icon={<Wrench size={16} />} onClick={() => db.geraete.update(geraet.id, { status: 'wartung' })}>
              Status auf „Wartung“ setzen
            </Button>
          </Hinweis>
        )}
        {service === 'ueberfaellig' && <Hinweis farbe="rot">Herstellerservice überfällig (fällig seit {fmtDatum(geraet.naechstesHerstellerservice)}).</Hinweis>}
        {service === 'bald' && <Hinweis farbe="gelb">Herstellerservice bald fällig: {fmtDatum(geraet.naechstesHerstellerservice)}.</Hinweis>}
      </div>

      <div className="mb-4">
        <Segmented value={tab} onChange={(t) => setParams(t === 'uebersicht' ? {} : { tab: t }, { replace: true })} options={tabs} />
      </div>

      {tab === 'uebersicht' && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Stammdaten key={geraet.id} geraet={geraet} />
          <div className="flex flex-col gap-4">
            <Statistik geraet={geraet} einsaetze={einsaetze} piloten={piloten} />
            <Loeschen geraet={geraet} verwendet={geraetVerwendet(geraet.id, einsaetze)} />
          </div>
        </div>
      )}
      {tab === 'akkus' && <GeraetAkkus geraet={geraet} einsaetze={einsaetze} />}
      {tab === 'wartung' && <Wartungsbuch geraet={geraet} wartungen={wartungen} maengel={maengel} />}
      {tab === 'maengel' && <GeraetMaengel geraet={geraet} maengel={maengel.filter((m) => m.geraetId === geraet.id)} einsaetze={einsaetze} />}
    </>
  )
}

export function Hinweis({ farbe, children }: { farbe: 'rot' | 'gelb'; children: ReactNode }) {
  return (
    <div className={cx('flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm', farbe === 'rot' ? 'border-rot-200 bg-fehler-bg text-fehler' : 'border-warn bg-warn-bg text-warn')}>
      <TriangleAlert size={18} className="shrink-0" />
      {children}
    </div>
  )
}

function Stammdaten({ geraet }: { geraet: Geraet }) {
  const [g, setG] = useState(geraet)
  const [gespeichert, setGespeichert] = useState<Geraet | null>(null)
  const vor = teileMinuten(geraet.vorerfassteMinuten ?? 0)
  const [vh, setVh] = useState(String(vor.stunden))
  const [vm, setVm] = useState(String(vor.minuten))
  type TextFeld = 'name' | 'hersteller' | 'modell' | 'payload' | 'registrierungsnummer' | 'seriennummer' | 'klasse' | 'verantwortlicher'
  const set = (k: TextFeld) => (e: { target: { value: string } }) => setG({ ...g, [k]: e.target.value })
  const zahl = (v: string) => Math.max(0, parseInt(v, 10) || 0)
  const opt = (v?: string) => v?.trim() || undefined

  const speichern = async () => {
    await db.geraete.update(geraet.id, {
      name: g.name.trim(),
      hersteller: g.hersteller.trim(),
      modell: g.modell.trim(),
      payload: opt(g.payload),
      registrierungsnummer: opt(g.registrierungsnummer),
      seriennummer: opt(g.seriennummer),
      klasse: opt(g.klasse),
      verantwortlicher: opt(g.verantwortlicher),
      naechstesHerstellerservice: g.naechstesHerstellerservice,
      vorerfassteMinuten: zuMinuten(zahl(vh), zahl(vm)) || undefined,
    })
    setGespeichert(g)
  }

  return (
    <Card title="Stammdaten">
      <div className="mb-4">
        <Segmented label="Status" value={geraet.status} onChange={(s) => db.geraete.update(geraet.id, { status: s })} options={STATUS_OPTIONEN} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput className="sm:col-span-2" label="Name *" value={g.name} onChange={set('name')} />
        <TextInput label="Hersteller" value={g.hersteller} onChange={set('hersteller')} />
        <TextInput label="Modell" value={g.modell} onChange={set('modell')} />
        <TextInput label="Payload" value={g.payload ?? ''} onChange={set('payload')} />
        <TextInput label="Klasse" value={g.klasse ?? ''} onChange={set('klasse')} placeholder="C0…C6 / Bestandsgerät" />
        <TextInput label="Registrierungsnummer" value={g.registrierungsnummer ?? ''} onChange={set('registrierungsnummer')} />
        <TextInput label="Seriennummer" value={g.seriennummer ?? ''} onChange={set('seriennummer')} />
        <TextInput className="sm:col-span-2" label="Geräteverantwortlicher" value={g.verantwortlicher ?? ''} onChange={set('verantwortlicher')} />
        <TextInput
          label="Nächstes Herstellerservice"
          type="date"
          value={toDateInput(g.naechstesHerstellerservice)}
          onChange={(e) => setG({ ...g, naechstesHerstellerservice: fromDateInput(e.target.value) })}
        />
      </div>
      <div className="mt-4 rounded-md border border-dashed border-linie bg-flaeche p-3">
        <span className="label">
          Vorerfasste Betriebsstunden <span className="font-normal text-gray-600">(vor Einführung der App)</span>
        </span>
        <div className="grid grid-cols-2 gap-3">
          <TextInput label="Stunden" type="number" min={0} inputMode="numeric" value={vh} onChange={(e) => setVh(e.target.value)} />
          <TextInput label="Minuten" type="number" min={0} max={59} inputMode="numeric" value={vm} onChange={(e) => setVm(e.target.value)} />
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <Button disabled={!g.name.trim()} onClick={speichern}>
          Speichern
        </Button>
        {gespeichert === g && <span className="text-sm text-ok">Gespeichert</span>}
      </div>
    </Card>
  )
}

function Statistik({ geraet, einsaetze, piloten }: { geraet: Geraet; einsaetze: Einsatz[]; piloten: Pilot[] }) {
  const st = geraetStatistik(geraet, einsaetze)
  const fluege = alleFluege(einsaetze).filter((f) => f.geraetId === geraet.id)
  const pilot = (id: string) => pilotName(piloten.find((p) => p.id === id)) || 'unbekannt'
  return (
    <Card title="Statistik">
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Flüge" value={st.fluege} sub="aus dem Flugbuch" />
        <Stat label="Betriebsstunden" value={formatStunden(st.minuten)} sub={geraet.vorerfassteMinuten ? `inkl. ${formatStunden(geraet.vorerfassteMinuten)} vorerfasst` : 'automatisch berechnet'} />
      </div>
      <h3 className="mb-2 mt-4 font-bold">Letzte Flüge</h3>
      {fluege.length === 0 ? (
        <p className="text-sm text-gray-600">Noch keine Flüge mit diesem Gerät.</p>
      ) : (
        <ul className="divide-y divide-linie rounded-md border border-linie">
          {fluege.slice(0, 8).map((f) => (
            <li key={f.flugId}>
              <Link to={`/einsaetze/${f.einsatz.id}`} className="flex min-h-11 flex-wrap items-center gap-x-3 px-3 py-2 hover:bg-flaeche">
                <span className="font-semibold tabular-nums">{fmtDatum(f.start)}</span>
                <span className="text-sm tabular-nums text-gray-600">{fmtZeit(f.start)}</span>
                <span className="min-w-0 flex-1 truncate text-sm">{pilot(f.pilotId)}</span>
                <span className="font-semibold tabular-nums">{f.landung ? formatStunden(f.minuten) : 'läuft'}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function Loeschen({ geraet, verwendet }: { geraet: Geraet; verwendet: boolean }) {
  const nav = useNavigate()
  const [offen, setOffen] = useState(false)
  return (
    <Card title="Gerät entfernen">
      <p className="mb-3 text-sm text-gray-600">
        {verwendet ? 'Das Gerät wurde bereits geflogen und bleibt für das Flugbuch erhalten. Es kann nur außer Dienst gestellt werden.' : 'Das Gerät wurde noch nie geflogen und kann gelöscht werden.'}
      </p>
      {verwendet ? (
        <Button variant="secondary" disabled={geraet.status === 'ausser_dienst'} onClick={() => db.geraete.update(geraet.id, { status: 'ausser_dienst' })}>
          {geraet.status === 'ausser_dienst' ? 'Bereits außer Dienst' : 'Außer Dienst stellen'}
        </Button>
      ) : (
        <Button variant="ghost" icon={<Trash2 size={16} />} onClick={() => setOffen(true)}>
          Gerät löschen
        </Button>
      )}
      <Modal
        open={offen}
        onClose={() => setOffen(false)}
        title="Gerät löschen"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOffen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                await db.transaction('rw', db.geraete, db.wartungen, db.maengel, async () => {
                  await db.wartungen.where('geraetId').equals(geraet.id).delete()
                  await db.maengel.where('geraetId').equals(geraet.id).delete()
                  await db.geraete.delete(geraet.id)
                })
                nav('/geraete', { replace: true })
              }}
            >
              Endgültig löschen
            </Button>
          </>
        }
      >
        <p>
          Soll <b>{geraet.name}</b> mit Akkus, Wartungsbuch und Mängeln endgültig gelöscht werden? Dies kann nicht rückgängig gemacht werden.
        </p>
      </Modal>
    </Card>
  )
}
