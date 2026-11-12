import { BookOpen, ClipboardList, Cog, Gauge, Home, Map, Plane, TriangleAlert, UserCog, Users } from 'lucide-react'
import { Suspense, type ReactNode } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { BenutzerBereich } from '../features/auth/BenutzerBereich'
import { useRolle } from '../features/auth/kontext'
import { darf, type Aktion } from '../lib/rechte'
import { CLOUD } from '../lib/supabase'
import { useOrg } from '../lib/useOrg'
import { SyncStatusAnzeige } from '../sync/SyncStatusAnzeige'
import { cx } from './ui'

type NavEintrag = { to: string; label: string; icon: ReactNode; mobile?: boolean; nurCloud?: boolean; recht?: Aktion }

const NAV: NavEintrag[] = [
  { to: '/', label: 'Start', icon: <Home size={22} />, mobile: true },
  { to: '/einsaetze', label: 'Einsätze', icon: <ClipboardList size={22} />, mobile: true },
  { to: '/flugbuch', label: 'Flugbuch', icon: <BookOpen size={22} />, mobile: true },
  { to: '/piloten', label: 'Piloten', icon: <Users size={22} />, mobile: true },
  { to: '/geraete', label: 'Geräte', icon: <Plane size={22} /> },
  { to: '/karte', label: 'Karte', icon: <Map size={22} /> },
  { to: '/auswertung', label: 'Auswertung', icon: <Gauge size={22} /> },
  { to: '/einstellungen', label: 'Einstellungen', icon: <Cog size={22} /> },
  { to: '/benutzer', label: 'Benutzer', icon: <UserCog size={22} />, nurCloud: true, recht: 'benutzer.verwalten' },
]

/** Navigation je nach Modus und Rolle */
function useNav(): NavEintrag[] {
  const rolle = useRolle()
  return NAV.filter((n) => (!n.nurCloud || CLOUD) && (!n.recht || darf(rolle, n.recht)))
}

export function NotfallButton({ className }: { className?: string }) {
  const nav = useNavigate()
  const loc = useLocation()
  // Läuft gerade ein Einsatz (Detailseite), wird er an die Notfallseite übergeben
  const m = loc.pathname.match(/^\/einsaetze\/([^/]+)$/)
  const einsatz = m && m[1] !== 'neu' ? `?einsatz=${m[1]}` : ''
  return (
    <button
      type="button"
      onClick={() => nav(`/notfall${einsatz}`)}
      className={cx(
        'inline-flex min-h-11 items-center gap-2 rounded-md bg-white px-3 font-bold text-rot-700 ring-2 ring-white hover:bg-rot-50',
        className,
      )}
    >
      <TriangleAlert size={20} /> NOTFALL
    </button>
  )
}

export function Layout() {
  const org = useOrg()
  const nav = useNav()
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      {/* Seitenleiste (Tablet/Desktop) */}
      <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto bg-dunkel text-white md:flex">
        <div className="border-b-4 border-rot-700 px-4 py-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">BOS Drohnen</div>
          <div className="truncate text-lg font-bold">{org?.name}</div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-2">
          {nav.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) =>
                cx('flex min-h-11 items-center gap-3 rounded-md px-3 font-semibold', isActive ? 'bg-rot-700 text-white' : 'text-gray-300 hover:bg-white/10')
              }
            >
              {n.icon}
              {n.label}
            </NavLink>
          ))}
        </nav>
        {CLOUD && (
          <div className="flex flex-col gap-2 border-t border-white/10 p-2">
            <SyncStatusAnzeige dunkel />
            <BenutzerBereich dunkel />
          </div>
        )}
        <div className="p-3">
          <NotfallButton className="w-full justify-center" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Kopfzeile (Smartphone) */}
        <header className="no-print sticky top-0 z-[500] flex items-center justify-between gap-2 border-b-4 border-rot-800 bg-rot-700 px-4 py-2 text-white md:hidden">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-widest text-rot-100">BOS Drohnen</div>
            <div className="truncate font-bold">{org?.name}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {CLOUD && <SyncStatusAnzeige dunkel />}
            <NotfallButton />
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pb-24 pt-4 md:px-6 md:pb-8 md:pt-6">
          <Suspense fallback={null}>
            <Outlet />
          </Suspense>
        </main>

        {/* Navigation unten (Smartphone) */}
        <nav className="no-print fixed inset-x-0 bottom-0 z-[500] grid grid-cols-5 border-t border-linie bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
          {nav.filter((n) => n.mobile).map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.to === '/'}
              className={({ isActive }) => cx('flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold', isActive ? 'text-rot-700' : 'text-gray-500')}
            >
              {n.icon}
              {n.label}
            </NavLink>
          ))}
          <MehrMenu nav={nav.filter((n) => !n.mobile)} />
        </nav>
      </div>
    </div>
  )
}

function MehrMenu({ nav }: { nav: NavEintrag[] }) {
  return (
    <details className="relative">
      <summary className="flex min-h-14 cursor-pointer list-none flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-gray-500">
        <Cog size={22} />
        Mehr
      </summary>
      <div className="absolute bottom-16 right-2 w-64 rounded-lg border border-linie bg-white p-1 shadow-lg">
        {nav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            onClick={(e) => (e.currentTarget.closest('details') as HTMLDetailsElement | null)?.removeAttribute('open')}
            className="flex min-h-11 items-center gap-3 rounded-md px-3 font-semibold hover:bg-flaeche"
          >
            {n.icon}
            {n.label}
          </NavLink>
        ))}
        {CLOUD && (
          <div className="mt-1 border-t border-linie pt-1">
            <BenutzerBereich />
          </div>
        )}
      </div>
    </details>
  )
}
