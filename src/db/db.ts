import Dexie, { type EntityTable } from 'dexie'
import type {
  AppEinstellung,
  Einsatz,
  Geraet,
  Mangel,
  Organisation,
  Pilot,
  WartungsPruefung,
} from './types'

/**
 * Lokale Offline-Datenbank (IndexedDB). Schema-Änderungen nur über neue
 * `version(n)`-Blöcke – niemals bestehende Versionen ändern.
 */
export class BosDb extends Dexie {
  organisationen!: EntityTable<Organisation, 'id'>
  piloten!: EntityTable<Pilot, 'id'>
  geraete!: EntityTable<Geraet, 'id'>
  einsaetze!: EntityTable<Einsatz, 'id'>
  wartungen!: EntityTable<WartungsPruefung, 'id'>
  maengel!: EntityTable<Mangel, 'id'>
  einstellungen!: EntityTable<AppEinstellung, 'key'>

  constructor(name = 'bos-drohnen') {
    super(name)
    this.version(1).stores({
      organisationen: 'id',
      piloten: 'id, orgId, nachname, aktiv',
      geraete: 'id, orgId, name, status',
      einsaetze: 'id, orgId, datum, status, art',
      wartungen: 'id, orgId, geraetId, [geraetId+jahr+monat], datum',
      maengel: 'id, orgId, geraetId, einsatzId, behobenAm',
      einstellungen: 'key',
    })
  }
}

export const db = new BosDb()

export const neueId = (): string => crypto.randomUUID()
export const jetzt = (): string => new Date().toISOString()

/** Schlüssel der aktiven Organisation in `einstellungen` */
export const AKTIVE_ORG_KEY = 'aktiveOrgId'
