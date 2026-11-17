import type { Ausleihe, Geraet, Mangel, VerleihPosition, Zubehoer, ZubehoerKategorie } from '../../db/types'

export const ZUBEHOER_KATEGORIE_LABEL: Record<ZubehoerKategorie, string> = {
  fernsteuerung: 'Fernsteuerung',
  bildschirm: 'Bildschirm / Monitor',
  ladegeraet: 'Ladegerät / Ladestation',
  koffer: 'Koffer / Transportbehälter',
  kamera: 'Kamera / Payload',
  propeller: 'Propeller',
  speicherkarte: 'Speicherkarte',
  sonstiges: 'Sonstiges',
}

export const ZUBEHOER_STATUS_LABEL = { ok: 'in Ordnung', defekt: 'defekt', ausgemustert: 'ausgemustert' } as const

/** Aktive Koffer (Zubehör der Kategorie „koffer“) eines Geräts */
export function aktiveKoffer(g: Geraet): Zubehoer[] {
  return (g.zubehoer ?? []).filter((z) => z.kategorie === 'koffer' && z.status !== 'ausgemustert')
}

/**
 * Alle aktiven Inventarteile eines Geräts als Checklisten-Positionen
 * (Drohne, Akkus, Zubehör – ausgemusterte Teile nicht). Teile in einem aktiven Koffer
 * bekommen `behaelterId` und stehen direkt nach ihrem Koffer.
 */
export function inventarPositionen(g: Geraet): VerleihPosition[] {
  const koffer = new Set(aktiveKoffer(g).map((k) => k.id))
  const imKoffer = (id?: string) => (id && koffer.has(id) ? id : undefined)
  const flach: VerleihPosition[] = [
    {
      teilId: g.id,
      art: 'drohne',
      bezeichnung: `${g.name} – ${[g.hersteller, g.modell].filter(Boolean).join(' ')}`,
      inventarnummer: g.inventarnummer,
      seriennummer: g.seriennummer,
      ausgegeben: false,
    },
  ]
  for (const a of g.akkus.filter((x) => x.status !== 'ausgemustert')) {
    flach.push({
      teilId: a.id,
      art: 'akku',
      bezeichnung: `Akku Nr. ${a.nummer} (${a.art === 'drohne' ? 'Drohne' : 'Fernbedienung'})`,
      inventarnummer: a.inventarnummer,
      seriennummer: a.seriennummer,
      behaelterId: imKoffer(a.behaelterId),
      ausgegeben: false,
    })
  }
  for (const z of (g.zubehoer ?? []).filter((x) => x.status !== 'ausgemustert')) {
    flach.push({
      teilId: z.id,
      art: 'zubehoer',
      bezeichnung: z.bezeichnung || ZUBEHOER_KATEGORIE_LABEL[z.kategorie],
      inventarnummer: z.inventarnummer,
      seriennummer: z.seriennummer,
      anzahl: z.anzahl && z.anzahl > 1 ? z.anzahl : undefined,
      behaelterId: z.kategorie === 'koffer' ? undefined : imKoffer(z.behaelterId),
      ausgegeben: false,
    })
  }
  return sortiereNachKoffer(flach)
}

/** Reihenfolge: lose Teile und Koffer wie gehabt, Inhalt direkt nach seinem Koffer */
export function sortiereNachKoffer(p: VerleihPosition[]): VerleihPosition[] {
  const oben = p.filter((x) => !x.behaelterId)
  return oben.flatMap((x) => [x, ...p.filter((y) => y.behaelterId === x.teilId)])
}

export interface InventarGruppe {
  pos: VerleihPosition
  index: number
  inhalt: { pos: VerleihPosition; index: number }[]
}

/** Gruppen für die Anzeige: oberste Ebene mit ihrem Kofferinhalt (index = Position in der Liste) */
export function inventarGruppen(p: VerleihPosition[]): InventarGruppe[] {
  const mitIndex = p.map((pos, index) => ({ pos, index }))
  const ids = new Set(p.map((x) => x.teilId))
  return mitIndex
    .filter((x) => !x.pos.behaelterId || !ids.has(x.pos.behaelterId))
    .map((x) => ({ ...x, inhalt: mitIndex.filter((y) => y.pos.behaelterId === x.pos.teilId) }))
}

/** Koffer abhaken/abwählen: Inhalt folgt */
export function setzeAusgegeben(p: VerleihPosition[], teilId: string, an: boolean): VerleihPosition[] {
  return p.map((x) => (x.teilId === teilId || x.behaelterId === teilId ? { ...x, ausgegeben: an } : x))
}

/** Rückgabe-Status setzen: beim Koffer gilt er für den mitgegebenen Inhalt mit */
export function setzeRueckgabe(p: VerleihPosition[], teilId: string, status: NonNullable<VerleihPosition['rueckgabe']>): VerleihPosition[] {
  return p.map((x) => (x.teilId === teilId || (x.behaelterId === teilId && x.ausgegeben) ? { ...x, rueckgabe: status } : x))
}

/** Offene Ausleihe eines Geräts (höchstens eine) */
export function offeneAusleihe(ausleihen: Ausleihe[], geraetId: string): Ausleihe | undefined {
  return ausleihen.find((a) => a.geraetId === geraetId && a.status === 'verliehen')
}

/** Ausgabe vollständig? Mindestens die Drohne muss abgehakt sein. */
export function ausgabeFehler(a: Pick<Ausleihe, 'empfaenger' | 'ausgabeDurch' | 'positionen'>): string | undefined {
  if (!a.empfaenger.trim()) return 'Organisation / Feuerwehr angeben, die das Gerät übernimmt.'
  if (!a.ausgabeDurch.trim()) return 'Angeben, wer das Gerät übergibt.'
  if (!a.positionen.some((p) => p.art === 'drohne' && p.ausgegeben)) return 'Die Drohne selbst muss in der Checkliste abgehakt sein.'
  return undefined
}

/** Rückgabe vollständig? Jedes ausgegebene Teil braucht einen Rückgabe-Status. */
export function rueckgabeFehler(a: Pick<Ausleihe, 'rueckgabeDurch' | 'positionen'>): string | undefined {
  if (!a.rueckgabeDurch?.trim()) return 'Angeben, wer das Gerät zurücknimmt.'
  const offen = a.positionen.filter((p) => p.ausgegeben && !p.rueckgabe)
  if (offen.length) return `Noch ${offen.length} Teil(e) ohne Rückgabe-Status.`
  return undefined
}

export interface RueckgabeErgebnis {
  fehlend: VerleihPosition[]
  beschaedigt: VerleihPosition[]
}

export function rueckgabeErgebnis(a: Pick<Ausleihe, 'positionen'>): RueckgabeErgebnis {
  const ausg = a.positionen.filter((p) => p.ausgegeben)
  return { fehlend: ausg.filter((p) => p.rueckgabe === 'fehlt'), beschaedigt: ausg.filter((p) => p.rueckgabe === 'beschaedigt') }
}

const teilText = (p: VerleihPosition) => `${p.bezeichnung}${p.inventarnummer ? ` (Inv.-Nr. ${p.inventarnummer})` : ''}`

/** Mängel aus der Rückgabe: je fehlendem/beschädigtem Teil ein offener Mangel am Gerät. */
export function rueckgabeMaengel(a: Ausleihe, neueId: () => string, jetzt: string): Mangel[] {
  const { fehlend, beschaedigt } = rueckgabeErgebnis(a)
  const mk = (p: VerleihPosition, was: string): Mangel => ({
    id: neueId(),
    orgId: a.orgId,
    geraetId: a.geraetId,
    erstelltAm: jetzt,
    quelle: 'verleih',
    ausleiheId: a.id,
    beschreibung: `Rückgabe von ${a.empfaenger}: ${teilText(p)} ${was}${p.bemerkung ? ` – ${p.bemerkung}` : ''}`,
  })
  return [...fehlend.map((p) => mk(p, 'fehlt')), ...beschaedigt.map((p) => mk(p, 'beschädigt'))]
}

/** Doppelte Inventarnummern innerhalb der Organisation (über alle Geräte, Akkus, Zubehör) */
export function doppelteInventarnummern(geraete: Geraet[]): Set<string> {
  const zaehler = new Map<string, number>()
  const add = (n?: string) => {
    const k = n?.trim().toLowerCase()
    if (k) zaehler.set(k, (zaehler.get(k) ?? 0) + 1)
  }
  for (const g of geraete) {
    add(g.inventarnummer)
    g.akkus.forEach((a) => add(a.inventarnummer))
    ;(g.zubehoer ?? []).forEach((z) => add(z.inventarnummer))
  }
  return new Set([...zaehler].filter(([, n]) => n > 1).map(([k]) => k))
}
