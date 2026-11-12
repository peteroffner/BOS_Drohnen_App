import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import type { Pilot, Rolle } from '../../../db/types'
import { pilotName } from '../../../lib/format'

const FREI = '__frei'

/** Auswahl einer Rolle: aktiver Pilot aus der Verwaltung oder Freitext (Externe). */
export function RolleAuswahl({
  label,
  rolle,
  piloten,
  onChange,
  disabled,
  extra,
}: {
  label: ReactNode
  rolle?: Rolle
  piloten: Pilot[]
  onChange: (r: Rolle | undefined) => void
  disabled?: boolean
  extra?: ReactNode
}) {
  const id = useId()
  const [freitext, setFreitext] = useState(!!rolle && !rolle.pilotId)
  const aktive = piloten.filter((p) => p.aktiv || p.id === rolle?.pilotId)
  const auswahl = rolle?.pilotId ?? (freitext ? FREI : '')
  return (
    <div>
      <label htmlFor={id} className="label">
        {label}
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          id={id}
          className="input sm:w-1/2"
          value={auswahl}
          disabled={disabled}
          onChange={(e) => {
            const v = e.target.value
            if (v === FREI) {
              setFreitext(true)
              onChange(rolle?.name ? { name: rolle.name } : undefined)
            } else if (!v) {
              setFreitext(false)
              onChange(undefined)
            } else {
              setFreitext(false)
              const p = aktive.find((x) => x.id === v)
              onChange(p ? { pilotId: p.id, name: pilotName(p) } : undefined)
            }
          }}
        >
          <option value="">– nicht besetzt –</option>
          {aktive.map((p) => (
            <option key={p.id} value={p.id}>
              {pilotName(p)}
            </option>
          ))}
          <option value={FREI}>Freitext (extern) …</option>
        </select>
        {auswahl === FREI && (
          <input
            className="input sm:w-1/2"
            aria-label={`${typeof label === 'string' ? label : 'Rolle'} – Name`}
            placeholder="Name, Dienstgrad, Organisation"
            value={rolle?.name ?? ''}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value ? { name: e.target.value } : undefined)}
          />
        )}
      </div>
      {extra}
    </div>
  )
}
