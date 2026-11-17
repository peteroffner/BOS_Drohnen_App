import { Briefcase, ChevronRight, FileDown, Handshake, Trash2, Undo2 } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { db, jetzt, neueId } from '../../db/db'
import type { Ausleihe, Geraet, VerleihPosition } from '../../db/types'
import { Badge, Button, Card, Checkbox, EmptyState, Modal, NurAnsichtHinweis, Segmented, TextArea, TextInput } from '../../components/ui'
import { fmtDatum, fmtDatumZeit, fromDateInput, fromLocalInput, toLocalInput } from '../../lib/format'
import { useDarf, useMitgliedschaft } from '../auth/kontext'
import { ausgabeFehler, inventarGruppen, inventarPositionen, rueckgabeErgebnis, rueckgabeFehler, rueckgabeMaengel, setzeAusgegeben, setzeRueckgabe, type InventarGruppe } from './inventar'

const RUECKGABE_LABEL: Record<NonNullable<VerleihPosition['rueckgabe']>, string> = { ok: 'zurück, ok', beschaedigt: 'beschädigt', fehlt: 'fehlt' }

async function pdf(a: Ausleihe, geraet: Geraet, orgName: string) {
  const { exportUebergabePdf } = await import('../auswertung/export/uebergabePdf')
  await exportUebergabePdf(a, geraet, orgName)
}

/** Verleih an andere Feuerwehren/Organisationen: Ausgabe, Rückgabe, Verlauf */
export function GeraetVerleih({ geraet, ausleihen, orgName }: { geraet: Geraet; ausleihen: Ausleihe[]; orgName: string }) {
  const darf = useDarf('geraet.verleihen')
  const darfLoeschen = useDarf('verleih.loeschen')
  const [loeschen, setLoeschen] = useState<Ausleihe | null>(null)
  const offen = ausleihen.find((a) => a.status === 'verliehen')
  const verlauf = ausleihen.filter((a) => a.status === 'zurueck')
  const [ausgabe, setAusgabe] = useState(false)
  const [rueckgabe, setRueckgabe] = useState(false)
  const [pdfFehler, setPdfFehler] = useState('')

  const loeschenButton = (a: Ausleihe) =>
    darfLoeschen && (
      <Button variant="ghost" size="sm" icon={<Trash2 size={16} />} onClick={() => setLoeschen(a)} aria-label={`Verleih an ${a.empfaenger} löschen`}>
        Löschen
      </Button>
    )

  const pdfButton = (a: Ausleihe) => (
    <Button
      variant="secondary"
      size="sm"
      icon={<FileDown size={16} />}
      onClick={() => {
        setPdfFehler('')
        pdf(a, geraet, orgName).catch(() => setPdfFehler('PDF konnte nicht erstellt werden.'))
      }}
    >
      Übergabeprotokoll (PDF)
    </Button>
  )

  return (
    <div className="flex flex-col gap-4">
      {!darf && <NurAnsichtHinweis />}
      {pdfFehler && <p className="text-sm font-semibold text-fehler">{pdfFehler}</p>}

      {offen ? (
        <Card
          title="Derzeit verliehen"
          actions={
            <>
              {pdfButton(offen)}
              {loeschenButton(offen)}
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge color="gelb">verliehen</Badge>
              <span className="text-lg font-bold">{offen.empfaenger}</span>
            </div>
            <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
              <Zeile k="Seit" v={fmtDatumZeit(offen.ausgabeZeit)} />
              <Zeile k="Übergeben durch" v={offen.ausgabeDurch} />
              <Zeile k="Ansprechperson" v={[offen.ansprechperson, offen.telefon].filter(Boolean).join(' · ')} />
              <Zeile k="Zweck" v={offen.zweck} />
              <Zeile k="Geplante Rückgabe" v={offen.geplanteRueckgabe ? fmtDatum(offen.geplanteRueckgabe) : undefined} />
              <Zeile k="Mitgegeben" v={`${offen.positionen.filter((p) => p.ausgegeben).length} von ${offen.positionen.length} Teilen`} />
            </dl>
            {darf && (
              <div>
                <Button icon={<Undo2 size={18} />} onClick={() => setRueckgabe(true)}>
                  Rückgabe erfassen
                </Button>
              </div>
            )}
          </div>
        </Card>
      ) : (
        <Card title="Verleih">
          <p className="mb-3 text-sm text-gray-600">
            Das Gerät ist bei {orgName}. Beim Verleih wird festgehalten, welche Organisation es mit welchem Inventar ab wann hat; bei der Rückgabe wird jedes Teil geprüft.
          </p>
          {darf && (
            <Button icon={<Handshake size={18} />} disabled={geraet.status === 'ausser_dienst'} onClick={() => setAusgabe(true)}>
              Gerät verleihen
            </Button>
          )}
          {geraet.status === 'ausser_dienst' && <p className="mt-2 text-sm text-gray-600">Außer Dienst gestellte Geräte können nicht verliehen werden.</p>}
        </Card>
      )}

      <Card title={`Verlauf${verlauf.length ? ` (${verlauf.length})` : ''}`}>
        {verlauf.length === 0 ? (
          <EmptyState title="Noch keine abgeschlossenen Verleihe" />
        ) : (
          <ul className="divide-y divide-linie">
            {verlauf.map((a) => {
              const { fehlend, beschaedigt } = rueckgabeErgebnis(a)
              return (
                <li key={a.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">{a.empfaenger}</div>
                    <div className="text-sm text-gray-600">
                      {fmtDatumZeit(a.ausgabeZeit)} – {fmtDatumZeit(a.rueckgabeZeit)}
                      {a.zweck ? ` · ${a.zweck}` : ''}
                    </div>
                    {(fehlend.length > 0 || beschaedigt.length > 0) && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {fehlend.length > 0 && <Badge color="rot">{fehlend.length} fehlend</Badge>}
                        {beschaedigt.length > 0 && <Badge color="gelb">{beschaedigt.length} beschädigt</Badge>}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {pdfButton(a)}
                    {loeschenButton(a)}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {ausgabe && <AusgabeModal geraet={geraet} onClose={() => setAusgabe(false)} />}
      {rueckgabe && offen && <RueckgabeModal ausleihe={offen} onClose={() => setRueckgabe(false)} />}
      {loeschen && (
        <Modal
          open
          onClose={() => setLoeschen(null)}
          title="Verleih löschen?"
          footer={
            <>
              <Button variant="secondary" onClick={() => setLoeschen(null)}>
                Abbrechen
              </Button>
              <Button
                variant="danger"
                icon={<Trash2 size={16} />}
                onClick={async () => {
                  await db.ausleihen.delete(loeschen.id)
                  setLoeschen(null)
                }}
              >
                Endgültig löschen
              </Button>
            </>
          }
        >
          <p>
            Der Verleih an <b>{loeschen.empfaenger}</b> vom {fmtDatumZeit(loeschen.ausgabeZeit)} wird mit Inventar-Checkliste und Rückgabe gelöscht.
            {loeschen.status === 'verliehen' && ' Das Gerät gilt danach wieder als bei Ihnen.'}
          </p>
          <p className="mt-2 text-sm text-gray-600">Mängel, die bei der Rückgabe angelegt wurden, bleiben am Gerät bestehen. Bereits ausgedruckte Protokolle sind davon nicht betroffen.</p>
        </Modal>
      )}
    </div>
  )
}

function Zeile({ k, v }: { k: string; v?: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-36 shrink-0 text-gray-600">{k}</dt>
      <dd className="min-w-0 font-semibold">{v || '–'}</dd>
    </div>
  )
}

function KofferLabel({ p, n, von }: { p: VerleihPosition; n: number; von?: number }) {
  return (
    <span className="flex items-start gap-2">
      <Briefcase size={18} className="mt-0.5 shrink-0" />
      <span>
        {p.bezeichnung}
        <span className="block text-xs text-gray-600">
          {p.inventarnummer ? `Inv.-Nr. ${p.inventarnummer} · ` : ''}
          {von !== undefined ? `${n} von ${von} Teilen im Koffer` : `${n} Teil${n === 1 ? '' : 'e'} im Koffer`}
        </span>
      </span>
    </span>
  )
}

function teilLabel(p: VerleihPosition) {
  return (
    <span>
      {p.bezeichnung}
      {p.anzahl ? ` (${p.anzahl} Stk.)` : ''}
      <span className="block text-xs text-gray-600">
        {p.inventarnummer ? `Inv.-Nr. ${p.inventarnummer}` : 'ohne Inventarnummer'}
        {p.seriennummer ? ` · S/N ${p.seriennummer}` : ''}
      </span>
    </span>
  )
}

/** Aufklappbarer Kofferinhalt */
function KofferInhalt({ g, children }: { g: InventarGruppe; children: (x: InventarGruppe['inhalt'][number]) => ReactNode }) {
  return (
    <details className="group ml-9 mb-2">
      <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1 text-sm font-semibold text-rot-700">
        <ChevronRight size={16} className="transition-transform group-open:rotate-90" />
        Inhalt anzeigen ({g.inhalt.length} Teil{g.inhalt.length === 1 ? '' : 'e'})
      </summary>
      <ul className="mt-1 flex flex-col border-l-2 border-linie pl-3">
        {g.inhalt.map((x) => (
          <li key={x.pos.teilId}>{children(x)}</li>
        ))}
      </ul>
    </details>
  )
}

function AusgabeModal({ geraet, onClose }: { geraet: Geraet; onClose: () => void }) {
  const mitglied = useMitgliedschaft()
  const [a, setA] = useState<Ausleihe>(() => ({
    id: neueId(),
    orgId: geraet.orgId,
    geraetId: geraet.id,
    status: 'verliehen',
    empfaenger: '',
    ausgabeZeit: jetzt(),
    ausgabeDurch: mitglied?.anzeigename ?? '',
    positionen: inventarPositionen(geraet),
    erstelltAm: jetzt(),
  }))
  const [fehler, setFehler] = useState('')
  const set = (p: Partial<Ausleihe>) => setA({ ...a, ...p })
  const setPos = (i: number, p: Partial<VerleihPosition>) => set({ positionen: a.positionen.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  const alleAn = a.positionen.every((p) => p.ausgegeben)

  const speichern = async () => {
    const f = ausgabeFehler(a)
    if (f) return setFehler(f)
    const sauber: Ausleihe = {
      ...a,
      empfaenger: a.empfaenger.trim(),
      ausgabeDurch: a.ausgabeDurch.trim(),
      ansprechperson: a.ansprechperson?.trim() || undefined,
      telefon: a.telefon?.trim() || undefined,
      email: a.email?.trim() || undefined,
      zweck: a.zweck?.trim() || undefined,
      ausgabeBemerkung: a.ausgabeBemerkung?.trim() || undefined,
    }
    await db.ausleihen.add(sauber)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${geraet.name} verleihen`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button icon={<Handshake size={18} />} onClick={speichern}>
            Ausgabe speichern
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <TextInput label="Organisation / Feuerwehr *" value={a.empfaenger} onChange={(e) => set({ empfaenger: e.target.value })} placeholder="z. B. FF Nachbarort" autoFocus />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextInput label="Ansprechperson" value={a.ansprechperson ?? ''} onChange={(e) => set({ ansprechperson: e.target.value })} />
          <TextInput label="Telefon" type="tel" value={a.telefon ?? ''} onChange={(e) => set({ telefon: e.target.value })} />
          <TextInput label="E-Mail" type="email" value={a.email ?? ''} onChange={(e) => set({ email: e.target.value })} />
        </div>
        <TextInput label="Zweck" value={a.zweck ?? ''} onChange={(e) => set({ zweck: e.target.value })} placeholder="z. B. Personensuche, Übung, Ausbildung" />
        <div className="grid gap-4 sm:grid-cols-3">
          <TextInput label="Ausgabe am *" type="datetime-local" value={toLocalInput(a.ausgabeZeit)} onChange={(e) => set({ ausgabeZeit: fromLocalInput(e.target.value) ?? a.ausgabeZeit })} />
          <TextInput label="Übergeben durch *" value={a.ausgabeDurch} onChange={(e) => set({ ausgabeDurch: e.target.value })} />
          <TextInput label="Geplante Rückgabe" type="date" value={a.geplanteRueckgabe?.slice(0, 10) ?? ''} onChange={(e) => set({ geplanteRueckgabe: fromDateInput(e.target.value) })} />
        </div>

        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="label mb-0">Inventar-Checkliste – mitgegeben</span>
            <Button variant="ghost" size="sm" onClick={() => set({ positionen: a.positionen.map((p) => ({ ...p, ausgegeben: !alleAn })) })}>
              {alleAn ? 'Alle abwählen' : 'Alle abhaken'}
            </Button>
          </div>
          <ul className="divide-y divide-linie rounded-md border border-linie px-3">
            {inventarGruppen(a.positionen).map((g) => (
              <li key={g.pos.teilId}>
                <Checkbox
                  checked={g.pos.ausgegeben}
                  onChange={(v) => set({ positionen: setzeAusgegeben(a.positionen, g.pos.teilId, v) })}
                  label={g.inhalt.length ? <KofferLabel p={g.pos} n={g.inhalt.filter((x) => x.pos.ausgegeben).length} von={g.inhalt.length} /> : teilLabel(g.pos)}
                />
                {g.inhalt.length > 0 && (
                  <KofferInhalt g={g}>{(x) => <Checkbox checked={x.pos.ausgegeben} onChange={(v) => setPos(x.index, { ausgegeben: v })} label={teilLabel(x.pos)} />}</KofferInhalt>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs text-gray-600">Fehlt etwas im Inventar? Zuerst im Reiter „Inventar“ bzw. „Akkus“ ergänzen.</p>
        </div>
        <TextArea label="Bemerkung zur Ausgabe" value={a.ausgabeBemerkung ?? ''} onChange={(e) => set({ ausgabeBemerkung: e.target.value })} placeholder="z. B. Zustand, Ladestand der Akkus" />
        {fehler && <p className="text-sm font-semibold text-fehler">{fehler}</p>}
      </div>
    </Modal>
  )
}

function RueckgabeModal({ ausleihe, onClose }: { ausleihe: Ausleihe; onClose: () => void }) {
  const mitglied = useMitgliedschaft()
  const [a, setA] = useState<Ausleihe>(() => ({
    ...ausleihe,
    rueckgabeZeit: jetzt(),
    rueckgabeDurch: mitglied?.anzeigename ?? '',
    rueckgabeUebergebenVon: ausleihe.ansprechperson ?? '',
  }))
  const [fehler, setFehler] = useState('')
  const set = (p: Partial<Ausleihe>) => setA({ ...a, ...p })
  const setPos = (i: number, p: Partial<VerleihPosition>) => set({ positionen: a.positionen.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  // nur mitgegebene Teile prüfen; Kofferinhalt aufklappbar unter dem Koffer
  const gruppen = inventarGruppen(a.positionen)
    .map((g) => ({ ...g, inhalt: g.inhalt.filter((x) => x.pos.ausgegeben) }))
    .filter((g) => g.pos.ausgegeben || g.inhalt.length > 0)
  const { fehlend, beschaedigt } = rueckgabeErgebnis(a)

  const speichern = async () => {
    const f = rueckgabeFehler(a)
    if (f) return setFehler(f)
    const fertig: Ausleihe = {
      ...a,
      status: 'zurueck',
      rueckgabeDurch: a.rueckgabeDurch?.trim(),
      rueckgabeUebergebenVon: a.rueckgabeUebergebenVon?.trim() || undefined,
      rueckgabeBemerkung: a.rueckgabeBemerkung?.trim() || undefined,
    }
    const maengel = rueckgabeMaengel(fertig, neueId, jetzt())
    await db.transaction('rw', db.ausleihen, db.maengel, async () => {
      await db.ausleihen.put(fertig)
      if (maengel.length) await db.maengel.bulkAdd(maengel)
    })
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Rückgabe von ${ausleihe.empfaenger}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button icon={<Undo2 size={18} />} onClick={speichern}>
            Rückgabe speichern
          </Button>
        </>
      }
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextInput label="Rückgabe am *" type="datetime-local" value={toLocalInput(a.rueckgabeZeit)} onChange={(e) => set({ rueckgabeZeit: fromLocalInput(e.target.value) ?? a.rueckgabeZeit })} />
          <TextInput label="Zurückgegeben von" value={a.rueckgabeUebergebenVon ?? ''} onChange={(e) => set({ rueckgabeUebergebenVon: e.target.value })} />
          <TextInput label="Zurückgenommen durch *" value={a.rueckgabeDurch ?? ''} onChange={(e) => set({ rueckgabeDurch: e.target.value })} />
        </div>
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <span className="label mb-0">Inventar-Checkliste – Rückgabe</span>
            <Button variant="ghost" size="sm" onClick={() => set({ positionen: a.positionen.map((p) => (p.ausgegeben ? { ...p, rueckgabe: 'ok' } : p)) })}>
              Alle „zurück, ok“
            </Button>
          </div>
          <ul className="divide-y divide-linie rounded-md border border-linie px-3">
            {gruppen.map((g) => (
              <li key={g.pos.teilId} className="flex flex-col gap-2 py-3">
                {g.inhalt.length ? <KofferLabel p={g.pos} n={g.inhalt.length} /> : teilLabel(g.pos)}
                <Segmented
                  value={g.pos.rueckgabe}
                  onChange={(v) => set({ positionen: setzeRueckgabe(a.positionen, g.pos.teilId, v) })}
                  options={(['ok', 'beschaedigt', 'fehlt'] as const).map((v) => ({ value: v, label: RUECKGABE_LABEL[v] }))}
                />
                {g.pos.rueckgabe && g.pos.rueckgabe !== 'ok' && (
                  <TextInput label="Was ist passiert?" value={g.pos.bemerkung ?? ''} onChange={(e) => setPos(g.index, { bemerkung: e.target.value })} />
                )}
                {g.inhalt.length > 0 && (
                  <KofferInhalt g={g}>
                    {(x) => (
                      <div className="flex flex-col gap-2 py-2">
                        {teilLabel(x.pos)}
                        <Segmented
                          value={x.pos.rueckgabe}
                          onChange={(v) => setPos(x.index, { rueckgabe: v })}
                          options={(['ok', 'beschaedigt', 'fehlt'] as const).map((v) => ({ value: v, label: RUECKGABE_LABEL[v] }))}
                        />
                        {x.pos.rueckgabe && x.pos.rueckgabe !== 'ok' && (
                          <TextInput label="Was ist passiert?" value={x.pos.bemerkung ?? ''} onChange={(e) => setPos(x.index, { bemerkung: e.target.value })} />
                        )}
                      </div>
                    )}
                  </KofferInhalt>
                )}
              </li>
            ))}
          </ul>
          {a.positionen.some((p) => !p.ausgegeben) && (
            <p className="mt-1 text-xs text-gray-600">Nicht mitgegebene Teile werden bei der Rückgabe nicht geprüft.</p>
          )}
        </div>
        {(fehlend.length > 0 || beschaedigt.length > 0) && (
          <p className="rounded-md border border-rot-200 bg-fehler-bg p-3 text-sm font-semibold text-fehler">
            Für {fehlend.length + beschaedigt.length} Teil(e) wird automatisch ein offener Mangel am Gerät angelegt.
          </p>
        )}
        <TextArea label="Bemerkung zur Rückgabe" value={a.rueckgabeBemerkung ?? ''} onChange={(e) => set({ rueckgabeBemerkung: e.target.value })} />
        {fehler && <p className="text-sm font-semibold text-fehler">{fehler}</p>}
      </div>
    </Modal>
  )
}
