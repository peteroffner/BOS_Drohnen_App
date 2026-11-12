// Kompakte Sync-Anzeige für Kopfzeile/Seitenleiste (Cloud-Modus)
import { useEffect, useRef, useState } from 'react'
import { CloudAlert, CloudCheck, CloudOff, CloudUpload, RefreshCw, Trash2 } from 'lucide-react'
import { CLOUD } from '../lib/supabase'
import { cx } from '../components/ui'
import { abgelehnteVerwerfen, syncJetzt, useAbgelehnteAenderungen, useSyncStatus, type SyncStatus } from './index'

const TABELLEN_NAME: Record<string, string> = {
  organisationen: 'Organisation',
  piloten: 'Pilot',
  geraete: 'Gerät',
  einsaetze: 'Einsatz',
  wartungen: 'Wartung',
  maengel: 'Mangel',
}

type Zustand = 'offline' | 'fehler' | 'abgelehnt' | 'laeuft' | 'ausstehend' | 'synchron'

function zustandVon(s: SyncStatus): Zustand {
  if (!s.online) return 'offline'
  if (s.fehler) return 'fehler'
  if (s.abgelehnt > 0) return 'abgelehnt'
  if (s.laeuft) return 'laeuft'
  if (s.ausstehend > 0) return 'ausstehend'
  return 'synchron'
}

function beschreibung(s: SyncStatus, z: Zustand): string {
  switch (z) {
    case 'offline':
      return s.ausstehend ? `Offline – ${s.ausstehend} Änderung(en) warten` : 'Offline'
    case 'fehler':
      return 'Synchronisation fehlgeschlagen'
    case 'abgelehnt':
      return `${s.abgelehnt} Änderung(en) abgelehnt`
    case 'laeuft':
      return 'Synchronisiert …'
    case 'ausstehend':
      return `${s.ausstehend} Änderung(en) ausstehend`
    default:
      return 'Synchron'
  }
}

const PUNKT: Record<Zustand, string> = {
  offline: 'bg-gray-400',
  fehler: 'bg-fehler',
  abgelehnt: 'bg-warn',
  laeuft: 'bg-gray-400',
  ausstehend: 'bg-warn',
  synchron: 'bg-ok',
}

function formatZeit(iso?: string): string {
  if (!iso) return 'noch nie'
  const d = new Date(iso)
  return d.toLocaleString('de-AT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function SyncStatusAnzeige({ dunkel }: { dunkel?: boolean }) {
  if (!CLOUD) return null
  return <SyncStatusInhalt dunkel={dunkel} />
}

function SyncStatusInhalt({ dunkel }: { dunkel?: boolean }) {
  const s = useSyncStatus()
  const abgelehnte = useAbgelehnteAenderungen()
  const [offen, setOffen] = useState(false)
  const [links, setLinks] = useState(false)
  const wurzel = useRef<HTMLDivElement>(null)
  const knopf = useRef<HTMLButtonElement>(null)
  const z = zustandVon(s)
  const text = beschreibung(s, z)
  const zahl = z === 'abgelehnt' ? s.abgelehnt : s.ausstehend

  useEffect(() => {
    if (!offen) return
    const klick = (e: PointerEvent) => {
      if (wurzel.current && !wurzel.current.contains(e.target as Node)) setOffen(false)
    }
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffen(false)
    }
    document.addEventListener('pointerdown', klick)
    document.addEventListener('keydown', taste)
    return () => {
      document.removeEventListener('pointerdown', klick)
      document.removeEventListener('keydown', taste)
    }
  }, [offen])

  const umschalten = () => {
    const r = knopf.current?.getBoundingClientRect()
    setLinks(!!r && r.left < 320)
    setOffen((o) => !o)
  }

  const Icon =
    z === 'offline' ? CloudOff : z === 'fehler' || z === 'abgelehnt' ? CloudAlert : z === 'synchron' ? CloudCheck : CloudUpload

  return (
    <div ref={wurzel} className="relative inline-block">
      <button
        ref={knopf}
        type="button"
        onClick={umschalten}
        aria-haspopup="dialog"
        aria-expanded={offen}
        aria-label={`Synchronisation: ${text}`}
        title={text}
        className={cx(
          'relative inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md px-2 transition-colors',
          dunkel ? 'text-white hover:bg-white/10' : 'text-anthrazit hover:bg-flaeche',
        )}
      >
        {z === 'laeuft' ? <RefreshCw className="h-5 w-5 animate-spin" aria-hidden /> : <Icon className="h-6 w-6" aria-hidden />}
        {zahl > 0 && z !== 'synchron' && <span className="text-sm font-semibold tabular-nums">{zahl}</span>}
        <span className={cx('absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-2', PUNKT[z], dunkel ? 'ring-dunkel' : 'ring-white')} />
      </button>

      {offen && (
        <div
          role="dialog"
          aria-label="Synchronisation"
          className={cx(
            'absolute z-[1100] mt-2 w-80 max-w-[calc(100vw-1rem)] rounded-lg border border-linie bg-white p-4 text-left text-anthrazit shadow-lg',
            links ? 'left-0' : 'right-0',
          )}
        >
          <div className="flex items-center gap-2">
            <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', PUNKT[z])} />
            <p className="font-bold text-dunkel">{text}</p>
          </div>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            <dt className="text-gray-600">Verbindung</dt>
            <dd>{s.online ? 'online' : 'offline'}</dd>
            <dt className="text-gray-600">Ausstehend</dt>
            <dd className="tabular-nums">{s.ausstehend}</dd>
            <dt className="text-gray-600">Letzter Sync</dt>
            <dd>{formatZeit(s.letzterSync)}</dd>
          </dl>
          {s.fehler && <p className="mt-2 rounded-md bg-fehler-bg px-3 py-2 text-sm text-fehler">{s.fehler}</p>}
          {!s.online && (
            <p className="mt-2 text-sm text-gray-600">Änderungen werden lokal gespeichert und übertragen, sobald wieder eine Verbindung besteht.</p>
          )}

          <button
            type="button"
            disabled={!s.online || s.laeuft}
            onClick={() => void syncJetzt()}
            className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-rot-700 px-4 font-semibold text-white hover:bg-rot-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            <RefreshCw className={cx('h-4 w-4', s.laeuft && 'animate-spin')} aria-hidden />
            Jetzt synchronisieren
          </button>

          {abgelehnte.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-bold text-dunkel">Abgelehnte Änderungen</h3>
              <p className="text-xs text-gray-600">Der Server hat diese Änderungen nicht übernommen; es gilt wieder der Stand am Server.</p>
              <ul className="mt-2 max-h-60 space-y-2 overflow-auto">
                {abgelehnte.map((e) => (
                  <li key={e.seq} className="flex items-start gap-2 rounded-md border border-linie bg-flaeche p-2">
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="font-semibold">
                        {TABELLEN_NAME[e.tabelle] ?? e.tabelle} {e.op === 'delete' ? '(Löschen)' : '(Änderung)'}
                      </p>
                      <p className="break-words text-xs text-fehler">{e.fehler ?? 'abgelehnt'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void abgelehnteVerwerfen(e.seq!)}
                      className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-md px-2 text-sm font-semibold text-rot-700 hover:bg-rot-50"
                      aria-label="Abgelehnte Änderung verwerfen"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                      verwerfen
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
