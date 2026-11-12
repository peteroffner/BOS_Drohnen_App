import { MapPin } from 'lucide-react'
import { MapContainer } from 'react-leaflet'
import type { Position } from '../../db/types'
import { EmptyState } from '../../components/ui'
import { fmtKoordinaten, fmtMeter, istPosition, schutzkreise } from './geo'
import { GroesseBeobachten, OsmKacheln, SchutzkreiseLayer } from './KartenLayer'
import { KartenLegende } from './KartenLegende'

/**
 * Kompakte Karte für die Einsatz-Detailseite: Startpunkt mit Ground Risk Buffer
 * und Abstand zu Menschenansammlungen. Zum Bearbeiten → /karte?einsatz=<id>.
 */
export function EinsatzKarte({
  position,
  flughoeheM,
  hoehe = 280,
  mitFlugplatz = false,
  legende = true,
}: {
  position?: Position
  flughoeheM?: number
  /** Höhe der Karte in px */
  hoehe?: number
  mitFlugplatz?: boolean
  legende?: boolean
}) {
  if (!istPosition(position)) {
    return <EmptyState icon={<MapPin size={28} />} title="Kein Startpunkt erfasst" text="Der Startpunkt kann in der Karte gesetzt und im Einsatz gespeichert werden." />
  }
  const kreise = schutzkreise(flughoeheM ?? 0, mitFlugplatz)
  const sichtbar = kreise.find((k) => k.id === 'menschen') ?? kreise[0]
  const radius = Math.max(sichtbar?.radiusM ?? 100, 60)
  // Zoom so wählen, dass der Kreis Abstand Menschenansammlungen ins Bild passt
  const zoom = Math.max(12, Math.min(18, Math.floor(Math.log2((156543 * Math.cos((position.lat * Math.PI) / 180) * (hoehe / 2.4)) / radius))))
  return (
    <div>
      <div className="relative isolate z-0 overflow-hidden rounded-lg border border-linie" style={{ height: hoehe }}>
        <MapContainer center={[position.lat, position.lng]} zoom={zoom} scrollWheelZoom={false} className="h-full w-full">
          <OsmKacheln />
          <GroesseBeobachten />
          <SchutzkreiseLayer start={position} kreise={kreise} />
        </MapContainer>
      </div>
      <p className="mt-1 text-xs text-gray-600">
        Startpunkt {fmtKoordinaten(position)}
        {position.genauigkeit ? ` (± ${fmtMeter(Math.round(position.genauigkeit))})` : ''}
      </p>
      {legende && kreise.length > 0 && <KartenLegende kreise={kreise} kompakt />}
    </div>
  )
}
