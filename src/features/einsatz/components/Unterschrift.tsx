import { Eraser } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { PointerEvent } from 'react'
import { Button } from '../../../components/ui'

/**
 * Unterschriftenfeld (Pointer Events: Finger, Stift, Maus).
 * Liefert nach jedem Strich ein PNG als dataUrl.
 */
export function UnterschriftFeld({ wert, onChange, disabled }: { wert?: string; onChange: (dataUrl: string | undefined) => void; disabled?: boolean }) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const zeichnet = useRef(false)
  const letzter = useRef<{ x: number; y: number } | null>(null)
  const geaendert = useRef(false)

  // Größe an Bildschirm anpassen (scharf auf HiDPI) und vorhandene Unterschrift zeichnen
  const leeren = (bild?: string) => {
    const c = canvas.current
    if (!c) return
    const r = c.getBoundingClientRect()
      const dpr = window.devicePixelRatio || 1
      c.width = Math.max(1, Math.round(r.width * dpr))
      c.height = Math.max(1, Math.round(r.height * dpr))
      const ctx = c.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.fillStyle = 'white'
      ctx.fillRect(0, 0, r.width, r.height)
      if (bild) {
        const img = new Image()
        img.onload = () => ctx.drawImage(img, 0, 0, r.width, r.height)
        img.src = bild
      }
  }

  // Nur beim Einblenden: gespeicherte Unterschrift zeichnen
  useEffect(() => leeren(wert), []) // eslint-disable-line react-hooks/exhaustive-deps

  const punkt = (e: PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  const linie = (von: { x: number; y: number }, bis: { x: number; y: number }) => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--color-dunkel').trim() || 'black'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(von.x, von.y)
    ctx.lineTo(bis.x, bis.y)
    ctx.stroke()
  }

  const ende = () => {
    if (!zeichnet.current) return
    zeichnet.current = false
    letzter.current = null
    if (geaendert.current && canvas.current) {
      geaendert.current = false
      onChange(canvas.current.toDataURL('image/png'))
    }
  }

  return (
    <div>
      <canvas
        ref={canvas}
        aria-label="Unterschrift Pilot"
        data-testid="unterschrift"
        className="h-40 w-full touch-none rounded-md border-2 border-dashed border-gray-400 bg-white"
        style={{ cursor: disabled ? 'not-allowed' : 'crosshair' }}
        onPointerDown={(e) => {
          if (disabled) return
          e.currentTarget.setPointerCapture(e.pointerId)
          zeichnet.current = true
          const p = punkt(e)
          letzter.current = p
          linie(p, { x: p.x + 0.1, y: p.y + 0.1 })
          geaendert.current = true
        }}
        onPointerMove={(e) => {
          if (!zeichnet.current || !letzter.current) return
          const p = punkt(e)
          linie(letzter.current, p)
          letzter.current = p
          geaendert.current = true
        }}
        onPointerUp={ende}
        onPointerCancel={ende}
      />
      {!disabled && (
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-xs text-gray-600">Mit Finger, Stift oder Maus unterschreiben</span>
          <Button size="sm" variant="secondary" icon={<Eraser size={16} />} onClick={() => {
              leeren()
              onChange(undefined)
            }} disabled={!wert}>
            Löschen
          </Button>
        </div>
      )}
    </div>
  )
}
