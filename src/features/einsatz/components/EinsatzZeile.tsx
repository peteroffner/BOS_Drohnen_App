import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Einsatz } from '../../../db/types'
import { Badge } from '../../../components/ui'
import { formatStunden, dauerMinuten } from '../../../lib/calc'
import { fmtDatumZeit } from '../../../lib/format'
import { ART_LABEL, laufenderFlug, rolleName, STATUS_FARBE, STATUS_LABEL } from '../logic/einsatz'

/** Listeneintrag eines Einsatzes (Start, Einsatzliste) */
export function EinsatzZeile({ e }: { e: Einsatz }) {
  const minuten = e.fluege.reduce((s, f) => s + dauerMinuten(f.start, f.landung), 0)
  const laeuft = !!laufenderFlug(e)
  return (
    <li>
      <Link to={`/einsaetze/${e.id}`} className="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-flaeche">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="break-words font-bold text-dunkel">{e.fluggebiet || e.grund || 'Ohne Bezeichnung'}</span>
            <Badge color={STATUS_FARBE[e.status]}>{laeuft ? 'Flug läuft' : STATUS_LABEL[e.status]}</Badge>
          </div>
          <div className="mt-0.5 text-sm text-gray-600">
            {fmtDatumZeit(e.datum)} · {ART_LABEL[e.art]}
            {e.gemeinde && ` · ${e.gemeinde}`}
            {rolleName(e.rollen.pilot) && ` · ${rolleName(e.rollen.pilot)}`}
          </div>
          <div className="text-sm text-gray-600">
            {e.fluege.length} {e.fluege.length === 1 ? 'Flug' : 'Flüge'}
            {minuten > 0 && ` · ${formatStunden(minuten)}`}
            {e.grund && e.fluggebiet && ` · ${e.grund}`}
          </div>
        </div>
        <ChevronRight size={20} className="shrink-0 text-gray-400" />
      </Link>
    </li>
  )
}
