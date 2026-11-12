import { Building2, CloudUpload, LogOut, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { db } from '../../db/db'
import type { OrgTyp } from '../../db/types'
import { Button, Select, TextInput } from '../../components/ui'
import { supabase } from '../../lib/supabase'
import { lokaleDatenUebernehmen } from '../../sync'
import { ORG_TYPEN } from '../einstellungen/orgTypen'
import { abmelden } from './abmelden'
import { AuthRahmen, Meldung } from './AuthRahmen'
import { useAuth } from './kontext'
import { dbFehlerText } from './logik'

type Schritt = 'info' | 'org' | 'uebernehmen'

/** Angemeldet, aber (noch) keiner Organisation zugeordnet. */
export function KeinZugangSeite() {
  const { session, neuLaden } = useAuth()
  const [schritt, setSchritt] = useState<Schritt>('info')
  const [neueOrgId, setNeueOrgId] = useState<string>()
  const [lokal, setLokal] = useState(0)
  const [pruefen, setPruefen] = useState(false)
  const email = session?.user.email ?? ''

  if (schritt === 'org')
    return (
      <OrgAnlegen
        onAbbrechen={() => setSchritt('info')}
        onAngelegt={async (id) => {
          setNeueOrgId(id)
          // Phase-1-Daten auf diesem Gerät?
          const n = (await db.piloten.count()) + (await db.geraete.count()) + (await db.einsaetze.count())
          if (n > 0 && id) {
            setLokal(n)
            setSchritt('uebernehmen')
          } else await neuLaden()
        }}
      />
    )

  if (schritt === 'uebernehmen' && neueOrgId)
    return <Uebernehmen anzahl={lokal} orgId={neueOrgId} onFertig={neuLaden} />

  return (
    <AuthRahmen titel="Kein Zugang" untertitel={`Angemeldet als ${email}`}>
      <p>
        Dein Konto ist noch keiner Organisation zugeordnet. Bitte vom Administrator deiner Organisation einladen lassen – <b>mit genau dieser E-Mail-Adresse</b> (
        <span className="break-all">{email}</span>).
      </p>
      <p className="text-sm text-gray-600">Sobald die Einladung angelegt ist, „Erneut prüfen“ wählen.</p>
      <Button
        size="lg"
        icon={<RefreshCw size={20} />}
        disabled={pruefen}
        onClick={async () => {
          setPruefen(true)
          await neuLaden()
          setPruefen(false)
        }}
      >
        {pruefen ? 'Wird geprüft …' : 'Erneut prüfen'}
      </Button>
      <div className="mt-2 border-t border-linie pt-4">
        <h2 className="font-bold">Neue Organisation einrichten</h2>
        <p className="mb-3 text-sm text-gray-600">
          Nur für die erstmalige Einrichtung: Du legst eine neue Organisation (z. B. deine Feuerwehr) an und wirst deren Administrator.
        </p>
        <Button variant="secondary" icon={<Building2 size={20} />} onClick={() => setSchritt('org')}>
          Neue Organisation einrichten
        </Button>
      </div>
      <div className="border-t border-linie pt-2">
        <Button variant="ghost" icon={<LogOut size={18} />} onClick={() => void abmelden()}>
          Abmelden
        </Button>
      </div>
    </AuthRahmen>
  )
}

function OrgAnlegen({ onAbbrechen, onAngelegt }: { onAbbrechen: () => void; onAngelegt: (id: string | undefined) => Promise<void> }) {
  const [name, setName] = useState('')
  const [typ, setTyp] = useState<OrgTyp>('FF')
  const [bezirk, setBezirk] = useState('')
  const [bundesland, setBundesland] = useState('')
  const [fehler, setFehler] = useState<string>()
  const [laeuft, setLaeuft] = useState(false)

  const anlegen = async () => {
    if (!supabase || !name.trim()) return
    setLaeuft(true)
    setFehler(undefined)
    const { data, error } = await supabase.rpc('organisation_anlegen', {
      p_name: name.trim(),
      p_typ: typ,
      p_bezirk: bezirk.trim() || null,
      p_bundesland: bundesland.trim() || null,
    })
    if (error) {
      setLaeuft(false)
      return setFehler(dbFehlerText(error))
    }
    // RPC liefert die neue Org-ID (uuid) – sonst über die Mitgliedschaft ermitteln
    let id: string | undefined = typeof data === 'string' ? data : (data as { id?: string } | null)?.id
    if (!id && supabase) {
      const uid = (await supabase.auth.getUser()).data.user?.id
      const r = uid ? await supabase.from('mitglieder').select('org_id').eq('user_id', uid).maybeSingle<{ org_id: string }>() : null
      id = r?.data?.org_id
    }
    await onAngelegt(id)
    setLaeuft(false)
  }

  return (
    <AuthRahmen titel="Organisation einrichten" untertitel="Du wirst Administrator dieser Organisation.">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void anlegen()
        }}
      >
        <Select label="Organisationstyp" value={typ} onChange={(e) => setTyp(e.target.value as OrgTyp)} options={ORG_TYPEN} />
        <TextInput label="Name der Organisation" placeholder="z. B. FF Musterdorf" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextInput label="Bezirk" value={bezirk} onChange={(e) => setBezirk(e.target.value)} />
          <TextInput label="Bundesland" value={bundesland} onChange={(e) => setBundesland(e.target.value)} />
        </div>
        {fehler && <Meldung art="fehler">{fehler}</Meldung>}
        <Button type="submit" size="lg" disabled={!name.trim() || laeuft}>
          {laeuft ? 'Wird angelegt …' : 'Organisation anlegen'}
        </Button>
        <Button variant="secondary" onClick={onAbbrechen} disabled={laeuft}>
          Zurück
        </Button>
      </form>
    </AuthRahmen>
  )
}

function Uebernehmen({ anzahl, orgId, onFertig }: { anzahl: number; orgId: string; onFertig: () => Promise<void> }) {
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState<string>()
  return (
    <AuthRahmen titel="Lokale Daten übernehmen?" untertitel="Organisation wurde angelegt.">
      <p>
        Auf diesem Gerät liegen noch <b>{anzahl}</b> Datensätze (Piloten, Geräte, Einsätze) aus der bisherigen Nutzung ohne Anmeldung. Sollen diese in die neue
        Cloud-Organisation übernommen werden? Sie stehen danach allen Mitgliedern zur Verfügung.
      </p>
      {fehler && <Meldung art="fehler">{fehler}</Meldung>}
      <Button
        size="lg"
        icon={<CloudUpload size={20} />}
        disabled={laeuft}
        onClick={async () => {
          setLaeuft(true)
          try {
            await lokaleDatenUebernehmen(orgId)
            await onFertig()
          } catch (e) {
            setFehler(`Übernahme fehlgeschlagen: ${(e as Error).message}`)
            setLaeuft(false)
          }
        }}
      >
        {laeuft ? 'Wird übernommen …' : 'Lokale Daten in die Cloud übernehmen'}
      </Button>
      <Button variant="secondary" disabled={laeuft} onClick={() => void onFertig()}>
        Nicht übernehmen
      </Button>
      <p className="text-xs text-gray-600">Nicht übernommene Daten sind in der Cloud-Organisation nicht sichtbar und werden beim Abmelden von diesem Gerät gelöscht.</p>
    </AuthRahmen>
  )
}
