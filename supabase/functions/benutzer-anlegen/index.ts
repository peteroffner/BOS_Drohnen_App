// Supabase Edge Function: Zugang für eine offene Einladung direkt anlegen (ohne E-Mail-Versand).
// Nur Administratoren der Organisation der Einladung. Das Konto wird mit bestätigter E-Mail und
// einem zufälligen Startpasswort angelegt; der Trigger auf auth.users nimmt die Einladung an.
// Beim ersten Login muss das Passwort geändert werden (user_metadata.passwort_aendern).
import { createClient } from 'npm:@supabase/supabase-js@2.49.4'

const ERLAUBT = ['https://peteroffner.github.io', 'http://localhost:5173', 'http://localhost:4173']

function cors(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ERLAUBT.includes(origin) ? origin : ERLAUBT[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function startpasswort(): string {
  // gut abzulesen/diktieren: ohne 0/O/1/l/I
  const zeichen = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const b = crypto.getRandomValues(new Uint8Array(12))
  const s = Array.from(b, (x) => zeichen[x % zeichen.length]).join('')
  return `${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8, 12)}`
}

Deno.serve(async (req) => {
  const h = { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' }
  const antwort = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: h })
  if (req.method === 'OPTIONS') return new Response('ok', { headers: h })
  if (req.method !== 'POST') return antwort(405, { fehler: 'Nur POST' })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  // Aufrufer prüfen
  const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: aufrufer, error: authFehler } = await admin.auth.getUser(jwt)
  if (authFehler || !aufrufer?.user) return antwort(401, { fehler: 'Nicht angemeldet.' })
  const { data: mitglied } = await admin.from('mitglieder').select('org_id, rolle').eq('user_id', aufrufer.user.id).maybeSingle()
  if (!mitglied || mitglied.rolle !== 'admin') return antwort(403, { fehler: 'Nur Administratoren dürfen Zugänge anlegen.' })

  let einladungId = ''
  try {
    einladungId = String((await req.json())?.einladungId ?? '')
  } catch {
    return antwort(400, { fehler: 'Ungültige Anfrage.' })
  }
  const { data: einl } = await admin.from('einladungen').select('id, org_id, email, angenommen_am').eq('id', einladungId).maybeSingle()
  if (!einl || einl.org_id !== mitglied.org_id) return antwort(404, { fehler: 'Einladung nicht gefunden.' })
  if (einl.angenommen_am) return antwort(409, { fehler: 'Diese Einladung wurde bereits angenommen.' })

  const passwort = startpasswort()
  const { data: neu, error } = await admin.auth.admin.createUser({
    email: einl.email,
    password: passwort,
    email_confirm: true,
    user_metadata: { passwort_aendern: true, angelegt_von: aufrufer.user.id },
  })
  if (error || !neu?.user) {
    const schon = /already|registered|exists/i.test(error?.message ?? '')
    return antwort(schon ? 409 : 500, {
      fehler: schon
        ? 'Für diese E-Mail-Adresse gibt es bereits ein Konto. Die Person soll sich mit ihrem Passwort anmelden – die Einladung wird dabei automatisch angenommen.'
        : 'Zugang konnte nicht angelegt werden.',
    })
  }

  // Mitgliedschaft prüfen (Trigger auf auth.users nimmt die Einladung an)
  const { data: m } = await admin.from('mitglieder').select('rolle').eq('user_id', neu.user.id).maybeSingle()
  if (!m) {
    await admin.auth.admin.deleteUser(neu.user.id)
    return antwort(500, { fehler: 'Einladung konnte nicht angenommen werden – Zugang wurde wieder entfernt.' })
  }
  return antwort(200, { email: einl.email, passwort, rolle: m.rolle })
})
