import type { ChecklistVorlage, Einsatz } from '../../../db/types'
import { phasenFortschritt } from './checkliste'
import { laufenderFlug } from './einsatz'

export interface Schritt {
  nr: number
  titel: string
  kurz: string
  erledigt: boolean
  info?: string
}

/** Die 8 Schritte des geführten Einsatz-Workflows mit Erledigt-Status */
export function schritte(e: Einsatz, vorlage?: ChecklistVorlage): Schritt[] {
  const fp = (phase: 'vorbereitung' | 'vorflug' | 'betrieb' | 'nachkontrolle') => {
    if (!vorlage) return { erledigt: true, info: '' }
    const f = phasenFortschritt(vorlage, [phase], e.antworten)
    return { erledigt: f.vollstaendig, info: `${f.erledigt}/${f.gesamt}` }
  }
  const nachStart = e.status === 'nachbereitung' || e.status === 'abgeschlossen'
  return [
    { nr: 1, titel: 'Einsatzdaten', kurz: 'Daten', erledigt: true },
    { nr: 2, titel: 'Vorbereitung', kurz: 'Vorb.', ...fp('vorbereitung') },
    { nr: 3, titel: 'Vorflugkontrolle', kurz: 'Vorflug', ...fp('vorflug') },
    { nr: 4, titel: 'Betriebskontrolle', kurz: 'Betrieb', ...fp('betrieb') },
    {
      nr: 5,
      titel: 'Flüge',
      kurz: 'Flüge',
      erledigt: e.fluege.length > 0 && !laufenderFlug(e),
      info: laufenderFlug(e) ? 'läuft' : String(e.fluege.length),
    },
    { nr: 6, titel: 'Einsatzende', kurz: 'Ende', erledigt: nachStart || !!e.einsatzende.einsatzleiter },
    { nr: 7, titel: 'Nachkontrolle', kurz: 'Nachk.', ...fp('nachkontrolle') },
    { nr: 8, titel: 'Abschluss', kurz: 'Abschl.', erledigt: e.status === 'abgeschlossen' },
  ]
}

/** Vorgeschlagener Schritt beim Öffnen */
export function startSchritt(e: Einsatz, liste: Schritt[]): number {
  if (e.status === 'abgeschlossen') return 8
  if (e.status === 'laufend') return 5
  if (e.status === 'nachbereitung') return liste[5].erledigt ? (liste[6].erledigt ? 8 : 7) : 6
  if (e.fluege.length > 0) return 5
  return liste.slice(1, 4).find((s) => !s.erledigt)?.nr ?? 5
}
