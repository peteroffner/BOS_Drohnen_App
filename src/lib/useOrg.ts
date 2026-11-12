import { useLiveQuery } from 'dexie-react-hooks'
import { AKTIVE_ORG_KEY, db } from '../db/db'
import type { FreigabeRegeln, Organisation } from '../db/types'

export const STANDARD_FREIGABE_REGELN: FreigabeRegeln = {
  pflichtQualifikationen: ['A1_A3'],
  mindestFluege: 3,
  zeitraumTage: 90,
  warnungTageVorAblauf: 60,
}

export async function aktiveOrgId(): Promise<string | undefined> {
  const e = await db.einstellungen.get(AKTIVE_ORG_KEY)
  return e?.value as string | undefined
}

/**
 * Aktive Organisation (Feuerwehr).
 * undefined = lädt noch, null = noch keine Organisation angelegt.
 */
export function useOrg(): Organisation | null | undefined {
  return useLiveQuery(async () => {
    const id = await aktiveOrgId()
    if (!id) return null
    return (await db.organisationen.get(id)) ?? null
  }, [])
}

/** Für Komponenten unterhalb von <RequireOrg>: Organisation ist garantiert vorhanden. */
export function useOrgId(): string {
  const org = useOrg()
  return org?.id ?? ''
}
