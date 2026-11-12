import { useState } from 'react'
import { AKTIVE_ORG_KEY, db, jetzt, neueId } from '../../db/db'
import type { OrgTyp } from '../../db/types'
import { Button, Select, TextInput } from '../../components/ui'
import { STANDARD_FREIGABE_REGELN } from '../../lib/useOrg'
import { ORG_TYPEN } from './orgTypen'

export function OrgSetup() {
  const [name, setName] = useState('')
  const [typ, setTyp] = useState<OrgTyp>('FF')
  const [bezirk, setBezirk] = useState('')
  const [bundesland, setBundesland] = useState('')

  const anlegen = async () => {
    const id = neueId()
    await db.transaction('rw', db.organisationen, db.einstellungen, async () => {
      await db.organisationen.add({
        id,
        name: name.trim(),
        typ,
        bezirk: bezirk || undefined,
        bundesland: bundesland || undefined,
        freigabeRegeln: STANDARD_FREIGABE_REGELN,
        erstelltAm: jetzt(),
      })
      await db.einstellungen.put({ key: AKTIVE_ORG_KEY, value: id })
    })
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-dunkel p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white">
        <div className="border-b-4 border-rot-800 bg-rot-700 px-6 py-5 text-white">
          <div className="text-xs font-semibold uppercase tracking-widest text-rot-100">BOS Drohnen</div>
          <h1 className="text-2xl font-bold">Willkommen</h1>
          <p className="mt-1 text-sm text-rot-50">Einsatzdokumentation für Drohnenflüge – Flugbuch, Checklisten, Piloten und Geräte.</p>
        </div>
        <form
          className="flex flex-col gap-4 p-6"
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) void anlegen()
          }}
        >
          <p className="text-sm text-gray-600">Lege zuerst deine Organisation an. Alle Daten bleiben lokal auf diesem Gerät gespeichert.</p>
          <Select label="Organisationstyp" value={typ} onChange={(e) => setTyp(e.target.value as OrgTyp)} options={ORG_TYPEN} />
          <TextInput label="Name der Organisation" placeholder="z. B. FF Musterdorf" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextInput label="Bezirk" value={bezirk} onChange={(e) => setBezirk(e.target.value)} />
            <TextInput label="Bundesland" value={bundesland} onChange={(e) => setBundesland(e.target.value)} />
          </div>
          <Button type="submit" size="lg" disabled={!name.trim()}>
            Organisation anlegen
          </Button>
        </form>
      </div>
    </div>
  )
}
