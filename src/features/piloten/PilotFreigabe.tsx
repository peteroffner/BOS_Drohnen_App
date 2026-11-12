import { useState } from 'react'
import { db } from '../../db/db'
import type { Freigabe, Geraet, Pilot } from '../../db/types'
import { Badge, Button, Card, Checkbox, NurAnsichtHinweis, TextArea, TextInput } from '../../components/ui'
import { fromDateInput, toDateInput } from '../../lib/format'
import { gueltigkeit } from './logic'

export function PilotFreigabe({ pilot, geraete, warnTage, nurAnsicht = false }: { pilot: Pilot; geraete: Geraet[]; warnTage: number; nurAnsicht?: boolean }) {
  const [f, setF] = useState<Freigabe>(pilot.freigabe ?? { erteilt: false })
  const [gespeichert, setGespeichert] = useState<Freigabe | null>(null)
  const auswahl = f.geraete ?? []
  const toggleGeraet = (id: string, an: boolean) => setF({ ...f, geraete: an ? [...auswahl, id] : auswahl.filter((x) => x !== id) })
  const g = f.erteilt ? gueltigkeit(f.gueltigBis, undefined, warnTage) : undefined

  const speichern = async () => {
    const neu: Freigabe = {
      erteilt: f.erteilt,
      erteiltVon: f.erteiltVon?.trim() || undefined,
      erteiltAm: f.erteiltAm,
      gueltigBis: f.gueltigBis,
      geraete: auswahl.length ? auswahl : undefined,
      bemerkung: f.bemerkung?.trim() || undefined,
    }
    await db.piloten.update(pilot.id, { freigabe: neu })
    setGespeichert(f)
  }

  return (
    <Card
      title="Freigabe als Einsatzpilot"
      actions={
        g === 'abgelaufen' ? <Badge color="rot">abgelaufen</Badge> : g === 'bald' ? <Badge color="gelb">läuft bald ab</Badge> : f.erteilt ? <Badge color="gruen">erteilt</Badge> : <Badge>nicht erteilt</Badge>
      }
    >
      {nurAnsicht && <NurAnsichtHinweis className="mb-3" text="Freigaben erteilt nur der Administrator – nur Ansicht." />}
      <fieldset disabled={nurAnsicht} className="min-w-0">
        <Checkbox label="Freigabe als Einsatzpilot erteilt" checked={f.erteilt} onChange={(v) => setF({ ...f, erteilt: v, erteiltAm: v && !f.erteiltAm ? new Date().toISOString() : f.erteiltAm })} />
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <TextInput label="Erteilt von" value={f.erteiltVon ?? ''} onChange={(e) => setF({ ...f, erteiltVon: e.target.value })} placeholder="z. B. Kommandant" disabled={!f.erteilt} />
          <TextInput label="Erteilt am" type="date" value={toDateInput(f.erteiltAm)} onChange={(e) => setF({ ...f, erteiltAm: fromDateInput(e.target.value) })} disabled={!f.erteilt} />
          <TextInput
            label="Gültig bis"
            type="date"
            value={toDateInput(f.gueltigBis)}
            onChange={(e) => setF({ ...f, gueltigBis: fromDateInput(e.target.value) })}
            hint="leer = unbefristet"
            disabled={!f.erteilt}
          />
        </div>
        <fieldset className="mt-4" disabled={!f.erteilt}>
          <legend className="label">Freigegebene Geräte</legend>
          {geraete.length === 0 ? (
            <p className="text-sm text-gray-600">Noch keine Geräte angelegt – Freigabe gilt für alle Geräte.</p>
          ) : (
            <>
              <p className="text-xs text-gray-600">Keine Auswahl = alle Geräte.</p>
              <div className="grid sm:grid-cols-2">
                {geraete.map((x) => (
                  <Checkbox
                    key={x.id}
                    disabled={!f.erteilt}
                    label={x.name}
                    hint={[x.hersteller, x.modell].filter(Boolean).join(' ')}
                    checked={auswahl.includes(x.id)}
                    onChange={(v) => toggleGeraet(x.id, v)}
                  />
                ))}
              </div>
            </>
          )}
      </fieldset>
      <TextArea className="mt-4" label="Bemerkung" value={f.bemerkung ?? ''} onChange={(e) => setF({ ...f, bemerkung: e.target.value })} />
      {!nurAnsicht && (
        <div className="mt-4 flex items-center gap-3">
          <Button onClick={speichern}>Freigabe speichern</Button>
          {gespeichert === f && <span className="text-sm text-ok">Gespeichert</span>}
        </div>
      )}
      </fieldset>
    </Card>
  )
}
