import type { Akku, Einsatz, Geraet, GeraetStatus, ID, Mangel, WartungsPruefung, WartungsVorlageItem } from '../../db/types'
import { akkuPruefId, WARTUNG_V2 } from '../../templates/wartung_v2'

/** Reine Logik Geräteverwaltung & Wartungsbuch (ohne React/DB, testbar). */

const TAG = 86400000

export const STATUS_LABEL: Record<GeraetStatus, string> = {
  einsatzbereit: 'einsatzbereit',
  wartung: 'Wartung',
  ausser_dienst: 'außer Dienst',
}
export const STATUS_FARBE: Record<GeraetStatus, 'gruen' | 'gelb' | 'grau'> = {
  einsatzbereit: 'gruen',
  wartung: 'gelb',
  ausser_dienst: 'grau',
}

export const AKKU_STATUS_LABEL: Record<Akku['status'], string> = { ok: 'ok', beobachten: 'beobachten', ausgemustert: 'ausgemustert' }
export const AKKU_ART_LABEL: Record<Akku['art'], string> = { drohne: 'Drohne', fernbedienung: 'Fernbedienung' }

export const MONATE = ['Jänner', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember']
export const MONATE_KURZ = ['Jän', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez']

export type Ergebnis = WartungsPruefung['ergebnisse'][string]

export interface WartungsPunkt extends WartungsVorlageItem {
  akkuId?: ID
}

export const akkuPruefLabel = (a: Akku) =>
  `Sichtkontrolle und Ladezustand Akku Nr. ${a.nummer} (${a.art === 'drohne' ? 'Drohne' : 'Fernbed.'})`

/**
 * Prüfpunkte eines Geräts: Vorlage Wartungsbuch v2 + je Akku eine Zeile.
 * Ausgemusterte Akkus nur, wenn sie in den übergebenen Prüfungen noch Ergebnisse haben.
 */
export function wartungsPunkte(geraet: Geraet, pruefungen: WartungsPruefung[] = []): WartungsPunkt[] {
  const akkuZeilen = geraet.akkus
    .filter((a) => a.status !== 'ausgemustert' || pruefungen.some((p) => akkuPruefId(a.id) in p.ergebnisse))
    .sort((a, b) => (a.art === b.art ? a.nummer.localeCompare(b.nummer, 'de-AT', { numeric: true }) : a.art === 'drohne' ? -1 : 1))
    .map<WartungsPunkt>((a) => ({ id: akkuPruefId(a.id), label: akkuPruefLabel(a), intervall: 'monatlich', akkuId: a.id }))
  return [...WARTUNG_V2, ...akkuZeilen]
}

/**
 * Ist der Prüfpunkt im Monat (1–12) fällig?
 * Quartal: März, Juni, September, Dezember; Halbjahr: Juni, Dezember.
 */
export function istFaellig(intervall: WartungsVorlageItem['intervall'], monat: number): boolean {
  if (intervall === 'quartal') return monat % 3 === 0
  if (intervall === 'halbjahr') return monat % 6 === 0
  return true
}

export const INTERVALL_LABEL: Record<WartungsVorlageItem['intervall'], string> = {
  monatlich: 'monatlich',
  quartal: 'vierteljährlich (Mär/Jun/Sep/Dez)',
  halbjahr: 'halbjährlich (Jun/Dez)',
}

export interface WartungsMatrix {
  jahr: number
  /** Index 0 = Jänner */
  pruefungen: (WartungsPruefung | undefined)[]
  zeilen: { punkt: WartungsPunkt; zellen: (Ergebnis | undefined)[] }[]
}

/** Jahresübersicht wie im Excel: Zeilen = Prüfpunkte, Spalten = Monate. */
export function wartungsMatrix(geraet: Geraet, pruefungen: WartungsPruefung[], jahr: number): WartungsMatrix {
  const imJahr = pruefungen.filter((p) => p.geraetId === geraet.id && p.jahr === jahr)
  const proMonat: (WartungsPruefung | undefined)[] = Array.from({ length: 12 }, (_, i) =>
    imJahr.filter((p) => p.monat === i + 1).sort((a, b) => b.datum.localeCompare(a.datum))[0],
  )
  const zeilen = wartungsPunkte(geraet, imJahr).map((punkt) => ({
    punkt,
    zellen: proMonat.map((p) => p?.ergebnisse[punkt.id]),
  }))
  return { jahr, pruefungen: proMonat, zeilen }
}

/** Startwerte für das Prüfformular: Bestehendes übernehmen, nicht fällige Punkte = n. a. */
export function vorbelegung(punkte: WartungsPunkt[], monat: number, bestehend?: WartungsPruefung): Record<string, Ergebnis | undefined> {
  const out: Record<string, Ergebnis | undefined> = {}
  for (const p of punkte) {
    out[p.id] = bestehend?.ergebnisse[p.id] ?? (istFaellig(p.intervall, monat) ? undefined : 'na')
  }
  return out
}

export const mangelBeschreibung = (monat: number, jahr: number, label: string) =>
  `Wartung ${String(monat).padStart(2, '0')}/${jahr}: ${label} – Mangel festgestellt`

/**
 * Mängel, die aus einer Monatsprüfung neu anzulegen sind (je Punkt „Mangel“).
 * Bereits vorhandene (gleiche Beschreibung, gleiches Gerät, Quelle Wartung) werden nicht doppelt angelegt.
 */
export function neueMaengelAusPruefung(
  pruefung: WartungsPruefung,
  punkte: WartungsPunkt[],
  bestehende: Mangel[],
): Pick<Mangel, 'geraetId' | 'quelle' | 'beschreibung'>[] {
  const vorhanden = new Set(bestehende.filter((m) => m.geraetId === pruefung.geraetId && m.quelle === 'wartung').map((m) => m.beschreibung))
  const out: Pick<Mangel, 'geraetId' | 'quelle' | 'beschreibung'>[] = []
  for (const p of punkte) {
    if (pruefung.ergebnisse[p.id] !== 'mangel') continue
    const beschreibung = mangelBeschreibung(pruefung.monat, pruefung.jahr, p.label)
    if (vorhanden.has(beschreibung)) continue
    out.push({ geraetId: pruefung.geraetId, quelle: 'wartung', beschreibung })
  }
  return out
}

export type Faelligkeit = 'ueberfaellig' | 'bald' | 'ok'

/** Fälligkeit des Herstellerservice (Warnung ab `vorlaufTage` vor dem Termin). */
export function serviceFaelligkeit(datum: string | undefined, heute = new Date(), vorlaufTage = 30): Faelligkeit | undefined {
  if (!datum) return undefined
  const t = new Date(datum).getTime()
  // Fällig ab Beginn des Termintages
  const tagesbeginn = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate()).getTime()
  if (t < tagesbeginn) return 'ueberfaellig'
  if (t < tagesbeginn + vorlaufTage * TAG) return 'bald'
  return 'ok'
}

export function wartungImMonatErledigt(pruefungen: WartungsPruefung[], geraetId: ID, heute = new Date()): boolean {
  return pruefungen.some((p) => p.geraetId === geraetId && p.jahr === heute.getFullYear() && p.monat === heute.getMonth() + 1)
}

export const offeneMaengel = (maengel: Mangel[], geraetId?: ID) => maengel.filter((m) => !m.behobenAm && (!geraetId || m.geraetId === geraetId))

/** Wurde das Gerät jemals in einem Einsatz/Flug verwendet? */
export function geraetVerwendet(geraetId: ID, einsaetze: Einsatz[]): boolean {
  return einsaetze.some((e) => e.geraetIds?.includes(geraetId) || e.fluege.some((f) => f.geraetId === geraetId))
}

export function akkuVerwendet(akkuId: ID, einsaetze: Einsatz[]): boolean {
  return einsaetze.some((e) => e.fluege.some((f) => f.akkuId === akkuId))
}
