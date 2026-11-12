import type { Session } from '@supabase/supabase-js'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '../../lib/supabase'
import { AuthContext, type AuthKontext } from './kontext'
import { cacheLesen, cacheSchreiben } from './cache'
import { authFehlerText, dbFehlerText, istNetzwerkFehler, zuMitgliedschaft, type MitgliedZeile, type Mitgliedschaft } from './logik'

/**
 * Mitgliedschaft vom Server laden. Vorher eine offene Einladung annehmen
 * (RPC einladung_annehmen; Fehler werden ignoriert).
 */
async function mitgliedschaftLaden(session: Session): Promise<Mitgliedschaft | null> {
  if (!supabase) return null
  try {
    await supabase.rpc('einladung_annehmen')
  } catch {
    /* ignorieren */
  }
  const { data, error } = await supabase
    .from('mitglieder')
    .select('org_id,user_id,rolle,pilot_id,email,anzeigename')
    .eq('user_id', session.user.id)
    .limit(1)
    .maybeSingle<MitgliedZeile>()
  if (error) throw error
  return data ? zuMitgliedschaft(data, session.user.email ?? '') : null
}

/**
 * Stellt Session und Mitgliedschaft bereit. Im lokalen Modus (kein Supabase)
 * liefert der Kontext immer null – damit bleibt alles wie in Phase 1.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null)
  /** Ergebnis des letzten Ladens je Benutzer */
  const [stand, setStand] = useState<{ userId: string; m: Mitgliedschaft | null | undefined; fehler?: string }>()
  const [passwortRecovery, setPasswortRecovery] = useState(false)
  const userId = session?.user.id
  const cache = useMemo(() => (userId ? cacheLesen(userId) : null), [userId])
  const sessionRef = useRef(session)
  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    if (!supabase) return
    let aktiv = true
    void supabase.auth.getSession().then(({ data }) => {
      if (aktiv) setSession((s) => (s === undefined ? data.session : s))
    })
    const { data } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === 'PASSWORD_RECOVERY') setPasswortRecovery(true)
      if (event === 'SIGNED_OUT') setPasswortRecovery(false)
      setSession(s)
    })
    return () => {
      aktiv = false
      data.subscription.unsubscribe()
    }
  }, [])

  const laden = useCallback(async () => {
    const s = sessionRef.current
    if (!s) return
    const uid = s.user.id
    try {
      const m = await mitgliedschaftLaden(s)
      cacheSchreiben(uid, m)
      setStand({ userId: uid, m })
    } catch (err) {
      // Offline-first: zuletzt bekannte Mitgliedschaft weiterverwenden
      const cache = cacheLesen(uid)
      setStand({
        userId: uid,
        m: cache ?? undefined,
        fehler: cache
          ? undefined
          : istNetzwerkFehler(err)
            ? 'Keine Verbindung zum Server. Für die erste Anmeldung auf diesem Gerät ist eine Internetverbindung nötig.'
            : (err as { code?: string }).code && !(err as { status?: number }).status
              ? dbFehlerText(err)
              : authFehlerText(err),
      })
    }
  }, [])

  // Nur bei Benutzerwechsel laden (Token-Refresh liefert neue Session-Objekte mit gleicher userId)
  useEffect(() => {
    if (userId) void laden()
  }, [userId, laden])

  // Abgeleitet: bis zum ersten Laden die zwischengespeicherte Mitgliedschaft (Offline-Start)
  let mitgliedschaft: Mitgliedschaft | null | undefined = null
  let fehler: string | undefined
  if (supabase) {
    if (session === undefined) mitgliedschaft = undefined
    else if (session) {
      if (stand?.userId === session.user.id) {
        mitgliedschaft = stand.m
        fehler = stand.fehler
      } else mitgliedschaft = cache ?? undefined
    }
  }

  const wert = useMemo<AuthKontext>(
    () => ({ session, mitgliedschaft, fehler, passwortRecovery, passwortRecoveryBeenden: () => setPasswortRecovery(false), neuLaden: laden }),
    [session, mitgliedschaft, fehler, passwortRecovery, laden],
  )
  return <AuthContext.Provider value={wert}>{children}</AuthContext.Provider>
}
