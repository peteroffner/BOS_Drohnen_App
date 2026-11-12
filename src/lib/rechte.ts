/**
 * Rollen und Rechte – gemeinsamer Vertrag für UI (Ausblenden/Sperren) und
 * Supabase-RLS (verbindliche Durchsetzung, siehe supabase/migrations).
 * Änderungen hier IMMER auch in den RLS-Policies nachziehen.
 */

export type Rolle = 'admin' | 'teamleiter' | 'pilot' | 'leser'

export const ROLLEN: { value: Rolle; label: string; beschreibung: string }[] = [
  { value: 'admin', label: 'Administrator', beschreibung: 'Alles, inkl. Benutzer, Freigaben und Einstellungen' },
  { value: 'teamleiter', label: 'Drohnen-Teamleiter', beschreibung: 'Alle Einsätze, Piloten-Stammdaten, Geräte, Wartung' },
  { value: 'pilot', label: 'Pilot', beschreibung: 'Einsätze anlegen und eigene Einsätze durchführen, eigene Stammdaten' },
  { value: 'leser', label: 'Nur lesen', beschreibung: 'Einsicht und Auswertung (z. B. Bezirk), keine Änderungen' },
]

export type Aktion =
  | 'einsatz.anlegen'
  | 'einsatz.alle_bearbeiten' // fremde, nicht abgeschlossene Einsätze bearbeiten/löschen
  | 'einsatz.eigene_bearbeiten' // selbst angelegt oder als Pilot eingetragen
  | 'einsatz.nachtrag'
  | 'pilot.verwalten' // Piloten anlegen/bearbeiten/deaktivieren, Qualifikationen
  | 'pilot.eigene_stammdaten' // eigenen Piloten-Datensatz (ohne Freigabe/aktiv)
  | 'freigabe.erteilen'
  | 'geraet.verwalten' // Geräte, Akkus
  | 'wartung.durchfuehren'
  | 'mangel.anlegen'
  | 'mangel.beheben'
  | 'org.einstellungen' // Organisation, Freigaberegeln
  | 'benutzer.verwalten' // Einladungen, Rollen
  | 'daten.wiederherstellen' // Backup einspielen / Demodaten
  | 'export' // PDF/Excel/CSV/Backup herunterladen

const MATRIX: Record<Aktion, Rolle[]> = {
  'einsatz.anlegen': ['admin', 'teamleiter', 'pilot'],
  'einsatz.alle_bearbeiten': ['admin', 'teamleiter'],
  'einsatz.eigene_bearbeiten': ['admin', 'teamleiter', 'pilot'],
  'einsatz.nachtrag': ['admin', 'teamleiter', 'pilot'],
  'pilot.verwalten': ['admin', 'teamleiter'],
  'pilot.eigene_stammdaten': ['admin', 'teamleiter', 'pilot'],
  'freigabe.erteilen': ['admin'],
  'geraet.verwalten': ['admin', 'teamleiter'],
  'wartung.durchfuehren': ['admin', 'teamleiter'],
  'mangel.anlegen': ['admin', 'teamleiter', 'pilot'],
  'mangel.beheben': ['admin', 'teamleiter'],
  'org.einstellungen': ['admin'],
  'benutzer.verwalten': ['admin'],
  'daten.wiederherstellen': ['admin'],
  export: ['admin', 'teamleiter', 'pilot', 'leser'],
}

/** Ohne Rolle (lokaler Modus ohne Backend) ist alles erlaubt. */
export function darf(rolle: Rolle | null | undefined, aktion: Aktion): boolean {
  if (!rolle) return true
  return MATRIX[aktion].includes(rolle)
}

/**
 * Darf der Benutzer diesen (nicht abgeschlossenen) Einsatz bearbeiten?
 * eigen = selbst angelegt (createdBy) ODER als Pilot im Einsatz/in einem Flug eingetragen.
 */
export function darfEinsatzBearbeiten(rolle: Rolle | null | undefined, eigen: boolean): boolean {
  if (!rolle) return true
  return darf(rolle, 'einsatz.alle_bearbeiten') || (eigen && darf(rolle, 'einsatz.eigene_bearbeiten'))
}

export const rollenLabel = (r: Rolle) => ROLLEN.find((x) => x.value === r)?.label ?? r
