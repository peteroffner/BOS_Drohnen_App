import { LogOut, RefreshCw } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { AKTIVE_ORG_KEY, db } from '../../db/db'
import { Button } from '../../components/ui'
import { useOrg } from '../../lib/useOrg'
import { startSync, stopSync, syncJetzt, useSyncStatus } from '../../sync'
import { abmelden } from './abmelden'
import { AnmeldenSeite } from './AnmeldenSeite'
import { LadeSeite } from './AuthRahmen'
import { KeinZugangSeite } from './KeinZugangSeite'
import { useAuth } from './kontext'
import type { Mitgliedschaft } from './logik'
import { PasswortNeuSeite } from './PasswortNeuSeite'

/**
 * Cloud-Modus: ersetzt <RequireOrg>. Login → Mitgliedschaft → Organisation
 * aktivieren, Sync starten und auf den ersten Pull warten.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, mitgliedschaft, fehler, passwortRecovery, neuLaden } = useAuth()

  if (session === undefined) return <LadeSeite text="Anmeldung wird geprüft …" />
  if (passwortRecovery && session) return <PasswortNeuSeite />
  if (!session) return <AnmeldenSeite />
  if (mitgliedschaft === undefined)
    return (
      <LadeSeite
        text={fehler ? 'Zugang konnte nicht geprüft werden' : 'Zugang wird geprüft …'}
        fehler={fehler}
        aktionen={
          fehler && (
            <>
              <Button icon={<RefreshCw size={18} />} onClick={() => void neuLaden()}>
                Erneut versuchen
              </Button>
              <Button variant="secondary" icon={<LogOut size={18} />} onClick={() => void abmelden()}>
                Abmelden
              </Button>
            </>
          )
        }
      />
    )
  if (mitgliedschaft === null) return <KeinZugangSeite />
  return <OrgBereit m={mitgliedschaft}>{children}</OrgBereit>
}

function OrgBereit({ m, children }: { m: Mitgliedschaft; children: ReactNode }) {
  const org = useOrg()
  const sync = useSyncStatus()

  useEffect(() => {
    let beendet = false
    void db.einstellungen.put({ key: AKTIVE_ORG_KEY, value: m.orgId }).then(() => {
      if (!beendet) startSync(m.orgId)
    })
    return () => {
      beendet = true
      stopSync()
    }
  }, [m.orgId])

  if (org && org.id === m.orgId) return <>{children}</>

  const offline = !sync.online || !!sync.fehler
  return (
    <LadeSeite
      text={offline ? 'Daten konnten nicht geladen werden' : 'Daten werden geladen …'}
      fehler={
        offline
          ? `${!sync.online ? 'Keine Internetverbindung.' : `Fehler: ${sync.fehler}.`} Beim ersten Start auf diesem Gerät müssen die Daten einmal vom Server geladen werden – bitte Verbindung herstellen.`
          : undefined
      }
      aktionen={
        offline && (
          <>
            <Button icon={<RefreshCw size={18} />} onClick={() => void syncJetzt()}>
              Erneut versuchen
            </Button>
            <Button variant="secondary" icon={<LogOut size={18} />} onClick={() => void abmelden()}>
              Abmelden
            </Button>
          </>
        )
      }
    />
  )
}
