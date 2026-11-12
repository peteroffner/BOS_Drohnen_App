import { describe, expect, it } from 'vitest'
import { appUrl, authFehlerText, dbFehlerText, einsatzRechte, istEigenerEinsatz, mitgliedName, passwortPruefen, zuMitgliedschaft } from './logik'

const einsatz = (p: { erstelltVon?: string; pilot?: string; flugPiloten?: string[] } = {}) => ({
  erstelltVon: p.erstelltVon,
  rollen: p.pilot ? { pilot: { pilotId: p.pilot, name: 'X' } } : {},
  fluege: (p.flugPiloten ?? []).map((pilotId, i) => ({ id: String(i), nr: i + 1, pilotId, geraetId: 'g', start: '', zwischencheck: false })),
})

describe('istEigenerEinsatz', () => {
  const ich = { userId: 'u1', pilotId: 'p1' }
  it('selbst angelegt', () => expect(istEigenerEinsatz(einsatz({ erstelltVon: 'u1' }), ich)).toBe(true))
  it('als Pilot im Einsatz eingetragen', () => expect(istEigenerEinsatz(einsatz({ pilot: 'p1' }), ich)).toBe(true))
  it('als Pilot in einem Flug', () => expect(istEigenerEinsatz(einsatz({ flugPiloten: ['p2', 'p1'] }), ich)).toBe(true))
  it('fremd', () => expect(istEigenerEinsatz(einsatz({ erstelltVon: 'u2', pilot: 'p2', flugPiloten: ['p3'] }), ich)).toBe(false))
  it('ohne verknüpften Piloten zählt nur der Anleger', () => {
    expect(istEigenerEinsatz(einsatz({ pilot: 'p1' }), { userId: 'u1', pilotId: null })).toBe(false)
    expect(istEigenerEinsatz(einsatz({ erstelltVon: 'u1' }), { userId: 'u1', pilotId: null })).toBe(true)
  })
  it('ohne Mitgliedschaft nie eigen', () => expect(istEigenerEinsatz(einsatz({ erstelltVon: 'u1' }), null)).toBe(false))
})

describe('einsatzRechte', () => {
  it('lokal (keine Rolle): alles außer Bearbeiten abgeschlossener Einsätze', () => {
    expect(einsatzRechte(null, false, false)).toEqual({ bearbeiten: true, loeschen: true, nachtrag: false })
    expect(einsatzRechte(null, false, true)).toEqual({ bearbeiten: false, loeschen: false, nachtrag: true })
  })
  it('Teamleiter darf fremde Einsätze', () => {
    expect(einsatzRechte('teamleiter', false, false).bearbeiten).toBe(true)
    expect(einsatzRechte('teamleiter', false, true).nachtrag).toBe(true)
  })
  it('Pilot nur eigene', () => {
    expect(einsatzRechte('pilot', false, false)).toEqual({ bearbeiten: false, loeschen: false, nachtrag: false })
    expect(einsatzRechte('pilot', true, false)).toEqual({ bearbeiten: true, loeschen: true, nachtrag: false })
    expect(einsatzRechte('pilot', true, true).nachtrag).toBe(true)
    expect(einsatzRechte('pilot', false, true).nachtrag).toBe(false)
  })
  it('Leser nie', () => {
    expect(einsatzRechte('leser', true, false)).toEqual({ bearbeiten: false, loeschen: false, nachtrag: false })
    expect(einsatzRechte('leser', true, true).nachtrag).toBe(false)
  })
})

describe('authFehlerText', () => {
  it('falsches Passwort', () => {
    expect(authFehlerText({ code: 'invalid_credentials', message: 'Invalid login credentials', status: 400 })).toMatch(/Passwort ist falsch/)
    expect(authFehlerText({ message: 'Invalid login credentials' })).toMatch(/Passwort ist falsch/)
  })
  it('E-Mail nicht bestätigt', () => expect(authFehlerText({ code: 'email_not_confirmed', message: 'Email not confirmed' })).toMatch(/nicht bestätigt/))
  it('schon registriert', () => {
    expect(authFehlerText({ code: 'user_already_exists' })).toMatch(/bereits ein Konto/)
    expect(authFehlerText({ message: 'User already registered' })).toMatch(/bereits ein Konto/)
  })
  it('Passwort zu kurz', () => {
    expect(authFehlerText({ code: 'weak_password', message: 'Password should be at least 6 characters.' })).toMatch(/zu kurz/)
    expect(authFehlerText({ message: 'Password should be at least 6 characters.' })).toMatch(/zu kurz/)
  })
  it('Netzwerk', () => {
    expect(authFehlerText({ name: 'AuthRetryableFetchError', message: 'Failed to fetch' })).toMatch(/Keine Verbindung/)
    expect(authFehlerText(new TypeError('Failed to fetch'))).toMatch(/Keine Verbindung/)
  })
  it('Rate-Limit', () => expect(authFehlerText({ code: 'over_email_send_rate_limit', status: 429 })).toMatch(/Zu viele/))
  it('Unbekannt: Originaltext', () => expect(authFehlerText({ message: 'Irgendwas' })).toBe('Fehler: Irgendwas'))
})

describe('dbFehlerText', () => {
  it('letzter Admin', () => expect(dbFehlerText({ code: 'P0001', message: 'Der letzte Administrator kann nicht entfernt werden' })).toMatch(/letzte Administrator/))
  it('last admin (englisch)', () => expect(dbFehlerText({ message: 'cannot remove last admin' })).toMatch(/letzte Administrator/))
  it('RLS', () => expect(dbFehlerText({ code: '42501', message: 'new row violates row-level security policy' })).toMatch(/Keine Berechtigung/))
  it('Servertext bei 42501/22023 wird übernommen', () => {
    expect(dbFehlerText({ code: '22023', message: 'Unbekannter Organisationstyp: X' })).toBe('Unbekannter Organisationstyp: X')
    expect(dbFehlerText({ code: '42501', message: 'Nur Administratoren dürfen Rollen ändern' })).toBe('Nur Administratoren dürfen Rollen ändern')
  })
  it('doppelt', () => expect(dbFehlerText({ code: '23505', message: 'duplicate key' })).toMatch(/existiert bereits/))
})

describe('Hilfsfunktionen', () => {
  it('passwortPruefen', () => {
    expect(passwortPruefen('kurz', 'kurz')).toMatch(/mindestens 8/)
    expect(passwortPruefen('langesPasswort', 'anderes1234')).toMatch(/stimmen nicht/)
    expect(passwortPruefen('langesPasswort', 'langesPasswort')).toBeNull()
  })
  it('appUrl mit BASE_URL', () => {
    expect(appUrl('https://peteroffner.github.io', '/BOS_Drohnen_App/')).toBe('https://peteroffner.github.io/BOS_Drohnen_App/')
    expect(appUrl('http://localhost:5173/', '/')).toBe('http://localhost:5173/')
    expect(appUrl('http://x', 'app')).toBe('http://x/app/')
  })
  it('mitgliedName', () => {
    expect(mitgliedName({ anzeigename: ' Max ', email: 'm@x.at' })).toBe('Max')
    expect(mitgliedName({ anzeigename: null, email: 'max.muster@ff.at' })).toBe('max.muster')
  })
  it('zuMitgliedschaft', () => {
    expect(zuMitgliedschaft({ org_id: 'o', user_id: 'u', rolle: 'pilot', pilot_id: null, email: null, anzeigename: 'A' }, 'f@x.at')).toEqual({
      userId: 'u',
      email: 'f@x.at',
      orgId: 'o',
      rolle: 'pilot',
      pilotId: null,
      anzeigename: 'A',
    })
  })
})
