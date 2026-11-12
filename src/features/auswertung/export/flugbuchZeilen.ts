import type { Einsatz, EinsatzArt, Geraet, Pilot, Rolle } from '../../../db/types'
import { formatStunden } from '../../../lib/calc'
import { fmtDatum, fmtZeit, pilotName } from '../../../lib/format'
import { alleFluege } from '../../../lib/stats'

/** Eine Zeile im Aufbau „Flugbuch v2“ (alle Werte als Text, fertig formatiert). */
export interface FlugbuchZeile {
  nr: number
  datum: string
  pilot: string
  geraet: string
  einsatzort: string
  start: string
  landung: string
  dauer: string
  minuten: number
  durchfuehrung: string
  payload: string
  art: string
  beschreibung: string
  gesamtEinsatzleiter: string
  einsatzleiterDrohne: string
  unfall: string
  unfallMeldung: string
  bemerkungen: string
  /** ISO, für Sortierung */
  startIso: string
  einsatzId: string
}

const volt = (v?: number) => (v == null ? '–' : v.toLocaleString('de-AT'))

export const ART_LABEL: Record<EinsatzArt, string> = { einsatz: 'Einsatz', training: 'Ausbildung/Training', checkflug: 'Checkflug' }

export interface Stammdaten {
  piloten: Pilot[]
  geraete: Geraet[]
}

export function rollenName(r: Rolle | undefined, piloten: Pilot[]): string {
  if (!r) return ''
  if (r.name?.trim()) return r.name.trim()
  return r.pilotId ? pilotName(piloten.find((p) => p.id === r.pilotId)) : ''
}

/** Flugbuch-Zeilen chronologisch (älteste zuerst), nur abgeschlossene Flüge (mit Landung). */
export function flugbuchZeilen(einsaetze: Einsatz[], { piloten, geraete }: Stammdaten): FlugbuchZeile[] {
  const pMap = new Map(piloten.map((p) => [p.id, p]))
  const gMap = new Map(geraete.map((g) => [g.id, g]))
  const fluege = alleFluege(einsaetze)
    .filter((f) => !!f.landung)
    .sort((a, b) => a.start.localeCompare(b.start))
  return fluege.map((f, i) => {
    const e = f.einsatz
    const g = gMap.get(f.geraetId)
    const flug = e.fluege.find((x) => x.id === f.flugId)
    const akku = f.akkuId ? g?.akkus.find((a) => a.id === f.akkuId) : undefined
    const bemerkungen = [flug?.bemerkung, akku ? `Akku ${akku.nummer}` : '', flug && flug.spannungVor != null ? `${volt(flug.spannungVor)} / ${volt(flug.spannungNach)} V` : '']
      .filter(Boolean)
      .join('; ')
    const meldung = e.unfall ? [e.unfallMeldungDatum ? fmtDatum(e.unfallMeldungDatum) : '', e.unfallMeldungAn ? `an ${e.unfallMeldungAn}` : ''].filter(Boolean).join(' ') : ''
    return {
      nr: i + 1,
      datum: fmtDatum(f.start),
      pilot: pilotName(pMap.get(f.pilotId)) || 'unbekannt',
      geraet: g ? `${g.name}${g.registrierungsnummer ? ` (${g.registrierungsnummer})` : ''}` : 'unbekannt',
      einsatzort: [e.fluggebiet, e.gemeinde].filter(Boolean).join(', '),
      start: fmtZeit(f.start),
      landung: fmtZeit(f.landung),
      dauer: formatStunden(f.minuten),
      minuten: f.minuten,
      durchfuehrung: e.flugart,
      payload: e.payload || g?.payload || '',
      art: ART_LABEL[e.art],
      beschreibung: e.beschreibung || e.grund || '',
      gesamtEinsatzleiter: rollenName(e.rollen?.gesamtEinsatzleiter, piloten),
      einsatzleiterDrohne: rollenName(e.rollen?.teamleiter, piloten) || rollenName(e.rollen?.abschnittsleiter, piloten),
      unfall: e.unfall ? 'ja' : 'nein',
      unfallMeldung: meldung,
      bemerkungen,
      startIso: f.start,
      einsatzId: e.id,
    }
  })
}
