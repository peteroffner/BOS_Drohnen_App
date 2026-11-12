import type { Einsatz, EinsatzArt, EinsatzStatus, Ereignis, Flug, Flugart, Geraet, GeraetStatus, OpenUnterkategorie, Rechtsgrundlage, Rolle } from '../../../db/types'
import { STANDARD_VORLAGE_ID } from '../../../templates/checkliste_v9'

/** Bezeichnungen und reine Hilfsfunktionen rund um den Einsatz. */

export const ART_LABEL: Record<EinsatzArt, string> = {
  einsatz: 'Einsatzflug',
  training: 'Trainingsflug',
  checkflug: 'Checkflug',
}
export const ART_OPTIONEN = (Object.keys(ART_LABEL) as EinsatzArt[]).map((value) => ({ value, label: ART_LABEL[value] }))

export const STATUS_LABEL: Record<EinsatzStatus, string> = {
  vorbereitung: 'Vorbereitung',
  laufend: 'Laufend',
  nachbereitung: 'Nachbereitung',
  abgeschlossen: 'Abgeschlossen',
}
export const STATUS_FARBE: Record<EinsatzStatus, 'grau' | 'rot' | 'gelb' | 'gruen'> = {
  vorbereitung: 'gelb',
  laufend: 'rot',
  nachbereitung: 'gelb',
  abgeschlossen: 'gruen',
}
export const STATUS_OPTIONEN = (Object.keys(STATUS_LABEL) as EinsatzStatus[]).map((value) => ({ value, label: STATUS_LABEL[value] }))

export const RECHTSGRUNDLAGE_LABEL: Record<Rechtsgrundlage, string> = {
  bescheid: 'Bescheid Austro Control',
  open: 'OPEN',
  specific_bos: 'SPECIFIC BOS',
}
export const FLUGARTEN: Flugart[] = ['VLOS', 'EVLOS', 'BVLOS']
export const OPEN_UNTERKATEGORIEN: OpenUnterkategorie[] = ['A1', 'A2', 'A3']

export const EINSATZENDE_ZEILEN: { key: keyof Einsatz['einsatzende']; label: string }[] = [
  { key: 'einsatzleiter', label: 'Abmeldung beim Einsatzleiter' },
  { key: 'leitstelle', label: 'Abmeldung bei der Leitstelle' },
  { key: 'tower', label: 'Abmeldung beim Tower' },
  { key: 'andereLfz', label: 'Abmeldung bei anderen LFZ-Betreibern' },
]

export function rechtsgrundlageText(e: Pick<Einsatz, 'rechtsgrundlage' | 'openUnterkategorie' | 'bescheidNr'>): string {
  if (!e.rechtsgrundlage) return ''
  let t = RECHTSGRUNDLAGE_LABEL[e.rechtsgrundlage]
  if (e.rechtsgrundlage === 'open' && e.openUnterkategorie) t += ` ${e.openUnterkategorie}`
  if (e.rechtsgrundlage !== 'open' && e.bescheidNr) t += ` (Bescheid-Nr. ${e.bescheidNr})`
  return t
}

/** Leerer Einsatz mit Standardwerten. */
export function neuerEinsatz(id: string, orgId: string, jetzt: string): Einsatz {
  return {
    id,
    orgId,
    status: 'vorbereitung',
    art: 'einsatz',
    datum: jetzt,
    geraetIds: [],
    flugart: 'VLOS',
    rollen: {},
    vorlageId: STANDARD_VORLAGE_ID,
    antworten: {},
    ereignisse: [],
    fluege: [],
    einsatzende: {},
    unfall: false,
    erstelltAm: jetzt,
    geaendertAm: jetzt,
  }
}

export const laufenderFlug = (e: Pick<Einsatz, 'fluege'>): Flug | undefined => e.fluege.find((f) => !f.landung)

export const naechsteFlugNr = (e: Pick<Einsatz, 'fluege'>) => e.fluege.reduce((m, f) => Math.max(m, f.nr), 0) + 1

export const rolleName = (r?: Rolle) => r?.name?.trim() ?? ''

/** Alle Namen in Rollen (für Suche). */
export function rollenNamen(e: Pick<Einsatz, 'rollen'>): string[] {
  const r = e.rollen
  return [r.gesamtEinsatzleiter, r.teamleiter, r.abschnittsleiter, r.pilot, ...(r.luftraumbeobachter ?? [])].map(rolleName).filter(Boolean)
}

/** Einsatzleiter-Spalte im Flugbuch: „Gesamt-EL / Drohne-Teamleiter“ */
export function einsatzleiterText(e: Pick<Einsatz, 'rollen'>): string {
  return [rolleName(e.rollen.gesamtEinsatzleiter), rolleName(e.rollen.teamleiter)].filter(Boolean).join(' / ')
}

/** Volltextsuche über die wichtigsten Felder */
export function einsatzPasstZuSuche(e: Einsatz, suche: string, extra: string[] = []): boolean {
  const q = suche.trim().toLowerCase()
  if (!q) return true
  const felder = [e.fluggebiet, e.gemeinde, e.grund, e.alarmierungVon, e.beschreibung, e.anmerkungen, e.payload, ART_LABEL[e.art], ...rollenNamen(e), ...extra]
  return felder.some((f) => f?.toLowerCase().includes(q))
}

export interface EinsatzFilter {
  art?: EinsatzArt | ''
  status?: EinsatzStatus | ''
  jahr?: number | ''
  suche?: string
}

export function filtereEinsaetze(liste: Einsatz[], f: EinsatzFilter): Einsatz[] {
  return liste
    .filter((e) => !f.art || e.art === f.art)
    .filter((e) => !f.status || e.status === f.status)
    .filter((e) => !f.jahr || new Date(e.datum).getFullYear() === f.jahr)
    .filter((e) => einsatzPasstZuSuche(e, f.suche ?? ''))
    .sort((a, b) => b.datum.localeCompare(a.datum))
}

/** Laufzeit in Sekunden -> "12:05" bzw. "1:02:05" */
export function formatLaufzeit(sekunden: number): string {
  const s = Math.max(0, Math.floor(sekunden))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const ss = String(s % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Prüfungen für „Einsatz abschließen“. Liefert die Liste der Hinderungsgründe. */
export function abschlussHindernisse(
  e: Pick<Einsatz, 'status' | 'fluege' | 'unterschrift'>,
  ohneFlugBestaetigt: boolean,
): string[] {
  const g: string[] = []
  if (e.status === 'abgeschlossen') g.push('Einsatz ist bereits abgeschlossen')
  if (laufenderFlug(e)) g.push('Es läuft noch ein Flug – zuerst landen')
  if (e.fluege.length === 0 && !ohneFlugBestaetigt) g.push('Kein Flug erfasst – „ohne Flug abschließen“ bestätigen')
  if (!e.unterschrift?.dataUrl) g.push('Unterschrift Pilot fehlt')
  return g
}

export { parseZahlAntwort as parseZahl } from './checkliste'

export const GERAET_STATUS_LABEL: Record<GeraetStatus, string> = {
  einsatzbereit: 'einsatzbereit',
  wartung: 'in Wartung',
  ausser_dienst: 'außer Dienst',
}

export const EREIGNIS_TYP_LABEL: Record<Ereignis['typ'], string> = { info: 'Info', meldung: 'Meldung', notfall: 'Notfall' }

export function sortierteEreignisse(e: Pick<Einsatz, 'ereignisse'>): Ereignis[] {
  return [...e.ereignisse].sort((a, b) => a.zeit.localeCompare(b.zeit))
}

export function akkuNummer(geraete: Geraet[], f: Pick<Flug, 'geraetId' | 'akkuId'>): string {
  return geraete.find((g) => g.id === f.geraetId)?.akkus.find((a) => a.id === f.akkuId)?.nummer ?? ''
}
