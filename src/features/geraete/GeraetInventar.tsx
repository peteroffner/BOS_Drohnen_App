import { Briefcase, ChevronRight, Package, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { db, neueId } from '../../db/db'
import type { Geraet, Zubehoer, ZubehoerKategorie } from '../../db/types'
import { Badge, Button, Card, Checkbox, EmptyState, Modal, NurAnsichtHinweis, Segmented, Select, TextInput } from '../../components/ui'
import { useDarf } from '../auth/kontext'
import { aktiveKoffer, doppelteInventarnummern, inventarGruppen, inventarPositionen, ZUBEHOER_KATEGORIE_LABEL, ZUBEHOER_STATUS_LABEL } from './inventar'
import type { VerleihPosition } from '../../db/types'

const KATEGORIEN = (Object.keys(ZUBEHOER_KATEGORIE_LABEL) as ZubehoerKategorie[]).map((k) => ({ value: k, label: ZUBEHOER_KATEGORIE_LABEL[k] }))
const STATUS_FARBE: Record<Zubehoer['status'], 'gruen' | 'rot' | 'grau'> = { ok: 'gruen', defekt: 'rot', ausgemustert: 'grau' }

/** Inventarliste: Drohne, Akkus und Zubehör mit Inventarnummern */
export function GeraetInventar({ geraet, alleGeraete }: { geraet: Geraet; alleGeraete: Geraet[] }) {
  const darf = useDarf('geraet.verwalten')
  const [bearbeiten, setBearbeiten] = useState<Zubehoer | null>(null)
  const [ausgemusterte, setAusgemusterte] = useState(false)
  const zubehoer = geraet.zubehoer ?? []
  const doppelt = doppelteInventarnummern(alleGeraete)
  const istDoppelt = (n?: string) => !!n && doppelt.has(n.trim().toLowerCase())
  const positionen = inventarPositionen(geraet)
  const ohneNummer = positionen.filter((p) => !p.inventarnummer).length
  const kofferName = new Map(aktiveKoffer(geraet).map((k) => [k.id, k.bezeichnung]))

  const speichern = async (z: Zubehoer) => {
    await db.geraete.update(geraet.id, { zubehoer: [...zubehoer.filter((x) => x.id !== z.id), z] })
    setBearbeiten(null)
  }
  const loeschen = async (id: string) => {
    // Inhalt eines gelöschten Koffers wird wieder „lose“
    const frei = <T extends { behaelterId?: string }>(x: T): T => (x.behaelterId === id ? { ...x, behaelterId: undefined } : x)
    await db.geraete.update(geraet.id, { zubehoer: zubehoer.filter((x) => x.id !== id).map(frei), akkus: geraet.akkus.map(frei) })
    setBearbeiten(null)
  }

  const liste = zubehoer
    .filter((z) => ausgemusterte || z.status !== 'ausgemustert')
    .sort((a, b) => (a.kategorie === b.kategorie ? a.bezeichnung.localeCompare(b.bezeichnung, 'de-AT') : a.kategorie.localeCompare(b.kategorie)))
  const anzahlAus = zubehoer.filter((z) => z.status === 'ausgemustert').length

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card title="Inventarübersicht">
        <p className="mb-3 text-sm text-gray-600">
          Alles, was zu diesem Gerät gehört und bei einem Verleih mitgegeben wird. Inventarnummern der Drohne (Reiter „Übersicht“) und der Akkus (Reiter „Akkus“) werden dort gepflegt.
        </p>
        {ohneNummer > 0 && <p className="mb-2 text-sm font-semibold text-warn">{ohneNummer} Teil(e) noch ohne Inventarnummer.</p>}
        <ul className="divide-y divide-linie">
          {inventarGruppen(positionen).map((g) =>
            g.inhalt.length === 0 && !aktiveKoffer(geraet).some((k) => k.id === g.pos.teilId) ? (
              <li key={g.pos.teilId} className="py-2">
                <TeilZeile p={g.pos} doppelt={istDoppelt(g.pos.inventarnummer)} />
              </li>
            ) : (
              <li key={g.pos.teilId}>
                <details className="group py-2">
                  <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2">
                    <ChevronRight size={18} className="shrink-0 text-gray-500 transition-transform group-open:rotate-90" />
                    <Briefcase size={18} className="shrink-0 text-anthrazit" />
                    <span className="min-w-0 flex-1">
                      <TeilZeile p={g.pos} doppelt={istDoppelt(g.pos.inventarnummer)} />
                    </span>
                    <Badge>{g.inhalt.length} Teil{g.inhalt.length === 1 ? '' : 'e'}</Badge>
                  </summary>
                  {g.inhalt.length === 0 ? (
                    <p className="ml-12 text-sm text-gray-600">Leer – beim Akku bzw. Zubehör „Liegt in Koffer“ wählen.</p>
                  ) : (
                    <ul className="ml-12 mt-1 flex flex-col gap-1 border-l-2 border-linie pl-3">
                      {g.inhalt.map((x) => (
                        <li key={x.pos.teilId}>
                          <TeilZeile p={x.pos} doppelt={istDoppelt(x.pos.inventarnummer)} />
                        </li>
                      ))}
                    </ul>
                  )}
                </details>
              </li>
            ),
          )}
        </ul>
      </Card>

      <Card
        title="Zubehör"
        actions={
          darf && (
            <Button size="sm" icon={<Plus size={16} />} onClick={() => setBearbeiten({ id: neueId(), kategorie: 'fernsteuerung', bezeichnung: '', status: 'ok' })}>
              Zubehör hinzufügen
            </Button>
          )
        }
      >
        {!darf && <NurAnsichtHinweis />}
        {anzahlAus > 0 && <Checkbox label={`ausgemustertes anzeigen (${anzahlAus})`} checked={ausgemusterte} onChange={setAusgemusterte} />}
        {liste.length === 0 ? (
          <EmptyState icon={<Package size={36} />} title="Noch kein Zubehör erfasst" text="z. B. Fernsteuerung, Bildschirm, Ladegerät, Transportkoffer, Ersatzpropeller." />
        ) : (
          <ul className="divide-y divide-linie">
            {liste.map((z) => (
              <li key={z.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{z.bezeichnung || ZUBEHOER_KATEGORIE_LABEL[z.kategorie]}</span>
                    {z.anzahl && z.anzahl > 1 && <span className="text-sm text-gray-600">{z.anzahl} Stk.</span>}
                    <Badge color={STATUS_FARBE[z.status]}>{ZUBEHOER_STATUS_LABEL[z.status]}</Badge>
                  </div>
                  <div className="text-sm text-gray-600">
                    {ZUBEHOER_KATEGORIE_LABEL[z.kategorie]}
                    {z.inventarnummer ? ` · Inv.-Nr. ${z.inventarnummer}` : ''}
                    {z.behaelterId && kofferName.get(z.behaelterId) ? ` · im ${kofferName.get(z.behaelterId)}` : ''}
                    {z.seriennummer ? ` · S/N ${z.seriennummer}` : ''}
                    {z.bemerkung ? ` · ${z.bemerkung}` : ''}
                  </div>
                </div>
                {darf && (
                  <Button variant="secondary" size="sm" icon={<Pencil size={16} />} onClick={() => setBearbeiten(z)} aria-label={`${z.bezeichnung} bearbeiten`}>
                    Bearbeiten
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {bearbeiten && (
        <ZubehoerModal
          key={bearbeiten.id}
          zubehoer={bearbeiten}
          koffer={aktiveKoffer(geraet).filter((k) => k.id !== bearbeiten.id)}
          neu={!zubehoer.some((x) => x.id === bearbeiten.id)}
          onClose={() => setBearbeiten(null)}
          onSave={speichern}
          onDelete={loeschen}
        />
      )}
    </div>
  )
}

function TeilZeile({ p, doppelt }: { p: VerleihPosition; doppelt: boolean }) {
  return (
    <span className="block text-sm">
      <span className="font-semibold">
        {p.bezeichnung}
        {p.anzahl ? ` (${p.anzahl} Stk.)` : ''}
      </span>
      <span className="block text-xs text-gray-600">
        {p.inventarnummer ? `Inv.-Nr. ${p.inventarnummer}` : 'ohne Inventarnummer'}
        {p.seriennummer ? ` · S/N ${p.seriennummer}` : ''}
        {doppelt && (
          <span className="ml-1">
            <Badge color="rot">doppelt</Badge>
          </span>
        )}
      </span>
    </span>
  )
}

function ZubehoerModal({
  zubehoer,
  koffer,
  neu,
  onClose,
  onSave,
  onDelete,
}: {
  zubehoer: Zubehoer
  koffer: Zubehoer[]
  neu: boolean
  onClose: () => void
  onSave: (z: Zubehoer) => void
  onDelete: (id: string) => void
}) {
  const [z, setZ] = useState(zubehoer)
  const [anzahl, setAnzahl] = useState(String(zubehoer.anzahl ?? 1))
  const [frage, setFrage] = useState(false)
  const bezeichnung = z.bezeichnung.trim() || ZUBEHOER_KATEGORIE_LABEL[z.kategorie]
  return (
    <Modal
      open
      onClose={onClose}
      title={neu ? 'Zubehör hinzufügen' : `${zubehoer.bezeichnung} bearbeiten`}
      footer={
        <>
          {!neu &&
            (frage ? (
              <Button variant="danger" className="mr-auto" onClick={() => onDelete(z.id)}>
                Wirklich löschen
              </Button>
            ) : (
              <Button variant="ghost" className="mr-auto" icon={<Trash2 size={16} />} onClick={() => setFrage(true)}>
                Löschen
              </Button>
            ))}
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button
            onClick={() =>
              onSave({
                ...z,
                bezeichnung,
                inventarnummer: z.inventarnummer?.trim() || undefined,
                seriennummer: z.seriennummer?.trim() || undefined,
                bemerkung: z.bemerkung?.trim() || undefined,
                anzahl: Math.max(1, parseInt(anzahl, 10) || 1) > 1 ? Math.max(1, parseInt(anzahl, 10) || 1) : undefined,
                behaelterId: z.kategorie === 'koffer' ? undefined : z.behaelterId || undefined,
              })
            }
          >
            Speichern
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <Select label="Kategorie" value={z.kategorie} onChange={(e) => setZ({ ...z, kategorie: e.target.value as ZubehoerKategorie })} options={KATEGORIEN} />
        <TextInput label="Bezeichnung" value={z.bezeichnung} onChange={(e) => setZ({ ...z, bezeichnung: e.target.value })} placeholder={`z. B. ${ZUBEHOER_KATEGORIE_LABEL[z.kategorie]}`} />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextInput label="Inventarnummer" value={z.inventarnummer ?? ''} onChange={(e) => setZ({ ...z, inventarnummer: e.target.value })} />
          <TextInput label="Seriennummer" value={z.seriennummer ?? ''} onChange={(e) => setZ({ ...z, seriennummer: e.target.value })} />
          <TextInput label="Anzahl" type="number" min={1} inputMode="numeric" value={anzahl} onChange={(e) => setAnzahl(e.target.value)} />
        </div>
        {z.kategorie === 'koffer' ? (
          <p className="text-sm text-gray-600">Akkus und Zubehör können diesem Koffer zugeordnet werden. Beim Verleih wird dann nur der Koffer abgehakt, der Inhalt ist aufklappbar.</p>
        ) : (
          koffer.length > 0 && (
            <Select
              label="Liegt in Koffer"
              value={z.behaelterId ?? ''}
              onChange={(e) => setZ({ ...z, behaelterId: e.target.value || undefined })}
              placeholder="– lose, in keinem Koffer –"
              options={koffer.map((k) => ({ value: k.id, label: k.bezeichnung + (k.inventarnummer ? ` (${k.inventarnummer})` : '') }))}
            />
          )
        )}
        <Segmented
          label="Status"
          value={z.status}
          onChange={(v) => setZ({ ...z, status: v })}
          options={[
            { value: 'ok', label: 'in Ordnung' },
            { value: 'defekt', label: 'defekt' },
            { value: 'ausgemustert', label: 'ausgemustert' },
          ]}
        />
        <TextInput label="Bemerkung" value={z.bemerkung ?? ''} onChange={(e) => setZ({ ...z, bemerkung: e.target.value })} />
      </div>
    </Modal>
  )
}
