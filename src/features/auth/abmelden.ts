import { AKTIVE_ORG_KEY, db } from '../../db/db'
import { supabase } from '../../lib/supabase'
import { lokaleDatenLoeschen, stopSync } from '../../sync'
import { mitgliedschaftCacheLeeren } from './cache'

/**
 * Abmelden (Cloud-Modus): Sync beenden, alle lokalen Daten löschen (geteilte Geräte),
 * Supabase-Session beenden. Vorher prüft die UI ausstehende Änderungen.
 */
export async function abmelden(): Promise<void> {
  stopSync()
  await lokaleDatenLoeschen()
  await db.einstellungen.delete(AKTIVE_ORG_KEY)
  mitgliedschaftCacheLeeren()
  if (!supabase) return
  const { error } = await supabase.auth.signOut()
  // offline: Server nicht erreichbar → zumindest lokal abmelden
  if (error) await supabase.auth.signOut({ scope: 'local' })
}
