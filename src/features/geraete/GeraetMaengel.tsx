import { CircleCheck, Plus } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { db, jetzt, neueId } from '../../db/db'
import type { Einsatz, Geraet, Mangel } from '../../db/types'
import { Badge, Button, Card, Checkbox, EmptyState, Modal, TextArea, TextInput } from '../../components/ui'
import { useDarf } from '../auth/kontext'
import { fmtDatum, fromDateInput, toDateInput } from '../../lib/format'

const QUELLE_LABEL: Record<Mangel['quelle'], string> = { nachkontrolle: 'Nachkontrolle', wartung: 'Wartung', manuell: 'manuell' }

export function GeraetMaengel({ geraet, maengel, einsaetze }: { geraet: Geraet; maengel: Mangel[]; einsaetze: Einsatz[] }) {
  const [neu, setNeu] = useState(false)
  const darfAnlegen = useDarf('mangel.anlegen')
  const darfBeheben = useDarf('mangel.beheben')
  const [beheben, setBeheben] = useState<Mangel | null>(null)
  const [behobeneZeigen, setBehobeneZeigen] = useState(false)
  const sortiert = [...maengel].sort((a, b) => b.erstelltAm.localeCompare(a.erstelltAm))
  const offen = sortiert.filter((m) => !m.behobenAm)
  const behoben = sortiert.filter((m) => m.behobenAm)

  return (
    <div className="flex flex-col gap-4">
      <Card
        title={`Offene Mängel (${offen.length})`}
        actions={
          darfAnlegen && (
            <Button size="sm" icon={<Plus size={16} />} onClick={() => setNeu(true)}>
              Mangel erfassen
            </Button>
          )
        }
      >
        {offen.length === 0 ? (
          <EmptyState icon={<CircleCheck size={36} />} title="Keine offenen Mängel" />
        ) : (
          <ul className="divide-y divide-linie">
            {offen.map((m) => (
              <MangelZeile key={m.id} m={m} einsaetze={einsaetze}>
                {darfBeheben && (
                  <Button size="sm" variant="secondary" icon={<CircleCheck size={16} />} onClick={() => setBeheben(m)}>
                    Als behoben markieren
                  </Button>
                )}
              </MangelZeile>
            ))}
          </ul>
        )}
      </Card>

      <Card title={`Behobene Mängel (${behoben.length})`}>
        {behoben.length === 0 ? (
          <p className="text-sm text-gray-600">Noch keine behobenen Mängel.</p>
        ) : (
          <>
            <Checkbox label="behobene Mängel anzeigen" checked={behobeneZeigen} onChange={setBehobeneZeigen} />
            {behobeneZeigen && (
              <ul className="divide-y divide-linie">
                {behoben.map((m) => (
                  <MangelZeile key={m.id} m={m} einsaetze={einsaetze} />
                ))}
              </ul>
            )}
          </>
        )}
      </Card>

      {neu && <NeuModal geraet={geraet} onClose={() => setNeu(false)} />}
      {beheben && <BehebenModal key={beheben.id} mangel={beheben} onClose={() => setBeheben(null)} />}
    </div>
  )
}

function MangelZeile({ m, einsaetze, children }: { m: Mangel; einsaetze: Einsatz[]; children?: ReactNode }) {
  const einsatz = m.einsatzId ? einsaetze.find((e) => e.id === m.einsatzId) : undefined
  return (
    <li className="flex flex-wrap items-start gap-3 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge color={m.behobenAm ? 'gruen' : 'rot'}>{m.behobenAm ? 'behoben' : 'offen'}</Badge>
          <Badge>{QUELLE_LABEL[m.quelle]}</Badge>
          <span className="text-sm text-gray-600">{fmtDatum(m.erstelltAm)}</span>
        </div>
        <p className="mt-1 whitespace-pre-line">{m.beschreibung}</p>
        {m.einsatzId && (
          <Link to={`/einsaetze/${m.einsatzId}`} className="inline-flex min-h-9 items-center text-sm font-semibold text-rot-700">
            Einsatz {einsatz ? `vom ${fmtDatum(einsatz.datum)}${einsatz.fluggebiet ? ` – ${einsatz.fluggebiet}` : ''}` : 'öffnen'} →
          </Link>
        )}
        {m.behobenAm && (
          <p className="mt-1 text-sm text-ok">
            Behoben am {fmtDatum(m.behobenAm)}
            {m.behobenVon ? ` durch ${m.behobenVon}` : ''}
            {m.massnahme ? `: ${m.massnahme}` : ''}
          </p>
        )}
      </div>
      {children}
    </li>
  )
}

function NeuModal({ geraet, onClose }: { geraet: Geraet; onClose: () => void }) {
  const [text, setText] = useState('')
  const speichern = async () => {
    if (!text.trim()) return
    await db.maengel.add({ id: neueId(), orgId: geraet.orgId, geraetId: geraet.id, erstelltAm: jetzt(), quelle: 'manuell', beschreibung: text.trim() })
    onClose()
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Mangel erfassen"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button disabled={!text.trim()} onClick={speichern}>
            Speichern
          </Button>
        </>
      }
    >
      <TextArea label="Beschreibung *" value={text} onChange={(e) => setText(e.target.value)} placeholder="z. B. Rotorblatt hinten links eingerissen" autoFocus />
    </Modal>
  )
}

function BehebenModal({ mangel, onClose }: { mangel: Mangel; onClose: () => void }) {
  const [datum, setDatum] = useState(() => jetzt())
  const [von, setVon] = useState('')
  const [massnahme, setMassnahme] = useState('')
  const ok = von.trim() && massnahme.trim()
  return (
    <Modal
      open
      onClose={onClose}
      title="Mangel als behoben markieren"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            disabled={!ok}
            onClick={async () => {
              await db.maengel.update(mangel.id, { behobenAm: datum, behobenVon: von.trim(), massnahme: massnahme.trim() })
              onClose()
            }}
          >
            Speichern
          </Button>
        </>
      }
    >
      <p className="mb-4 rounded-md bg-flaeche p-3 text-sm">{mangel.beschreibung}</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput label="Behoben am *" type="date" value={toDateInput(datum)} onChange={(e) => setDatum(fromDateInput(e.target.value) ?? datum)} />
        <TextInput label="Behoben durch *" value={von} onChange={(e) => setVon(e.target.value)} />
        <TextArea className="sm:col-span-2" label="Maßnahme *" value={massnahme} onChange={(e) => setMassnahme(e.target.value)} placeholder="z. B. Rotorblatt getauscht" />
      </div>
    </Modal>
  )
}
