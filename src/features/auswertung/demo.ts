import type { BosDb } from '../../db/db'
import type {
  Akku,
  ChecklistAntwort,
  ChecklistItem,
  Einsatz,
  EinsatzArt,
  Ereignis,
  Flug,
  Flugart,
  Geraet,
  Mangel,
  Pilot,
  Position,
  Rolle,
  WartungsPruefung,
} from '../../db/types'
import { CHECKLISTE_V9 } from '../../templates/checkliste_v9'
import { akkuPruefId, WARTUNG_V2 } from '../../templates/wartung_v2'
import { DEMO_UNTERSCHRIFT_PNG } from './demoUnterschrift'

/**
 * Demodaten für Präsentation und Tests: 3 Piloten (grün/gelb/rot nach Standard-Freigaberegeln),
 * 2 Geräte, 8 abgeschlossene Einsätze/Trainings der letzten Monate, Wartungsprüfungen, Mängel.
 * Reine Funktion – alle Zeitpunkte relativ zu `heute`.
 */
export interface DemoDaten {
  piloten: Pilot[]
  geraete: Geraet[]
  einsaetze: Einsatz[]
  wartungen: WartungsPruefung[]
  maengel: Mangel[]
}

const TAG = 86400000

export function erzeugeDemodaten(orgId: string, heute = new Date(), neueId: () => string = () => crypto.randomUUID()): DemoDaten {
  const iso = (d: Date) => d.toISOString()
  /** vor n Tagen um hh:mm (lokale Zeit) */
  const tagUm = (vorTagen: number, h: number, m = 0) => {
    const d = new Date(heute.getTime() - vorTagen * TAG)
    d.setHours(h, m, 0, 0)
    return d
  }
  const plusMin = (d: Date, min: number) => new Date(d.getTime() + min * 60000)
  const inTagen = (n: number) => iso(new Date(heute.getTime() + n * TAG))
  const erstellt = iso(tagUm(200, 9))

  // ---------------------------------------------------------- Piloten
  const pilot = (p: Omit<Pilot, 'id' | 'orgId' | 'aktiv' | 'erstelltAm'>): Pilot => ({ id: neueId(), orgId, aktiv: true, erstelltAm: erstellt, ...p })
  const huber = pilot({
    vorname: 'Markus',
    nachname: 'Huber',
    dienstgrad: 'OBI',
    telefon: '+43 664 0000001',
    vorerfassteMinuten: 1260,
    vorerfassteFluege: 54,
    qualifikationen: [
      { id: neueId(), typ: 'A1_A3', nummer: 'AUT-RP-DEMO-0001', erworbenAm: '2022-03-14', gueltigBis: inTagen(900) },
      { id: neueId(), typ: 'A2', nummer: 'AUT-RP-DEMO-0001-A2', erworbenAm: '2022-05-02', gueltigBis: inTagen(950) },
      { id: neueId(), typ: 'BOS_GRUND', erworbenAm: '2022-09-17' },
      { id: neueId(), typ: 'BOS_EINSATZ', erworbenAm: '2023-04-22' },
      { id: neueId(), typ: 'BOS_WAERMEBILD', erworbenAm: '2023-10-07' },
      { id: neueId(), typ: 'FUNK', erworbenAm: '2019-02-01' },
    ],
    freigabe: { erteilt: true, erteiltVon: 'HBI Josef Maier', erteiltAm: iso(tagUm(400, 10)), gueltigBis: inTagen(330) },
  })
  const leitner = pilot({
    vorname: 'Sabine',
    nachname: 'Leitner',
    dienstgrad: 'LM',
    telefon: '+43 664 0000002',
    vorerfassteMinuten: 420,
    vorerfassteFluege: 21,
    qualifikationen: [
      // läuft in 35 Tagen ab → gelb
      { id: neueId(), typ: 'A1_A3', nummer: 'AUT-RP-DEMO-0002', erworbenAm: '2021-12-20', gueltigBis: inTagen(35) },
      { id: neueId(), typ: 'BOS_GRUND', erworbenAm: '2023-03-11' },
      { id: neueId(), typ: 'BOS_EINSATZ', erworbenAm: '2024-05-18' },
      { id: neueId(), typ: 'FUNK', erworbenAm: '2020-06-01' },
    ],
    freigabe: { erteilt: true, erteiltVon: 'HBI Josef Maier', erteiltAm: iso(tagUm(300, 10)), gueltigBis: inTagen(200) },
  })
  const pichler = pilot({
    vorname: 'Lukas',
    nachname: 'Pichler',
    dienstgrad: 'FM',
    telefon: '+43 664 0000003',
    qualifikationen: [
      { id: neueId(), typ: 'A1_A3', nummer: 'AUT-RP-DEMO-0003', erworbenAm: iso(tagUm(120, 10)), gueltigBis: inTagen(1700) },
      { id: neueId(), typ: 'BOS_GRUND', erworbenAm: iso(tagUm(70, 10)) },
    ],
    // in Ausbildung → rot
    freigabe: { erteilt: false, bemerkung: 'in Ausbildung – Freigabe nach Modul Einsatzpilot' },
  })
  const piloten = [huber, leitner, pichler]

  // ---------------------------------------------------------- Geräte
  const akku = (nummer: string, art: Akku['art'], vorerfassteZyklen: number, status: Akku['status'] = 'ok'): Akku => ({ id: neueId(), nummer, art, vorerfassteZyklen, status })
  const h1Akkus = [akku('1', 'drohne', 48), akku('2', 'drohne', 47), akku('3', 'drohne', 31), akku('4', 'drohne', 30, 'beobachten'), akku('FB-1', 'fernbedienung', 22)]
  const h2Akkus = [akku('1', 'drohne', 12), akku('2', 'drohne', 11), akku('3', 'drohne', 9), akku('FB-1', 'fernbedienung', 6)]
  const hornisse1: Geraet = {
    id: neueId(),
    orgId,
    name: 'Hornisse 1',
    hersteller: 'DJI',
    modell: 'Matrice 300 RTK',
    payload: 'Zenmuse H20T',
    registrierungsnummer: 'AUT-DEMO-OP-0001',
    seriennummer: '1ZNDH-DEMO-0001',
    klasse: 'Bestandsgerät',
    verantwortlicher: 'OBI Markus Huber',
    status: 'einsatzbereit',
    akkus: h1Akkus,
    vorerfassteMinuten: 1890,
    naechstesHerstellerservice: inTagen(75),
    erstelltAm: erstellt,
  }
  const hornisse2: Geraet = {
    id: neueId(),
    orgId,
    name: 'Hornisse 2',
    hersteller: 'DJI',
    modell: 'Mavic 3T',
    payload: 'integriert (Weitwinkel, Tele, Wärmebild)',
    registrierungsnummer: 'AUT-DEMO-OP-0001',
    seriennummer: '1581F-DEMO-0002',
    klasse: 'C2',
    verantwortlicher: 'LM Sabine Leitner',
    status: 'einsatzbereit',
    akkus: h2Akkus,
    vorerfassteMinuten: 240,
    naechstesHerstellerservice: inTagen(160),
    erstelltAm: erstellt,
  }
  const geraete = [hornisse1, hornisse2]

  // ---------------------------------------------------------- Einsätze
  const rolle = (p: Pilot): Rolle => ({ pilotId: p.id, name: `${p.dienstgrad} ${p.vorname} ${p.nachname}` })
  const el: Rolle = { name: 'HBI Josef Maier' }

  interface FlugPlan {
    pilot: Pilot
    akku: number
    min: number
    pause?: number
    bemerkung?: string
  }
  interface Plan {
    vorTagen: number
    h: number
    m: number
    art: EinsatzArt
    geraet: Geraet
    grund: string
    beschreibung: string
    alarmierung?: string
    fluggebiet: string
    pos: Position
    hoehe: number
    flugart?: Flugart
    fluege: FlugPlan[]
    ereignisse?: { nachMin: number; text: string; typ?: Ereignis['typ']; bezug?: string }[]
    antworten?: Record<string, ChecklistAntwort>
    uebersteuerung?: { itemId: string; begruendung: string }
    anmerkungen?: string
    nachtrag?: string
    mangel?: string
  }

  const plaene: Plan[] = [
    {
      vorTagen: 172,
      h: 18,
      m: 30,
      art: 'training',
      geraet: hornisse1,
      grund: 'Übungsabend Drohnengruppe',
      beschreibung: 'Grundübung Start-/Landeprozedere, Flug nach Sicht',
      fluggebiet: 'Übungsgelände beim Feuerwehrhaus',
      pos: { lat: 48.2047, lng: 15.6256, genauigkeit: 6 },
      hoehe: 50,
      fluege: [
        { pilot: huber, akku: 0, min: 18 },
        { pilot: leitner, akku: 1, min: 21, pause: 10 },
        { pilot: huber, akku: 2, min: 16, pause: 8 },
      ],
    },
    {
      vorTagen: 141,
      h: 22,
      m: 5,
      art: 'einsatz',
      geraet: hornisse1,
      alarmierung: 'Bezirksalarmzentrale (BAZ)',
      grund: 'Personensuche – abgängige Person im Waldgebiet',
      beschreibung: 'Personensuche mit Wärmebild',
      fluggebiet: 'Waldgebiet Hochfeld',
      pos: { lat: 48.2391, lng: 15.5874, genauigkeit: 9 },
      hoehe: 80,
      fluege: [
        { pilot: huber, akku: 0, min: 27, bemerkung: 'Suchraster Sektor A' },
        { pilot: huber, akku: 1, min: 24, pause: 9, bemerkung: 'Sektor B – Wärmesignatur gefunden' },
      ],
      ereignisse: [
        { nachMin: 4, text: 'Freigabe Einsatzleiter für Suchflug erteilt', typ: 'meldung', bezug: '1' },
        { nachMin: 70, text: 'Informationsweitergabe an EL: Wärmesignatur in Sektor B, Koordinaten übermittelt' },
      ],
      uebersteuerung: { itemId: 'b17_360l', begruendung: 'Zeitkritische Personensuche – verkürztes Startprozedere nach Rücksprache mit EL' },
      anmerkungen: 'Nachtflug mit Wärmebild, Sichtverbindung durch Luftraumbeobachter sichergestellt.',
      nachtrag: 'Person wurde von Suchtrupp 2 lebend aufgefunden und an den Rettungsdienst übergeben.',
    },
    {
      vorTagen: 112,
      h: 17,
      m: 0,
      art: 'checkflug',
      geraet: hornisse2,
      grund: 'Checkflug nach Firmware-Update',
      beschreibung: 'Funktionskontrolle nach Update Fernsteuerung/Drohne',
      fluggebiet: 'Übungsgelände beim Feuerwehrhaus',
      pos: { lat: 48.2047, lng: 15.6256, genauigkeit: 5 },
      hoehe: 40,
      fluege: [{ pilot: leitner, akku: 0, min: 12 }],
    },
    {
      vorTagen: 84,
      h: 14,
      m: 40,
      art: 'einsatz',
      geraet: hornisse1,
      alarmierung: 'Einsatzleiter vor Ort',
      grund: 'Brand Lagerhalle – Lageerkundung',
      beschreibung: 'Lageerkundung aus der Luft, Glutnester mit Wärmebild',
      fluggebiet: 'Gewerbegebiet Nord',
      pos: { lat: 48.2213, lng: 15.6411, genauigkeit: 7 },
      hoehe: 60,
      fluege: [
        { pilot: huber, akku: 2, min: 25 },
        { pilot: huber, akku: 3, min: 19, pause: 12, bemerkung: 'Nachkontrolle Glutnester' },
      ],
      ereignisse: [{ nachMin: 30, text: 'Informationsweitergabe an EL über Ausbreitung Richtung Osten, Livebild an ELF' }],
    },
    {
      vorTagen: 58,
      h: 18,
      m: 0,
      art: 'training',
      geraet: hornisse2,
      grund: 'Ausbildung Einsatzpilot',
      beschreibung: 'Ausbildungsflug mit Lehrpilot, Notverfahren RTH',
      fluggebiet: 'Übungsgelände beim Feuerwehrhaus',
      pos: { lat: 48.2047, lng: 15.6256, genauigkeit: 6 },
      hoehe: 30,
      fluege: [
        { pilot: pichler, akku: 0, min: 15, bemerkung: 'mit Lehrpilot OBI Huber' },
        { pilot: pichler, akku: 1, min: 17, pause: 10, bemerkung: 'Übung RTH' },
      ],
    },
    {
      vorTagen: 39,
      h: 9,
      m: 15,
      art: 'einsatz',
      geraet: hornisse2,
      alarmierung: 'Landeswarnzentrale',
      grund: 'Hochwasser – Erkundung Uferbereich',
      beschreibung: 'Lageerkundung Hochwasser, Fotodokumentation Dammbereich',
      fluggebiet: 'Uferbereich Traisen',
      pos: { lat: 48.1925, lng: 15.6302, genauigkeit: 8 },
      hoehe: 100,
      flugart: 'EVLOS',
      fluege: [
        { pilot: leitner, akku: 0, min: 26 },
        { pilot: leitner, akku: 1, min: 23, pause: 14 },
      ],
      ereignisse: [{ nachMin: 60, text: 'Fotos des Dammbereichs an Einsatzleitung übergeben' }],
    },
    {
      vorTagen: 19,
      h: 18,
      m: 30,
      art: 'training',
      geraet: hornisse1,
      grund: 'Übungsabend Drohnengruppe',
      beschreibung: 'Suchübung mit Wärmebild, Zusammenarbeit mit Suchtrupp',
      fluggebiet: 'Waldrand Kogelberg',
      pos: { lat: 48.2302, lng: 15.6055, genauigkeit: 6 },
      hoehe: 60,
      fluege: [
        { pilot: huber, akku: 0, min: 22 },
        { pilot: leitner, akku: 1, min: 20, pause: 9, bemerkung: 'harte Landung im unebenen Gelände' },
        { pilot: huber, akku: 2, min: 14, pause: 8 },
      ],
      ereignisse: [
        {
          nachMin: 35,
          typ: 'notfall',
          bezug: 'N2',
          text: 'Kommunikationsverlust zur Drohne (ca. 20 s) – Drohne verharrte auf der Stelle, Verbindung wiederhergestellt',
        },
      ],
      antworten: { n19_rotoren: 'tausch' },
      anmerkungen: 'Nach Flug 2 Rotorblatt rechts vorne beschädigt festgestellt.',
      mangel: 'Rotorblatt rechts vorne beschädigt – Tausch erforderlich (Nachkontrolle Punkt 19)',
    },
    {
      vorTagen: 6,
      h: 7,
      m: 50,
      art: 'einsatz',
      geraet: hornisse2,
      alarmierung: 'Bezirksalarmzentrale (BAZ)',
      grund: 'Verkehrsunfall B1 – Dokumentation Unfallstelle',
      beschreibung: 'Übersichtsaufnahmen Unfallstelle für Polizei',
      fluggebiet: 'B1 Ortsausfahrt West',
      pos: { lat: 48.2019, lng: 15.5987, genauigkeit: 5 },
      hoehe: 40,
      fluege: [{ pilot: huber, akku: 2, min: 13 }],
    },
  ]

  const einsaetze: Einsatz[] = []
  const maengel: Mangel[] = []
  for (const p of plaene) {
    const beginn = tagUm(p.vorTagen, p.h, p.m)
    let t = plusMin(beginn, 25)
    const istM300 = p.geraet === hornisse1
    const fluege: Flug[] = p.fluege.map((f, i) => {
      t = plusMin(t, f.pause ?? 0)
      const start = t
      const landung = plusMin(start, f.min)
      t = landung
      const voll = istM300 ? 52.6 : 17.2
      const verbrauch = (istM300 ? 0.28 : 0.11) * f.min
      return {
        id: neueId(),
        nr: i + 1,
        pilotId: f.pilot.id,
        geraetId: p.geraet.id,
        akkuId: p.geraet.akkus[f.akku]?.id,
        spannungVor: voll,
        spannungNach: Math.round((voll - verbrauch) * 10) / 10,
        start: iso(start),
        landung: iso(landung),
        zwischencheck: i > 0,
        bemerkung: f.bemerkung,
      }
    })
    const ende = t
    const hauptpilot = p.fluege[0].pilot
    const id = neueId()
    const abgeschlossen = plusMin(ende, 35)
    const einsatz: Einsatz = {
      id,
      orgId,
      status: 'abgeschlossen',
      art: p.art,
      datum: iso(beginn),
      alarmierungVon: p.alarmierung ?? (p.art === 'einsatz' ? 'Einsatzleiter' : 'Gruppenkommandant'),
      grund: p.grund,
      beschreibung: p.beschreibung,
      fluggebiet: p.fluggebiet,
      gemeinde: 'Musterdorf',
      position: p.pos,
      geraetIds: [p.geraet.id],
      rechtsgrundlage: p.art === 'einsatz' ? 'specific_bos' : 'open',
      openUnterkategorie: p.art === 'einsatz' ? undefined : istM300 ? 'A3' : 'A2',
      bescheidNr: p.art === 'einsatz' ? 'BOS-DEMO-2026/001' : undefined,
      flugart: p.flugart ?? 'VLOS',
      geplanteFlughoeheM: p.hoehe,
      payload: p.geraet.payload,
      rollen: {
        gesamtEinsatzleiter: p.art === 'einsatz' ? el : undefined,
        teamleiter: rolle(huber),
        pilot: rolle(hauptpilot),
        luftraumbeobachter: [hauptpilot === huber ? rolle(leitner) : rolle(huber), { name: 'FM Anna Berger' }],
      },
      vorlageId: CHECKLISTE_V9.id,
      antworten: { ...standardAntworten(beginn, p.hoehe), ...p.antworten },
      uebersteuerungen: p.uebersteuerung ? [{ ...p.uebersteuerung, zeit: iso(plusMin(beginn, 20)) }] : undefined,
      dronespaceGeprueft: iso(plusMin(beginn, 8)),
      ereignisse: (p.ereignisse ?? []).map((x) => ({ id: neueId(), zeit: iso(plusMin(beginn, x.nachMin)), text: x.text, typ: x.typ ?? 'info', bezug: x.bezug })),
      fluege,
      einsatzende: {
        einsatzleiter: iso(plusMin(ende, 10)),
        leitstelle: p.art === 'einsatz' ? iso(plusMin(ende, 12)) : undefined,
      },
      unfall: false,
      anmerkungen: p.anmerkungen,
      unterschrift: { name: `${hauptpilot.dienstgrad} ${hauptpilot.vorname} ${hauptpilot.nachname}`, dataUrl: DEMO_UNTERSCHRIFT_PNG, zeit: iso(abgeschlossen) },
      abgeschlossenAm: iso(abgeschlossen),
      nachtraege: p.nachtrag ? [{ zeit: iso(plusMin(abgeschlossen, 60 * 20)), autor: 'HBI Josef Maier', text: p.nachtrag }] : undefined,
      erstelltAm: iso(beginn),
      geaendertAm: iso(abgeschlossen),
    }
    einsaetze.push(einsatz)
    if (p.mangel) {
      maengel.push({ id: neueId(), orgId, geraetId: p.geraet.id, erstelltAm: iso(abgeschlossen), quelle: 'nachkontrolle', einsatzId: id, beschreibung: p.mangel })
    }
  }
  // behobener Mangel aus Wartung
  maengel.push({
    id: neueId(),
    orgId,
    geraetId: hornisse2.id,
    erstelltAm: iso(tagUm(95, 19)),
    quelle: 'wartung',
    beschreibung: 'Gimbal-Schutzabdeckung fehlt im Transportkoffer',
    behobenAm: iso(tagUm(88, 18)),
    behobenVon: 'LM Sabine Leitner',
    massnahme: 'Ersatzteil beschafft und eingelegt',
  })

  // ---------------------------------------------------------- Wartungsbuch (monatlich, letzte 6 Monate)
  const wartungen: WartungsPruefung[] = []
  for (let k = 6; k >= 1; k--) {
    const d = new Date(heute.getFullYear(), heute.getMonth() - k, 5, 19, 0)
    const monat = d.getMonth() + 1
    for (const g of geraete) {
      const ergebnisse: WartungsPruefung['ergebnisse'] = {}
      for (const w of WARTUNG_V2) {
        ergebnisse[w.id] =
          w.intervall === 'monatlich' ? 'ok' : w.intervall === 'quartal' ? (monat % 3 === 0 ? 'ok' : 'na') : monat === 6 || monat === 12 ? 'ok' : 'na'
      }
      for (const a of g.akkus) ergebnisse[akkuPruefId(a.id)] = 'ok'
      let bemerkung: string | undefined
      if (g === hornisse2 && k === 3) {
        ergebnisse.sicht_transport = 'mangel'
        bemerkung = 'Gimbal-Schutzabdeckung fehlt'
      }
      if (g === hornisse1 && k === 1) {
        const a4 = g.akkus.find((a) => a.nummer === '4')
        if (a4) ergebnisse[akkuPruefId(a4.id)] = 'mangel'
        bemerkung = 'Akku 4 leicht aufgebläht – beobachten'
      }
      wartungen.push({
        id: neueId(),
        orgId,
        geraetId: g.id,
        datum: iso(d),
        jahr: d.getFullYear(),
        monat,
        pruefer: g === hornisse1 ? 'OBI Markus Huber' : 'LM Sabine Leitner',
        ergebnisse,
        bemerkung,
      })
    }
  }

  return { piloten, geraete, einsaetze, wartungen, maengel }
}

const TEXT_ANTWORT: Record<string, string> = {
  v2_kommunikation: 'Tetra-Funk TMO, Rufname „Hornisse“',
  v3_flugroute: 'Startpunkt – Einsatzraum – zurück, Rundflug im Sichtbereich',
  v4_wetter: 'leicht bewölkt, Wind 12 km/h aus W, 9 °C',
  v6_risikoanalyse: 'geringes Risiko, Absperrung Start-/Landezone',
  v7_tetra1: '6011234',
  v7_tetra2: '6011235',
  v8_flugeinsatzstellen: 'Leitstelle informiert',
  v13_namen: 'FM Anna Berger',
  v14_hindernis_art: 'Baumreihe',
  n23_dokumentation: 'Fotos/Videos auf Einsatzlaufwerk abgelegt',
}

const ZAHL_ANTWORT: Record<string, number> = { v14_hindernis: 25, vf16_gps: 18, vf16_geofencing: 500 }

/** Vollständig ausgefüllte Checkliste (alle Pflichtpunkte erledigt). */
function standardAntworten(beginn: Date, hoehe: number): Record<string, ChecklistAntwort> {
  const a: Record<string, ChecklistAntwort> = {}
  const walk = (items: ChecklistItem[]) => {
    for (const it of items) {
      switch (it.typ) {
        case 'check':
          a[it.id] = true
          break
        case 'janein':
          a[it.id] = 'ja'
          break
        case 'auswahl':
          if (it.optionen?.[0]) a[it.id] = it.optionen[0].id
          break
        case 'zeit':
          a[it.id] = new Date(beginn.getTime() + 5 * 60000).toISOString()
          break
        case 'zahl':
          a[it.id] = it.id === 'vf16_hoehenlimit' ? Math.min(120, hoehe + 20) : (ZAHL_ANTWORT[it.id] ?? 0)
          break
        case 'text':
          if (TEXT_ANTWORT[it.id]) a[it.id] = TEXT_ANTWORT[it.id]
          break
      }
      if (it.unterpunkte) walk(it.unterpunkte)
    }
  }
  for (const s of CHECKLISTE_V9.sektionen) walk(s.items)
  return a
}

/** Zählt vorhandene Stammdaten/Einsätze einer Organisation (Demo nur bei 0 erlaubt). */
export async function vorhandeneDaten(db: BosDb, orgId: string): Promise<number> {
  const [p, g, e] = await Promise.all([
    db.piloten.where('orgId').equals(orgId).count(),
    db.geraete.where('orgId').equals(orgId).count(),
    db.einsaetze.where('orgId').equals(orgId).count(),
  ])
  return p + g + e
}

/** Schreibt Demodaten in einer Transaktion (nur, wenn noch keine Daten existieren). */
export async function demodatenLaden(db: BosDb, orgId: string, heute = new Date()): Promise<DemoDaten> {
  const d = erzeugeDemodaten(orgId, heute)
  await db.transaction('rw', [db.piloten, db.geraete, db.einsaetze, db.wartungen, db.maengel], async () => {
    if ((await vorhandeneDaten(db, orgId)) > 0) throw new Error('Es sind bereits Daten vorhanden – Demodaten werden nicht geladen.')
    await db.piloten.bulkAdd(d.piloten)
    await db.geraete.bulkAdd(d.geraete)
    await db.einsaetze.bulkAdd(d.einsaetze)
    await db.wartungen.bulkAdd(d.wartungen)
    await db.maengel.bulkAdd(d.maengel)
  })
  return d
}
