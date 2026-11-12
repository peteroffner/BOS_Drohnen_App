import { ArrowLeft, CheckCircle2, ClipboardPen, CornerDownRight, TriangleAlert } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { db, jetzt, neueId } from '../../db/db'
import type { NotfallSzenario } from '../../db/types'
import { cx } from '../../components/ui'
import { fmtZeit } from '../../lib/format'
import { NOTFALL_V2 } from '../../templates/notfall_v2'
import { aendereEinsatz } from '../einsatz/data'
import { notfallAnker, notfallEreignis } from './notfall'

/** Notfall-Checkliste v2 – groß und kontraststark für Stresssituationen */
export function NotfallPage() {
  const [params] = useSearchParams()
  const einsatzId = params.get('einsatz') ?? ''
  const einsatz = useLiveQuery(async () => (einsatzId ? ((await db.einsaetze.get(einsatzId)) ?? null) : null), [einsatzId])
  const [protokolliert, setProtokolliert] = useState<Record<number, string>>({})
  const [markiert, setMarkiert] = useState<number>()
  const kannProtokollieren = !!einsatz && einsatz.status !== 'abgeschlossen'

  const springe = (nr: number) => {
    document.getElementById(notfallAnker(nr))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setMarkiert(nr)
    window.setTimeout(() => setMarkiert((m) => (m === nr ? undefined : m)), 2500)
  }

  const protokolliere = async (s: NotfallSzenario) => {
    if (!einsatz) return
    const zeit = jetzt()
    await aendereEinsatz(einsatz.id, (e) => {
      e.ereignisse.push(notfallEreignis(s, neueId(), zeit))
    })
    setProtokolliert((p) => ({ ...p, [s.nr]: zeit }))
  }

  const zurueck = einsatz ? `/einsaetze/${einsatz.id}?schritt=5` : undefined

  return (
    <div className="flex flex-col gap-4">
      <header className="rounded-lg bg-rot-700 p-4 text-white">
        <div className="flex items-center gap-3">
          <TriangleAlert size={36} strokeWidth={2.5} className="shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold sm:text-3xl">NOTFALL-Checkliste</h1>
            <p className="text-sm text-rot-100">Notfall-Checkliste Drohnenflug v2 · Ruhe bewahren – Personen warnen – Flughelfer informieren</p>
          </div>
        </div>
        {einsatz && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-rot-500 pt-3">
            <Link to={zurueck!} className="inline-flex min-h-11 items-center gap-2 rounded-md bg-white px-4 font-bold text-rot-700 hover:bg-rot-50">
              <ArrowLeft size={20} /> Zurück zum Einsatz
            </Link>
            <span className="text-sm">
              {einsatz.fluggebiet || einsatz.grund || 'Einsatz'}
              {!kannProtokollieren && ' (abgeschlossen – Protokollieren nicht möglich)'}
            </span>
          </div>
        )}
      </header>

      <nav aria-label="Szenarien" className="grid grid-cols-5 gap-2">
        {NOTFALL_V2.map((s) => (
          <button
            key={s.nr}
            type="button"
            title={s.vorfall}
            onClick={() => springe(s.nr)}
            className="min-h-12 rounded-md border-2 border-dunkel bg-white text-xl font-bold text-dunkel hover:bg-flaeche"
          >
            {s.nr}
          </button>
        ))}
      </nav>

      <ol className="flex flex-col gap-4">
        {NOTFALL_V2.map((s) => (
          <li
            key={s.nr}
            id={notfallAnker(s.nr)}
            className={cx('scroll-mt-20 overflow-hidden rounded-lg border-2 bg-white transition-shadow', markiert === s.nr ? 'border-rot-700 ring-4 ring-rot-200' : 'border-dunkel')}
          >
            <div className="flex items-start gap-3 bg-dunkel p-4 text-white">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-rot-700 text-2xl font-bold">{s.nr}</span>
              <div className="min-w-0">
                <h2 className="break-words text-xl font-bold leading-tight sm:text-2xl">{s.vorfall}</h2>
                {s.beschreibung && <p className="mt-1 text-base text-gray-300">{s.beschreibung}</p>}
              </div>
            </div>
            <ul className="divide-y-2 divide-linie">
              {s.reaktionen.map((r, i) => (
                <li key={i} className="grid gap-1 p-4 sm:grid-cols-2 sm:gap-4">
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-gray-600">Verhalten Drohne</div>
                    <div className="text-lg font-semibold text-dunkel">{r.verhalten}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-rot-700">Maßnahme</div>
                    <div className="text-lg font-bold text-dunkel">{r.massnahme}</div>
                    {r.siehe && (
                      <button
                        type="button"
                        onClick={() => springe(r.siehe!)}
                        className="mt-2 inline-flex min-h-11 items-center gap-2 rounded-md border-2 border-rot-700 px-3 font-bold text-rot-700 hover:bg-rot-50"
                      >
                        <CornerDownRight size={18} /> siehe Nr. {r.siehe}: {NOTFALL_V2.find((x) => x.nr === r.siehe)?.vorfall}
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {kannProtokollieren && (
              <div className="border-t-2 border-linie bg-flaeche p-3">
                {protokolliert[s.nr] ? (
                  <div role="status" className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-2 font-bold text-ok">
                      <CheckCircle2 size={22} /> Um {fmtZeit(protokolliert[s.nr])} im Ereignis-Log protokolliert
                    </span>
                    <Link to={zurueck!} className="font-semibold text-rot-700 underline">
                      Zurück zum Einsatz
                    </Link>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => void protokolliere(s)}
                    className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-rot-700 px-4 text-lg font-bold text-white hover:bg-rot-800 sm:w-auto"
                  >
                    <ClipboardPen size={22} /> Vorfall protokollieren
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
