import type { Anhang, Einsatz, ID, Pilot } from '../../db/types'
import { alleFluege, type FlugZeile, type PilotStatistik, type PilotStatus } from '../../lib/stats'

/** Reine Logik der Pilotenverwaltung (ohne React/DB, testbar). */

const TAG = 86400000

export type Gueltigkeit = 'abgelaufen' | 'bald' | 'gueltig' | 'unbefristet'

/** Gültigkeit eines Nachweises (Qualifikation/Freigabe) relativ zu heute. */
export function gueltigkeit(gueltigBis: string | undefined, heute = new Date(), warnTage = 60): Gueltigkeit {
  if (!gueltigBis) return 'unbefristet'
  const t = new Date(gueltigBis).getTime()
  if (t < heute.getTime()) return 'abgelaufen'
  if (t < heute.getTime() + warnTage * TAG) return 'bald'
  return 'gueltig'
}

/** Kommt der Pilot in einem Flug oder einer Einsatzrolle vor? Dann darf er nicht gelöscht werden. */
export function pilotVerwendet(pilotId: ID, einsaetze: Einsatz[]): boolean {
  return einsaetze.some((e) => {
    if (e.fluege.some((f) => f.pilotId === pilotId)) return true
    const r = e.rollen ?? {}
    const rollen = [r.gesamtEinsatzleiter, r.teamleiter, r.abschnittsleiter, r.pilot, ...(r.luftraumbeobachter ?? [])]
    return rollen.some((x) => x?.pilotId === pilotId)
  })
}

/** Flüge eines Piloten, neueste zuerst. */
export function fluegeVonPilot(pilotId: ID, einsaetze: Einsatz[]): FlugZeile[] {
  return alleFluege(einsaetze).filter((f) => f.pilotId === pilotId)
}

export interface PilotZeile {
  pilot: Pilot
  status: PilotStatus
  stat: PilotStatistik
}

export type PilotSortierung = 'name' | 'status' | 'stunden' | 'letzterFlug'

const AMPEL_RANG = { gruen: 0, gelb: 1, rot: 2 } as const

export function sortierePiloten(zeilen: PilotZeile[], nach: PilotSortierung): PilotZeile[] {
  const name = (p: Pilot) => `${p.nachname} ${p.vorname}`.toLocaleLowerCase('de-AT')
  const byName = (a: PilotZeile, b: PilotZeile) => name(a.pilot).localeCompare(name(b.pilot), 'de-AT')
  const cmp: Record<PilotSortierung, (a: PilotZeile, b: PilotZeile) => number> = {
    name: byName,
    status: (a, b) => AMPEL_RANG[a.status.ampel] - AMPEL_RANG[b.status.ampel] || byName(a, b),
    stunden: (a, b) => b.stat.gesamt.minuten - a.stat.gesamt.minuten || byName(a, b),
    letzterFlug: (a, b) => (b.stat.letzterFlug ?? '').localeCompare(a.stat.letzterFlug ?? '') || byName(a, b),
  }
  return [...zeilen].sort(cmp[nach])
}

/** Volltextsuche über Name, Dienstgrad, Feuerwehr, Kontakt. */
export function pilotPasst(p: Pilot, suche: string): boolean {
  const q = suche.trim().toLocaleLowerCase('de-AT')
  if (!q) return true
  const text = [p.vorname, p.nachname, p.dienstgrad, p.feuerwehr, p.telefon, p.email].filter(Boolean).join(' ').toLocaleLowerCase('de-AT')
  return q.split(/\s+/).every((w) => text.includes(w))
}

// ------------------------------------------------------------ Nachweis-Upload

export const MAX_ANHANG_BYTES = 2 * 1024 * 1024
export const ANHANG_ACCEPT = 'image/*,application/pdf'

/** Prüft Typ und Größe einer Datei; gibt eine Fehlermeldung oder null zurück. */
export function pruefeAnhang(datei: { size: number; type: string }): string | null {
  if (!(datei.type.startsWith('image/') || datei.type === 'application/pdf')) return 'Nur Bilder oder PDF-Dateien sind erlaubt.'
  if (datei.size > MAX_ANHANG_BYTES) return `Datei ist zu groß (${(datei.size / 1024 / 1024).toFixed(1)} MB, max. 2 MB).`
  return null
}

export function dateiZuAnhang(datei: File): Promise<Anhang> {
  const fehler = pruefeAnhang(datei)
  if (fehler) return Promise.reject(new Error(fehler))
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve({ name: datei.name, mime: datei.type, dataUrl: String(r.result) })
    r.onerror = () => reject(new Error('Datei konnte nicht gelesen werden.'))
    r.readAsDataURL(datei)
  })
}

// ------------------------------------------------------------ Vorerfasste Stunden

/** Minuten -> {stunden, minuten} für Eingabefelder */
export const teileMinuten = (min = 0) => ({ stunden: Math.floor(min / 60), minuten: min % 60 })
export const zuMinuten = (stunden: number, minuten: number) => Math.max(0, Math.round((stunden || 0) * 60 + (minuten || 0)))
