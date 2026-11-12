import { BookOpen, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { EinsatzArt } from '../../db/types'
import { Badge, Button, EmptyState, PageHeader, Select, TextInput } from '../../components/ui'
import { formatStunden } from '../../lib/calc'
import { fmtDatum, fmtZeit, pilotName } from '../../lib/format'
import { useOrg } from '../../lib/useOrg'
import { useEinsaetze, useGeraete, usePiloten } from '../einsatz/data'
import { ART_LABEL, ART_OPTIONEN } from '../einsatz/logic/einsatz'
import { filtereFlugbuch, flugbuchSumme, flugbuchZeilen, type FlugbuchFilter, type FlugbuchZeile } from './flugbuch'

const ART_KURZ: Record<EinsatzArt, string> = { einsatz: 'Einsatz', training: 'Ausbildung', checkflug: 'Checkflug' }

export function FlugbuchPage() {
  const org = useOrg()
  const orgId = org?.id ?? ''
  const einsaetze = useEinsaetze(orgId)
  const piloten = usePiloten(orgId)
  const geraete = useGeraete(orgId)
  const nav = useNavigate()
  const [f, setF] = useState<FlugbuchFilter>({})
  if (!einsaetze || !piloten || !geraete) return null

  const alle = flugbuchZeilen(einsaetze, piloten, geraete)
  const zeilen = filtereFlugbuch(alle, f)
  const summe = flugbuchSumme(zeilen)
  const set = (patch: Partial<FlugbuchFilter>) => setF((x) => ({ ...x, ...patch }))
  const filterAktiv = Object.values(f).some(Boolean)

  return (
    <>
      <PageHeader title="Flugbuch" subtitle="Automatisch aus den Flügen der Einsätze erstellt (Flugbuch v2)" />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <TextInput label="Von" type="date" value={f.von ?? ''} onChange={(e) => set({ von: e.target.value || undefined })} />
        <TextInput label="Bis" type="date" value={f.bis ?? ''} onChange={(e) => set({ bis: e.target.value || undefined })} />
        <Select
          label="Pilot"
          value={f.pilotId ?? ''}
          onChange={(e) => set({ pilotId: e.target.value || undefined })}
          options={piloten.map((p) => ({ value: p.id, label: pilotName(p) }))}
          placeholder="Alle"
        />
        <Select
          label="Gerät"
          value={f.geraetId ?? ''}
          onChange={(e) => set({ geraetId: e.target.value || undefined })}
          options={geraete.map((g) => ({ value: g.id, label: g.name }))}
          placeholder="Alle"
        />
        <Select label="Art" value={f.art ?? ''} onChange={(e) => set({ art: e.target.value as EinsatzArt | '' })} options={ART_OPTIONEN} placeholder="Alle" />
        <TextInput label="Suche" type="search" value={f.suche ?? ''} onChange={(e) => set({ suche: e.target.value })} placeholder="Ort, Beschreibung …" />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-linie bg-white px-4 py-3">
        <span className="text-lg font-bold tabular-nums text-dunkel" data-testid="flugbuch-summe">
          {summe.fluege} {summe.fluege === 1 ? 'Flug' : 'Flüge'} · {formatStunden(summe.minuten)}
        </span>
        {filterAktiv && (
          <>
            <span className="text-sm text-gray-600">gefiltert aus {alle.length}</span>
            <Button size="sm" variant="ghost" onClick={() => setF({})}>
              Filter zurücksetzen
            </Button>
          </>
        )}
      </div>

      {zeilen.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={36} />}
          title={alle.length === 0 ? 'Noch keine Flüge' : 'Keine Flüge im Filter'}
          text={alle.length === 0 ? 'Flüge entstehen automatisch, wenn im Einsatz „Flug starten“ und „Gelandet“ gedrückt wird.' : undefined}
        />
      ) : (
        <>
          {/* Smartphone: Karten */}
          <ul className="flex flex-col gap-2 md:hidden">
            {zeilen.map((z) => (
              <FlugKarte key={z.flugId} z={z} />
            ))}
          </ul>

          {/* Tablet/Desktop: Tabelle (bewusst horizontal scrollbar) */}
          <div className="hidden overflow-x-auto rounded-lg border border-linie bg-white md:block">
            <table className="w-full min-w-[1200px] text-left text-sm">
              <thead className="bg-flaeche text-xs uppercase tracking-wide text-gray-600">
                <tr>
                  {['#', 'Datum', 'Pilot', 'Gerät', 'Einsatzort', 'Start', 'Landung', 'Dauer', 'Durchführung', 'Payload', 'Einsatz / Ausbildung', 'Beschreibung', 'Einsatzleiter', 'Unfall', 'Bemerkungen'].map(
                    (h) => (
                      <th key={h} className="whitespace-nowrap px-2 py-2">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {zeilen.map((z) => (
                  <tr
                    key={z.flugId}
                    className="cursor-pointer border-t border-linie align-top hover:bg-flaeche"
                    onClick={() => nav(`/einsaetze/${z.einsatz.id}`)}
                  >
                    <td className="px-2 py-2 font-bold tabular-nums">
                      <Link to={`/einsaetze/${z.einsatz.id}`} onClick={(e) => e.stopPropagation()} className="text-rot-700">
                        {z.lfdNr}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 tabular-nums">{fmtDatum(z.start)}</td>
                    <td className="px-2 py-2">{z.pilot}</td>
                    <td className="px-2 py-2">{z.geraet}</td>
                    <td className="px-2 py-2">{z.einsatzort}</td>
                    <td className="px-2 py-2 tabular-nums">{fmtZeit(z.start)}</td>
                    <td className="px-2 py-2 tabular-nums">{z.landung ? fmtZeit(z.landung) : <Badge color="rot">läuft</Badge>}</td>
                    <td className="whitespace-nowrap px-2 py-2 tabular-nums">{z.landung ? `${z.minuten} min` : ''}</td>
                    <td className="px-2 py-2">{z.einsatz.flugart}</td>
                    <td className="px-2 py-2">{z.einsatz.payload}</td>
                    <td className="px-2 py-2">{ART_KURZ[z.art]}</td>
                    <td className="px-2 py-2">{z.beschreibung}</td>
                    <td className="px-2 py-2">{z.einsatzleiter}</td>
                    <td className="px-2 py-2">{z.einsatz.unfall ? <Badge color="rot">ja</Badge> : 'nein'}</td>
                    <td className="px-2 py-2">{z.bemerkung}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-linie bg-flaeche font-bold">
                  <td className="px-2 py-2" colSpan={7}>
                    Summe: {summe.fluege} {summe.fluege === 1 ? 'Flug' : 'Flüge'}
                  </td>
                  <td className="whitespace-nowrap px-2 py-2 tabular-nums">{formatStunden(summe.minuten)}</td>
                  <td colSpan={7} />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </>
  )
}

function FlugKarte({ z }: { z: FlugbuchZeile }) {
  return (
    <li>
      <Link to={`/einsaetze/${z.einsatz.id}`} className="flex items-center gap-3 rounded-lg border border-linie bg-white p-3 hover:bg-flaeche">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold text-rot-700">#{z.lfdNr}</span>
            <span className="font-semibold tabular-nums">
              {fmtDatum(z.start)} · {fmtZeit(z.start)}–{z.landung ? fmtZeit(z.landung) : '…'}
            </span>
            <Badge color={z.art === 'einsatz' ? 'rot' : 'grau'}>{ART_LABEL[z.art]}</Badge>
            {z.einsatz.unfall && <Badge color="rot">Unfall</Badge>}
          </div>
          <div className="mt-1 break-words text-sm">
            <b>{z.pilot || 'Pilot ?'}</b> · {z.geraet} · {z.landung ? `${z.minuten} min` : 'läuft'} · {z.einsatz.flugart}
          </div>
          {z.einsatzort && <div className="break-words text-sm text-gray-700">{z.einsatzort}</div>}
          {z.beschreibung && <div className="break-words text-sm text-gray-600">{z.beschreibung}</div>}
          {z.einsatzleiter && <div className="break-words text-xs text-gray-600">EL: {z.einsatzleiter}</div>}
          {z.bemerkung && <div className="break-words text-xs text-gray-600">Bem.: {z.bemerkung}</div>}
        </div>
        <ChevronRight size={20} className="shrink-0 text-gray-400" />
      </Link>
    </li>
  )
}
