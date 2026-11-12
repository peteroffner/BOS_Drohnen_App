import type { WartungsVorlageItem } from '../db/types'

/**
 * Prüfpunkte aus „Wartungsbuch v2“ (Excel). Akku-Zeilen werden je Gerät
 * dynamisch aus Geraet.akkus erzeugt (IDs `akku:<akkuId>`).
 */
export const WARTUNG_V2: WartungsVorlageItem[] = [
  { id: 'vollstaendigkeit', label: 'Vollständigkeit gesamte Ausrüstung', intervall: 'monatlich' },
  { id: 'sicht_drohne', label: 'Sichtkontrolle Drohne', intervall: 'monatlich' },
  {
    id: 'sicht_rotoren',
    label: 'Sichtkontrolle Rotoren und Rotorarme (Verriegelungen/Verschraubungen)',
    intervall: 'monatlich',
  },
  { id: 'sicht_fernbedienung', label: 'Sichtkontrolle Fernbedienung', intervall: 'monatlich' },
  { id: 'sicht_transport', label: 'Sichtkontrolle Zubehör Transportbehälter', intervall: 'monatlich' },
  {
    id: 'sicht_monitor',
    label: 'Sichtkontrolle Zubehör Übertragungsmonitor und Verbindungen zur Steuerung',
    intervall: 'monatlich',
  },
  { id: 'sicht_zubehoer', label: 'Sichtkontrolle sonstiges Zubehör', intervall: 'monatlich' },
  { id: 'grundeinstellungen_fb', label: 'Grundeinstellungen Fernbedienung', intervall: 'monatlich' },
  { id: 'update_fb', label: 'Update Fernbedienung / Firmware', intervall: 'monatlich' },
  { id: 'internet', label: 'Mobile Internetverbindung, Hotspot funktioniert', intervall: 'monatlich' },
  { id: 'uebertragung', label: 'Übertragung funktioniert (Fernseher, etc.)', intervall: 'monatlich' },
  { id: 'speicherkarte', label: 'Speicherkarte geleert', intervall: 'monatlich' },
  {
    id: 'funktion',
    label: 'Funktionskontrolle Gerät (Positionslichter, Kamera, Scheinwerfer)',
    intervall: 'quartal',
  },
  { id: 'herstellerservice', label: 'Halbjährliches / jährliches Herstellerservice', intervall: 'halbjahr' },
]

export const akkuPruefId = (akkuId: string) => `akku:${akkuId}`
