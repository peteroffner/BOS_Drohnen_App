import { useLayoutEffect, useRef, useState } from 'react'
import { cx } from '../../components/ui'
import { formatStunden } from '../../lib/calc'
import { achse, MONATE_KURZ, MONATE_LANG, type MonatsWert } from './auswertung'

const fmtH = (min: number) => (min / 60).toLocaleString('de-AT', { maximumFractionDigits: 1 })

/** Gestapeltes Säulendiagramm Flugstunden je Monat (Einsatz / Training+Checkflug), eigenes SVG. */
export function MonatsChart({ werte }: { werte: MonatsWert[] }) {
  const ref = useRef<HTMLDivElement>(null)
  const [breite, setBreite] = useState(0)
  const [aktiv, setAktiv] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const messen = () => setBreite(Math.max(240, Math.floor(el.getBoundingClientRect().width)))
    messen()
    const ro = new ResizeObserver(messen)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const H = 220
  const rand = { l: 34, r: 8, t: 18, b: 26 }
  const innenB = breite - rand.l - rand.r
  const innenH = H - rand.t - rand.b
  const maxMin = Math.max(0, ...werte.map((w) => w.minutenEinsatz + w.minutenTraining))
  const ax = achse(maxMin / 60)
  const y = (stunden: number) => rand.t + innenH - (stunden / ax.max) * innenH
  const slot = innenB / Math.max(1, werte.length)
  const balken = Math.max(4, Math.min(36, slot * 0.62))
  const zeigeWerte = slot >= 24
  const jedesWievielte = slot < 22 ? Math.ceil(22 / slot) : 1
  const mehrereJahre = werte.length > 0 && werte[0].jahr !== werte[werte.length - 1].jahr
  const ticks: number[] = []
  for (let v = 0; v <= ax.max + 1e-9; v += ax.schritt) ticks.push(Math.round(v * 100) / 100)

  const a = aktiv != null ? werte[aktiv] : undefined

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-rot-700" aria-hidden /> Einsatz
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-anthrazit" aria-hidden /> Training / Checkflug
        </span>
        <span className="ml-auto min-h-5 text-xs text-gray-600" aria-live="polite">
          {a
            ? `${MONATE_LANG[a.monat - 1]} ${a.jahr}: ${formatStunden(a.minutenEinsatz + a.minutenTraining)} (Einsatz ${formatStunden(a.minutenEinsatz)}, Training ${formatStunden(a.minutenTraining)}), ${a.fluege} Flüge`
            : 'Säule antippen für Details'}
        </span>
      </div>
      <div ref={ref} className="w-full min-h-[220px]">
        {breite > 0 && <svg width={breite} height={H} role="img" aria-label="Flugstunden je Monat, gestapelt nach Einsatz und Training" className="block select-none">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={rand.l} x2={breite - rand.r} y1={y(t)} y2={y(t)} className={t === 0 ? 'stroke-anthrazit' : 'stroke-linie'} strokeWidth={1} />
              <text x={rand.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-gray-500 text-[11px] tabular-nums">
                {t.toLocaleString('de-AT')}
              </text>
            </g>
          ))}
          <text x={4} y={10} className="fill-gray-500 text-[10px]">
            h
          </text>
          {werte.map((w, i) => {
            const x = rand.l + i * slot + (slot - balken) / 2
            const hE = w.minutenEinsatz / 60
            const hT = w.minutenTraining / 60
            const yE = y(hE)
            const yT = y(hE + hT)
            const gesamt = w.minutenEinsatz + w.minutenTraining
            const lueckeT = hE > 0 && hT > 0 ? 2 : 0
            return (
              <g
                key={w.schluessel}
                onPointerEnter={() => setAktiv(i)}
                onPointerLeave={() => setAktiv(null)}
                onClick={() => setAktiv(i)}
                className="cursor-pointer"
              >
                <title>{`${MONATE_LANG[w.monat - 1]} ${w.jahr}: ${formatStunden(gesamt)} (Einsatz ${formatStunden(w.minutenEinsatz)}, Training ${formatStunden(w.minutenTraining)})`}</title>
                <rect x={rand.l + i * slot} y={rand.t} width={slot} height={innenH} className={aktiv === i ? 'fill-flaeche' : 'fill-transparent'} />
                {hE > 0 && <rect x={x} y={yE} width={balken} height={Math.max(1, y(0) - yE)} rx={hT > 0 ? 0 : 3} className="fill-rot-700" />}
                {hT > 0 && <rect x={x} y={yT} width={balken} height={Math.max(1, yE - yT - lueckeT)} rx={3} className="fill-anthrazit" />}
                {zeigeWerte && gesamt > 0 && (
                  <text x={x + balken / 2} y={yT - 4} textAnchor="middle" className="fill-dunkel text-[10px] font-semibold tabular-nums">
                    {fmtH(gesamt)}
                  </text>
                )}
                {i % jedesWievielte === 0 && (
                  <text x={rand.l + i * slot + slot / 2} y={H - rand.b + 14} textAnchor="middle" className={cx('text-[11px]', aktiv === i ? 'fill-dunkel font-semibold' : 'fill-gray-600')}>
                    {MONATE_KURZ[w.monat - 1]}
                    {mehrereJahre && (w.monat === 1 || i === 0) ? ` ${String(w.jahr).slice(2)}` : ''}
                  </text>
                )}
              </g>
            )
          })}
        </svg>}
      </div>
      <details className="mt-2 text-sm">
        <summary className="min-h-11 cursor-pointer py-2 font-semibold text-rot-700">Werte als Tabelle</summary>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-linie text-left">
                <th className="py-1 pr-2">Monat</th>
                <th className="py-1 pr-2 text-right">Flüge</th>
                <th className="py-1 pr-2 text-right">Einsatz</th>
                <th className="py-1 pr-2 text-right">Training</th>
                <th className="py-1 text-right">Gesamt</th>
              </tr>
            </thead>
            <tbody>
              {werte.map((w) => (
                <tr key={w.schluessel} className="border-b border-linie tabular-nums">
                  <td className="py-1 pr-2">
                    {MONATE_LANG[w.monat - 1]} {w.jahr}
                  </td>
                  <td className="py-1 pr-2 text-right">{w.fluege}</td>
                  <td className="py-1 pr-2 text-right">{formatStunden(w.minutenEinsatz)}</td>
                  <td className="py-1 pr-2 text-right">{formatStunden(w.minutenTraining)}</td>
                  <td className="py-1 text-right font-semibold">{formatStunden(w.minutenEinsatz + w.minutenTraining)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}
