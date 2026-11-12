import { useState } from 'react'
import { Button, TextInput } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { AuthRahmen, Meldung } from './AuthRahmen'
import { appUrl, authFehlerText, istEmail, MIN_PASSWORT_LAENGE, passwortPruefen } from './logik'

type Modus = 'anmelden' | 'registrieren' | 'vergessen'

const redirect = () => appUrl(window.location.origin, import.meta.env.BASE_URL)

/** Anmelden, Registrieren und Passwort vergessen (Cloud-Modus). */
export function AnmeldenSeite() {
  const [modus, setModus] = useState<Modus>('anmelden')
  const [email, setEmail] = useState('')
  return (
    <>
      {modus === 'anmelden' && <Anmelden email={email} setEmail={setEmail} wechsel={setModus} />}
      {modus === 'registrieren' && <Registrieren email={email} setEmail={setEmail} wechsel={setModus} />}
      {modus === 'vergessen' && <Vergessen email={email} setEmail={setEmail} wechsel={setModus} />}
    </>
  )
}

type Props = { email: string; setEmail: (v: string) => void; wechsel: (m: Modus) => void }

function Link({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button type="button" className="min-h-11 font-semibold text-rot-700 underline-offset-2 hover:underline" onClick={onClick}>
      {children}
    </button>
  )
}

function Anmelden({ email, setEmail, wechsel }: Props) {
  const [pw, setPw] = useState('')
  const [fehler, setFehler] = useState<string>()
  const [laeuft, setLaeuft] = useState(false)
  const ok = istEmail(email) && pw.length > 0

  const senden = async () => {
    if (!supabase || !ok) return
    setLaeuft(true)
    setFehler(undefined)
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw })
    setLaeuft(false)
    if (error) setFehler(authFehlerText(error))
  }

  return (
    <AuthRahmen titel="Anmelden" untertitel="Einsatzdokumentation für Drohnenflüge – Flugbuch, Checklisten, Piloten und Geräte.">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void senden()
        }}
      >
        <TextInput label="E-Mail-Adresse" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <TextInput label="Passwort" type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} required />
        {fehler && <Meldung art="fehler">{fehler}</Meldung>}
        <Button type="submit" size="lg" disabled={!ok || laeuft}>
          {laeuft ? 'Anmeldung läuft …' : 'Anmelden'}
        </Button>
      </form>
      <div className="flex flex-wrap justify-between gap-2 border-t border-linie pt-2 text-sm">
        <Link onClick={() => wechsel('vergessen')}>Passwort vergessen?</Link>
        <Link onClick={() => wechsel('registrieren')}>Neu hier? Registrieren</Link>
      </div>
    </AuthRahmen>
  )
}

function Registrieren({ email, setEmail, wechsel }: Props) {
  const [name, setName] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [fehler, setFehler] = useState<string>()
  const [laeuft, setLaeuft] = useState(false)
  const [fertig, setFertig] = useState(false)
  const ok = istEmail(email) && name.trim() && pw && pw2

  const senden = async () => {
    if (!supabase || !ok) return
    const pruef = passwortPruefen(pw, pw2)
    if (pruef) return setFehler(pruef)
    setLaeuft(true)
    setFehler(undefined)
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: pw,
      options: { data: { anzeigename: name.trim(), name: name.trim() }, emailRedirectTo: redirect() },
    })
    setLaeuft(false)
    if (error) return setFehler(authFehlerText(error))
    // Supabase verschleiert bestehende Konten: Benutzer ohne Identitäten = schon registriert
    if (data.user && data.user.identities?.length === 0) return setFehler(authFehlerText({ code: 'user_already_exists' }))
    // Mit Session (E-Mail-Bestätigung deaktiviert) geht es direkt weiter
    if (!data.session) setFertig(true)
  }

  if (fertig)
    return (
      <AuthRahmen titel="Fast geschafft">
        <Meldung art="ok">
          Wir haben eine Bestätigungsmail an <b>{email.trim()}</b> gesendet. Bitte den Link in der Mail öffnen und danach hier anmelden.
        </Meldung>
        <p className="text-sm text-gray-600">Keine Mail erhalten? Bitte auch den Spam-Ordner prüfen.</p>
        <Button size="lg" onClick={() => wechsel('anmelden')}>
          Zur Anmeldung
        </Button>
      </AuthRahmen>
    )

  return (
    <AuthRahmen titel="Registrieren" untertitel="Konto für die Einsatzdokumentation anlegen">
      <Meldung art="hinweis">
        Die Registrierung ist nur mit der E-Mail-Adresse sinnvoll, an die der Administrator deiner Organisation eine Einladung geschickt hat. Nach der Registrierung
        erhältst du eine Bestätigungsmail.
      </Meldung>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void senden()
        }}
      >
        <TextInput label="Name (wird anderen angezeigt)" autoComplete="name" placeholder="z. B. OBI Max Muster" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <TextInput label="E-Mail-Adresse (wie in der Einladung)" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <TextInput
          label="Passwort"
          type="password"
          autoComplete="new-password"
          hint={`mindestens ${MIN_PASSWORT_LAENGE} Zeichen`}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          required
        />
        <TextInput label="Passwort wiederholen" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
        {fehler && <Meldung art="fehler">{fehler}</Meldung>}
        <Button type="submit" size="lg" disabled={!ok || laeuft}>
          {laeuft ? 'Wird registriert …' : 'Registrieren'}
        </Button>
      </form>
      <div className="border-t border-linie pt-2 text-sm">
        <Link onClick={() => wechsel('anmelden')}>Bereits registriert? Anmelden</Link>
      </div>
    </AuthRahmen>
  )
}

function Vergessen({ email, setEmail, wechsel }: Props) {
  const [fehler, setFehler] = useState<string>()
  const [laeuft, setLaeuft] = useState(false)
  const [gesendet, setGesendet] = useState(false)

  const senden = async () => {
    if (!supabase || !istEmail(email)) return
    setLaeuft(true)
    setFehler(undefined)
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect() })
    setLaeuft(false)
    if (error) setFehler(authFehlerText(error))
    else setGesendet(true)
  }

  return (
    <AuthRahmen titel="Passwort vergessen" untertitel="Link zum Zurücksetzen per E-Mail anfordern">
      {gesendet ? (
        <Meldung art="ok">
          Falls ein Konto mit <b>{email.trim()}</b> existiert, wurde eine E-Mail mit einem Link zum Zurücksetzen gesendet. Den Link auf diesem Gerät öffnen und ein
          neues Passwort vergeben.
        </Meldung>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void senden()
          }}
        >
          <TextInput label="E-Mail-Adresse" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          {fehler && <Meldung art="fehler">{fehler}</Meldung>}
          <Button type="submit" size="lg" disabled={!istEmail(email) || laeuft}>
            {laeuft ? 'Wird gesendet …' : 'Link senden'}
          </Button>
        </form>
      )}
      <div className="border-t border-linie pt-2 text-sm">
        <Link onClick={() => wechsel('anmelden')}>Zurück zur Anmeldung</Link>
      </div>
    </AuthRahmen>
  )
}
