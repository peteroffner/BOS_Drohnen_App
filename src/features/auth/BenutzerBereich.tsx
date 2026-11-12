import { LogOut, RefreshCw, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Button, Modal, cx } from '../../components/ui'
import { rollenLabel } from '../../lib/rechte'
import { ausstehendeAenderungen, syncJetzt } from '../../sync'
import { abmelden } from './abmelden'
import { useMitgliedschaft } from './kontext'
import { mitgliedName } from './logik'

/** Name, Rolle und Abmelden – Seitenleiste (dunkel) bzw. Mehr-Menü (hell). Nur Cloud-Modus. */
export function BenutzerBereich({ dunkel }: { dunkel?: boolean }) {
  const m = useMitgliedschaft()
  if (!m) return null
  return (
    <div className={cx('flex items-center gap-2 rounded-md p-2', dunkel ? 'bg-white/5' : 'bg-flaeche')} data-testid="benutzer-bereich">
      <UserRound size={22} className={cx('shrink-0', dunkel ? 'text-gray-400' : 'text-gray-500')} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold" title={m.email}>
          {mitgliedName(m)}
        </div>
        <div className={cx('truncate text-xs', dunkel ? 'text-gray-400' : 'text-gray-600')}>{rollenLabel(m.rolle)}</div>
      </div>
      <AbmeldenButton dunkel={dunkel} />
    </div>
  )
}

export function AbmeldenButton({ dunkel }: { dunkel?: boolean }) {
  const [warnung, setWarnung] = useState<number | null>(null)
  const [laeuft, setLaeuft] = useState(false)

  const ausfuehren = async () => {
    setLaeuft(true)
    try {
      await abmelden()
    } finally {
      setLaeuft(false)
      setWarnung(null)
    }
  }
  const pruefen = async () => {
    const n = await ausstehendeAenderungen()
    if (n > 0) setWarnung(n)
    else await ausfuehren()
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void pruefen()}
        disabled={laeuft}
        aria-label="Abmelden"
        title="Abmelden"
        className={cx('inline-flex min-h-11 min-w-11 items-center justify-center rounded-md', dunkel ? 'text-gray-300 hover:bg-white/10' : 'text-anthrazit hover:bg-white')}
      >
        <LogOut size={20} />
      </button>
      <Modal
        open={warnung !== null}
        onClose={() => setWarnung(null)}
        title="Nicht synchronisierte Änderungen"
        footer={
          <>
            <Button
              variant="secondary"
              icon={<RefreshCw size={18} />}
              disabled={laeuft}
              onClick={async () => {
                await syncJetzt()
                const n = await ausstehendeAenderungen()
                setWarnung(n > 0 ? n : null)
              }}
            >
              Jetzt synchronisieren
            </Button>
            <Button variant="danger" icon={<LogOut size={18} />} disabled={laeuft} onClick={() => void ausfuehren()}>
              Trotzdem abmelden
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3 text-anthrazit">
          <p className="rounded-md border-2 border-fehler bg-fehler-bg p-3 font-semibold text-fehler">
            {warnung === 1 ? 'Eine Änderung wurde' : `${warnung} Änderungen wurden`} noch nicht zum Server übertragen. Beim Abmelden werden alle Daten auf diesem
            Gerät gelöscht – diese Änderungen gingen dann <u>unwiderruflich verloren</u>.
          </p>
          <p className="text-sm">Bitte eine Internetverbindung herstellen und „Jetzt synchronisieren“ wählen. Erst abmelden, wenn alles übertragen ist.</p>
        </div>
      </Modal>
    </>
  )
}
