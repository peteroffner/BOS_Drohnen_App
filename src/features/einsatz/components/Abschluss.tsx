import { Lock, NotebookPen } from 'lucide-react'
import { useState } from 'react'
import type { Einsatz } from '../../../db/types'
import { Badge, Button, Card, Checkbox, Segmented, TextArea, TextInput } from '../../../components/ui'
import { jetzt } from '../../../db/db'
import { fmtDatumZeit, fromDateInput, toDateInput } from '../../../lib/format'
import { abschlussHindernisse, rolleName } from '../logic/einsatz'
import { aendereEinsatz } from '../data'
import { AutoFeld } from './AutoFeld'
import { UnterschriftFeld } from './Unterschrift'

const speichere = (id: string, patch: Partial<Einsatz>) => aendereEinsatz(id, (e) => Object.assign(e, patch))

/** Schritt 8: Anmerkungen, Unfall, Unterschrift, Abschließen */
export function AbschlussSchritt({ einsatz }: { einsatz: Einsatz }) {
  const gesperrt = einsatz.status === 'abgeschlossen'
  const [ohneFlug, setOhneFlug] = useState(false)
  const [bestaetigen, setBestaetigen] = useState(false)
  const hindernisse = abschlussHindernisse(einsatz, ohneFlug)
  const unterschriftName = einsatz.unterschrift?.name ?? rolleName(einsatz.rollen.pilot)

  return (
    <div className="flex flex-col gap-4">
      <Card title="Anmerkungen / Vorfälle">
        <div className="flex flex-col gap-4">
          <AutoFeld
            label="Anmerkungen / Vorfälle (mit Bezug lfd. Nr.)"
            mehrzeilig
            wert={einsatz.anmerkungen ?? ''}
            speichern={(v) => void speichere(einsatz.id, { anmerkungen: v || undefined })}
            disabled={gesperrt}
          />
          <AutoFeld
            label="Kurzbeschreibung für das Flugbuch"
            hint="Erscheint im Flugbuch in der Spalte „Beschreibung“ (sonst Grund des Fluges)"
            wert={einsatz.beschreibung ?? ''}
            speichern={(v) => void speichere(einsatz.id, { beschreibung: v || undefined })}
            disabled={gesperrt}
          />
          <Segmented
            label="Unfall"
            value={einsatz.unfall ? 'ja' : 'nein'}
            options={[
              { value: 'nein', label: 'nein' },
              { value: 'ja', label: 'ja' },
            ]}
            onChange={(v) => void speichere(einsatz.id, { unfall: v === 'ja' })}
            disabled={gesperrt}
          />
          {einsatz.unfall && (
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput
                label="Datum der Meldung"
                type="date"
                value={toDateInput(einsatz.unfallMeldungDatum)}
                onChange={(e) => void speichere(einsatz.id, { unfallMeldungDatum: fromDateInput(e.target.value) })}
                disabled={gesperrt}
              />
              <AutoFeld
                label="Meldung an"
                wert={einsatz.unfallMeldungAn ?? ''}
                speichern={(v) => void speichere(einsatz.id, { unfallMeldungAn: v || undefined })}
                disabled={gesperrt}
                placeholder="z. B. Austro Control, Versicherung"
              />
            </div>
          )}
        </div>
      </Card>

      <Card title="Unterschrift Pilot">
        <div className="flex flex-col gap-3">
          <AutoFeld
            label="Name"
            wert={unterschriftName}
            disabled={gesperrt}
            speichern={(name) =>
              void aendereEinsatz(einsatz.id, (e) => {
                if (e.unterschrift) e.unterschrift.name = name
                else e.unterschrift = { name, dataUrl: '', zeit: jetzt() }
              })
            }
          />
          {gesperrt ? (
            einsatz.unterschrift?.dataUrl && (
              <img src={einsatz.unterschrift.dataUrl} alt="Unterschrift Pilot" className="h-40 w-full rounded-md border border-linie bg-white object-contain" />
            )
          ) : (
            <UnterschriftFeld
              wert={einsatz.unterschrift?.dataUrl || undefined}
              onChange={(dataUrl) =>
                void aendereEinsatz(einsatz.id, (e) => {
                  e.unterschrift = { name: e.unterschrift?.name || unterschriftName, dataUrl: dataUrl ?? '', zeit: jetzt() }
                })
              }
            />
          )}
          {einsatz.unterschrift?.dataUrl && <p className="text-xs text-gray-600">Unterschrieben am {fmtDatumZeit(einsatz.unterschrift.zeit)}</p>}
        </div>
      </Card>

      {gesperrt ? (
        <Card>
          <p className="flex items-center gap-2 font-semibold text-ok">
            <Lock size={18} /> Einsatz abgeschlossen am {fmtDatumZeit(einsatz.abgeschlossenAm)} – schreibgeschützt.
          </p>
        </Card>
      ) : (
        <Card title="Einsatz abschließen">
          {einsatz.fluege.length === 0 && (
            <Checkbox checked={ohneFlug} onChange={setOhneFlug} label="Einsatz ohne Flug abschließen" hint="z. B. Flug abgebrochen, Wetter, Auftrag storniert" />
          )}
          {hindernisse.length > 0 && (
            <ul className="mb-3 list-disc pl-5 text-sm text-fehler">
              {hindernisse.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          )}
          <p className="mb-3 text-sm text-gray-600">Nach dem Abschluss sind keine Änderungen mehr möglich – nur noch protokollierte Nachträge.</p>
          {bestaetigen ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="lg"
                icon={<Lock size={20} />}
                disabled={hindernisse.length > 0}
                onClick={async () => {
                  await aendereEinsatz(einsatz.id, (e) => {
                    if (abschlussHindernisse(e, ohneFlug).length) return
                    e.status = 'abgeschlossen'
                    e.abgeschlossenAm = jetzt()
                  })
                  setBestaetigen(false)
                }}
              >
                Ja, endgültig abschließen
              </Button>
              <Button size="lg" variant="secondary" onClick={() => setBestaetigen(false)}>
                Abbrechen
              </Button>
            </div>
          ) : (
            <Button size="lg" icon={<Lock size={20} />} disabled={hindernisse.length > 0} onClick={() => setBestaetigen(true)}>
              Einsatz abschließen
            </Button>
          )}
        </Card>
      )}

      {gesperrt && <Nachtraege einsatz={einsatz} />}
    </div>
  )
}

export function Nachtraege({ einsatz }: { einsatz: Einsatz }) {
  const [autor, setAutor] = useState('')
  const [text, setText] = useState('')
  const [offen, setOffen] = useState(false)
  const liste = einsatz.nachtraege ?? []
  return (
    <Card title="Nachträge" actions={<Badge>{liste.length}</Badge>}>
      {liste.length > 0 && (
        <ol className="mb-4 flex flex-col divide-y divide-linie">
          {liste.map((n, i) => (
            <li key={i} className="py-2">
              <div className="text-xs text-gray-600">
                {fmtDatumZeit(n.zeit)} · {n.autor}
              </div>
              <div className="whitespace-pre-wrap break-words">{n.text}</div>
            </li>
          ))}
        </ol>
      )}
      {offen ? (
        <div className="flex flex-col gap-3">
          <TextInput label="Autor" value={autor} onChange={(e) => setAutor(e.target.value)} />
          <TextArea label="Nachtrag" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex gap-2">
            <Button
              disabled={!autor.trim() || !text.trim()}
              onClick={async () => {
                await aendereEinsatz(
                  einsatz.id,
                  (e) => {
                    e.nachtraege = [...(e.nachtraege ?? []), { zeit: jetzt(), autor: autor.trim(), text: text.trim() }]
                  },
                  true,
                )
                setText('')
                setOffen(false)
              }}
            >
              Nachtrag speichern
            </Button>
            <Button variant="secondary" onClick={() => setOffen(false)}>
              Abbrechen
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" icon={<NotebookPen size={18} />} onClick={() => setOffen(true)}>
          Nachtrag hinzufügen
        </Button>
      )}
    </Card>
  )
}
