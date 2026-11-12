import { MessageSquarePlus, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Einsatz, Ereignis } from '../../../db/types'
import { Badge, Button, Card, Segmented, TextInput } from '../../../components/ui'
import { jetzt, neueId } from '../../../db/db'
import { fmtDatumZeit, fmtZeit } from '../../../lib/format'
import { aendereEinsatz } from '../data'
import { EREIGNIS_TYP_LABEL, sortierteEreignisse } from '../logic/einsatz'

const EL_VORLAGE = 'Informationsweitergabe an EL über '

/** Ereignis-Log mit Zeitstempel */
export function EreignisLog({ einsatz, gesperrt }: { einsatz: Einsatz; gesperrt: boolean }) {
  const [text, setText] = useState('')
  const [typ, setTyp] = useState<'info' | 'meldung'>('info')
  const [bezug, setBezug] = useState('')
  const liste = sortierteEreignisse(einsatz)

  const hinzufuegen = async () => {
    if (!text.trim()) return
    const ev: Ereignis = { id: neueId(), zeit: jetzt(), text: text.trim(), typ, bezug: bezug.trim() || undefined }
    await aendereEinsatz(einsatz.id, (e) => {
      e.ereignisse.push(ev)
    })
    setText('')
    setBezug('')
  }

  return (
    <Card
      title="Ereignis-Log"
      actions={
        !gesperrt && (
          <Link
            to={`/notfall?einsatz=${einsatz.id}`}
            className="inline-flex min-h-9 items-center gap-1 rounded-md bg-rot-700 px-3 text-sm font-bold text-white hover:bg-rot-800"
          >
            <TriangleAlert size={16} /> Notfall
          </Link>
        )
      }
    >
      {liste.length === 0 ? (
        <p className="text-sm text-gray-600">Noch keine Einträge.</p>
      ) : (
        <ol className="mb-4 flex flex-col divide-y divide-linie">
          {liste.map((ev) => (
            <li key={ev.id} className="flex gap-3 py-2">
              <span className="w-12 shrink-0 font-bold tabular-nums" title={fmtDatumZeit(ev.zeit)}>
                {fmtZeit(ev.zeit)}
              </span>
              <div className="min-w-0 flex-1 break-words">
                <span className="mr-2 inline-flex flex-wrap gap-1 align-middle">
                  <Badge color={ev.typ === 'notfall' ? 'rot' : ev.typ === 'meldung' ? 'gelb' : 'grau'}>{EREIGNIS_TYP_LABEL[ev.typ]}</Badge>
                  {ev.bezug && <Badge>Bezug {ev.bezug}</Badge>}
                </span>
                {ev.text}
              </div>
            </li>
          ))}
        </ol>
      )}

      {!gesperrt && (
        <form
          className="flex flex-col gap-3 border-t border-linie pt-3"
          onSubmit={(e) => {
            e.preventDefault()
            void hinzufuegen()
          }}
        >
          <TextInput label="Neuer Eintrag" value={text} onChange={(e) => setText(e.target.value)} placeholder="Was ist passiert?" />
          <div className="flex flex-wrap items-end gap-3">
            <Segmented
              value={typ}
              onChange={setTyp}
              options={[
                { value: 'info', label: 'Info' },
                { value: 'meldung', label: 'Meldung' },
              ]}
            />
            <TextInput className="w-32" label="Bezug lfd. Nr." value={bezug} onChange={(e) => setBezug(e.target.value)} placeholder="z. B. 17" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit" icon={<MessageSquarePlus size={18} />} disabled={!text.trim()}>
              Eintragen
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setTyp('meldung')
                setText((t) => (t.startsWith(EL_VORLAGE) ? t : EL_VORLAGE + t))
              }}
            >
              Informationsweitergabe an EL über …
            </Button>
          </div>
        </form>
      )}
    </Card>
  )
}
