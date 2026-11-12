import { CircleCheck, CircleX, Plane, Plus, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { db, jetzt, neueId } from '../../db/db'
import type { Geraet } from '../../db/types'
import { Badge, Button, EmptyState, Modal, PageHeader, TextInput } from '../../components/ui'
import { formatStunden } from '../../lib/calc'
import { geraetStatistik } from '../../lib/stats'
import { useOrg } from '../../lib/useOrg'
import { useEinsaetze, useGeraete, useMaengel, useWartungen } from './daten'
import { MONATE, offeneMaengel, serviceFaelligkeit, STATUS_FARBE, STATUS_LABEL, wartungImMonatErledigt } from './logic'

export function GeraeteListePage() {
  const org = useOrg()
  const geraete = useGeraete(org?.id)
  const einsaetze = useEinsaetze(org?.id)
  const maengel = useMaengel(org?.id)
  const wartungen = useWartungen(org?.id)
  const [neu, setNeu] = useState(false)
  const [heute] = useState(() => new Date())

  if (!org || !geraete || !einsaetze || !maengel || !wartungen) return null

  return (
    <>
      <PageHeader
        title="Geräte"
        subtitle={`${geraete.filter((g) => g.status === 'einsatzbereit').length} von ${geraete.length} einsatzbereit · Wartung ${MONATE[heute.getMonth()]} ${heute.getFullYear()}`}
        actions={
          <Button icon={<Plus size={20} />} onClick={() => setNeu(true)}>
            Gerät anlegen
          </Button>
        }
      />
      {geraete.length === 0 ? (
        <EmptyState
          icon={<Plane size={40} />}
          title="Noch keine Geräte erfasst"
          text="Lege die Drohnen deiner Feuerwehr mit Akkus an. Betriebsstunden und Akkuzyklen werden automatisch aus den Flügen berechnet."
          action={<Button onClick={() => setNeu(true)}>Gerät anlegen</Button>}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {geraete.map((g) => {
            const st = geraetStatistik(g, einsaetze)
            const offen = offeneMaengel(maengel, g.id).length
            const erledigt = wartungImMonatErledigt(wartungen, g.id, heute)
            const service = serviceFaelligkeit(g.naechstesHerstellerservice, heute)
            return (
              <li key={g.id}>
                <Link to={`/geraete/${g.id}`} className="flex h-full flex-col gap-3 rounded-lg border border-linie bg-white p-4 hover:border-rot-200 hover:bg-rot-50">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-lg font-bold text-dunkel">{g.name}</div>
                      <div className="text-sm text-gray-600">{[g.hersteller, g.modell].filter(Boolean).join(' ')}</div>
                    </div>
                    <Badge color={STATUS_FARBE[g.status]}>{STATUS_LABEL[g.status]}</Badge>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                    <dt className="text-gray-500">Payload</dt>
                    <dd className="truncate">{g.payload || '–'}</dd>
                    <dt className="text-gray-500">Registrierung</dt>
                    <dd className="truncate">{g.registrierungsnummer || '–'}</dd>
                    <dt className="text-gray-500">Betriebsstunden</dt>
                    <dd className="font-semibold tabular-nums">
                      {formatStunden(st.minuten)} <span className="font-normal text-gray-600">· {st.fluege} Flüge</span>
                    </dd>
                  </dl>
                  <div className="mt-auto flex flex-wrap gap-2">
                    {offen > 0 ? (
                      <Badge color="rot">
                        <TriangleAlert size={14} /> {offen === 1 ? '1 offener Mangel' : `${offen} offene Mängel`}
                      </Badge>
                    ) : (
                      <Badge color="gruen">keine offenen Mängel</Badge>
                    )}
                    {g.status !== 'ausser_dienst' &&
                      (erledigt ? (
                        <Badge color="gruen">
                          <CircleCheck size={14} /> Monatsprüfung erledigt
                        </Badge>
                      ) : (
                        <Badge color="gelb">
                          <CircleX size={14} /> Monatsprüfung offen
                        </Badge>
                      ))}
                    {service === 'ueberfaellig' && <Badge color="rot">Service überfällig</Badge>}
                    {service === 'bald' && <Badge color="gelb">Service bald fällig</Badge>}
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <GeraetAnlegenModal open={neu} onClose={() => setNeu(false)} orgId={org.id} />
    </>
  )
}

function GeraetAnlegenModal({ open, onClose, orgId }: { open: boolean; onClose: () => void; orgId: string }) {
  const nav = useNavigate()
  const leer = { name: '', hersteller: '', modell: '', payload: '', registrierungsnummer: '' }
  const [f, setF] = useState(leer)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })
  const ok = f.name.trim()
  const schliessen = () => {
    setF(leer)
    onClose()
  }
  const anlegen = async () => {
    if (!ok) return
    const g: Geraet = {
      id: neueId(),
      orgId,
      name: f.name.trim(),
      hersteller: f.hersteller.trim(),
      modell: f.modell.trim(),
      payload: f.payload.trim() || undefined,
      registrierungsnummer: f.registrierungsnummer.trim() || undefined,
      status: 'einsatzbereit',
      akkus: [],
      erstelltAm: jetzt(),
    }
    await db.geraete.add(g)
    schliessen()
    nav(`/geraete/${g.id}`)
  }
  return (
    <Modal
      open={open}
      onClose={schliessen}
      title="Gerät anlegen"
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
        <TextInput className="sm:col-span-2" label="Name *" value={f.name} onChange={set('name')} placeholder="z. B. Hornisse 1" autoFocus autoComplete="off" />
        <TextInput label="Hersteller" value={f.hersteller} onChange={set('hersteller')} placeholder="z. B. DJI" />
        <TextInput label="Modell" value={f.modell} onChange={set('modell')} placeholder="z. B. Matrice 30T" />
        <TextInput label="Payload" value={f.payload} onChange={set('payload')} placeholder="z. B. Wärmebild + Zoom" />
        <TextInput label="Registrierungsnummer" value={f.registrierungsnummer} onChange={set('registrierungsnummer')} />
        <button type="submit" hidden />
        <p className="text-sm text-gray-600 sm:col-span-2">Weitere Daten und Akkus können danach auf der Geräteseite ergänzt werden.</p>
      </form>
    </Modal>
  )
}
