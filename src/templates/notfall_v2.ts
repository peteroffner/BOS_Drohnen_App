import type { NotfallSzenario } from '../db/types'

/** Notfall-Checkliste Drohnenflug v2 (Projektgruppe „Einsatz Drohnen“, 21.09.2021) */
export const NOTFALL_V2: NotfallSzenario[] = [
  {
    nr: 1,
    vorfall: 'Ausfall der Fernsteuerung',
    beschreibung: 'Komplettausfall der Fernsteuerung, Drohne reagiert nicht auf Befehle',
    reaktionen: [
      { verhalten: 'Drohne verharrt auf der Stelle', massnahme: 'Neustart des Systems', siehe: 2 },
      { verhalten: 'Drohne leitet RTH ein', massnahme: 'Rückkehr abwarten, Flughelfer informieren', siehe: 6 },
    ],
  },
  {
    nr: 2,
    vorfall: 'Kommunikationsverlust zur Drohne',
    beschreibung: 'Drohne reagiert nicht auf Steuerbefehle',
    reaktionen: [
      {
        verhalten: 'Drohne verharrt auf der Stelle',
        massnahme: 'Distanz zur Drohne verringern und versuchen, die Kontrolle zu übernehmen',
      },
      {
        verhalten: 'Drohne leitet RTH ein',
        massnahme: 'Laufend versuchen, Kontrolle zu übernehmen, Landung abwarten',
        siehe: 8,
      },
      {
        verhalten: 'Drohne schwebt auf der Stelle, Kontrolle ist nicht möglich',
        massnahme: 'Gebiet absichern, Personen informieren, Absturz abwarten',
        siehe: 7,
      },
    ],
  },
  {
    nr: 3,
    vorfall: 'Ausfall der Kamera',
    beschreibung: 'Kein Bild oder Bild ist eingefroren',
    reaktionen: [
      { verhalten: 'Drohne reagiert auf Steuerbefehle', massnahme: 'Manuellen Rückflug oder Auto-RTH einleiten' },
    ],
  },
  {
    nr: 4,
    vorfall: 'Akku-Kapazitätswarnung',
    reaktionen: [
      { verhalten: 'Akustisches Signal + Energiewarnung GELB', massnahme: 'Rückflug unverzüglich einleiten' },
    ],
  },
  {
    nr: 5,
    vorfall: 'Akku-Kapazitätswarnung KRITISCH',
    reaktionen: [
      {
        verhalten: 'Akustisches Signal + Energiewarnung ROT',
        massnahme: 'Rückflug unverzüglich einleiten, ggf. Auto-RTH verwenden',
      },
      {
        verhalten: 'Drohne leitet RTH ein',
        massnahme: 'Rückflug beobachten, Flughelfer informieren, Akkustand laufend prüfen',
        siehe: 8,
      },
    ],
  },
  {
    nr: 6,
    vorfall: '„Akku leer“-Alarm',
    reaktionen: [
      {
        verhalten: 'Absturz steht kurz bevor',
        massnahme:
          'Soweit möglich, Höhe kontrolliert verringern; wenn möglich, Position der Drohne so verändern, dass geringster Schaden entsteht',
        siehe: 7,
      },
    ],
  },
  {
    nr: 7,
    vorfall: 'Drohne stürzt ab',
    reaktionen: [{ verhalten: '„Akku leer“-Warnung, Absturz', massnahme: 'Personen warnen' }],
  },
  {
    nr: 8,
    vorfall: 'Drohne führt Auto-RTH durch',
    reaktionen: [
      {
        verhalten: 'Drohne steigt auf eingestellte RTH-Höhe, Drohne kehrt zum Startpunkt zurück',
        massnahme: 'Beobachten und Flughelfer informieren',
      },
    ],
  },
  {
    nr: 9,
    vorfall: 'Ausfall einzelner Rotoren',
    reaktionen: [{ verhalten: 'Drohne stürzt ab', massnahme: 'Personen warnen', siehe: 7 }],
  },
  {
    nr: 10,
    vorfall: 'Unbeteiligtes bemanntes Luftfahrzeug tritt in Luftraum ein',
    reaktionen: [{ verhalten: 'Kollision möglich', massnahme: 'Personen warnen, unverzüglich landen' }],
  },
]
