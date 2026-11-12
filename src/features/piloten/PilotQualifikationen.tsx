import { FileText, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { db, neueId } from '../../db/db'
import type { Pilot, Qualifikation, QualifikationTyp } from '../../db/types'
import { Badge, Button, Card, EmptyState, Modal, Select, TextInput } from '../../components/ui'
import { fmtDatum, fromDateInput, toDateInput } from '../../lib/format'
import { QUALIFIKATION_LABEL } from '../../lib/stats'
import { AnhangFeld, AnhangLink } from './AnhangFeld'
import { gueltigkeit, type Gueltigkeit } from './logic'

const TYP_OPTIONEN = (Object.keys(QUALIFIKATION_LABEL) as QualifikationTyp[]).map((t) => ({ value: t, label: QUALIFIKATION_LABEL[t] }))

export function GueltigkeitBadge({ g }: { g: Gueltigkeit }) {
  if (g === 'abgelaufen') return <Badge color="rot">abgelaufen</Badge>
  if (g === 'bald') return <Badge color="gelb">läuft bald ab</Badge>
  if (g === 'gueltig') return <Badge color="gruen">gültig</Badge>
  return <Badge>unbefristet</Badge>
}

export function PilotQualifikationen({ pilot, warnTage, pflicht, nurAnsicht = false }: { pilot: Pilot; warnTage: number; pflicht: QualifikationTyp[]; nurAnsicht?: boolean }) {
  const [bearbeiten, setBearbeiten] = useState<Qualifikation | null>(null)
  const liste = [...pilot.qualifikationen].sort((a, b) => TYP_OPTIONEN.findIndex((o) => o.value === a.typ) - TYP_OPTIONEN.findIndex((o) => o.value === b.typ))
  const fehlend = pflicht.filter((t) => !pilot.qualifikationen.some((q) => q.typ === t))

  const speichern = async (q: Qualifikation) => {
    const rest = pilot.qualifikationen.filter((x) => x.id !== q.id)
    await db.piloten.update(pilot.id, { qualifikationen: [...rest, q] })
    setBearbeiten(null)
  }
  const loeschen = async (id: string) => {
    await db.piloten.update(pilot.id, { qualifikationen: pilot.qualifikationen.filter((x) => x.id !== id) })
    setBearbeiten(null)
  }

  return (
    <Card
      title="Qualifikationen"
      actions={
        !nurAnsicht && <Button size="sm" icon={<Plus size={16} />} onClick={() => setBearbeiten({ id: neueId(), typ: fehlend[0] ?? 'A1_A3' })}>
          Hinzufügen
        </Button>
      }
    >
      {fehlend.length > 0 && (
        <p className="mb-3 rounded-md bg-fehler-bg px-3 py-2 text-sm text-fehler">
          Pflicht-Qualifikation fehlt: <b>{fehlend.map((t) => QUALIFIKATION_LABEL[t]).join(', ')}</b>
        </p>
      )}
      {liste.length === 0 ? (
        <EmptyState title="Keine Qualifikationen erfasst" text="z. B. EU-Kompetenznachweis A1/A3, Fernpilotenzeugnis A2, BOS-Drohnenausbildung" />
      ) : (
        <ul className="divide-y divide-linie">
          {liste.map((q) => (
            <li key={q.id} className="flex flex-wrap items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-bold">{QUALIFIKATION_LABEL[q.typ]}</span>
                  {pflicht.includes(q.typ) && <Badge>Pflicht</Badge>}
                  <GueltigkeitBadge g={gueltigkeit(q.gueltigBis, undefined, warnTage)} />
                </div>
                {q.bezeichnung && <div className="text-sm">{q.bezeichnung}</div>}
                <div className="mt-0.5 flex flex-wrap gap-x-4 text-sm text-gray-600">
                  {q.nummer && <span>Nr. {q.nummer}</span>}
                  {q.erworbenAm && <span>erworben {fmtDatum(q.erworbenAm)}</span>}
                  <span>{q.gueltigBis ? `gültig bis ${fmtDatum(q.gueltigBis)}` : 'unbefristet'}</span>
                </div>
                {q.nachweis && (
                  <div className="mt-1 flex items-center gap-1 text-sm">
                    <FileText size={16} className="text-gray-500" />
                    <span className="truncate">{q.nachweis.name}</span>
                    <AnhangLink anhang={q.nachweis} />
                  </div>
                )}
              </div>
              {!nurAnsicht && <Button variant="secondary" size="sm" icon={<Pencil size={16} />} onClick={() => setBearbeiten(q)} aria-label={`${QUALIFIKATION_LABEL[q.typ]} bearbeiten`}>
                Bearbeiten
              </Button>}
            </li>
          ))}
        </ul>
      )}
      {bearbeiten && (
        <QualifikationModal
          key={bearbeiten.id}
          q={bearbeiten}
          neu={!pilot.qualifikationen.some((x) => x.id === bearbeiten.id)}
          onClose={() => setBearbeiten(null)}
          onSave={speichern}
          onDelete={loeschen}
        />
      )}
    </Card>
  )
}

function QualifikationModal({ q: start, neu, onClose, onSave, onDelete }: { q: Qualifikation; neu: boolean; onClose: () => void; onSave: (q: Qualifikation) => void; onDelete: (id: string) => void }) {
  const [q, setQ] = useState(start)
  const [loeschFrage, setLoeschFrage] = useState(false)
  const bezeichnungPflicht = q.typ === 'SONSTIGE' && !q.bezeichnung?.trim()
  return (
    <Modal
      open
      onClose={onClose}
      title={neu ? 'Qualifikation hinzufügen' : 'Qualifikation bearbeiten'}
      footer={
        <>
          {!neu &&
            (loeschFrage ? (
              <Button variant="danger" className="mr-auto" onClick={() => onDelete(q.id)}>
                Wirklich löschen
              </Button>
            ) : (
              <Button variant="ghost" className="mr-auto" icon={<Trash2 size={16} />} onClick={() => setLoeschFrage(true)}>
                Löschen
              </Button>
            ))}
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            disabled={bezeichnungPflicht}
            onClick={() =>
              onSave({
                ...q,
                bezeichnung: q.bezeichnung?.trim() || undefined,
                nummer: q.nummer?.trim() || undefined,
              })
            }
          >
            Speichern
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Select className="sm:col-span-2" label="Typ" value={q.typ} onChange={(e) => setQ({ ...q, typ: e.target.value as QualifikationTyp })} options={TYP_OPTIONEN} />
        <TextInput
          label={q.typ === 'SONSTIGE' ? 'Bezeichnung *' : 'Bezeichnung'}
          value={q.bezeichnung ?? ''}
          onChange={(e) => setQ({ ...q, bezeichnung: e.target.value })}
          placeholder={q.typ === 'SONSTIGE' ? 'z. B. Erste Hilfe 16 h' : 'optional, z. B. Modul 2'}
        />
        <TextInput label="Nummer" value={q.nummer ?? ''} onChange={(e) => setQ({ ...q, nummer: e.target.value })} placeholder="Zertifikats-/Registrierungsnr." />
        <TextInput label="Erworben am" type="date" value={toDateInput(q.erworbenAm)} onChange={(e) => setQ({ ...q, erworbenAm: fromDateInput(e.target.value) })} />
        <TextInput label="Gültig bis" type="date" value={toDateInput(q.gueltigBis)} onChange={(e) => setQ({ ...q, gueltigBis: fromDateInput(e.target.value) })} hint="leer = unbefristet" />
        <div className="sm:col-span-2">
          <AnhangFeld wert={q.nachweis} onChange={(a) => setQ({ ...q, nachweis: a })} />
        </div>
      </div>
    </Modal>
  )
}
