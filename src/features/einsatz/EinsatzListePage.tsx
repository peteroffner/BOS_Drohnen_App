import { ClipboardList, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { EinsatzArt, EinsatzStatus } from '../../db/types'
import { EmptyState, PageHeader, Select } from '../../components/ui'
import { useOrg } from '../../lib/useOrg'
import { useDarf } from '../auth/kontext'
import { EinsatzZeile } from './components/EinsatzZeile'
import { useEinsaetze } from './data'
import { ART_OPTIONEN, filtereEinsaetze, STATUS_OPTIONEN } from './logic/einsatz'

export function EinsatzListePage() {
  const org = useOrg()
  const einsaetze = useEinsaetze(org?.id ?? '')
  const darfAnlegen = useDarf('einsatz.anlegen')
  const [art, setArt] = useState<EinsatzArt | ''>('')
  const [status, setStatus] = useState<EinsatzStatus | ''>('')
  const [jahr, setJahr] = useState<number | ''>('')
  const [suche, setSuche] = useState('')
  if (!einsaetze) return null

  const jahre = [...new Set(einsaetze.map((e) => new Date(e.datum).getFullYear()))].sort((a, b) => b - a)
  const liste = filtereEinsaetze(einsaetze, { art, status, jahr, suche })

  return (
    <>
      <PageHeader
        title="Einsätze"
        subtitle={`${liste.length} von ${einsaetze.length}`}
        actions={
          darfAnlegen && (
            <Link to="/einsaetze/neu" className="inline-flex min-h-11 items-center gap-2 rounded-md bg-rot-700 px-4 font-semibold text-white hover:bg-rot-800">
              <Plus size={20} /> Neuer Einsatz
            </Link>
          )
        }
      />
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor="einsatz-suche" className="label">
            Suche
          </label>
          <div className="relative">
            <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              id="einsatz-suche"
              type="search"
              className="input pl-9"
              placeholder="Ort, Grund, Person …"
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
            />
          </div>
        </div>
        <Select label="Art" value={art} onChange={(e) => setArt(e.target.value as EinsatzArt | '')} options={ART_OPTIONEN} placeholder="Alle" />
        <Select label="Status" value={status} onChange={(e) => setStatus(e.target.value as EinsatzStatus | '')} options={STATUS_OPTIONEN} placeholder="Alle" />
        <Select
          label="Jahr"
          value={jahr === '' ? '' : String(jahr)}
          onChange={(e) => setJahr(e.target.value ? Number(e.target.value) : '')}
          options={jahre.map((j) => ({ value: String(j), label: String(j) }))}
          placeholder="Alle"
        />
      </div>

      {liste.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={36} />}
          title={einsaetze.length === 0 ? 'Noch keine Einsätze' : 'Keine Treffer'}
          text={einsaetze.length === 0 ? 'Lege den ersten Einsatz, Trainings- oder Checkflug an.' : 'Filter oder Suchbegriff anpassen.'}
        />
      ) : (
        <ul className="divide-y divide-linie overflow-hidden rounded-lg border border-linie bg-white">
          {liste.map((e) => (
            <EinsatzZeile key={e.id} e={e} />
          ))}
        </ul>
      )}
    </>
  )
}
