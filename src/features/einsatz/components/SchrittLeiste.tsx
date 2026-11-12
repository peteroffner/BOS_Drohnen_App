import { Check } from 'lucide-react'
import { cx } from '../../../components/ui'
import type { Schritt } from '../logic/schritte'

export function SchrittLeiste({ liste, aktiv, onWahl }: { liste: Schritt[]; aktiv: number; onWahl: (nr: number) => void }) {
  return (
    <nav aria-label="Schritte" className="grid grid-cols-8 gap-1">
      {liste.map((s) => {
        const ist = s.nr === aktiv
        return (
          <button
            key={s.nr}
            type="button"
            aria-current={ist ? 'step' : undefined}
            title={s.titel}
            onClick={() => onWahl(s.nr)}
            className={cx(
              'flex min-h-14 min-w-0 flex-col items-center justify-center gap-0.5 rounded-md border px-0.5 text-center transition-colors',
              ist ? 'border-rot-700 bg-rot-700 text-white' : s.erledigt ? 'border-ok bg-ok-bg text-ok' : 'border-linie bg-white text-anthrazit hover:bg-flaeche',
            )}
          >
            <span className="flex items-center gap-0.5 text-base font-bold leading-none">
              {s.erledigt && !ist ? <Check size={16} strokeWidth={3} /> : s.nr}
            </span>
            <span className="hidden w-full truncate text-[11px] font-semibold sm:block lg:hidden">{s.kurz}</span>
            <span className="hidden w-full truncate text-xs font-semibold lg:block">{s.titel}</span>
          </button>
        )
      })}
    </nav>
  )
}
