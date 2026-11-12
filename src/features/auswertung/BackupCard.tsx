import { useLiveQuery } from 'dexie-react-hooks'
import { DatabaseBackup, Download, FlaskConical, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import { db } from '../../db/db'
import { Button, Card, Modal } from '../../components/ui'
import { fmtDatumZeit } from '../../lib/format'
import { useOrg } from '../../lib/useOrg'
import {
  BACKUP_ERINNERUNG_TAGE,
  backupDateiname,
  backupErzeugen,
  backupValidieren,
  backupWiederherstellen,
  LETZTES_BACKUP_KEY,
  TABELLEN,
  TABELLEN_LABEL,
  tageSeit,
  type BackupDatei,
} from './backup'
import { demodatenLaden, vorhandeneDaten } from './demo'
import { downloadBlob } from './export/download'

type Meldung = { art: 'ok' | 'fehler'; text: string } | null

export function BackupCard() {
  const org = useOrg()
  const letztes = useLiveQuery(async () => (await db.einstellungen.get(LETZTES_BACKUP_KEY))?.value as string | undefined, [])
  const datenAnzahl = useLiveQuery(async () => (org ? vorhandeneDaten(db, org.id) : undefined), [org?.id])
  const [meldung, setMeldung] = useState<Meldung>(null)
  const [laeuft, setLaeuft] = useState(false)
  const [vorschau, setVorschau] = useState<{ datei: string; daten: BackupDatei; anzahl: Record<string, number> } | null>(null)
  const [demoFrage, setDemoFrage] = useState(false)
  const dateiRef = useRef<HTMLInputElement>(null)

  const tage = tageSeit(letztes)
  const erinnern = tage === undefined || tage > BACKUP_ERINNERUNG_TAGE

  const herunterladen = async () => {
    setLaeuft(true)
    setMeldung(null)
    try {
      const jetzt = new Date()
      const b = await backupErzeugen(db, jetzt)
      downloadBlob(new Blob([JSON.stringify(b, null, 1)], { type: 'application/json' }), backupDateiname(org?.name, jetzt))
      await db.einstellungen.put({ key: LETZTES_BACKUP_KEY, value: jetzt.toISOString() })
      const n = TABELLEN.reduce((s, t) => s + b.tabellen[t].length, 0)
      setMeldung({ art: 'ok', text: `Backup mit ${n} Datensätzen erstellt. Bitte die Datei sicher (z. B. auf einem USB-Stick oder Netzlaufwerk) ablegen.` })
    } catch (e) {
      setMeldung({ art: 'fehler', text: `Backup fehlgeschlagen: ${(e as Error).message}` })
    } finally {
      setLaeuft(false)
    }
  }

  const dateiGewaehlt = async (f: File | undefined) => {
    if (!f) return
    setMeldung(null)
    const v = backupValidieren(await f.text())
    if (!v.ok) setMeldung({ art: 'fehler', text: v.fehler })
    else setVorschau({ datei: f.name, daten: v.daten, anzahl: v.anzahl })
    if (dateiRef.current) dateiRef.current.value = ''
  }

  const wiederherstellen = async () => {
    if (!vorschau) return
    setLaeuft(true)
    try {
      await backupWiederherstellen(db, vorschau.daten)
      setVorschau(null)
      setMeldung({ art: 'ok', text: 'Backup wurde wiederhergestellt.' })
    } catch (e) {
      setMeldung({ art: 'fehler', text: `Wiederherstellen fehlgeschlagen – es wurde nichts verändert. (${(e as Error).message})` })
    } finally {
      setLaeuft(false)
    }
  }

  const demoLaden = async () => {
    if (!org) return
    setLaeuft(true)
    try {
      const d = await demodatenLaden(db, org.id)
      setMeldung({ art: 'ok', text: `Demodaten geladen: ${d.piloten.length} Piloten, ${d.geraete.length} Geräte, ${d.einsaetze.length} Einsätze.` })
    } catch (e) {
      setMeldung({ art: 'fehler', text: (e as Error).message })
    } finally {
      setLaeuft(false)
      setDemoFrage(false)
    }
  }

  return (
    <Card title="Datensicherung">
      <div className="flex flex-col gap-4">
        <p className="text-sm text-gray-600">
          Alle Daten liegen nur auf diesem Gerät (im Browser). Erstellen Sie regelmäßig ein Backup und bewahren Sie die Datei sicher auf – sie enthält personenbezogene
          Daten.
        </p>
        <div className={erinnern ? 'rounded-md border border-amber-200 bg-warn-bg p-3 text-sm font-semibold text-warn' : 'text-sm'}>
          {letztes ? (
            <>
              Letztes Backup: {fmtDatumZeit(letztes)}
              {tage !== undefined && (tage === 0 ? ' (heute)' : ` (vor ${tage} ${tage === 1 ? 'Tag' : 'Tagen'})`)}
              {erinnern && ` – älter als ${BACKUP_ERINNERUNG_TAGE} Tage, bitte neues Backup erstellen.`}
            </>
          ) : (
            'Es wurde noch kein Backup erstellt.'
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <Button icon={<Download size={20} />} onClick={herunterladen} disabled={laeuft}>
            Backup herunterladen
          </Button>
          <Button variant="secondary" icon={<Upload size={20} />} onClick={() => dateiRef.current?.click()} disabled={laeuft}>
            Backup wiederherstellen
          </Button>
          <input ref={dateiRef} type="file" accept="application/json,.json" className="hidden" aria-label="Backup-Datei wählen" onChange={(e) => dateiGewaehlt(e.target.files?.[0])} />
          {datenAnzahl === 0 && (
            <Button variant="ghost" icon={<FlaskConical size={20} />} onClick={() => setDemoFrage(true)} disabled={laeuft}>
              Demodaten laden
            </Button>
          )}
        </div>
        {meldung && (
          <p role="status" className={meldung.art === 'ok' ? 'text-sm font-semibold text-ok' : 'text-sm font-semibold text-fehler'}>
            {meldung.text}
          </p>
        )}
      </div>

      <Modal
        open={!!vorschau}
        onClose={() => setVorschau(null)}
        title="Backup wiederherstellen?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setVorschau(null)} disabled={laeuft}>
              Abbrechen
            </Button>
            <Button variant="danger" icon={<DatabaseBackup size={20} />} onClick={wiederherstellen} disabled={laeuft}>
              Alle Daten ersetzen
            </Button>
          </>
        }
      >
        {vorschau && (
          <div className="flex flex-col gap-3">
            <p className="text-sm">
              Datei <b className="break-all">{vorschau.datei}</b>
              {vorschau.daten.erstelltAm && <> vom {fmtDatumZeit(vorschau.daten.erstelltAm)}</>}
            </p>
            <table className="w-full text-sm">
              <tbody>
                {TABELLEN.map((t) => (
                  <tr key={t} className="border-b border-linie">
                    <td className="py-1.5">{TABELLEN_LABEL[t]}</td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">{vorschau.anzahl[t]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="rounded-md bg-fehler-bg p-3 text-sm font-semibold text-fehler">
              Achtung: Alle derzeit auf diesem Gerät gespeicherten Daten werden gelöscht und durch das Backup ersetzt. Dies kann nicht rückgängig gemacht werden.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={demoFrage}
        onClose={() => setDemoFrage(false)}
        title="Demodaten laden?"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDemoFrage(false)}>
              Abbrechen
            </Button>
            <Button onClick={demoLaden} disabled={laeuft}>
              Demodaten laden
            </Button>
          </>
        }
      >
        <p className="text-sm">
          Legt 3 Beispiel-Piloten, 2 Geräte („Hornisse 1“, „Hornisse 2“), 8 abgeschlossene Einsätze/Trainings der letzten Monate, Wartungsprüfungen und Mängel an – zum
          Ausprobieren und für Präsentationen. Die Daten sind fiktiv und können nicht automatisch wieder entfernt werden.
        </p>
      </Modal>
    </Card>
  )
}
