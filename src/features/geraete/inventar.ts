import type { Ausleihe, Geraet, Mangel, VerleihPosition, ZubehoerKategorie } from '../../db/types'

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

/**
 * Alle aktiven Inventarteile eines Geräts als Checklisten-Positionen
 * (Drohne, Akkus, Zubehör – ausgemusterte Teile nicht).
 */
export function inventarPositionen(g: Geraet): VerleihPosition[] {
  const out: VerleihPosition[] = [
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
    out.push({
      teilId: a.id,
      art: 'akku',
      bezeichnung: `Akku Nr. ${a.nummer} (${a.art === 'drohne' ? 'Drohne' : 'Fernbedienung'})`,
      inventarnummer: a.inventarnummer,
      seriennummer: a.seriennummer,
      ausgegeben: false,
    })
  }
  for (const z of (g.zubehoer ?? []).filter((x) => x.status !== 'ausgemustert')) {
    out.push({
      teilId: z.id,
      art: 'zubehoer',
      bezeichnung: z.bezeichnung || ZUBEHOER_KATEGORIE_LABEL[z.kategorie],
      inventarnummer: z.inventarnummer,
      seriennummer: z.seriennummer,
      anzahl: z.anzahl && z.anzahl > 1 ? z.anzahl : undefined,
      ausgegeben: false,
    })
  }
  return out
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
