import { describe, expect, it } from 'vitest'
import { APP_LINK, einladungPruefen, einladungsText } from './logik'

describe('einladungPruefen', () => {
  const mitglieder = [{ email: 'Admin@FF.at' }]
  const offen = [{ email: 'pilot@ff.at' }]
  it('ungültige E-Mail', () => expect(einladungPruefen('kein-mail', mitglieder, offen)).toMatch(/gültige/))
  it('schon Mitglied (Groß/Klein egal)', () => expect(einladungPruefen(' admin@ff.AT ', mitglieder, offen)).toMatch(/bereits Mitglied/))
  it('schon eingeladen', () => expect(einladungPruefen('PILOT@ff.at', mitglieder, offen)).toMatch(/offene Einladung/))
  it('ok', () => expect(einladungPruefen('neu@ff.at', mitglieder, offen)).toBeNull())
})

it('Einladungstext enthält App-Link und Organisation', () => {
  const t = einladungsText('FF Musterdorf')
  expect(t).toContain(APP_LINK)
  expect(t).toContain('FF Musterdorf')
  expect(t).toContain('Registrieren')
})

describe('Zugangstext', () => {
  it('enthält App-Link, E-Mail und Startpasswort und weist auf „Anmelden“ hin', async () => {
    const { zugangsText } = await import('./logik')
    const t = zugangsText('FF Musterdorf', 'a@b.at', 'abcd-efgh-jkmn')
    expect(t).toContain(APP_LINK)
    expect(t).toContain('a@b.at')
    expect(t).toContain('abcd-efgh-jkmn')
    expect(t).toMatch(/Anmelden/)
  })
})
