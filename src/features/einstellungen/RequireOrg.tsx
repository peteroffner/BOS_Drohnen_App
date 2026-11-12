import type { ReactNode } from 'react'
import { useOrg } from '../../lib/useOrg'
import { OrgSetup } from './OrgSetup'

/** Zeigt beim ersten Start die Einrichtung der Organisation (Feuerwehr). */
export function RequireOrg({ children }: { children: ReactNode }) {
  const org = useOrg()
  if (org === undefined) return null
  if (org === null) return <OrgSetup />
  return <>{children}</>
}
