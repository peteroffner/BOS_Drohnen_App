import { cx } from '../../components/ui'
import { fmtMeter, type Schutzkreis } from './geo'

export function KartenLegende({ kreise, kompakt }: { kreise: Schutzkreis[]; kompakt?: boolean }) {
  // in der Legende von innen nach außen
  const liste = [...kreise].reverse()
  return (
    <ul className={cx('flex flex-col', kompakt ? 'mt-2 gap-1 text-sm' : 'gap-2')} aria-label="Legende">
      {liste.map((k) => (
        <li key={k.id} className="flex items-start gap-3">
          <span className={cx('mt-0.5 h-5 w-5 shrink-0 rounded-full border-2', k.legendeKlasse)} aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-baseline justify-between gap-x-2">
              <span className="font-semibold">{k.label}</span>
              <span className="font-bold tabular-nums text-dunkel">{fmtMeter(k.radiusM)}</span>
            </span>
            {!kompakt && <span className="block text-xs text-gray-600">{k.beschreibung}</span>}
          </span>
        </li>
      ))}
    </ul>
  )
}
