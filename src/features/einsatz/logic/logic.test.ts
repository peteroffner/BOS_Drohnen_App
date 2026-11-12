import { describe, expect, it } from 'vitest'
import type { Einsatz, Mangel } from '../../../db/types'
import { CHECKLISTE_V9, alleItems } from '../../../templates/checkliste_v9'
import {
  findeItem,
  flugFreigabe,
  itemErledigt,
  istGruppe,
  phasenFortschritt,
  sektionFortschritt,
  VORFLUG_PHASEN,
  wertBeantwortet,
  type Antworten,
} from './checkliste'
import { abschlussHindernisse, filtereEinsaetze, formatLaufzeit, neuerEinsatz, rechtsgrundlageText } from './einsatz'
import { maengelAbgleich, sollMaengel } from './maengel'

const V = CHECKLISTE_V9
const item = (id: string) => findeItem(V, id)!
const sektion = (id: string) => V.sektionen.find((s) => s.id === id)!

/** Antworten, die alle Pflichtpunkte der Phasen erfüllen */
function vollstaendig(): Antworten {
  const a: Antworten = {}
  for (const it of alleItems(V)) {
    if (!it.pflicht) continue
    if (it.typ === 'check') a[it.id] = true
    if (it.typ === 'text') a[it.id] = 'x'
    if (it.typ === 'zahl') a[it.id] = 10
    if (it.typ === 'zeit') a[it.id] = '2026-11-12T10:00:00.000Z'
    if (it.typ === 'janein') a[it.id] = 'ja'
    if (it.typ === 'auswahl') a[it.id] = it.optionen![0].id
  }
  return a
}

describe('wertBeantwortet', () => {
  it('prüft je Typ', () => {
    expect(wertBeantwortet(item('vf15_gesundheit'), true)).toBe(true)
    expect(wertBeantwortet(item('vf15_gesundheit'), false)).toBe(false)
    expect(wertBeantwortet(item('v2_kommunikation'), '  ')).toBe(false)
    expect(wertBeantwortet(item('v14_hindernis'), 0)).toBe(true)
    expect(wertBeantwortet(item('v14_hindernis'), Number.NaN)).toBe(false)
    expect(wertBeantwortet(item('v5_risikobeurteilung'), 'nein')).toBe(true)
    expect(wertBeantwortet(item('v9_kontrollzone'), 'gibtsnicht')).toBe(false)
  })
})

describe('itemErledigt', () => {
  it('Gruppe gilt als erledigt, wenn alle Pflicht-Unterpunkte erledigt sind', () => {
    const vf16 = item('vf16')
    expect(istGruppe(vf16)).toBe(true)
    const a: Antworten = {}
    for (const u of vf16.unterpunkte!) a[u.id] = u.typ === 'zahl' ? 12 : true
    expect(itemErledigt(vf16, a)).toBe(true)
    delete a.vf16_gps
    expect(itemErledigt(vf16, a)).toBe(false)
  })

  it('nicht-Pflicht-Unterpunkte sind egal (n21 Scheinwerfer)', () => {
    const n21 = item('n21_kamera')
    const a: Antworten = { n21_reinigen: true, n21_gimbal: true, n21_sensoren: true, n21_positionslichter: true }
    expect(itemErledigt(n21, a)).toBe(true)
  })

  it('Folgefelder der gewählten Option müssen erledigt sein', () => {
    const v9 = item('v9_kontrollzone')
    expect(itemErledigt(v9, { v9_kontrollzone: 'nein' })).toBe(true)
    expect(itemErledigt(v9, { v9_kontrollzone: 'ja' })).toBe(false)
    expect(itemErledigt(v9, { v9_kontrollzone: 'ja', v9_freigabe: 'Tower LOWW' })).toBe(true)
  })

  it('Check mit nur optionalen Unterpunkten braucht eigenes Häkchen', () => {
    const v13 = item('v13_hilfskraefte')
    expect(istGruppe(v13)).toBe(false)
    expect(itemErledigt(v13, {})).toBe(false)
    expect(itemErledigt(v13, { v13_hilfskraefte: true })).toBe(true)
  })
})

describe('Fortschritt', () => {
  it('zählt Unterpunkte von Gruppen einzeln', () => {
    const f = sektionFortschritt(sektion('vorflug'), {})
    // 15 + 13 Unterpunkte von 16
    expect(f.gesamt).toBe(14)
    expect(f.erledigt).toBe(0)
    expect(f.vollstaendig).toBe(false)
  })

  it('vollständig ausgefüllt', () => {
    const f = phasenFortschritt(V, VORFLUG_PHASEN, vollstaendig())
    expect(f.vollstaendig).toBe(true)
    expect(f.erledigt).toBe(f.gesamt)
  })
})

describe('flugFreigabe', () => {
  it('blockiert bei offenen Pflichtpunkten', () => {
    const r = flugFreigabe({ antworten: {}, uebersteuerungen: [] }, V)
    expect(r.frei).toBe(false)
    expect(r.offen.length).toBeGreaterThan(0)
  })

  it('frei, wenn alle offenen Punkte übersteuert sind', () => {
    const offen = flugFreigabe({ antworten: {} }, V).offen
    const uebersteuerungen = offen.map((p) => ({ itemId: p.itemId, begruendung: 'Gefahr im Verzug', zeit: 'x' }))
    const r = flugFreigabe({ antworten: {}, uebersteuerungen }, V)
    expect(r.frei).toBe(true)
    expect(r.uebersteuert.length).toBe(offen.length)
  })

  it('frei bei vollständiger Checkliste', () => {
    expect(flugFreigabe({ antworten: vollstaendig() }, V).frei).toBe(true)
  })
})

describe('Mängel aus Nachkontrolle', () => {
  const basis = { ...neuerEinsatz('e1', 'o1', '2026-11-12T10:00:00Z'), geraetIds: ['g1', 'g2'] }
  let n = 0
  const id = () => `m${++n}`

  it('erzeugt je Gerät einen Mangel', () => {
    const e = { ...basis, antworten: { n19_rotoren: 'tausch' } }
    expect(sollMaengel(e, V)).toHaveLength(2)
    const r = maengelAbgleich(e, V, [], id, 'jetzt')
    expect(r.anlegen.map((m) => m.geraetId)).toEqual(['g1', 'g2'])
    expect(r.anlegen[0]).toMatchObject({ quelle: 'nachkontrolle', einsatzId: 'e1', orgId: 'o1' })
    expect(r.anlegen[0].beschreibung).toContain('Rotoren überprüfen')
    expect(r.anlegen[0].beschreibung).toContain('Rotor muss getauscht werden')
  })

  it('ist idempotent', () => {
    const e = { ...basis, antworten: { n19_rotoren: 'tausch' } }
    const erste = maengelAbgleich(e, V, [], id, 'jetzt').anlegen
    const zweite = maengelAbgleich(e, V, erste, id, 'jetzt')
    expect(zweite.anlegen).toHaveLength(0)
    expect(zweite.loeschen).toHaveLength(0)
  })

  it('löscht beim Abwählen, behobene bleiben', () => {
    const e = { ...basis, antworten: { n19_rotoren: 'tausch' } }
    const ms: Mangel[] = maengelAbgleich(e, V, [], id, 'jetzt').anlegen
    ms[1] = { ...ms[1], behobenAm: 'gestern' }
    const fremd: Mangel = { ...ms[0], id: 'fremd', einsatzId: 'anderer' }
    const r = maengelAbgleich({ ...e, antworten: { n19_rotoren: 'ok' } }, V, [...ms, fremd], id, 'jetzt')
    expect(r.loeschen).toEqual([ms[0].id])
    expect(r.anlegen).toHaveLength(0)
  })

  it('ändert nichts bei abgeschlossenem Einsatz', () => {
    const e = { ...basis, status: 'abgeschlossen' as const, antworten: { n18_drohne: 'schaden' } }
    expect(maengelAbgleich(e, V, [], id, 'jetzt')).toEqual({ anlegen: [], loeschen: [] })
  })
})

describe('Einsatz-Hilfen', () => {
  it('formatLaufzeit', () => {
    expect(formatLaufzeit(65)).toBe('1:05')
    expect(formatLaufzeit(3725)).toBe('1:02:05')
    expect(formatLaufzeit(-3)).toBe('0:00')
  })

  it('rechtsgrundlageText', () => {
    expect(rechtsgrundlageText({ rechtsgrundlage: 'open', openUnterkategorie: 'A2' })).toBe('OPEN A2')
    expect(rechtsgrundlageText({ rechtsgrundlage: 'specific_bos', bescheidNr: '123' })).toBe('SPECIFIC BOS (Bescheid-Nr. 123)')
  })

  it('abschlussHindernisse', () => {
    const e: Pick<Einsatz, 'status' | 'fluege' | 'unterschrift'> = { status: 'nachbereitung', fluege: [] }
    expect(abschlussHindernisse(e, false)).toHaveLength(2)
    expect(abschlussHindernisse({ ...e, unterschrift: { name: 'a', dataUrl: 'data:x', zeit: 'z' } }, true)).toHaveLength(0)
    const laufend = { ...e, fluege: [{ id: 'f', nr: 1, pilotId: 'p', geraetId: 'g', start: 'x', zwischencheck: false }] }
    expect(abschlussHindernisse(laufend, false)).toContain('Es läuft noch ein Flug – zuerst landen')
  })

  it('filtereEinsaetze', () => {
    const a = { ...neuerEinsatz('a', 'o', '2025-05-01T10:00:00Z'), fluggebiet: 'Donauufer', art: 'training' as const }
    const b = { ...neuerEinsatz('b', 'o', '2026-05-01T10:00:00Z'), fluggebiet: 'Waldbrand Hohe Wand' }
    expect(filtereEinsaetze([a, b], {}).map((e) => e.id)).toEqual(['b', 'a'])
    expect(filtereEinsaetze([a, b], { jahr: 2025 }).map((e) => e.id)).toEqual(['a'])
    expect(filtereEinsaetze([a, b], { art: 'einsatz' }).map((e) => e.id)).toEqual(['b'])
    expect(filtereEinsaetze([a, b], { suche: 'donau' }).map((e) => e.id)).toEqual(['a'])
  })
})
