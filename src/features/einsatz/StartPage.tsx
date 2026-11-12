import { ClipboardList, Plus, TriangleAlert, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { Geraet, Pilot } from '../../db/types'
import { AmpelBadge, Badge, Card, EmptyState, Stat } from '../../components/ui'
import { formatStunden } from '../../lib/calc'
import { pilotName } from '../../lib/format'
import { alleFluege, pilotStatus, type PilotStatus } from '../../lib/stats'
import { useOrg } from '../../lib/useOrg'
import { useDarf } from '../auth/kontext'
import { EinsatzZeile } from './components/EinsatzZeile'
import { useEinsaetze, useGeraete, useMaengel, usePiloten } from './data'
import { GERAET_STATUS_LABEL } from './logic/einsatz'

export function StartPage() {
  const org = useOrg()
  const orgId = org?.id ?? ''
  const einsaetze = useEinsaetze(orgId)
  const piloten = usePiloten(orgId)
  const geraete = useGeraete(orgId)
  const maengel = useMaengel(orgId)
  const [jahr] = useState(() => new Date().getFullYear())
  const darfAnlegen = useDarf('einsatz.anlegen')
  if (!org || !einsaetze || !piloten || !geraete || !maengel) return null

  const sortiert = [...einsaetze].sort((a, b) => b.datum.localeCompare(a.datum))
  const offen = sortiert.filter((e) => e.status !== 'abgeschlossen')
  const letzte = sortiert.filter((e) => e.status === 'abgeschlossen').slice(0, 5)

  const fluegeJahr = alleFluege(einsaetze).filter((f) => f.landung && new Date(f.start).getFullYear() === jahr)
  const minutenJahr = fluegeJahr.reduce((s, f) => s + f.minuten, 0)
  const einsaetzeJahr = einsaetze.filter((e) => new Date(e.datum).getFullYear() === jahr)

  const pilotHinweise: { p: Pilot; s: PilotStatus }[] = piloten
    .filter((p) => p.aktiv)
    .map((p) => ({ p, s: pilotStatus(p, einsaetze, org.freigabeRegeln) }))
    .filter((x) => x.s.ampel !== 'gruen')
    .sort((a, b) => (a.s.ampel === b.s.ampel ? 0 : a.s.ampel === 'rot' ? -1 : 1))

  const geraetHinweise: { g: Geraet; offeneMaengel: number }[] = geraete
    .map((g) => ({ g, offeneMaengel: maengel.filter((m) => m.geraetId === g.id && !m.behobenAm).length }))
    .filter((x) => x.offeneMaengel > 0 || x.g.status !== 'einsatzbereit')

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-dunkel">{org.name}</h1>
        <p className="text-sm text-gray-600">Einsatzdokumentation Drohne</p>
      </div>

      {darfAnlegen && (
        <Link
          to="/einsaetze/neu"
          className="flex min-h-20 items-center justify-center gap-3 rounded-lg bg-rot-700 px-6 text-xl font-bold text-white shadow-sm hover:bg-rot-800 active:bg-rot-900"
        >
          <Plus size={30} strokeWidth={3} /> Neuer Einsatz
        </Link>
      )}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label={`Einsätze ${jahr}`} value={einsaetzeJahr.length} />
        <Stat label={`Flüge ${jahr}`} value={fluegeJahr.length} />
        <Stat label={`Flugstunden ${jahr}`} value={formatStunden(minutenJahr)} />
      </div>

      <Card title={`Laufende / offene Einsätze (${offen.length})`}>
        {offen.length === 0 ? (
          <p className="text-sm text-gray-600">Keine offenen Einsätze.</p>
        ) : (
          <ul className="-m-4 divide-y divide-linie">
            {offen.map((e) => (
              <EinsatzZeile key={e.id} e={e} />
            ))}
          </ul>
        )}
      </Card>

      {(pilotHinweise.length > 0 || geraetHinweise.length > 0) && (
        <Card title="Hinweise">
          <ul className="-m-4 divide-y divide-linie">
            {pilotHinweise.map(({ p, s }) => (
              <li key={p.id}>
                <Link to={`/piloten/${p.id}`} className="flex min-h-14 items-start gap-3 px-4 py-3 hover:bg-flaeche">
                  <TriangleAlert size={20} className={s.ampel === 'rot' ? 'mt-0.5 shrink-0 text-fehler' : 'mt-0.5 shrink-0 text-warn'} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      {pilotName(p)} <AmpelBadge ampel={s.ampel} />
                    </div>
                    <div className="text-sm text-gray-600">{s.gruende.join(' · ')}</div>
                  </div>
                </Link>
              </li>
            ))}
            {geraetHinweise.map(({ g, offeneMaengel }) => (
              <li key={g.id}>
                <Link to={`/geraete/${g.id}`} className="flex min-h-14 items-start gap-3 px-4 py-3 hover:bg-flaeche">
                  <Wrench size={20} className="mt-0.5 shrink-0 text-warn" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 font-semibold">
                      {g.name}
                      {g.status !== 'einsatzbereit' && <Badge color={g.status === 'wartung' ? 'gelb' : 'rot'}>{GERAET_STATUS_LABEL[g.status]}</Badge>}
                    </div>
                    {offeneMaengel > 0 && (
                      <div className="text-sm text-gray-600">
                        {offeneMaengel} offene{offeneMaengel === 1 ? 'r' : ''} Mangel{offeneMaengel === 1 ? '' : 'e'}
                      </div>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card
        title="Zuletzt abgeschlossen"
        actions={
          <Link to="/einsaetze" className="text-sm font-semibold text-rot-700">
            Alle Einsätze
          </Link>
        }
      >
        {letzte.length === 0 ? (
          <EmptyState icon={<ClipboardList size={32} />} title="Noch keine abgeschlossenen Einsätze" />
        ) : (
          <ul className="-m-4 divide-y divide-linie">
            {letzte.map((e) => (
              <EinsatzZeile key={e.id} e={e} />
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
