import { BatteryFull, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { db, neueId } from '../../db/db'
import type { Akku, Einsatz, Geraet } from '../../db/types'
import { Badge, Button, Card, Checkbox, EmptyState, Modal, Segmented, TextInput } from '../../components/ui'
import { geraetStatistik } from '../../lib/stats'
import { useDarf } from '../auth/kontext'
import { AKKU_ART_LABEL, AKKU_STATUS_LABEL, akkuVerwendet } from './logic'

const STATUS_FARBE: Record<Akku['status'], 'gruen' | 'gelb' | 'grau'> = { ok: 'gruen', beobachten: 'gelb', ausgemustert: 'grau' }

export function GeraetAkkus({ geraet, einsaetze }: { geraet: Geraet; einsaetze: Einsatz[] }) {
  const [bearbeiten, setBearbeiten] = useState<Akku | null>(null)
  const [ausgemusterte, setAusgemusterte] = useState(false)
  const zyklen = geraetStatistik(geraet, einsaetze).akkuZyklen
  const anzahlAus = geraet.akkus.filter((a) => a.status === 'ausgemustert').length
  const liste = geraet.akkus
    .filter((a) => ausgemusterte || a.status !== 'ausgemustert')
    .sort((a, b) => (a.art === b.art ? a.nummer.localeCompare(b.nummer, 'de-AT', { numeric: true }) : a.art === 'drohne' ? -1 : 1))

  const speichern = async (a: Akku) => {
    await db.geraete.update(geraet.id, { akkus: [...geraet.akkus.filter((x) => x.id !== a.id), a] })
    setBearbeiten(null)
  }
  const loeschen = async (id: string) => {
    await db.geraete.update(geraet.id, { akkus: geraet.akkus.filter((x) => x.id !== id) })
    setBearbeiten(null)
  }
  const darfVerwalten = useDarf('geraet.verwalten')
  const naechsteNr = String(geraet.akkus.filter((a) => a.art === 'drohne').length + 1)

  return (
    <Card
      title="Akkus"
      actions={
        darfVerwalten && (
          <Button size="sm" icon={<Plus size={16} />} onClick={() => setBearbeiten({ id: neueId(), nummer: naechsteNr, art: 'drohne', status: 'ok' })}>
            Akku hinzufügen
          </Button>
        )
      }
    >
      <p className="mb-2 text-sm text-gray-600">Zyklen werden automatisch aus den Flügen gezählt (1 Flug = 1 Zyklus) und zu den vorerfassten Zyklen addiert.</p>
      {anzahlAus > 0 && <Checkbox label={`ausgemusterte anzeigen (${anzahlAus})`} checked={ausgemusterte} onChange={setAusgemusterte} />}
      {liste.length === 0 ? (
        <EmptyState icon={<BatteryFull size={36} />} title="Keine Akkus erfasst" text="Akkus der Drohne und der Fernbedienung erfassen – sie erscheinen dann auch im Wartungsbuch." />
      ) : (
        <ul className="divide-y divide-linie">
          {liste.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="flex h-11 w-14 shrink-0 items-center justify-center rounded-md bg-flaeche text-lg font-bold">{a.nummer}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Akku Nr. {a.nummer}</span>
                  <span className="text-sm text-gray-600">{AKKU_ART_LABEL[a.art]}</span>
                  <Badge color={STATUS_FARBE[a.status]}>{AKKU_STATUS_LABEL[a.status]}</Badge>
                </div>
                <div className="text-sm text-gray-600">
                  <b className="tabular-nums text-anthrazit">{zyklen[a.id] ?? 0}</b> Zyklen
                  {a.vorerfassteZyklen ? ` (davon ${a.vorerfassteZyklen} vorerfasst)` : ''}
                  {a.bemerkung ? ` · ${a.bemerkung}` : ''}
                </div>
              </div>
              {darfVerwalten && (
                <Button variant="secondary" size="sm" icon={<Pencil size={16} />} onClick={() => setBearbeiten(a)} aria-label={`Akku ${a.nummer} bearbeiten`}>
                  Bearbeiten
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {bearbeiten && (
        <AkkuModal
          key={bearbeiten.id}
          akku={bearbeiten}
          neu={!geraet.akkus.some((x) => x.id === bearbeiten.id)}
          verwendet={akkuVerwendet(bearbeiten.id, einsaetze)}
          onClose={() => setBearbeiten(null)}
          onSave={speichern}
          onDelete={loeschen}
        />
      )}
    </Card>
  )
}

function AkkuModal({
  akku,
  neu,
  verwendet,
  onClose,
  onSave,
  onDelete,
}: {
  akku: Akku
  neu: boolean
  verwendet: boolean
  onClose: () => void
  onSave: (a: Akku) => void
  onDelete: (id: string) => void
}) {
  const [a, setA] = useState(akku)
  const [vor, setVor] = useState(String(akku.vorerfassteZyklen ?? 0))
  const [frage, setFrage] = useState(false)
  return (
    <Modal
      open
      onClose={onClose}
      title={neu ? 'Akku hinzufügen' : `Akku Nr. ${akku.nummer} bearbeiten`}
      footer={
        <>
          {!neu &&
            !verwendet &&
            (frage ? (
              <Button variant="danger" className="mr-auto" onClick={() => onDelete(a.id)}>
                Wirklich löschen
              </Button>
            ) : (
              <Button variant="ghost" className="mr-auto" icon={<Trash2 size={16} />} onClick={() => setFrage(true)}>
                Löschen
              </Button>
            ))}
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            disabled={!a.nummer.trim()}
            onClick={() => onSave({ ...a, nummer: a.nummer.trim(), bemerkung: a.bemerkung?.trim() || undefined, vorerfassteZyklen: Math.max(0, parseInt(vor, 10) || 0) || undefined })}
          >
            Speichern
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextInput label="Nummer *" value={a.nummer} onChange={(e) => setA({ ...a, nummer: e.target.value })} placeholder="z. B. 1, 2, FB-1" />
          <TextInput label="Vorerfasste Zyklen" type="number" min={0} inputMode="numeric" value={vor} onChange={(e) => setVor(e.target.value)} hint="Ladezyklen vor Einführung der App" />
        </div>
        <Segmented label="Art" value={a.art} onChange={(v) => setA({ ...a, art: v })} options={[{ value: 'drohne', label: 'Drohne' }, { value: 'fernbedienung', label: 'Fernbedienung' }]} />
        <Segmented
          label="Status"
          value={a.status}
          onChange={(v) => setA({ ...a, status: v })}
          options={[
            { value: 'ok', label: 'ok' },
            { value: 'beobachten', label: 'beobachten' },
            { value: 'ausgemustert', label: 'ausgemustert' },
          ]}
        />
        <TextInput label="Bemerkung" value={a.bemerkung ?? ''} onChange={(e) => setA({ ...a, bemerkung: e.target.value })} placeholder="z. B. Zelle 3 schwächer" />
        {!neu && verwendet && <p className="text-sm text-gray-600">Dieser Akku wurde in Flügen verwendet und kann nicht gelöscht, nur ausgemustert werden.</p>}
      </div>
    </Modal>
  )
}
