import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Supabase-Client. Ohne Konfiguration (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
 * läuft die App im lokalen Modus wie in Phase 1 (kein Login, alle Rechte).
 */
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      })
    : null

export const CLOUD = supabase !== null
