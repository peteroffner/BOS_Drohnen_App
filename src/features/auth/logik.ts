/**
 * Reine Logik des Auth-Moduls (ohne React/Supabase) – gut testbar.
 */
import type { Einsatz } from '../../db/types'
import { darf, darfEinsatzBearbeiten, type Rolle } from '../../lib/rechte'

export interface Mitgliedschaft {
  userId: string
  email: string
  orgId: string
  rolle: Rolle
  pilotId: string | null
  anzeigename: string | null
}

/** Zeile der Tabelle `mitglieder` (siehe docs/BACKEND.md) */
export interface MitgliedZeile {
  org_id: string
  user_id: string
  rolle: Rolle
  pilot_id: string | null
  email: string | null
  anzeigename: string | null
  erstellt_am?: string
}

/** Zeile der Tabelle `einladungen` */
export interface EinladungZeile {
  id: string
  org_id: string
  email: string
  rolle: Rolle
  pilot_id: string | null
  erstellt_von: string | null
  erstellt_am: string
  angenommen_am: string | null
}

export function zuMitgliedschaft(z: MitgliedZeile, fallbackEmail = ''): Mitgliedschaft {
  return {
    userId: z.user_id,
    email: z.email ?? fallbackEmail,
    orgId: z.org_id,
    rolle: z.rolle,
    pilotId: z.pilot_id ?? null,
    anzeigename: z.anzeigename ?? null,
  }
}

/** Anzeigename eines Mitglieds: Name, sonst E-Mail-Teil vor dem @ */
export function mitgliedName(m: { anzeigename?: string | null; email?: string | null }): string {
  return m.anzeigename?.trim() || m.email?.split('@')[0] || 'Unbekannt'
}

/**
 * „Eigener“ Einsatz im Sinne der Rechte-Matrix (vgl. RLS in BACKEND.md):
 * selbst angelegt ODER als Pilot im Einsatz/in einem Flug eingetragen.
 */
export function istEigenerEinsatz(
  e: Pick<Einsatz, 'erstelltVon' | 'rollen' | 'fluege'>,
  m: { userId: string; pilotId?: string | null } | null | undefined,
): boolean {
  if (!m) return false
  if (e.erstelltVon && e.erstelltVon === m.userId) return true
  if (!m.pilotId) return false
  if (e.rollen?.pilot?.pilotId === m.pilotId) return true
  return (e.fluege ?? []).some((f) => f.pilotId === m.pilotId)
}

export interface EinsatzRechte {
  /** Daten, Checklisten, Flüge ändern (nur nicht abgeschlossene Einsätze) */
  bearbeiten: boolean
  /** Einsatz löschen (nur nicht abgeschlossene Einsätze) */
  loeschen: boolean
  /** Nachtrag zu einem abgeschlossenen Einsatz */
  nachtrag: boolean
}

/** Rechte an einem konkreten Einsatz. Rolle null = lokaler Modus = alles erlaubt. */
export function einsatzRechte(rolle: Rolle | null | undefined, eigen: boolean, abgeschlossen: boolean): EinsatzRechte {
  const darfAendern = darfEinsatzBearbeiten(rolle, eigen)
  return {
    bearbeiten: !abgeschlossen && darfAendern,
    loeschen: !abgeschlossen && darfAendern,
    nachtrag: abgeschlossen && darf(rolle, 'einsatz.nachtrag') && darfAendern,
  }
}

/** Einfache E-Mail-Prüfung für Formulare */
export const istEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim())

export const MIN_PASSWORT_LAENGE = 8

/** Prüft das Registrierungs-/Neues-Passwort-Formular. Gibt eine Fehlermeldung oder null zurück. */
export function passwortPruefen(pw: string, pw2: string): string | null {
  if (pw.length < MIN_PASSWORT_LAENGE) return `Das Passwort muss mindestens ${MIN_PASSWORT_LAENGE} Zeichen lang sein.`
  if (pw !== pw2) return 'Die beiden Passwörter stimmen nicht überein.'
  return null
}

type FehlerLike = { message?: string; code?: string; status?: number; name?: string } | null | undefined

/** Deutsche Fehlermeldungen für typische Supabase-Auth-Fehler. */
export function authFehlerText(err: unknown): string {
  const e = (err ?? {}) as Exclude<FehlerLike, null | undefined>
  const code = e.code ?? ''
  const msg = (e.message ?? String(err ?? '')).toLowerCase()

  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) return 'E-Mail-Adresse oder Passwort ist falsch.'
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed'))
    return 'Die E-Mail-Adresse ist noch nicht bestätigt. Bitte den Link in der Bestätigungsmail öffnen und danach erneut anmelden.'
  if (code === 'user_already_exists' || code === 'email_exists' || msg.includes('already registered') || msg.includes('already been registered'))
    return 'Für diese E-Mail-Adresse gibt es bereits ein Konto. Bitte anmelden oder „Passwort vergessen“ verwenden.'
  if (code === 'weak_password' || (msg.includes('password') && (msg.includes('at least') || msg.includes('weak') || msg.includes('short'))))
    return `Das Passwort ist zu kurz oder zu schwach (mindestens ${MIN_PASSWORT_LAENGE} Zeichen).`
  if (code === 'same_password' || msg.includes('should be different')) return 'Das neue Passwort muss sich vom bisherigen unterscheiden.'
  if (code.startsWith('over_') || code === 'over_email_send_rate_limit' || msg.includes('rate limit') || e.status === 429)
    return 'Zu viele Versuche. Bitte einige Minuten warten und erneut versuchen.'
  if (code === 'email_address_invalid' || msg.includes('invalid email') || msg.includes('unable to validate email'))
    return 'Die E-Mail-Adresse ist ungültig.'
  if (code === 'signup_disabled' || msg.includes('signups not allowed')) return 'Registrierungen sind derzeit deaktiviert.'
  if (code === 'session_not_found' || code === 'session_expired' || msg.includes('auth session missing'))
    return 'Die Sitzung ist abgelaufen. Bitte den Link erneut anfordern bzw. neu anmelden.'
  if (istNetzwerkFehler(err)) return 'Keine Verbindung zum Server. Bitte Internetverbindung prüfen.'
  return e.message ? `Fehler: ${e.message}` : 'Unbekannter Fehler.'
}

/** Deutsche Fehlermeldungen für Datenbank-/RPC-Fehler (PostgREST). */
export function dbFehlerText(err: unknown): string {
  const e = (err ?? {}) as Exclude<FehlerLike, null | undefined> & { details?: string; hint?: string }
  const msg = `${e.message ?? ''} ${e.details ?? ''}`.toLowerCase()
  if (msg.includes('admin') && (msg.includes('letzt') || msg.includes('last')))
    return 'Der letzte Administrator kann nicht entfernt oder herabgestuft werden. Bitte zuerst eine andere Person zum Administrator machen.'
  if (e.code === '23505') return 'Dieser Eintrag existiert bereits (z. B. offene Einladung für diese E-Mail-Adresse).'
  if (msg.includes('row-level security') || msg.includes('permission denied')) return 'Keine Berechtigung für diese Aktion.'
  // Server-Funktionen melden verständliche deutsche Texte (42501 Berechtigung, 22023 ungültige Eingabe, 23514 Prüfung)
  if (['42501', '22023', '23514', 'P0001'].includes(e.code ?? '') && e.message) return e.message
  if (e.code === '42501') return 'Keine Berechtigung für diese Aktion.'
  if (istNetzwerkFehler(err)) return 'Keine Verbindung zum Server. Bitte Internetverbindung prüfen.'
  return e.message ? `Fehler: ${e.message}` : 'Unbekannter Fehler.'
}

export function istNetzwerkFehler(err: unknown): boolean {
  const e = (err ?? {}) as Exclude<FehlerLike, null | undefined>
  const msg = (e.message ?? '').toLowerCase()
  return e.name === 'AuthRetryableFetchError' || msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed') || msg.includes('fetch failed')
}

/** URL der App (inkl. BASE_URL) – Ziel für Links in Mails (Passwort-Reset, Bestätigung). */
export function appUrl(origin: string, baseUrl: string): string {
  const base = baseUrl.startsWith('/') ? baseUrl : `/${baseUrl}`
  return origin.replace(/\/$/, '') + (base.endsWith('/') ? base : `${base}/`)
}
