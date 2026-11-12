import type { ChecklistItem, ChecklistVorlage } from '../db/types'

/**
 * Digitale Fassung der „Checkliste Drohnenflug v9“
 * (Projektgruppe „Einsatz-Drohnen“ | BOS Drohnenausbildung, 08.03.2023).
 *
 * Die Einsatzdaten von Seite 1 (Datum, Art, Fluggebiet, Rechtsgrundlage, Flughöhe,
 * Rollen …) sind eigene Felder am Einsatz (siehe Einsatz in db/types.ts).
 * Die Tabelle „Verwendete Akkus / Flug“ entspricht Einsatz.fluege.
 */

const check = (id: string, label: string, pflicht = true, extra: Partial<ChecklistItem> = {}): ChecklistItem => ({
  id,
  label,
  typ: 'check',
  pflicht,
  ...extra,
})

export const CHECKLISTE_V9: ChecklistVorlage = {
  id: 'bfv-checkliste-v9',
  name: 'Checkliste Drohnenflug',
  version: 'v9 (08.03.2023)',
  quelle: 'Projektgruppe „Einsatz-Drohnen“ | BOS Drohnenausbildung',
  sektionen: [
    {
      id: 'vorbereitung',
      titel: 'Vorbereitung',
      phase: 'vorbereitung',
      items: [
        {
          id: 'v1_auftrag',
          nr: '1',
          label: 'Auftrag durch Einsatzleiter genehmigt',
          typ: 'zeit',
          pflicht: true,
          hinweis: 'Datum und Uhrzeit der Genehmigung',
        },
        { id: 'v2_kommunikation', nr: '2', label: 'Kommunikation zur Einsatzleitung über', typ: 'text', pflicht: true },
        { id: 'v3_flugroute', nr: '3', label: 'Flugroute festgelegt', typ: 'text', pflicht: true },
        {
          id: 'v4_wetter',
          nr: '4',
          label: 'Wetter / Windgeschwindigkeit / Temperatur',
          typ: 'text',
          pflicht: true,
          hinweis: 'z. B. „bewölkt, 15 km/h aus W, 8 °C“',
        },
        { id: 'v5_risikobeurteilung', nr: '5', label: 'Risikobeurteilung durchgeführt', typ: 'janein', pflicht: true },
        { id: 'v6_risikoanalyse', nr: '6', label: 'Risikoanalyse ergibt', typ: 'text' },
        {
          id: 'v7_kommunikation',
          nr: '7',
          label: 'Kommunikation sicherstellen (Tetra-Funkgeräte)',
          typ: 'check',
          hinweis: 'Digital mit ISSI-Nr.',
          unterpunkte: [
            { id: 'v7_tetra1', label: 'Tetra-Funkgerät 1 (ISSI)', typ: 'text' },
            { id: 'v7_tetra2', label: 'Tetra-Funkgerät 2 (ISSI)', typ: 'text' },
            { id: 'v7_tetra3', label: 'Tetra-Funkgerät 3 (ISSI)', typ: 'text' },
          ],
        },
        {
          id: 'v8_flugeinsatzstellen',
          nr: '8',
          label: 'Flugeinsatzstellen informieren',
          typ: 'text',
          hinweis: 'z. B. Leitstelle, Polizeihubschrauber, Notarzthubschrauber, Tower',
        },
        {
          id: 'v8b_dronespace',
          label: 'Luftraum in Dronespace (Austro Control) geprüft',
          typ: 'check',
          pflicht: true,
          hinweis: 'map.dronespace.at – Geozonen und NOTAMs prüfen',
        },
        {
          id: 'v9_kontrollzone',
          nr: '9',
          label: 'Flug in Kontrollzone',
          typ: 'auswahl',
          pflicht: true,
          optionen: [
            { id: 'nein', label: 'nein' },
            {
              id: 'ja',
              label: 'ja',
              folgeFelder: [{ id: 'v9_freigabe', label: 'Freigabe durch', typ: 'text', pflicht: true }],
            },
          ],
        },
        {
          id: 'v10_militaerzone',
          nr: '10',
          label: 'Militärzone',
          typ: 'auswahl',
          pflicht: true,
          optionen: [
            { id: 'nein', label: 'nein' },
            {
              id: 'ja',
              label: 'ja',
              folgeFelder: [{ id: 'v10_freigabe', label: 'Freigabe durch', typ: 'text', pflicht: true }],
            },
          ],
        },
        {
          id: 'v11_flugplatz',
          nr: '11',
          label: 'Flugplatz ohne Sicherheitszone näher als 2,5 km',
          typ: 'auswahl',
          pflicht: true,
          optionen: [
            { id: 'nein', label: 'nein' },
            {
              id: 'ja',
              label: 'ja – Flug nur außerhalb der Betriebszeiten',
              folgeFelder: [
                { id: 'v11_quelle', label: 'Betriebszeiten laut', typ: 'text' },
                { id: 'v11_von', label: 'Betriebszeit von (hh:mm)', typ: 'text' },
                { id: 'v11_bis', label: 'Betriebszeit bis (hh:mm)', typ: 'text' },
              ],
            },
          ],
        },
        {
          id: 'v12_absperrung',
          nr: '12',
          label: 'Start-/Landezone mit Pylonen absperren',
          typ: 'auswahl',
          pflicht: true,
          optionen: [
            { id: 'keine', label: 'Absperrung nicht notwendig' },
            { id: '5x5', label: '5 × 5 Meter' },
            { id: '10x10', label: '10 × 10 Meter' },
            { id: '30x30', label: '30 × 30 Meter' },
          ],
        },
        check('v13_hilfskraefte', 'Hilfskräfte vorhanden und unterwiesen', false, {
          nr: '13',
          unterpunkte: [{ id: 'v13_namen', label: 'Namen der Hilfskräfte', typ: 'text' }],
        }),
        {
          id: 'v14_hindernis',
          nr: '14',
          label: 'Höchstes Hindernis',
          typ: 'zahl',
          einheit: 'm',
          pflicht: true,
          unterpunkte: [{ id: 'v14_hindernis_art', label: 'Art des Hindernisses', typ: 'text' }],
        },
      ],
    },
    {
      id: 'vorflug',
      titel: 'Vorflugkontrolle',
      phase: 'vorflug',
      items: [
        check('vf15_gesundheit', 'Pilot ist gesundheitlich in der Lage zu fliegen', true, { nr: '15' }),
        {
          id: 'vf16',
          nr: '16',
          label: 'Gerätecheck',
          typ: 'check',
          pflicht: true,
          unterpunkte: [
            check('vf16_fernsteuerung', 'Fernsteuerung betriebsbereit'),
            check('vf16_drohne', 'Drohne betriebsbereit (lt. Betriebshandbuch)'),
            check('vf16_positionslichter', 'Positionslichter in Betrieb'),
            check('vf16_verbindung', 'Verbindung Fernsteuerung zur Drohne betriebsbereit'),
            check('vf16_kamera', 'Kamera, Gimbal, sonstige Anbauten, Live-Bild etc. funktionsbereit'),
            check('vf16_flugmodus', 'Flugmodus eingestellt'),
            check('vf16_rth_position', 'RTH-Position (Landekoordinaten) geprüft'),
            check('vf16_rth_hoehe', 'RTH-Höhe mindestens 10 Meter über höchstem Hindernis'),
            { id: 'vf16_gps', label: 'GPS-Stärke, Anzahl Satelliten', typ: 'zahl', pflicht: true },
            { id: 'vf16_geofencing', label: 'Geofencing eingestellt auf', typ: 'zahl', einheit: 'm', pflicht: true },
            { id: 'vf16_hoehenlimit', label: 'Höhenlimit eingestellt auf', typ: 'zahl', einheit: 'm', pflicht: true },
            check('vf16_akku30', 'Akkuwarnung auf 30 % eingestellt'),
            check('vf16_akku20', 'Akkuwarnung 20 % auf RTH eingestellt'),
          ],
        },
      ],
    },
    {
      id: 'betrieb',
      titel: 'Betriebskontrolle',
      phase: 'betrieb',
      hinweis: 'Startprozedere lt. Betriebshandbuch',
      items: [
        {
          id: 'b17',
          nr: '17',
          label: 'Startprozedere',
          typ: 'check',
          pflicht: true,
          unterpunkte: [
            check('b17_start3m', 'Start auf 3 Meter über Grund'),
            check('b17_schweben', 'Schweben über RTH-Punkt (Startposition)', true, {
              hinweis: 'Drohne driftet mehr als 1 Meter ab: Drohne landen und kalibrieren',
            }),
            check('b17_akku', 'Akkuentladung normal', true, {
              hinweis: 'Bei rascher Entladung: Drohne landen und Akku wechseln',
            }),
            check('b17_360r', '360-Grad-Drehung nach rechts'),
            check('b17_360l', '360-Grad-Drehung nach links'),
            check('b17_gieren_r', 'Gieren einen Meter nach rechts'),
            check('b17_gieren_l', 'Gieren einen Meter nach links'),
            check('b17_vor', 'Flug vorwärts 2 Meter'),
            check('b17_zurueck', 'Flug rückwärts 2 Meter'),
            check('b17_landen', 'Drohne landen'),
            check('b17_ok', 'Alle Checks OK – Flug kann durchgeführt werden'),
          ],
        },
      ],
    },
    {
      id: 'zwischen',
      titel: 'Zwischenflugkontrolle',
      phase: 'zwischen',
      hinweis: 'Vor jedem weiteren Flug (Akkuwechsel) Punkte 12–17 erneut prüfen und beim Flug abhaken.',
      items: [],
    },
    {
      id: 'nachkontrolle',
      titel: 'Nachkontrolle',
      phase: 'nachkontrolle',
      hinweis: 'lt. Betriebshandbuch',
      items: [
        {
          id: 'n18_drohne',
          nr: '18',
          label: 'Drohne auf Beschädigungen prüfen (Sichtkontrolle)',
          typ: 'auswahl',
          pflicht: true,
          optionen: [
            { id: 'ok', label: 'keine Schäden, Drohne ist einsatzbereit' },
            { id: 'schaden', label: 'Schaden vorhanden, Wartung erforderlich', erzeugtMangel: true },
          ],
        },
        {
          id: 'n19_rotoren',
          nr: '19',
          label: 'Rotoren überprüfen',
          typ: 'auswahl',
          pflicht: true,
          optionen: [
            { id: 'ok', label: 'keine Schäden' },
            { id: 'tausch', label: 'Rotor muss getauscht werden (Wartung)', erzeugtMangel: true },
          ],
        },
        {
          id: 'n20_motoren',
          nr: '20',
          label: 'Motoren prüfen',
          typ: 'auswahl',
          pflicht: true,
          optionen: [
            { id: 'sauber', label: 'Motoren sind frei von Schmutz' },
            { id: 'gereinigt', label: 'Schmutz von Motoren entfernt, Rotoren frei beweglich' },
            { id: 'wartung', label: 'Wartung erforderlich', erzeugtMangel: true },
          ],
        },
        {
          id: 'n21_kamera',
          nr: '21',
          label: 'Kamera überprüfen',
          typ: 'check',
          pflicht: true,
          unterpunkte: [
            check('n21_reinigen', 'Kamera reinigen'),
            check('n21_gimbal', 'Gimbal funktionstüchtig'),
            check('n21_sensoren', 'Sensoren'),
            check('n21_scheinwerfer', 'Scheinwerfer / sonstige Anbauten', false),
            check('n21_positionslichter', 'Positionslichter'),
          ],
        },
        {
          id: 'n22',
          nr: '22',
          label: 'Akkus und Speicher',
          typ: 'check',
          pflicht: true,
          unterpunkte: [
            check('n22_akku', 'Akku-Check (Sichtkontrolle auf Beschädigung)'),
            check('n22_speicherkarte', 'Speicherkarte (leeren?)', false),
          ],
        },
        {
          id: 'n23_dokumentation',
          nr: '23',
          label: 'Einsatz dokumentieren (Flugbuch archivieren)',
          typ: 'text',
          hinweis: 'Ablageort von Fotos/Videos, Übergabe an …',
        },
      ],
    },
  ],
}

/** Alle Items inkl. Unterpunkte und Folgefelder einer Vorlage, flach. */
export function alleItems(vorlage: ChecklistVorlage): ChecklistItem[] {
  const out: ChecklistItem[] = []
  const walk = (items: ChecklistItem[]) => {
    for (const it of items) {
      out.push(it)
      if (it.unterpunkte) walk(it.unterpunkte)
      for (const o of it.optionen ?? []) if (o.folgeFelder) walk(o.folgeFelder)
    }
  }
  for (const s of vorlage.sektionen) walk(s.items)
  return out
}

export const VORLAGEN: Record<string, ChecklistVorlage> = {
  [CHECKLISTE_V9.id]: CHECKLISTE_V9,
}
export const STANDARD_VORLAGE_ID = CHECKLISTE_V9.id
