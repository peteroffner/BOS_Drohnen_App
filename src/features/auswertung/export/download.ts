/** Datei im Browser speichern (Blob + <a download>). */
export function downloadBlob(blob: Blob, dateiname: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = dateiname
  a.rel = 'noopener'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 30_000)
}

/** Für Dateinamen unbedenklicher Text: "FF Musterdorf" -> "FF_Musterdorf" */
export function dateiSicher(s: string): string {
  return (
    s
      .normalize('NFC')
      .replace(/[\\/:*?"<>|]+/g, '')
      .replace(/\s+/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
      .slice(0, 60) || 'Export'
  )
}

/** heutiges Datum für Dateinamen: 2026-11-12 */
export function heuteDatei(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
