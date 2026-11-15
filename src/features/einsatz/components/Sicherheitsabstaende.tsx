import { TriangleAlert } from 'lucide-react'
import type { OpenUnterkategorie, Rechtsgrundlage } from '../../../db/types'
import { ABSTAND_HINWEIS_OHNE_GEWAEHR, abstandsModus, abstandsRegel, MAX_FLUGHOEHE_M } from '../../../lib/calc'

const m = (n: number) => `${n.toLocaleString('de-AT')} m`

/**
 * Sicherheitsabstände passend zur Rechtsgrundlage:
 * Bescheid / SPECIFIC BOS → Rechnung laut Checkliste v9 Seite 1,
 * OPEN A1/A2/A3 → feste Abstände der Kategorie OPEN.
 */
export function Sicherheitsabstaende({
  flughoehe,
  rechtsgrundlage,
  openUnterkategorie,
}: {
  flughoehe?: number
  rechtsgrundlage?: Rechtsgrundlage
  openUnterkategorie?: OpenUnterkategorie
}) {
  const modus = abstandsModus(rechtsgrundlage, openUnterkategorie)
  const regel = abstandsRegel(modus, flughoehe ?? 0)
  const ohneHoehe = flughoehe === undefined || flughoehe <= 0
  return (
    <div className="flex flex-col gap-2">
      {regel.hoeheUeberschritten && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-rot-200 bg-fehler-bg p-3 font-semibold text-fehler">
          <TriangleAlert size={20} className="mt-0.5 shrink-0" />
          Geplante Flughöhe über {MAX_FLUGHOEHE_M} m – nur mit gesonderter Genehmigung zulässig!
        </div>
      )}
      <p className="text-sm font-semibold text-anthrazit">{regel.titel}</p>
      {ohneHoehe && modus !== 'A1' && modus !== 'open_offen' && (
        <p className="text-sm text-gray-600">Flughöhe eingeben – die Abstände werden automatisch berechnet.</p>
      )}
      {regel.werte.length > 0 && !(ohneHoehe && modus === 'formular') && (
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {regel.werte.map((w) => (
            <div key={w.id} className="rounded-md border border-linie bg-flaeche p-3">
              <dt className="text-xs font-semibold uppercase tracking-wide text-gray-600">{w.label}</dt>
              <dd className="text-xl font-bold tabular-nums text-dunkel">{m(w.meter)}</dd>
              <dd className="text-xs text-gray-600">{w.sub}</dd>
            </div>
          ))}
        </dl>
      )}
      <ul className="list-disc pl-5 text-sm text-gray-700">
        {regel.hinweise.map((h) => (
          <li key={h}>{h}</li>
        ))}
      </ul>
      <p className="text-xs text-gray-600">{ABSTAND_HINWEIS_OHNE_GEWAEHR}</p>
    </div>
  )
}
