import { istEmail, type EinladungZeile, type MitgliedZeile } from '../auth/logik'

/** Öffentliche Adresse der App (GitHub Pages) */
export const APP_LINK = 'https://peteroffner.github.io/BOS_Drohnen_App/'

/** Prüft eine neue Einladung. Gibt eine Fehlermeldung oder null zurück. */
export function einladungPruefen(email: string, mitglieder: Pick<MitgliedZeile, 'email'>[], offen: Pick<EinladungZeile, 'email'>[]): string | null {
  const e = email.trim().toLowerCase()
  if (!istEmail(e)) return 'Bitte eine gültige E-Mail-Adresse eingeben.'
  if (mitglieder.some((m) => m.email?.toLowerCase() === e)) return 'Diese Person ist bereits Mitglied der Organisation.'
  if (offen.some((x) => x.email.toLowerCase() === e)) return 'Für diese E-Mail-Adresse gibt es bereits eine offene Einladung.'
  return null
}

/** Text zum Weitergeben an die eingeladene Person */
export function einladungsText(orgName: string): string {
  return [
    `Du wurdest zur Drohnen-Einsatzdokumentation von ${orgName} eingeladen.`,
    '',
    `1. App öffnen: ${APP_LINK}`,
    '2. „Registrieren“ wählen – mit genau dieser E-Mail-Adresse.',
    '3. Bestätigungsmail öffnen, danach anmelden.',
  ].join('\n')
}
