import { ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import type { Einsatz } from '../../../db/types'
import { Button, Modal, TextArea } from '../../../components/ui'
import { jetzt, neueId } from '../../../db/db'
import { fmtDatumZeit } from '../../../lib/format'
import type { Pflichtpunkt } from '../logic/checkliste'
import { aendereEinsatz } from '../data'

/** Offene Pflichtpunkte mit Begründung übersteuern (wird dokumentiert). */
export function UebersteuernModal({ open, onClose, einsatz, offen }: { open: boolean; onClose: () => void; einsatz: Einsatz; offen: Pflichtpunkt[] }) {
  const [begruendung, setBegruendung] = useState('')
  const ok = begruendung.trim().length >= 5
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pflichtpunkte übersteuern"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            disabled={!ok}
            icon={<ShieldAlert size={18} />}
            onClick={async () => {
              const zeit = jetzt()
              await aendereEinsatz(einsatz.id, (e) => {
                const vorhandene = new Set((e.uebersteuerungen ?? []).map((u) => u.itemId))
                e.uebersteuerungen = [
                  ...(e.uebersteuerungen ?? []),
                  ...offen.filter((p) => !vorhandene.has(p.itemId)).map((p) => ({ itemId: p.itemId, begruendung: begruendung.trim(), zeit })),
                ]
                e.ereignisse.push({
                  id: neueId(),
                  zeit,
                  typ: 'meldung',
                  text: `Checkliste übersteuert (${offen.length} offene Pflichtpunkte): ${begruendung.trim()}`,
                })
              })
              setBegruendung('')
              onClose()
            }}
          >
            Übersteuern und Flug freigeben
          </Button>
        </>
      }
    >
      <p className="mb-3 font-semibold text-fehler">Folgende Pflichtpunkte sind nicht erledigt:</p>
      <ul className="mb-4 list-disc pl-5 text-sm">
        {offen.map((p) => (
          <li key={p.itemId}>
            {p.nr && <b>{p.nr}. </b>}
            {p.label}
          </li>
        ))}
      </ul>
      <TextArea
        label="Begründung (Pflicht)"
        hint="z. B. „Gefahr im Verzug – Menschenrettung“. Wird mit Zeitstempel im Protokoll dokumentiert."
        value={begruendung}
        onChange={(e) => setBegruendung(e.target.value)}
      />
    </Modal>
  )
}

export function UebersteuerungenListe({ einsatz }: { einsatz: Einsatz }) {
  const u = einsatz.uebersteuerungen ?? []
  if (!u.length) return null
  // gleiche Begründung + Zeit zusammenfassen
  const gruppen = new Map<string, { zeit: string; begruendung: string; n: number }>()
  for (const x of u) {
    const k = `${x.zeit}|${x.begruendung}`
    const g = gruppen.get(k) ?? { zeit: x.zeit, begruendung: x.begruendung, n: 0 }
    g.n++
    gruppen.set(k, g)
  }
  return (
    <div className="rounded-md border border-warn bg-warn-bg p-3 text-sm text-warn">
      <p className="font-bold">Übersteuerungen</p>
      <ul className="list-disc pl-5">
        {[...gruppen.values()].map((g) => (
          <li key={g.zeit + g.begruendung}>
            {fmtDatumZeit(g.zeit)}: {g.n} Pflichtpunkt{g.n === 1 ? '' : 'e'} – „{g.begruendung}“
          </li>
        ))}
      </ul>
    </div>
  )
}
