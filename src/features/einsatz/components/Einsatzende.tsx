import { LogOut } from 'lucide-react'
import type { Einsatz } from '../../../db/types'
import { Button, Card } from '../../../components/ui'
import { jetzt } from '../../../db/db'
import { fromLocalInput, toLocalInput } from '../../../lib/format'
import { EINSATZENDE_ZEILEN, laufenderFlug } from '../logic/einsatz'
import { aendereEinsatz } from '../data'

/** Schritt 6: Abmeldungen beim Einsatzende */
export function EinsatzendeSchritt({ einsatz, gesperrt }: { einsatz: Einsatz; gesperrt: boolean }) {
  const laeuft = !!laufenderFlug(einsatz)
  const setze = (key: keyof Einsatz['einsatzende'], wert: string | undefined) =>
    aendereEinsatz(einsatz.id, (e) => {
      e.einsatzende = { ...e.einsatzende, [key]: wert }
      if (wert && !laufenderFlug(e) && (e.status === 'vorbereitung' || e.status === 'laufend')) e.status = 'nachbereitung'
    })

  return (
    <Card title="Einsatzende – Abmeldung">
      {laeuft && !gesperrt && (
        <p role="alert" className="mb-3 rounded-md bg-fehler-bg p-3 font-semibold text-fehler">
          Es läuft noch ein Flug. Bitte zuerst landen (Schritt 5).
        </p>
      )}
      <div className="flex flex-col divide-y divide-linie">
        {EINSATZENDE_ZEILEN.map((z) => (
          <div key={z.key} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
            <span className="font-semibold sm:w-72">{z.label}</span>
            <div className="flex flex-1 flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                aria-label={`${z.label} – Zeit`}
                className="input max-w-xs"
                value={toLocalInput(einsatz.einsatzende[z.key])}
                disabled={gesperrt}
                onChange={(e) => void setze(z.key, fromLocalInput(e.target.value))}
              />
              {!gesperrt && (
                <Button variant={einsatz.einsatzende[z.key] ? 'secondary' : 'primary'} icon={<LogOut size={18} />} onClick={() => void setze(z.key, jetzt())}>
                  Jetzt abmelden
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>
      {!gesperrt && einsatz.status !== 'nachbereitung' && !laeuft && (
        <div className="mt-3">
          <Button
            variant="secondary"
            onClick={() =>
              void aendereEinsatz(einsatz.id, (e) => {
                if (!laufenderFlug(e)) e.status = 'nachbereitung'
              })
            }
          >
            Flugbetrieb beenden → Nachbereitung
          </Button>
        </div>
      )}
    </Card>
  )
}
