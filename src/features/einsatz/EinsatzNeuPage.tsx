import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, jetzt, neueId } from '../../db/db'
import { PageHeader } from '../../components/ui'
import { useOrg } from '../../lib/useOrg'
import { EinsatzDatenForm } from './components/EinsatzDatenForm'
import { useEinsaetze, useGeraete, useMaengel, usePiloten } from './data'
import { neuerEinsatz } from './logic/einsatz'

export function EinsatzNeuPage() {
  const org = useOrg()
  const orgId = org?.id ?? ''
  const nav = useNavigate()
  const piloten = usePiloten(orgId)
  const geraete = useGeraete(orgId)
  const maengel = useMaengel(orgId)
  const einsaetze = useEinsaetze(orgId)
  const [start] = useState(() => neuerEinsatz(neueId(), orgId, jetzt()))

  if (!org || !piloten || !geraete || !maengel || !einsaetze) return null

  return (
    <>
      <PageHeader title="Neuer Einsatz" subtitle="Einsatzdaten laut Checkliste Drohnenflug v9, Seite 1" />
      <EinsatzDatenForm
        start={{ ...start, orgId: org.id }}
        org={org}
        piloten={piloten}
        geraete={geraete}
        maengel={maengel}
        einsaetze={einsaetze}
        speichernLabel="Einsatz anlegen"
        onAbbrechen={() => nav(-1)}
        onSpeichern={async (e) => {
          const t = jetzt()
          await db.einsaetze.add({ ...e, orgId: org.id, status: 'vorbereitung', erstelltAm: t, geaendertAm: t })
          nav(`/einsaetze/${e.id}`, { replace: true })
        }}
      />
    </>
  )
}
