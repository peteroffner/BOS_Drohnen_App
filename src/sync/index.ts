/**
 * Öffentliche API der Synchronisation (Vertrag zwischen Sync-Modul und UI).
 * PLATZHALTER – wird vom Sync-Agent implementiert. Signaturen nicht ändern.
 */
export interface SyncStatus {
  online: boolean
  laeuft: boolean
  /** Anzahl lokaler Änderungen, die noch nicht beim Server sind */
  ausstehend: number
  /** ISO-Zeitpunkt des letzten erfolgreichen Syncs */
  letzterSync?: string
  fehler?: string
  /** Änderungen, die der Server abgelehnt hat (keine Berechtigung) */
  abgelehnt: number
}

/** Nach Login: Synchronisation für die Organisation starten (Pull, Push, Realtime, Intervall). */
export function startSync(_orgId: string): void {}

/** Beim Abmelden: alle Timer/Realtime-Kanäle beenden. */
export function stopSync(): void {}

/** Sofort synchronisieren (Push, dann Pull). */
export async function syncJetzt(): Promise<void> {}

export function useSyncStatus(): SyncStatus {
  return { online: true, laeuft: false, ausstehend: 0, abgelehnt: 0 }
}

export async function ausstehendeAenderungen(): Promise<number> {
  return 0
}

/** Löscht alle lokalen Fachdaten, Outbox und Sync-Cursor (z. B. beim Abmelden). */
export async function lokaleDatenLoeschen(): Promise<void> {}

/**
 * Übernimmt lokal vorhandene Phase-1-Daten in die neue Cloud-Organisation:
 * orgId aller Datensätze umschreiben und alles zum Hochladen vormerken.
 */
export async function lokaleDatenUebernehmen(_neueOrgId: string): Promise<void> {}
