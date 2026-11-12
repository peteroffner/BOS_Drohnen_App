import { useState } from 'react'
import { Button, TextInput } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { AuthRahmen, Meldung } from './AuthRahmen'
import { useAuth } from './kontext'
import { authFehlerText, MIN_PASSWORT_LAENGE, passwortPruefen } from './logik'

/** Nach Klick auf den Link „Passwort zurücksetzen“ (Event PASSWORD_RECOVERY). */
export function PasswortNeuSeite() {
  const { passwortRecoveryBeenden } = useAuth()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [fehler, setFehler] = useState<string>()
  const [laeuft, setLaeuft] = useState(false)
  const [fertig, setFertig] = useState(false)

  const senden = async () => {
    if (!supabase) return
    const pruef = passwortPruefen(pw, pw2)
    if (pruef) return setFehler(pruef)
    setLaeuft(true)
    setFehler(undefined)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setLaeuft(false)
    if (error) setFehler(authFehlerText(error))
    else setFertig(true)
  }

  return (
    <AuthRahmen titel="Neues Passwort" untertitel="Bitte ein neues Passwort für dein Konto vergeben.">
      {fertig ? (
        <>
          <Meldung art="ok">Das Passwort wurde geändert.</Meldung>
          <Button size="lg" onClick={passwortRecoveryBeenden}>
            Weiter zur App
          </Button>
        </>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            void senden()
          }}
        >
          <TextInput
            label="Neues Passwort"
            type="password"
            autoComplete="new-password"
            hint={`mindestens ${MIN_PASSWORT_LAENGE} Zeichen`}
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            required
            autoFocus
          />
          <TextInput label="Passwort wiederholen" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
          {fehler && <Meldung art="fehler">{fehler}</Meldung>}
          <Button type="submit" size="lg" disabled={!pw || !pw2 || laeuft}>
            {laeuft ? 'Wird gespeichert …' : 'Passwort speichern'}
          </Button>
        </form>
      )}
    </AuthRahmen>
  )
}
