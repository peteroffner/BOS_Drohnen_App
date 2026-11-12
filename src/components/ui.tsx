/**
 * Gemeinsame UI-Bausteine. Bitte in allen Feature-Modulen verwenden,
 * damit die App einheitlich aussieht (BFV-Farbschema, große Touch-Ziele).
 */
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { useId } from 'react'
import type { Ampel } from '../lib/stats'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
const VARIANT: Record<Variant, string> = {
  primary: 'bg-rot-700 text-white hover:bg-rot-800 active:bg-rot-900 disabled:bg-gray-300',
  secondary: 'bg-white text-anthrazit border border-linie hover:bg-flaeche disabled:text-gray-400',
  ghost: 'text-rot-700 hover:bg-rot-50 disabled:text-gray-400',
  danger: 'bg-dunkel text-white hover:bg-black disabled:bg-gray-300',
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md' | 'lg'; icon?: ReactNode }) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors disabled:cursor-not-allowed',
        size === 'sm' && 'min-h-9 px-3 text-sm',
        size === 'md' && 'min-h-11 px-4 text-base',
        size === 'lg' && 'min-h-14 px-6 text-lg',
        VARIANT[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  )
}

export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-lg border border-linie bg-white', className)}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-linie px-4 py-3">
          <h2 className="text-base font-bold text-anthrazit">{title}</h2>
          {actions && <div className="flex gap-2">{actions}</div>}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-dunkel">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-gray-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Field({ label, hint, error, children, className }: { label: ReactNode; hint?: ReactNode; error?: ReactNode; children: (id: string) => ReactNode; className?: string }) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="label">
        {label}
      </label>
      {children(id)}
      {hint && !error && <p className="mt-1 text-xs text-gray-600">{hint}</p>}
      {error && <p className="mt-1 text-xs font-semibold text-fehler">{error}</p>}
    </div>
  )
}

export function TextInput({ label, hint, error, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; hint?: ReactNode; error?: ReactNode }) {
  return (
    <Field label={label} hint={hint} error={error} className={className}>
      {(id) => <input id={id} className="input" {...rest} />}
    </Field>
  )
}

export function TextArea({ label, hint, className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { label: ReactNode; hint?: ReactNode }) {
  return (
    <Field label={label} hint={hint} className={className}>
      {(id) => <textarea id={id} rows={3} className="input" {...rest} />}
    </Field>
  )
}

export function Select({
  label,
  hint,
  options,
  placeholder,
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { label: ReactNode; hint?: ReactNode; options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <Field label={label} hint={hint} className={className}>
      {(id) => (
        <select id={id} className="input" {...rest}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Field>
  )
}

/** Großes, gut antippbares Häkchen */
export function Checkbox({ checked, onChange, label, hint, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: ReactNode; hint?: ReactNode; disabled?: boolean }) {
  return (
    <label className={cx('flex min-h-11 cursor-pointer items-start gap-3 rounded-md py-2', disabled && 'cursor-not-allowed opacity-60')}>
      <input
        type="checkbox"
        className="mt-0.5 h-6 w-6 shrink-0 accent-rot-700"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        <span className="text-base">{label}</span>
        {hint && <span className="block text-xs text-gray-600">{hint}</span>}
      </span>
    </label>
  )
}

/** Segmentierte Auswahl (Radio als Buttons) */
export function Segmented<T extends string>({ value, onChange, options, label, disabled }: { value?: T; onChange: (v: T) => void; options: { value: T; label: string }[]; label?: ReactNode; disabled?: boolean }) {
  return (
    <div>
      {label && <span className="label">{label}</span>}
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cx(
              'min-h-11 rounded-md border px-4 text-base font-semibold transition-colors',
              value === o.value ? 'border-rot-700 bg-rot-700 text-white' : 'border-linie bg-white text-anthrazit hover:bg-flaeche',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

const BADGE: Record<string, string> = {
  grau: 'bg-flaeche text-anthrazit border-linie',
  rot: 'bg-fehler-bg text-fehler border-rot-200',
  gelb: 'bg-warn-bg text-warn border-amber-200',
  gruen: 'bg-ok-bg text-ok border-green-200',
}
export function Badge({ color = 'grau', children }: { color?: 'grau' | 'rot' | 'gelb' | 'gruen'; children: ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold', BADGE[color])}>{children}</span>
}

const AMPEL_TEXT: Record<Ampel, string> = { gruen: 'einsatzbereit', gelb: 'eingeschränkt', rot: 'nicht freigegeben' }
export function AmpelBadge({ ampel, title }: { ampel: Ampel; title?: string }) {
  return (
    <span title={title}>
      <Badge color={ampel}>
        <span className={cx('h-2 w-2 rounded-full', ampel === 'gruen' ? 'bg-ok' : ampel === 'gelb' ? 'bg-amber-500' : 'bg-fehler')} />
        {AMPEL_TEXT[ampel]}
      </Badge>
    </span>
  )
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-linie bg-white px-6 py-10 text-center">
      {icon && <div className="text-gray-400">{icon}</div>}
      <p className="font-semibold">{title}</p>
      {text && <p className="max-w-md text-sm text-gray-600">{text}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-lg border border-linie bg-white p-4">
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</div>
      <div className="mt-1 text-2xl font-bold text-dunkel tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-600">{sub}</div>}
    </div>
  )
}

export function Modal({ open, onClose, title, children, footer }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[1000] flex items-end justify-center bg-black/50 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="max-h-[90vh] w-full overflow-auto rounded-t-xl bg-white sm:max-w-2xl sm:rounded-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sticky top-0 flex items-center justify-between border-b border-linie bg-white px-4 py-3">
          <h2 className="text-lg font-bold">{title}</h2>
          <button type="button" aria-label="Schließen" className="min-h-11 min-w-11 text-2xl text-gray-500" onClick={onClose}>
            ×
          </button>
        </header>
        <div className="p-4">{children}</div>
        {footer && <footer className="sticky bottom-0 flex justify-end gap-2 border-t border-linie bg-white px-4 py-3">{footer}</footer>}
      </div>
    </div>
  )
}


/** Hinweis, wenn die Rolle des Benutzers hier nur Lesen erlaubt (Cloud-Modus). */
export function NurAnsichtHinweis({ text = 'Keine Berechtigung – nur Ansicht', className }: { text?: ReactNode; className?: string }) {
  return (
    <p role="note" data-testid="nur-ansicht" className={cx('flex items-center gap-2 rounded-md border border-linie bg-flaeche px-3 py-2 text-sm font-semibold text-gray-700', className)}>
      <svg aria-hidden width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
        <rect x="3" y="11" width="18" height="11" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      {text}
    </p>
  )
}
