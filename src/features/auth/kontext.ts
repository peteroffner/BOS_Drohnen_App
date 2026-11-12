import type { Session } from '@supabase/supabase-js'
import { createContext, useContext } from 'react'
import { CLOUD } from '../../lib/supabase'
import { darf, type Aktion, type Rolle } from '../../lib/rechte'
import type { Einsatz } from '../../db/types'
import { einsatzRechte, istEigenerEinsatz, type EinsatzRechte, type Mitgliedschaft } from './logik'

export interface AuthKontext {
  /** undefined = lädt, null = nicht angemeldet (lokal immer null) */
  session: Session | null | undefined
  /** undefined = lädt, null = keine Mitgliedschaft (lokal immer null) */
  mitgliedschaft: Mitgliedschaft | null | undefined
  /** Fehler beim Laden der Mitgliedschaft (z. B. offline beim ersten Start) */
  fehler?: string
  /** Benutzer kam über den Link „Passwort zurücksetzen“ */
  passwortRecovery: boolean
  passwortRecoveryBeenden: () => void
  /** Mitgliedschaft neu laden (z. B. nach Einladung / Organisation anlegen) */
  neuLaden: () => Promise<void>
}

export const AuthContext = createContext<AuthKontext>({
  session: null,
  mitgliedschaft: null,
  passwortRecovery: false,
  passwortRecoveryBeenden: () => {},
  neuLaden: async () => {},
})

export const useAuth = () => useContext(AuthContext)

/** Supabase-Session (lokaler Modus: null) */
export const useSession = () => useAuth().session

/** Mitgliedschaft des angemeldeten Benutzers (lokaler Modus: null) */
export const useMitgliedschaft = () => useAuth().mitgliedschaft

/** Rolle des Benutzers – lokal null (= alles erlaubt, siehe darf()). */
export function useRolle(): Rolle | null {
  const m = useMitgliedschaft()
  if (!CLOUD) return null
  // Im Cloud-Modus ohne Mitgliedschaft (sollte unter RequireAuth nicht vorkommen) sicherheitshalber nur lesen
  return m?.rolle ?? 'leser'
}

export function useDarf(aktion: Aktion): boolean {
  return darf(useRolle(), aktion)
}

/** Rechte am Einsatz für den aktuellen Benutzer (lokal: alles, soweit nicht abgeschlossen). */
export function useEinsatzRechte(e: Pick<Einsatz, 'erstelltVon' | 'rollen' | 'fluege' | 'status'> | null | undefined): EinsatzRechte {
  const rolle = useRolle()
  const m = useMitgliedschaft()
  if (!e) return { bearbeiten: false, loeschen: false, nachtrag: false }
  return einsatzRechte(rolle, istEigenerEinsatz(e, m), e.status === 'abgeschlossen')
}
