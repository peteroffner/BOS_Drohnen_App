import { ArrowLeft, ArrowRight, FileDown, Printer, Trash2 } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { db, jetzt } from '../../db/db'
import type { ChecklistAntwort, ChecklistItem, ChecklistPhase, Einsatz } from '../../db/types'
import { Badge, Button, Card, EmptyState, Modal, NurAnsichtHinweis } from '../../components/ui'
import { fmtDatumZeit } from '../../lib/format'
import { useOrg } from '../../lib/useOrg'
import { useEinsatzRechte } from '../auth/kontext'
import { VORLAGEN } from '../../templates/checkliste_v9'
import { AbschlussSchritt } from './components/Abschluss'
import { ChecklisteSektion } from './components/Checkliste'
import { EinsatzDatenForm } from './components/EinsatzDatenForm'
import { EinsatzendeSchritt } from './components/Einsatzende'
import { EinsatzProtokoll } from './components/EinsatzProtokoll'
import { EreignisLog } from './components/EreignisLog'
import { FluegeSchritt } from './components/Fluege'
import { KarteCard } from './components/KarteCard'
import { SchrittLeiste } from './components/SchrittLeiste'
import { schritte, startSchritt } from './logic/schritte'
import { aendereEinsatz, gleicheMaengelAb, loescheEinsatz, speichereAntwort, useEinsaetze, useGeraete, useMaengel, usePiloten } from './data'
import { flugFreigabe, istDronespaceItem, sektionenFuerPhase } from './logic/checkliste'
import { ART_LABEL, STATUS_FARBE, STATUS_LABEL } from './logic/einsatz'

const PHASE_JE_SCHRITT: Record<number, ChecklistPhase> = { 2: 'vorbereitung', 3: 'vorflug', 4: 'betrieb', 7: 'nachkontrolle' }

/** Felder aus Schritt 1 (Einsatzdaten) */
const DATEN_FELDER = [
  'datum',
  'art',
  'alarmierungVon',
  'grund',
  'fluggebiet',
  'gemeinde',
  'position',
  'geraetIds',
  'rechtsgrundlage',
  'openUnterkategorie',
  'bescheidNr',
  'flugart',
  'geplanteFlughoeheM',
  'payload',
  'rollen',
] as const satisfies readonly (keyof Einsatz)[]

export function EinsatzDetailPage() {
  const { id = '' } = useParams()
  const org = useOrg()
  const orgId = org?.id ?? ''
  const einsatz = useLiveQuery(async () => (await db.einsaetze.get(id)) ?? null, [id])
  const piloten = usePiloten(orgId)
  const geraete = useGeraete(orgId)
  const maengel = useMaengel(orgId)
  const einsaetze = useEinsaetze(orgId)

  if (einsatz === undefined || !org || !piloten || !geraete || !maengel || !einsaetze) return null
  if (einsatz === null || einsatz.orgId !== org.id) {
    return (
      <EmptyState
        title="Einsatz nicht gefunden"
        action={
          <Link to="/einsaetze" className="font-semibold text-rot-700 underline">
            Zur Einsatzliste
          </Link>
        }
      />
    )
  }
  return (
    <Detail
      key={einsatz.id}
      einsatz={einsatz}
      ctx={{ org, piloten, geraete, maengel, einsaetze }}
    />
  )
}

type Ctx = {
  org: NonNullable<ReturnType<typeof useOrg>>
  piloten: NonNullable<ReturnType<typeof usePiloten>>
  geraete: NonNullable<ReturnType<typeof useGeraete>>
  maengel: NonNullable<ReturnType<typeof useMaengel>>
  einsaetze: NonNullable<ReturnType<typeof useEinsaetze>>
}

function Detail({ einsatz, ctx }: { einsatz: Einsatz; ctx: Ctx }) {
  const nav = useNavigate()
  const [params, setParams] = useSearchParams()
  const [loeschen, setLoeschen] = useState(false)
  const [gespeichert, setGespeichert] = useState(false)
  const [pdf, setPdf] = useState<'aus' | 'laeuft' | 'fehler'>('aus')
  const vorlage = VORLAGEN[einsatz.vorlageId]
  const liste = schritte(einsatz, vorlage)
  const [vorschlag] = useState(() => startSchritt(einsatz, liste))
  const aktiv = Math.min(8, Math.max(1, Number(params.get('schritt')) || vorschlag))
  const rechte = useEinsatzRechte(einsatz)
  const abgeschlossen = einsatz.status === 'abgeschlossen'
  /** schreibgeschützt: abgeschlossen ODER keine Berechtigung (Cloud-Modus) */
  const gesperrt = abgeschlossen || !rechte.bearbeiten
  const freigabe = vorlage ? flugFreigabe(einsatz, vorlage) : { frei: true, offen: [], uebersteuert: [] }

  const geheZu = (nr: number) => {
    setParams((p) => {
      const n = new URLSearchParams(p)
      n.set('schritt', String(nr))
      return n
    }, { replace: true })
    window.scrollTo({ top: 0 })
  }

  const onAntwort = (item: ChecklistItem, wert: ChecklistAntwort | undefined) => {
    if (gesperrt) return
    void speichereAntwort(einsatz.id, item.id, wert, (e) => {
      if (istDronespaceItem(item)) e.dronespaceGeprueft = wert === true ? jetzt() : undefined
    })
  }

  const phase = PHASE_JE_SCHRITT[aktiv]
  const titel = liste[aktiv - 1].titel

  return (
    <>
      <div className="print:hidden">
        <div className="mb-3">
          <Link to="/einsaetze" className="inline-flex min-h-11 items-center gap-1 font-semibold text-rot-700">
            <ArrowLeft size={18} /> Einsätze
          </Link>
        </div>
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="break-words text-2xl font-bold text-dunkel">{einsatz.fluggebiet || einsatz.grund || 'Einsatz'}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-700">
              <Badge color={einsatz.art === 'einsatz' ? 'rot' : 'grau'}>{ART_LABEL[einsatz.art]}</Badge>
              <span>{fmtDatumZeit(einsatz.datum)}</span>
              {einsatz.gemeinde && <span>· {einsatz.gemeinde}</span>}
              <Badge color={STATUS_FARBE[einsatz.status]}>{STATUS_LABEL[einsatz.status]}</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              icon={<FileDown size={18} />}
              disabled={pdf === 'laeuft'}
              onClick={async () => {
                setPdf('laeuft')
                try {
                  const { exportEinsatzPdf } = await import('../auswertung/export/einsatzPdf')
                  await exportEinsatzPdf(einsatz.id)
                  setPdf('aus')
                } catch (err) {
                  console.error(err)
                  setPdf('fehler')
                }
              }}
            >
              {pdf === 'laeuft' ? 'PDF wird erstellt …' : 'PDF-Protokoll'}
            </Button>
            <Button variant="secondary" icon={<Printer size={18} />} onClick={() => window.print()}>
              Protokoll drucken
            </Button>
            {rechte.loeschen && (
              <Button variant="secondary" icon={<Trash2 size={18} />} onClick={() => setLoeschen(true)} aria-label="Einsatz löschen">
                <span className="hidden sm:inline">Löschen</span>
              </Button>
            )}
          </div>
        </header>

        {pdf === 'fehler' && (
          <p role="alert" className="mb-3 font-semibold text-fehler">
            PDF konnte nicht erstellt werden – bitte „Protokoll drucken“ verwenden.
          </p>
        )}
        {!abgeschlossen && !rechte.bearbeiten && (
          <NurAnsichtHinweis className="mb-3" text="Keine Berechtigung – nur Ansicht. Diesen Einsatz können nur der Anleger, eingetragene Piloten oder Teamleiter bearbeiten." />
        )}
        <SchrittLeiste liste={liste} aktiv={aktiv} onWahl={geheZu} />
        <h2 className="mb-3 mt-4 text-xl font-bold text-dunkel">
          <span className="text-rot-700">{aktiv}.</span> {titel}
        </h2>

        <div className="flex flex-col gap-4">
          {aktiv === 1 && (
            <>
              <EinsatzDatenForm
                start={einsatz}
                org={ctx.org}
                piloten={ctx.piloten}
                geraete={ctx.geraete}
                maengel={ctx.maengel}
                einsaetze={ctx.einsaetze}
                gesperrt={gesperrt}
                speichernLabel="Änderungen speichern"
                onSpeichern={async (neu) => {
                  await aendereEinsatz(einsatz.id, (e) => {
                    for (const k of DATEN_FELDER) (e as unknown as Record<string, unknown>)[k] = neu[k]
                  })
                  await gleicheMaengelAb(einsatz.id)
                  setGespeichert(true)
                  window.setTimeout(() => setGespeichert(false), 2500)
                }}
              />
              {gespeichert && (
                <p role="status" className="font-semibold text-ok">
                  Gespeichert
                </p>
              )}
              <KarteCard einsatz={einsatz} />
            </>
          )}

          {phase && vorlage && (
            <>
              {aktiv === 2 && <KarteCard einsatz={einsatz} />}
              {sektionenFuerPhase(vorlage, phase).map((s) => (
                <ChecklisteSektion key={s.id} sektion={s} einsatz={einsatz} gesperrt={gesperrt} onAntwort={onAntwort} />
              ))}
              {aktiv === 4 && !gesperrt && (
                <Card>
                  {freigabe.frei ? (
                    <p className="font-semibold text-ok">Alle Pflichtpunkte erledigt{freigabe.uebersteuert.length > 0 && ' bzw. übersteuert'} – Flug kann durchgeführt werden.</p>
                  ) : (
                    <p className="font-semibold text-fehler">
                      Noch {freigabe.offen.length} Pflichtpunkt{freigabe.offen.length === 1 ? '' : 'e'} in Schritt 2–4 offen.
                    </p>
                  )}
                </Card>
              )}
            </>
          )}
          {phase && !vorlage && <EmptyState title={`Checklisten-Vorlage „${einsatz.vorlageId}“ nicht gefunden`} />}

          {aktiv === 5 && (
            <>
              <FluegeSchritt einsatz={einsatz} piloten={ctx.piloten} geraete={ctx.geraete} freigabe={freigabe} gesperrt={gesperrt} />
              <EreignisLog einsatz={einsatz} gesperrt={gesperrt} />
            </>
          )}
          {aktiv === 6 && <EinsatzendeSchritt einsatz={einsatz} gesperrt={gesperrt} />}
          {aktiv === 8 && <AbschlussSchritt einsatz={einsatz} nurAnsicht={!rechte.bearbeiten} darfNachtrag={rechte.nachtrag} />}

          <div className="flex justify-between gap-2">
            {aktiv > 1 ? (
              <Button variant="secondary" icon={<ArrowLeft size={18} />} onClick={() => geheZu(aktiv - 1)}>
                Zurück
              </Button>
            ) : (
              <span />
            )}
            {aktiv < 8 && (
              <Button onClick={() => geheZu(aktiv + 1)}>
                Weiter: {liste[aktiv].titel} <ArrowRight size={18} />
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="hidden print:block">
        <EinsatzProtokoll einsatz={einsatz} vorlage={vorlage} org={ctx.org} piloten={ctx.piloten} geraete={ctx.geraete} />
      </div>

      <Modal
        open={loeschen}
        onClose={() => setLoeschen(false)}
        title="Einsatz löschen?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setLoeschen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              icon={<Trash2 size={18} />}
              onClick={async () => {
                await loescheEinsatz(einsatz.id)
                nav('/einsaetze', { replace: true })
              }}
            >
              Endgültig löschen
            </Button>
          </>
        }
      >
        <p>
          Der Einsatz mit allen Checklisten-Antworten, {einsatz.fluege.length} Flug/Flügen und dem Ereignis-Log wird gelöscht. Dies kann nicht rückgängig gemacht
          werden.
        </p>
      </Modal>
    </>
  )
}
