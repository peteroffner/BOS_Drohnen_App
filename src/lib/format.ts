const LOCALE = 'de-AT'

export const fmtDatum = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(LOCALE, { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''

export const fmtZeit = (iso?: string) =>
  iso ? new Date(iso).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' }) : ''

export const fmtDatumZeit = (iso?: string) => (iso ? `${fmtDatum(iso)} ${fmtZeit(iso)}` : '')

/** ISO -> Wert für <input type="datetime-local"> (lokale Zeit) */
export function toLocalInput(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

/** Wert aus <input type="datetime-local"> -> ISO */
export const fromLocalInput = (v: string): string | undefined => (v ? new Date(v).toISOString() : undefined)

/** ISO -> Wert für <input type="date"> */
export const toDateInput = (iso?: string) => (iso ? toLocalInput(iso).slice(0, 10) : '')
export const fromDateInput = (v: string): string | undefined => (v ? new Date(`${v}T12:00:00`).toISOString() : undefined)

export const pilotName = (p?: { vorname: string; nachname: string; dienstgrad?: string }) =>
  p ? `${p.dienstgrad ? p.dienstgrad + ' ' : ''}${p.vorname} ${p.nachname}` : ''
