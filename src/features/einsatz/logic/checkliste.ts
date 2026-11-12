import type { ChecklistAntwort, ChecklistItem, ChecklistPhase, ChecklistSektion, ChecklistVorlage, Einsatz } from '../../../db/types'

/**
 * Reine Logik zur Vollständigkeitsprüfung der Checklisten-Vorlage.
 * Keine DB-Zugriffe – testbar ohne Browser.
 */

export type Antworten = Record<string, ChecklistAntwort>

/** Phasen, die vor dem ersten Flug vollständig sein müssen. */
export const VORFLUG_PHASEN: ChecklistPhase[] = ['vorbereitung', 'vorflug', 'betrieb']

/** Ist ein Wert (ohne Unterpunkte/Folgefelder) beantwortet? */
export function wertBeantwortet(item: ChecklistItem, wert: ChecklistAntwort | undefined): boolean {
  if (wert === undefined || wert === null) return false
  switch (item.typ) {
    case 'check':
      return wert === true
    case 'text':
    case 'zeit':
      return typeof wert === 'string' && wert.trim() !== ''
    case 'zahl':
      return typeof wert === 'number' && Number.isFinite(wert)
    case 'janein':
      return wert === 'ja' || wert === 'nein'
    case 'auswahl':
      return typeof wert === 'string' && (item.optionen ?? []).some((o) => o.id === wert)
    case 'mehrfach':
      return Array.isArray(wert) && wert.length > 0
  }
}

/** Gewählte Optionen eines auswahl/mehrfach-Items. */
export function gewaehlteOptionen(item: ChecklistItem, wert: ChecklistAntwort | undefined) {
  const ids = Array.isArray(wert) ? wert : typeof wert === 'string' ? [wert] : []
  return (item.optionen ?? []).filter((o) => ids.includes(o.id))
}

/**
 * Ein „check“-Item mit Pflicht-Unterpunkten ist nur eine Gruppe (eigenes Häkchen entfällt),
 * es ist erledigt, sobald alle Pflicht-Unterpunkte erledigt sind.
 */
export function istGruppe(item: ChecklistItem): boolean {
  return item.typ === 'check' && (item.unterpunkte ?? []).some((u) => u.pflicht)
}

/**
 * Item erledigt?
 * - Gruppe: alle Pflicht-Unterpunkte erledigt
 * - sonst: eigener Wert beantwortet, Pflicht-Unterpunkte erledigt und
 *   Pflicht-Folgefelder der gewählten Option(en) erledigt
 */
export function itemErledigt(item: ChecklistItem, antworten: Antworten): boolean {
  const pflichtUnter = (item.unterpunkte ?? []).filter((u) => u.pflicht)
  const unterOk = pflichtUnter.every((u) => itemErledigt(u, antworten))
  if (istGruppe(item)) return unterOk
  const wert = antworten[item.id]
  if (!wertBeantwortet(item, wert)) return false
  if (!unterOk) return false
  for (const o of gewaehlteOptionen(item, wert)) {
    for (const f of o.folgeFelder ?? []) if (f.pflicht && !itemErledigt(f, antworten)) return false
  }
  return true
}

export interface Pflichtpunkt {
  /** ID des Items, das übersteuert/geprüft wird */
  itemId: string
  nr?: string
  label: string
  erledigt: boolean
}

/**
 * Pflichtpunkte einer Sektion für die Fortschrittsanzeige. Bei Gruppen zählt
 * jeder Pflicht-Unterpunkt einzeln, sonst jedes Pflicht-Item (inkl. seiner Folgefelder).
 */
export function pflichtpunkte(sektion: ChecklistSektion, antworten: Antworten): Pflichtpunkt[] {
  const out: Pflichtpunkt[] = []
  for (const item of sektion.items) {
    if (istGruppe(item)) {
      for (const u of item.unterpunkte ?? []) {
        if (!u.pflicht) continue
        out.push({ itemId: u.id, nr: item.nr, label: `${item.label}: ${u.label}`, erledigt: itemErledigt(u, antworten) })
      }
    } else if (item.pflicht) {
      out.push({ itemId: item.id, nr: item.nr, label: item.label, erledigt: itemErledigt(item, antworten) })
    }
  }
  return out
}

export interface Fortschritt {
  erledigt: number
  gesamt: number
  vollstaendig: boolean
  fehlend: Pflichtpunkt[]
}

export function sektionFortschritt(sektion: ChecklistSektion, antworten: Antworten): Fortschritt {
  const pp = pflichtpunkte(sektion, antworten)
  const fehlend = pp.filter((p) => !p.erledigt)
  return { erledigt: pp.length - fehlend.length, gesamt: pp.length, vollstaendig: fehlend.length === 0, fehlend }
}

export function sektionenFuerPhase(vorlage: ChecklistVorlage, phase: ChecklistPhase): ChecklistSektion[] {
  return vorlage.sektionen.filter((s) => s.phase === phase)
}

/** Gesamtfortschritt über eine oder mehrere Phasen. */
export function phasenFortschritt(vorlage: ChecklistVorlage, phasen: ChecklistPhase[], antworten: Antworten): Fortschritt {
  const fs = vorlage.sektionen.filter((s) => phasen.includes(s.phase)).map((s) => sektionFortschritt(s, antworten))
  const fehlend = fs.flatMap((f) => f.fehlend)
  const gesamt = fs.reduce((a, f) => a + f.gesamt, 0)
  return { erledigt: gesamt - fehlend.length, gesamt, vollstaendig: fehlend.length === 0, fehlend }
}

export interface FlugFreigabe {
  /** Flüge dürfen gestartet werden */
  frei: boolean
  /** noch offene Pflichtpunkte (ohne Übersteuerung) */
  offen: Pflichtpunkt[]
  /** offene Pflichtpunkte, die übersteuert wurden */
  uebersteuert: Pflichtpunkt[]
}

/**
 * Flüge sind startbar, wenn Vorbereitung + Vorflug + Betrieb vollständig sind
 * oder alle fehlenden Pflichtpunkte mit Begründung übersteuert wurden.
 */
export function flugFreigabe(einsatz: Pick<Einsatz, 'antworten' | 'uebersteuerungen'>, vorlage: ChecklistVorlage): FlugFreigabe {
  const f = phasenFortschritt(vorlage, VORFLUG_PHASEN, einsatz.antworten)
  const ueb = new Set((einsatz.uebersteuerungen ?? []).map((u) => u.itemId))
  const offen = f.fehlend.filter((p) => !ueb.has(p.itemId))
  const uebersteuert = f.fehlend.filter((p) => ueb.has(p.itemId))
  return { frei: offen.length === 0, offen, uebersteuert }
}

/** Item per ID in der Vorlage finden (inkl. Unterpunkte/Folgefelder). */
export function findeItem(vorlage: ChecklistVorlage, id: string): ChecklistItem | undefined {
  let treffer: ChecklistItem | undefined
  const walk = (items: ChecklistItem[]) => {
    for (const it of items) {
      if (treffer) return
      if (it.id === id) treffer = it
      if (it.unterpunkte) walk(it.unterpunkte)
      for (const o of it.optionen ?? []) if (o.folgeFelder) walk(o.folgeFelder)
    }
  }
  for (const s of vorlage.sektionen) walk(s.items)
  return treffer
}

/** Lesbarer Antworttext (für Protokoll/Druck). */
export function antwortText(item: ChecklistItem, wert: ChecklistAntwort | undefined, fmtZeit: (iso: string) => string): string {
  if (wert === undefined || wert === null || wert === '') return ''
  switch (item.typ) {
    case 'check':
      return wert === true ? '✓' : ''
    case 'zeit':
      return typeof wert === 'string' ? fmtZeit(wert) : ''
    case 'zahl':
      return `${wert}${item.einheit ? ' ' + item.einheit : ''}`
    case 'auswahl':
    case 'mehrfach':
      return gewaehlteOptionen(item, wert)
        .map((o) => o.label)
        .join(', ')
    default:
      return String(wert)
  }
}

export const DRONESPACE_URL = 'https://map.dronespace.at'
/** Checkpunkt „Luftraum in Dronespace geprüft“ */
export const istDronespaceItem = (it: ChecklistItem) => /dronespace/i.test(it.label)

/** Zahl aus Eingabe (Komma oder Punkt), leer/ungültig -> undefined */
export function parseZahlAntwort(v: string): number | undefined {
  const t = v.trim().replace(',', '.')
  if (!t) return undefined
  const n = Number(t)
  return Number.isFinite(n) ? n : undefined
}
