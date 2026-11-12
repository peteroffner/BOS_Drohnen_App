import { Map as MapIcon } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import type { Einsatz } from '../../../db/types'
import { Card } from '../../../components/ui'

// Leaflet erst laden, wenn die Karte gebraucht wird
const EinsatzKarte = lazy(() => import('../../karte/EinsatzKarte').then((m) => ({ default: m.EinsatzKarte })))

/** Startpunkt mit Schutzradien (Modul C), nur wenn eine Position gesetzt ist */
export function KarteCard({ einsatz }: { einsatz: Einsatz }) {
  if (!einsatz.position) return null
  return (
    <Card
      title="Karte Startpunkt"
      actions={
        <Link to={`/karte?einsatz=${einsatz.id}`} className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-rot-700">
          <MapIcon size={16} /> Karte öffnen
        </Link>
      }
    >
      <Suspense fallback={<div className="h-[260px] rounded-lg bg-flaeche" />}>
        <EinsatzKarte position={einsatz.position} flughoeheM={einsatz.geplanteFlughoeheM} hoehe={260} mitFlugplatz />
      </Suspense>
    </Card>
  )
}
