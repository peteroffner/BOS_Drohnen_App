import { useEffect, useRef } from 'react'
import { Circle, CircleMarker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { Position } from '../../db/types'
import { fmtMeter, kreisGrenzen, OSM_ATTRIBUTION, OSM_URL, type Schutzkreis } from './geo'

/** OpenStreetMap-Kacheln mit Pflicht-Attribution */
export function OsmKacheln() {
  return <TileLayer url={OSM_URL} attribution={OSM_ATTRIBUTION} maxZoom={19} />
}

/** Kreise um den Startpunkt + Startpunkt-Markierung */
export function SchutzkreiseLayer({ start, kreise }: { start: Position; kreise: Schutzkreis[] }) {
  const center: [number, number] = [start.lat, start.lng]
  return (
    <>
      {kreise.map((k) => (
        <Circle
          key={k.id + k.radiusM}
          center={center}
          radius={k.radiusM}
          pathOptions={{
            className: k.pfadKlasse,
            weight: 2,
            fillOpacity: k.id === 'grb' ? 0.2 : 0.08,
            dashArray: k.gestrichelt ? '6 6' : undefined,
          }}
        >
          <Tooltip sticky>
            {k.label}: {fmtMeter(k.radiusM)}
          </Tooltip>
        </Circle>
      ))}
      <CircleMarker center={center} radius={8} pathOptions={{ className: 'stroke-white fill-dunkel', weight: 3, fillOpacity: 1 }}>
        <Tooltip>Startpunkt</Tooltip>
      </CircleMarker>
    </>
  )
}

/** Eigene Position mit Genauigkeitskreis */
export function EigenePositionLayer({ pos }: { pos: Position }) {
  const center: [number, number] = [pos.lat, pos.lng]
  return (
    <>
      {pos.genauigkeit != null && pos.genauigkeit > 0 && (
        <Circle center={center} radius={pos.genauigkeit} pathOptions={{ className: 'stroke-ok fill-ok', weight: 1, fillOpacity: 0.12 }} interactive={false} />
      )}
      <CircleMarker center={center} radius={7} pathOptions={{ className: 'stroke-white fill-ok', weight: 3, fillOpacity: 1 }}>
        <Tooltip>
          Eigene Position{pos.genauigkeit ? ` (± ${fmtMeter(Math.round(pos.genauigkeit))})` : ''}
        </Tooltip>
      </CircleMarker>
    </>
  )
}

/**
 * Passt den Kartenausschnitt an, sobald sich `ziel` (Schlüssel) ändert.
 * Radius = Bereich, der sichtbar sein soll.
 */
export function ZoomAuf({ pos, radiusM, ziel }: { pos?: Position; radiusM: number; ziel: string }) {
  const map = useMap()
  // bewusst nur bei neuem Ziel zoomen – pos/radius über Ref, damit Eingaben nicht ständig zoomen
  const aktuell = useRef({ pos, radiusM })
  useEffect(() => {
    aktuell.current = { pos, radiusM }
  })
  useEffect(() => {
    const { pos: p, radiusM: r } = aktuell.current
    if (!p || !ziel) return
    map.fitBounds(kreisGrenzen(p, Math.max(r, 50)), { padding: [24, 24], maxZoom: 18 })
  }, [map, ziel])
  return null
}

/** Leaflet neu vermessen, wenn sich die Containergröße ändert (z. B. Drehung am Tablet). */
export function GroesseBeobachten() {
  const map = useMap()
  useEffect(() => {
    const el = map.getContainer()
    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)
    return () => ro.disconnect()
  }, [map])
  return null
}
