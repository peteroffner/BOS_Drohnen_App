import type { Mitgliedschaft } from './logik'

/** Zuletzt bekannte Mitgliedschaft je Benutzer (für Offline-Start). */
const CACHE_PREFIX = 'bos-mitgliedschaft:'

export function cacheLesen(userId: string): Mitgliedschaft | null {
  try {
    const s = localStorage.getItem(CACHE_PREFIX + userId)
    return s ? (JSON.parse(s) as Mitgliedschaft) : null
  } catch {
    return null
  }
}
export function cacheSchreiben(userId: string, m: Mitgliedschaft | null) {
  try {
    if (m) localStorage.setItem(CACHE_PREFIX + userId, JSON.stringify(m))
    else localStorage.removeItem(CACHE_PREFIX + userId)
  } catch {
    /* Speicher nicht verfügbar – egal */
  }
}
/** Beim Abmelden: zwischengespeicherte Mitgliedschaften entfernen */
export function mitgliedschaftCacheLeeren() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k)
  } catch {
    /* egal */
  }
}

