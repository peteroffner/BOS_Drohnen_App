import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, jetzt, neueId } from '../../db/db'
import { NurAnsichtHinweis, PageHeader } from '../../components/ui'
import { useOrg } from '../../lib/useOrg'
import { useDarf, useMitgliedschaft } from '../auth/kontext'
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
  const darfAnlegen = useDarf('einsatz.anlegen')
  const ich = useMitgliedschaft()

  if (!darfAnlegen)
    return (
      <>
        <PageHeader title="Neuer Einsatz" />
        <NurAnsichtHinweis text="Keine Berechtigung – Einsätze anlegen ist mit deiner Rolle nicht möglich." />
      </>
    )
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
          // Cloud-Modus: Anleger merken (für „eigene Einsätze“)
          await db.einsaetze.add({ ...e, orgId: org.id, status: 'vorbereitung', erstelltAm: t, geaendertAm: t, ...(ich ? { erstelltVon: ich.userId } : {}) })
          nav(`/einsaetze/${e.id}`, { replace: true })
        }}
      />
    </>
  )
}
