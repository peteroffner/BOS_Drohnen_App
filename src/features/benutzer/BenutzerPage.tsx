import { Copy, MailPlus, RefreshCw, Trash2, UserMinus, Users } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { Pilot } from '../../db/types'
import { Badge, Button, Card, EmptyState, Modal, NurAnsichtHinweis, PageHeader, Select, TextInput } from '../../components/ui'
import { fmtDatum, pilotName } from '../../lib/format'
import { ROLLEN, rollenLabel, type Rolle } from '../../lib/rechte'
import { supabase } from '../../lib/supabase'
import { useOrg } from '../../lib/useOrg'
import { useAuth, useDarf } from '../auth/kontext'
import { dbFehlerText, istEmail, mitgliedName, type EinladungZeile, type MitgliedZeile } from '../auth/logik'
import { usePiloten } from '../einsatz/data'
import { APP_LINK, einladungsText, einladungPruefen } from './logik'

const ROLLEN_OPTIONEN = ROLLEN.map((r) => ({ value: r.value, label: r.label }))

/** Mitglieder und Einladungen der Organisation laden */
async function holen(orgId: string | undefined) {
  if (!supabase || !orgId) return null
  return Promise.all([
    supabase.from('mitglieder').select('org_id,user_id,rolle,pilot_id,email,anzeigename,erstellt_am').eq('org_id', orgId).order('erstellt_am'),
    supabase.from('einladungen').select('id,org_id,email,rolle,pilot_id,erstellt_von,erstellt_am,angenommen_am').eq('org_id', orgId).order('erstellt_am', { ascending: false }),
  ])
}

/** Benutzerverwaltung (nur Administrator, Cloud-Modus): Mitglieder und Einladungen. */
export function BenutzerPage() {
  const darfVerwalten = useDarf('benutzer.verwalten')
  const org = useOrg()
  const piloten = usePiloten(org?.id ?? '')
  const { mitgliedschaft: ich, neuLaden: eigeneNeuLaden } = useAuth()
  const [mitglieder, setMitglieder] = useState<MitgliedZeile[]>()
  const [einladungen, setEinladungen] = useState<EinladungZeile[]>()
  const [fehler, setFehler] = useState<string>()
  const orgId = org?.id

  const anwenden = useCallback((r: Awaited<ReturnType<typeof holen>>) => {
    if (!r) return
    const [m, e] = r
    setFehler(m.error || e.error ? dbFehlerText(m.error ?? e.error) : undefined)
    if (!m.error) setMitglieder((m.data ?? []) as MitgliedZeile[])
    if (!e.error) setEinladungen((e.data ?? []) as EinladungZeile[])
  }, [])
  const laden = useCallback(async () => anwenden(await holen(orgId)), [orgId, anwenden])

  useEffect(() => {
    let beendet = false
    void holen(orgId).then((r) => {
      if (!beendet) anwenden(r)
    })
    return () => {
      beendet = true
    }
  }, [orgId, anwenden])

  if (!darfVerwalten)
    return (
      <>
        <PageHeader title="Benutzer" />
        <NurAnsichtHinweis text="Keine Berechtigung – die Benutzerverwaltung ist Administratoren vorbehalten." />
      </>
    )
  if (!org || !piloten) return null

  /** Änderung ausführen, Fehler anzeigen, danach neu laden */
  const aendern = async (fn: () => PromiseLike<{ error: unknown }>) => {
    const { error } = await fn()
    setFehler(error ? dbFehlerText(error) : undefined)
    await laden()
    return !error
  }

  return (
    <>
      <PageHeader
        title="Benutzer"
        subtitle="Mitglieder der Organisation, Rollen und Einladungen"
        actions={
          <Button variant="secondary" icon={<RefreshCw size={18} />} onClick={() => void laden()}>
            Aktualisieren
          </Button>
        }
      />
      {fehler && (
        <p role="alert" className="mb-4 rounded-md border border-rot-200 bg-fehler-bg p-3 font-semibold text-fehler">
          {fehler}
        </p>
      )}
      <div className="flex flex-col gap-4">
        <MitgliederCard
          mitglieder={mitglieder}
          piloten={piloten}
          ichId={ich?.userId}
          aendern={aendern}
          eigeneGeaendert={eigeneNeuLaden}
        />
        <EinladungenCard
          einladungen={einladungen}
          mitglieder={mitglieder ?? []}
          piloten={piloten}
          orgId={org.id}
          orgName={org.name}
          aendern={aendern}
        />
      </div>
    </>
  )
}

type Aendern = (fn: () => PromiseLike<{ error: unknown }>) => Promise<boolean>

const pilotOptionen = (piloten: Pilot[]) => piloten.filter((p) => p.aktiv).map((p) => ({ value: p.id, label: pilotName(p) }))

function MitgliederCard({
  mitglieder,
  piloten,
  ichId,
  aendern,
  eigeneGeaendert,
}: {
  mitglieder: MitgliedZeile[] | undefined
  piloten: Pilot[]
  ichId?: string
  aendern: Aendern
  eigeneGeaendert: () => Promise<void>
}) {
  const [entfernen, setEntfernen] = useState<MitgliedZeile | null>(null)
  const [selbstRolle, setSelbstRolle] = useState<Rolle | null>(null)
  if (!supabase) return null
  const sb = supabase

  const rolleSetzen = async (m: MitgliedZeile, rolle: Rolle) => {
    const ok = await aendern(() => sb.rpc('mitglied_rolle_aendern', { p_user_id: m.user_id, p_rolle: rolle }))
    if (ok && m.user_id === ichId) await eigeneGeaendert()
  }
  const pilotSetzen = async (m: MitgliedZeile, pilotId: string) => {
    const ok = await aendern(() => sb.rpc('mitglied_pilot_zuordnen', { p_user_id: m.user_id, p_pilot_id: pilotId || null }))
    if (ok && m.user_id === ichId) await eigeneGeaendert()
  }
  const ich = mitglieder?.find((m) => m.user_id === ichId)

  return (
    <Card title={`Mitglieder${mitglieder ? ` (${mitglieder.length})` : ''}`}>
      {mitglieder === undefined ? (
        <p className="text-sm text-gray-600">Wird geladen …</p>
      ) : mitglieder.length === 0 ? (
        <EmptyState icon={<Users size={36} />} title="Keine Mitglieder" />
      ) : (
        <ul className="-m-4 divide-y divide-linie" data-testid="mitglieder">
          {mitglieder.map((m) => {
            const pilot = piloten.find((p) => p.id === m.pilot_id)
            const opts = pilotOptionen(piloten)
            if (pilot && !opts.some((o) => o.value === pilot.id)) opts.push({ value: pilot.id, label: `${pilotName(pilot)} (inaktiv)` })
            return (
              <li key={m.user_id} className="grid gap-3 p-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-dunkel">{mitgliedName(m)}</span>
                    {m.user_id === ichId && <Badge color="gruen">Du</Badge>}
                  </div>
                  <div className="break-all text-sm text-gray-600">{m.email}</div>
                  {m.erstellt_am && <div className="text-xs text-gray-500">Mitglied seit {fmtDatum(m.erstellt_am)}</div>}
                </div>
                <Select
                  label="Rolle"
                  value={m.rolle}
                  options={ROLLEN_OPTIONEN}
                  onChange={(e) => {
                    const r = e.target.value as Rolle
                    if (m.user_id === ichId && m.rolle === 'admin' && r !== 'admin') setSelbstRolle(r)
                    else void rolleSetzen(m, r)
                  }}
                />
                <Select
                  label="Verknüpfter Pilot"
                  value={m.pilot_id ?? ''}
                  options={opts}
                  placeholder="– kein Pilot –"
                  onChange={(e) => void pilotSetzen(m, e.target.value)}
                />
                <Button variant="secondary" icon={<UserMinus size={18} />} onClick={() => setEntfernen(m)} aria-label={`${mitgliedName(m)} entfernen`}>
                  Entfernen
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-6 text-xs text-gray-600">
        Rollen: {ROLLEN.map((r) => `${r.label} – ${r.beschreibung}`).join(' · ')}. Der verknüpfte Pilot bestimmt, welche Einsätze und Stammdaten als „eigene“ gelten.
      </p>

      <Modal
        open={!!entfernen}
        onClose={() => setEntfernen(null)}
        title="Mitglied entfernen?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEntfernen(null)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              icon={<UserMinus size={18} />}
              onClick={async () => {
                const m = entfernen!
                setEntfernen(null)
                const ok = await aendern(() => sb.rpc('mitglied_entfernen', { p_user_id: m.user_id }))
                if (ok && m.user_id === ichId) await eigeneGeaendert()
              }}
            >
              Entfernen
            </Button>
          </>
        }
      >
        {entfernen && (
          <p>
            <b>{mitgliedName(entfernen)}</b> ({entfernen.email}) verliert den Zugang zu allen Daten der Organisation. Einsätze und Flugbuch-Einträge bleiben erhalten.
            {entfernen.user_id === ichId && <b className="mt-2 block text-fehler">Achtung: Du entfernst dich selbst und hast danach keinen Zugang mehr.</b>}
          </p>
        )}
      </Modal>

      <Modal
        open={!!selbstRolle}
        onClose={() => setSelbstRolle(null)}
        title="Eigene Admin-Rechte abgeben?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setSelbstRolle(null)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const r = selbstRolle!
                setSelbstRolle(null)
                if (ich) await rolleSetzen(ich, r)
              }}
            >
              Rolle ändern
            </Button>
          </>
        }
      >
        <p>
          Du änderst deine eigene Rolle auf <b>{selbstRolle && rollenLabel(selbstRolle)}</b>. Danach kannst du Benutzer, Freigaben und Einstellungen nicht mehr verwalten.
        </p>
      </Modal>
    </Card>
  )
}

function EinladungenCard({
  einladungen,
  mitglieder,
  piloten,
  orgId,
  orgName,
  aendern,
}: {
  einladungen: EinladungZeile[] | undefined
  mitglieder: MitgliedZeile[]
  piloten: Pilot[]
  orgId: string
  orgName: string
  aendern: Aendern
}) {
  const [email, setEmail] = useState('')
  const [rolle, setRolle] = useState<Rolle>('pilot')
  const [pilotId, setPilotId] = useState('')
  const [formFehler, setFormFehler] = useState<string>()
  const [laeuft, setLaeuft] = useState(false)
  const [kopiert, setKopiert] = useState(false)
  if (!supabase) return null
  const sb = supabase
  const offen = (einladungen ?? []).filter((e) => !e.angenommen_am)
  const angenommen = (einladungen ?? []).filter((e) => e.angenommen_am)
  const pilot = (id: string | null) => (id ? pilotName(piloten.find((p) => p.id === id)) || 'unbekannter Pilot' : undefined)

  const einladen = async () => {
    const f = einladungPruefen(email, mitglieder, offen)
    if (f) return setFormFehler(f)
    setFormFehler(undefined)
    setLaeuft(true)
    const ok = await aendern(() =>
      sb.from('einladungen').insert({ org_id: orgId, email: email.trim().toLowerCase(), rolle, pilot_id: pilotId || null }),
    )
    setLaeuft(false)
    if (ok) {
      setEmail('')
      setPilotId('')
    }
  }

  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(einladungsText(orgName))
      setKopiert(true)
      window.setTimeout(() => setKopiert(false), 2500)
    } catch {
      /* Zwischenablage nicht verfügbar */
    }
  }

  return (
    <Card title="Einladungen">
      <div className="flex flex-col gap-5">
        <form
          className="grid gap-4 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            void einladen()
          }}
        >
          <TextInput label="E-Mail-Adresse" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@feuerwehr.at" autoComplete="off" />
          <Select label="Rolle" value={rolle} options={ROLLEN_OPTIONEN} onChange={(e) => setRolle(e.target.value as Rolle)} />
          <Select label="Pilot verknüpfen (optional)" value={pilotId} options={pilotOptionen(piloten)} placeholder="– kein Pilot –" onChange={(e) => setPilotId(e.target.value)} />
          <Button type="submit" icon={<MailPlus size={18} />} disabled={!istEmail(email) || laeuft}>
            Einladen
          </Button>
        </form>
        {formFehler && (
          <p role="alert" className="-mt-2 text-sm font-semibold text-fehler">
            {formFehler}
          </p>
        )}

        <div className="rounded-md border border-amber-200 bg-warn-bg p-3 text-sm text-anthrazit">
          <p className="font-bold text-warn">So geht die eingeladene Person vor</p>
          <ol className="mt-1 list-decimal pl-5">
            <li>
              App öffnen:{' '}
              <a className="break-all font-semibold text-rot-700 underline" href={APP_LINK} target="_blank" rel="noreferrer">
                {APP_LINK}
              </a>
            </li>
            <li>„Registrieren“ wählen – mit genau der eingeladenen E-Mail-Adresse.</li>
            <li>Bestätigungsmail öffnen, danach anmelden. Die Zuordnung zur Organisation erfolgt automatisch.</li>
          </ol>
          <p className="mt-1 text-xs text-gray-600">Die App verschickt selbst keine Einladungsmail – bitte den Text weitergeben (E-Mail, Messenger).</p>
          <Button className="mt-2" size="sm" variant="secondary" icon={<Copy size={16} />} onClick={() => void kopieren()}>
            {kopiert ? 'Kopiert' : 'Einladungstext kopieren'}
          </Button>
        </div>

        <div>
          <h3 className="mb-2 font-bold">Offen ({offen.length})</h3>
          {einladungen === undefined ? (
            <p className="text-sm text-gray-600">Wird geladen …</p>
          ) : offen.length === 0 ? (
            <p className="text-sm text-gray-600">Keine offenen Einladungen.</p>
          ) : (
            <ul className="divide-y divide-linie rounded-md border border-linie" data-testid="einladungen-offen">
              {offen.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="break-all font-semibold">{e.email}</div>
                    <div className="text-sm text-gray-600">
                      {rollenLabel(e.rolle)}
                      {e.pilot_id && ` · Pilot: ${pilot(e.pilot_id)}`} · eingeladen am {fmtDatum(e.erstellt_am)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    icon={<Trash2 size={18} />}
                    aria-label={`Einladung für ${e.email} löschen`}
                    onClick={() => void aendern(() => sb.from('einladungen').delete().eq('id', e.id))}
                  >
                    <span className="hidden sm:inline">Löschen</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {angenommen.length > 0 && (
          <div>
            <h3 className="mb-2 font-bold">Angenommen ({angenommen.length})</h3>
            <ul className="divide-y divide-linie rounded-md border border-linie">
              {angenommen.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <div className="break-all font-semibold">{e.email}</div>
                    <div className="text-sm text-gray-600">
                      {rollenLabel(e.rolle)} · angenommen am {fmtDatum(e.angenommen_am!)}
                    </div>
                  </div>
                  <Badge color="gruen">angenommen</Badge>
                  <Button
                    variant="ghost"
                    icon={<Trash2 size={18} />}
                    aria-label={`Einladung für ${e.email} aus der Liste löschen`}
                    onClick={() => void aendern(() => sb.from('einladungen').delete().eq('id', e.id))}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  )
}
