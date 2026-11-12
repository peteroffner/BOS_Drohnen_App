/**
 * Zentrales Datenmodell der App. Alle Feature-Module arbeiten mit diesen Typen.
 * IDs sind UUID-Strings (crypto.randomUUID), Zeitpunkte ISO-8601-Strings.
 * Abgeleitete Werte (Flugstunden, Akkuzyklen, Gerätestunden) werden NICHT gespeichert,
 * sondern über src/lib/stats.ts berechnet.
 */

export type ID = string
export type ISODate = string // ISO-8601 (Datum oder Datum+Zeit)

// ---------------------------------------------------------------- Organisation

export type OrgTyp = 'FF' | 'BF' | 'BtF' | 'Rettung' | 'Polizei' | 'Bergrettung' | 'Wasserrettung' | 'Sonstige'

export interface FreigabeRegeln {
  /** Qualifikationstypen, die gültig vorliegen müssen */
  pflichtQualifikationen: QualifikationTyp[]
  /** Mindestanzahl Flüge im Betrachtungszeitraum */
  mindestFluege: number
  /** Betrachtungszeitraum in Tagen */
  zeitraumTage: number
  /** Ab wie vielen Tagen vor Ablauf gelb gewarnt wird */
  warnungTageVorAblauf: number
}

export interface Organisation {
  id: ID
  name: string // z. B. "FF Musterdorf"
  typ: OrgTyp
  bezirk?: string
  bundesland?: string
  kontakt?: string
  freigabeRegeln: FreigabeRegeln
  erstelltAm: ISODate
}

// ---------------------------------------------------------------- Piloten

export type QualifikationTyp =
  | 'A1_A3' // EU-Kompetenznachweis A1/A3
  | 'A2' // EU-Fernpilotenzeugnis A2
  | 'STS' // STS-01 / STS-02
  | 'BOS_GRUND' // BOS Drohnenausbildung Grundmodul
  | 'BOS_EINSATZ' // BOS Drohnenausbildung Einsatzpilot
  | 'BOS_WAERMEBILD' // Wärmebild / Thermografie
  | 'FUNK' // Funk / Tetra
  | 'SONSTIGE'

export interface Qualifikation {
  id: ID
  typ: QualifikationTyp
  bezeichnung?: string // Freitext, v. a. bei SONSTIGE
  nummer?: string // Zertifikats-/Registrierungsnummer
  erworbenAm?: ISODate
  gueltigBis?: ISODate // leer = unbefristet
  nachweis?: Anhang
}

export interface Freigabe {
  erteilt: boolean
  erteiltVon?: string
  erteiltAm?: ISODate
  gueltigBis?: ISODate
  /** IDs der Geräte, für die die Freigabe gilt (leer = alle) */
  geraete?: ID[]
  bemerkung?: string
}

export interface Pilot {
  id: ID
  orgId: ID
  vorname: string
  nachname: string
  dienstgrad?: string
  feuerwehr?: string // falls abweichend von Organisation (z. B. Nachbarwehr)
  telefon?: string
  email?: string
  /** Flugstunden vor Einführung der App (in Minuten), werden zu den App-Stunden addiert */
  vorerfassteMinuten?: number
  vorerfassteFluege?: number
  qualifikationen: Qualifikation[]
  freigabe: Freigabe
  aktiv: boolean
  erstelltAm: ISODate
}

export interface Anhang {
  name: string
  mime: string
  dataUrl: string
}

// ---------------------------------------------------------------- Geräte & Wartung

export type GeraetStatus = 'einsatzbereit' | 'wartung' | 'ausser_dienst'

export interface Akku {
  id: ID
  nummer: string // "1", "2", "FB-1" …
  art: 'drohne' | 'fernbedienung'
  /** Zyklen vor Einführung der App */
  vorerfassteZyklen?: number
  status: 'ok' | 'beobachten' | 'ausgemustert'
  bemerkung?: string
}

export interface Geraet {
  id: ID
  orgId: ID
  name: string // "Hornisse 1"
  hersteller: string // "DJI"
  modell: string // "Matrice 300"
  payload?: string // "Zenmuse H20T"
  registrierungsnummer?: string // Betreiber-/Geräteregistrierung
  seriennummer?: string
  klasse?: string // C0…C6 / Bestandsgerät
  verantwortlicher?: string
  status: GeraetStatus
  akkus: Akku[]
  vorerfassteMinuten?: number
  naechstesHerstellerservice?: ISODate
  erstelltAm: ISODate
}

/** Monatliche Prüfung nach Wartungsbuch v2 */
export interface WartungsPruefung {
  id: ID
  orgId: ID
  geraetId: ID
  datum: ISODate
  jahr: number
  monat: number // 1–12
  pruefer: string
  /** itemId (aus WARTUNG_V2) -> Ergebnis */
  ergebnisse: Record<string, 'ok' | 'mangel' | 'na'>
  bemerkung?: string
}

export interface Mangel {
  id: ID
  orgId: ID
  geraetId: ID
  erstelltAm: ISODate
  quelle: 'nachkontrolle' | 'wartung' | 'manuell'
  einsatzId?: ID
  beschreibung: string
  behobenAm?: ISODate
  behobenVon?: string
  massnahme?: string
}

// ---------------------------------------------------------------- Einsatz / Flüge

export type EinsatzArt = 'einsatz' | 'training' | 'checkflug'
export type Flugart = 'VLOS' | 'EVLOS' | 'BVLOS'
export type Rechtsgrundlage = 'bescheid' | 'open' | 'specific_bos'
export type OpenUnterkategorie = 'A1' | 'A2' | 'A3'
export type EinsatzStatus = 'vorbereitung' | 'laufend' | 'nachbereitung' | 'abgeschlossen'

export interface Rolle {
  /** Verweis auf Pilot (optional), sonst Freitext */
  pilotId?: ID
  name: string
}

export interface Ereignis {
  id: ID
  zeit: ISODate
  text: string
  typ: 'info' | 'notfall' | 'meldung'
  /** Bezug zur lfd. Nr. der Checkliste (z. B. "17") oder Notfall-Nr. */
  bezug?: string
}

export interface Flug {
  id: ID
  nr: number
  pilotId: ID
  geraetId: ID
  akkuId?: ID
  spannungVor?: number
  spannungNach?: number
  start: ISODate
  landung?: ISODate // leer = Flug läuft
  zwischencheck: boolean
  bemerkung?: string
}

export interface Position {
  lat: number
  lng: number
  genauigkeit?: number
}

export interface Einsatz {
  id: ID
  orgId: ID
  /** Supabase-User-ID des Anlegers (nur Cloud-Modus) – für „eigene Einsätze“ */
  erstelltVon?: string
  status: EinsatzStatus
  art: EinsatzArt
  datum: ISODate // Beginn (Datum+Uhrzeit)
  alarmierungVon?: string
  grund?: string
  /** Kurzbeschreibung für das Flugbuch */
  beschreibung?: string
  fluggebiet?: string
  gemeinde?: string
  position?: Position
  geraetIds: ID[]
  rechtsgrundlage?: Rechtsgrundlage
  openUnterkategorie?: OpenUnterkategorie
  bescheidNr?: string
  flugart: Flugart
  geplanteFlughoeheM?: number
  payload?: string
  rollen: {
    gesamtEinsatzleiter?: Rolle
    teamleiter?: Rolle
    abschnittsleiter?: Rolle
    pilot?: Rolle
    luftraumbeobachter?: Rolle[]
  }
  /** Version der verwendeten Checklisten-Vorlage, z. B. "bfv-checkliste-v9" */
  vorlageId: string
  /** itemId -> Antwort (siehe ChecklistItem.typ) */
  antworten: Record<string, ChecklistAntwort>
  /** Pflichtpunkte, die mit Begründung übersteuert wurden */
  uebersteuerungen?: { itemId: string; begruendung: string; zeit: ISODate }[]
  dronespaceGeprueft?: ISODate
  ereignisse: Ereignis[]
  fluege: Flug[]
  einsatzende: {
    einsatzleiter?: ISODate
    leitstelle?: ISODate
    tower?: ISODate
    andereLfz?: ISODate
  }
  unfall: boolean
  unfallMeldungDatum?: ISODate
  unfallMeldungAn?: string
  anmerkungen?: string
  unterschrift?: { name: string; dataUrl: string; zeit: ISODate }
  abgeschlossenAm?: ISODate
  /** Nachträge nach Abschluss (unveränderliches Protokoll) */
  nachtraege?: { zeit: ISODate; autor: string; text: string }[]
  erstelltAm: ISODate
  geaendertAm: ISODate
}

// ---------------------------------------------------------------- Checklisten-Vorlagen

export type ChecklistPhase =
  | 'vorbereitung'
  | 'vorflug'
  | 'betrieb'
  | 'zwischen'
  | 'einsatzende'
  | 'nachkontrolle'

export type ChecklistItemTyp =
  | 'check' // Häkchen (boolean)
  | 'text' // Freitext (string)
  | 'zahl' // number
  | 'zeit' // ISO-Zeitpunkt
  | 'janein' // 'ja' | 'nein'
  | 'auswahl' // eine Option (string = option.id)
  | 'mehrfach' // mehrere Optionen (string[])

export type ChecklistAntwort = boolean | string | number | string[] | null

export interface ChecklistOption {
  id: string
  label: string
  /** Wenn gewählt: weitere Felder anzeigen (z. B. "Freigabe durch") */
  folgeFelder?: ChecklistItem[]
  /** Wenn gewählt: automatisch Mangel/Wartungsbedarf am Gerät anlegen */
  erzeugtMangel?: boolean
}

export interface ChecklistItem {
  id: string
  /** Laufende Nummer laut Formular, z. B. "16" */
  nr?: string
  label: string
  typ: ChecklistItemTyp
  pflicht?: boolean
  hinweis?: string
  einheit?: string
  optionen?: ChecklistOption[]
  /** Unterpunkte (z. B. Punkt 16 hat viele Einzel-Checks) */
  unterpunkte?: ChecklistItem[]
}

export interface ChecklistSektion {
  id: string
  titel: string
  phase: ChecklistPhase
  hinweis?: string
  items: ChecklistItem[]
}

export interface ChecklistVorlage {
  id: string // z. B. "bfv-checkliste-v9"
  name: string
  version: string
  quelle: string
  sektionen: ChecklistSektion[]
}

export interface NotfallSzenario {
  nr: number
  vorfall: string
  beschreibung?: string
  reaktionen: { verhalten: string; massnahme: string; siehe?: number }[]
}

export interface WartungsVorlageItem {
  id: string
  label: string
  /** 'monatlich' | 'quartal' | 'halbjahr' */
  intervall: 'monatlich' | 'quartal' | 'halbjahr'
}

// ---------------------------------------------------------------- Einstellungen

export interface AppEinstellung {
  key: string
  value: unknown
}
