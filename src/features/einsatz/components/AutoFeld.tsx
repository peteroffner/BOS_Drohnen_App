/** Eingabefeld mit Autosave (siehe useAutoSave) */
import { useId } from 'react'
import type { ReactNode } from 'react'
import { useAutoSave } from './useAutoSave'

interface Props {
  label?: ReactNode
  hint?: ReactNode
  wert: string
  speichern: (v: string) => void
  disabled?: boolean
  placeholder?: string
  mehrzeilig?: boolean
  type?: 'text' | 'number'
  einheit?: string
  className?: string
  inputMode?: 'decimal' | 'numeric' | 'text'
  ariaLabel?: string
}

export function AutoFeld({ label, hint, wert, speichern, disabled, placeholder, mehrzeilig, type = 'text', einheit, className, inputMode, ariaLabel }: Props) {
  const id = useId()
  const a = useAutoSave(wert, speichern)
  const common = {
    id,
    className: 'input',
    value: a.value,
    disabled,
    placeholder,
    'aria-label': label ? undefined : ariaLabel,
    onFocus: a.onFocus,
    onBlur: a.onBlur,
  }
  return (
    <div className={className}>
      {label && (
        <label htmlFor={id} className="label">
          {label}
        </label>
      )}
      <div className="flex items-center gap-2">
        {mehrzeilig ? (
          <textarea rows={3} {...common} onChange={(e) => a.onChange(e.target.value)} />
        ) : (
          <input type={type} inputMode={inputMode ?? (type === 'number' ? 'decimal' : undefined)} {...common} onChange={(e) => a.onChange(e.target.value)} />
        )}
        {einheit && <span className="shrink-0 text-sm font-semibold text-gray-600">{einheit}</span>}
      </div>
      {hint && <p className="mt-1 text-xs text-gray-600">{hint}</p>}
    </div>
  )
}
