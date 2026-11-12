import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Autosave für Eingabefelder: lokaler Zustand (kein Cursor-Springen beim Tippen),
 * Speichern verzögert, beim Verlassen des Felds und beim Unmount.
 */
export function useAutoSave(wert: string, speichern: (v: string) => void, verzoegerung = 400) {
  const [lokal, setLokal] = useState(wert)
  const [fokus, setFokus] = useState(false)
  const [letzterWert, setLetzterWert] = useState(wert)
  const offen = useRef<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const speichernRef = useRef(speichern)
  useEffect(() => {
    speichernRef.current = speichern
  })

  // Externe Änderungen übernehmen, solange nicht getippt wird
  if (wert !== letzterWert) {
    setLetzterWert(wert)
    if (!fokus) setLokal(wert)
  }

  const flush = useCallback(() => {
    window.clearTimeout(timer.current)
    if (offen.current !== null) {
      const v = offen.current
      offen.current = null
      speichernRef.current(v)
    }
  }, [])

  useEffect(() => flush, [flush])

  return {
    value: lokal,
    onChange: (v: string) => {
      setLokal(v)
      offen.current = v
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(flush, verzoegerung)
    },
    onFocus: () => setFokus(true),
    onBlur: () => {
      setFokus(false)
      flush()
    },
  }
}
