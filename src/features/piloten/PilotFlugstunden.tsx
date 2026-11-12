import { useState } from 'react'
import { Link } from 'react-router-dom'
import { db } from '../../db/db'
import type { Einsatz, Geraet, Pilot } from '../../db/types'
import { Badge, Button, Card, Stat, TextInput } from '../../components/ui'
import { formatStunden } from '../../lib/calc'
import { fmtDatum, fmtZeit } from '../../lib/format'
import { pilotStatistik } from '../../lib/stats'
import { fluegeVonPilot, teileMinuten, zuMinuten } from './logic'

const ART_LABEL = { einsatz: 'Einsatz', training: 'Training', checkflug: 'Checkflug' } as const

export function PilotFlugstunden({ pilot, einsaetze, geraete, regelZeitraumTage }: { pilot: Pilot; einsaetze: Einsatz[]; geraete: Geraet[]; regelZeitraumTage: number }) {
  const s = pilotStatistik(pilot, einsaetze, regelZeitraumTage)
  const fluege = fluegeVonPilot(pilot.id, einsaetze)
  const geraetName = (id: string) => geraete.find((g) => g.id === id)?.name ?? 'unbekanntes Gerät'
  const vorMin = pilot.vorerfassteMinuten ?? 0
  const vorFl = pilot.vorerfassteFluege ?? 0
  const sum = (x: { fluege: number; minuten: number }) => `${x.fluege} ${x.fluege === 1 ? 'Flug' : 'Flüge'}`
  const jeGeraet = Object.entries(s.jeGeraet).sort((a, b) => b[1].minuten - a[1].minuten)

  return (
    <Card title="Flugstunden (automatisch aus dem Flugbuch)">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Gesamt" value={formatStunden(s.gesamt.minuten)} sub={`${sum(s.gesamt)}${vorMin || vorFl ? ' · inkl. vorerfasst' : ''}`} />
        <Stat label="Einsatz" value={formatStunden(s.einsatz.minuten)} sub={sum(s.einsatz)} />
        <Stat label="Training" value={formatStunden(s.training.minuten)} sub={`${sum(s.training)} (inkl. Checkflug)`} />
        <Stat label="Letzte 90 Tage" value={formatStunden(s.letzte90Tage.minuten)} sub={sum(s.letzte90Tage)} />
        <Stat label="Letzte 12 Monate" value={formatStunden(s.letzte12Monate.minuten)} sub={sum(s.letzte12Monate)} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-2 font-bold">Je Gerät</h3>
          {jeGeraet.length === 0 ? (
            <p className="text-sm text-gray-600">Noch keine Flüge in der App erfasst.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-linie text-left text-xs text-gray-500">
                  <th className="py-2 font-semibold">Gerät</th>
                  <th className="py-2 text-right font-semibold">Flüge</th>
                  <th className="py-2 text-right font-semibold">Stunden</th>
                </tr>
              </thead>
              <tbody>
                {jeGeraet.map(([gid, x]) => (
                  <tr key={gid} className="border-b border-linie last:border-0">
                    <td className="py-2">
                      <Link to={`/geraete/${gid}`} className="font-semibold text-rot-700">
                        {geraetName(gid)}
                      </Link>
                    </td>
                    <td className="py-2 text-right tabular-nums">{x.fluege}</td>
                    <td className="py-2 text-right tabular-nums">{formatStunden(x.minuten)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <Vorerfasst key={`${vorMin}-${vorFl}`} pilot={pilot} />
        </div>

        <div>
          <h3 className="mb-2 font-bold">Letzte Flüge</h3>
          {fluege.length === 0 ? (
            <p className="text-sm text-gray-600">Keine Flüge.</p>
          ) : (
            <ul className="divide-y divide-linie rounded-md border border-linie">
              {fluege.slice(0, 10).map((f) => (
                <li key={f.flugId}>
                  <Link to={`/einsaetze/${f.einsatz.id}`} className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 hover:bg-flaeche">
                    <span className="font-semibold tabular-nums">{fmtDatum(f.start)}</span>
                    <span className="text-sm tabular-nums text-gray-600">
                      {fmtZeit(f.start)}–{f.landung ? fmtZeit(f.landung) : '…'}
                    </span>
                    <Badge color={f.art === 'einsatz' ? 'rot' : 'grau'}>{ART_LABEL[f.art]}</Badge>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {geraetName(f.geraetId)}
                      {f.einsatz.fluggebiet ? ` · ${f.einsatz.fluggebiet}` : ''}
                    </span>
                    <span className="ml-auto font-semibold tabular-nums">{f.landung ? formatStunden(f.minuten) : 'läuft'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {fluege.length > 10 && (
            <Link to="/flugbuch" className="mt-2 inline-flex min-h-11 items-center text-sm font-semibold text-rot-700">
              Alle {fluege.length} Flüge im Flugbuch →
            </Link>
          )}
        </div>
      </div>
    </Card>
  )
}

/** Stunden/Flüge vor Einführung der App – werden zur Gesamtsumme addiert. */
function Vorerfasst({ pilot }: { pilot: Pilot }) {
  const start = teileMinuten(pilot.vorerfassteMinuten ?? 0)
  const [h, setH] = useState(String(start.stunden))
  const [m, setM] = useState(String(start.minuten))
  const [n, setN] = useState(String(pilot.vorerfassteFluege ?? 0))
  const zahl = (v: string) => Math.max(0, parseInt(v, 10) || 0)
  const neuMin = zuMinuten(zahl(h), zahl(m))
  const geaendert = neuMin !== (pilot.vorerfassteMinuten ?? 0) || zahl(n) !== (pilot.vorerfassteFluege ?? 0)
  return (
    <div className="mt-6 rounded-md border border-dashed border-linie bg-flaeche p-3">
      <h3 className="font-bold">
        Vorerfasst <span className="text-sm font-normal text-gray-600">(vor Einführung der App)</span>
      </h3>
      <p className="mb-3 text-xs text-gray-600">Manuell übernommene Werte, z. B. aus dem Papier-Flugbuch. Zählen nur zur Gesamtsumme, nicht zu 90 Tagen / 12 Monaten.</p>
      <div className="grid grid-cols-3 gap-3">
        <TextInput label="Stunden" type="number" min={0} inputMode="numeric" value={h} onChange={(e) => setH(e.target.value)} />
        <TextInput label="Minuten" type="number" min={0} max={59} inputMode="numeric" value={m} onChange={(e) => setM(e.target.value)} />
        <TextInput label="Flüge" type="number" min={0} inputMode="numeric" value={n} onChange={(e) => setN(e.target.value)} />
      </div>
      <Button
        className="mt-3"
        variant="secondary"
        disabled={!geaendert}
        onClick={() => db.piloten.update(pilot.id, { vorerfassteMinuten: neuMin || undefined, vorerfassteFluege: zahl(n) || undefined })}
      >
        Vorerfasste Werte speichern
      </Button>
    </div>
  )
}
