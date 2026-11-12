import { TriangleAlert } from 'lucide-react'
import { MAX_FLUGHOEHE_M, sicherheitsabstaende } from '../../../lib/calc'

const m = (n: number) => `${n.toLocaleString('de-AT')} m`

/** Live-Berechnung laut Checkliste v9 Seite 1 */
export function Sicherheitsabstaende({ flughoehe }: { flughoehe?: number }) {
  if (flughoehe === undefined || flughoehe <= 0) {
    return <p className="text-sm text-gray-600">Flughöhe eingeben – Sicherheitsabstände werden automatisch berechnet.</p>
  }
  const s = sicherheitsabstaende(flughoehe)
  return (
    <div className="flex flex-col gap-2">
      {s.hoeheUeberschritten && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-rot-200 bg-fehler-bg p-3 font-semibold text-fehler">
          <TriangleAlert size={20} className="mt-0.5 shrink-0" />
          Geplante Flughöhe über {MAX_FLUGHOEHE_M} m – nur mit gesonderter Genehmigung zulässig!
        </div>
      )}
      <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Wert label="Contingency Volume" sub="10 % der Flughöhe" wert={m(s.contingencyVolume)} />
        <Wert label="Ground Risk Buffer" sub="Flughöhe + CV" wert={m(s.groundRiskBuffer)} />
        <Wert label="Abstand Menschenansammlung" sub="GRB + CV + 120 m" wert={m(s.abstandMenschenansammlung)} />
      </dl>
      <p className="text-sm text-gray-700">
        <b>1:1-Regel:</b> horizontaler Mindestabstand zu unbeteiligten Personen = Flughöhe ({m(s.abstandUnbeteiligte)}).
      </p>
    </div>
  )
}

function Wert({ label, sub, wert }: { label: string; sub: string; wert: string }) {
  return (
    <div className="rounded-md border border-linie bg-flaeche p-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">{label}</dt>
      <dd className="text-xl font-bold tabular-nums text-dunkel">{wert}</dd>
      <dd className="text-xs text-gray-600">{sub}</dd>
    </div>
  )
}
