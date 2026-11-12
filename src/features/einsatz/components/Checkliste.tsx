import { CheckCircle2, Circle, ExternalLink, ShieldAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ChecklistAntwort, ChecklistItem, ChecklistSektion, Einsatz } from '../../../db/types'
import { Badge, Button, Card, Checkbox, cx, Segmented } from '../../../components/ui'
import { fmtDatumZeit, fromLocalInput, toLocalInput } from '../../../lib/format'
import { DRONESPACE_URL, gewaehlteOptionen, istDronespaceItem, istGruppe, itemErledigt, parseZahlAntwort, sektionFortschritt } from '../logic/checkliste'
import { AutoFeld } from './AutoFeld'


interface Ctx {
  einsatz: Einsatz
  gesperrt: boolean
  onAntwort: (item: ChecklistItem, wert: ChecklistAntwort | undefined) => void
}

/** Generische Darstellung einer Checklisten-Sektion aus der Vorlage */
export function ChecklisteSektion({ sektion, ...ctx }: Ctx & { sektion: ChecklistSektion }) {
  const f = sektionFortschritt(sektion, ctx.einsatz.antworten)
  return (
    <Card
      title={sektion.titel}
      actions={<FortschrittBadge erledigt={f.erledigt} gesamt={f.gesamt} />}
    >
      {sektion.hinweis && <p className="mb-3 rounded-md bg-flaeche p-3 text-sm text-gray-700">{sektion.hinweis}</p>}
      <FortschrittBalken erledigt={f.erledigt} gesamt={f.gesamt} />
      <ol className="mt-2 flex flex-col divide-y divide-linie">
        {sektion.items.map((it) => (
          <li key={it.id} className="py-3">
            <ItemFeld item={it} {...ctx} />
          </li>
        ))}
      </ol>
    </Card>
  )
}

export function FortschrittBadge({ erledigt, gesamt }: { erledigt: number; gesamt: number }) {
  return (
    <Badge color={gesamt === 0 || erledigt === gesamt ? 'gruen' : erledigt === 0 ? 'grau' : 'gelb'}>
      {erledigt}/{gesamt} Pflichtpunkte
    </Badge>
  )
}

export function FortschrittBalken({ erledigt, gesamt }: { erledigt: number; gesamt: number }) {
  const p = gesamt === 0 ? 100 : Math.round((erledigt / gesamt) * 100)
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-flaeche" role="progressbar" aria-valuenow={p} aria-valuemin={0} aria-valuemax={100}>
      <div className={cx('h-full rounded-full transition-all', p === 100 ? 'bg-ok' : 'bg-rot-700')} style={{ width: `${p}%` }} />
    </div>
  )
}

function ItemKopf({ item, erledigt, uebersteuert }: { item: ChecklistItem; erledigt: boolean; uebersteuert?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      {item.pflicht || istGruppe(item) ? (
        erledigt ? (
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-ok" aria-label="erledigt" />
        ) : (
          <Circle size={20} className="mt-0.5 shrink-0 text-gray-400" aria-label="offen" />
        )
      ) : (
        <span className="w-5 shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <span className="font-semibold">
          {item.nr && <span className="mr-1 text-rot-700">{item.nr}.</span>}
          {item.label}
          {item.pflicht && <span className="text-rot-700"> *</span>}
        </span>
        {uebersteuert && (
          <span className="ml-2">
            <Badge color="gelb">
              <ShieldAlert size={12} /> übersteuert
            </Badge>
          </span>
        )}
        {item.hinweis && <p className="text-sm text-gray-600">{item.hinweis}</p>}
      </div>
    </div>
  )
}

/** Ein Checklisten-Punkt inkl. Unterpunkte und Folgefelder */
export function ItemFeld({ item, einsatz, gesperrt, onAntwort, unter }: Ctx & { item: ChecklistItem; unter?: boolean }) {
  const erledigt = itemErledigt(item, einsatz.antworten)
  const uebersteuert = (einsatz.uebersteuerungen ?? []).some((u) => u.itemId === item.id) && !erledigt
  const wert = einsatz.antworten[item.id]
  const gruppe = istGruppe(item)
  const ctx = { einsatz, gesperrt, onAntwort }

  let feld: ReactNode = null
  if (item.typ === 'check' && !gruppe) {
    feld = (
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <Checkbox
            checked={wert === true}
            disabled={gesperrt}
            onChange={(v) => onAntwort(item, v ? true : undefined)}
            label={
              <span className={cx(!unter && 'font-semibold')}>
                {item.nr && <span className="mr-1 text-rot-700">{item.nr}.</span>}
                {item.label}
                {item.pflicht && <span className="text-rot-700"> *</span>}
                {uebersteuert && (
                  <span className="ml-2">
                    <Badge color="gelb">übersteuert</Badge>
                  </span>
                )}
              </span>
            }
            hint={item.hinweis}
          />
        </div>
      </div>
    )
  } else {
    feld = (
      <>
        <ItemKopf item={item} erledigt={erledigt} uebersteuert={uebersteuert} />
        {!gruppe && (
          <div className="mt-2 pl-7">
            <Eingabe item={item} wert={wert} gesperrt={gesperrt} onAntwort={onAntwort} />
          </div>
        )}
      </>
    )
  }

  const folge = gewaehlteOptionen(item, wert).flatMap((o) => o.folgeFelder ?? [])

  return (
    <div>
      {feld}
      {istDronespaceItem(item) && (
        <div className="mt-1 flex flex-wrap items-center gap-2 pl-9">
          <a
            href={DRONESPACE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-linie bg-white px-4 font-semibold text-rot-700 hover:bg-flaeche"
          >
            <ExternalLink size={18} /> Dronespace öffnen
          </a>
          {einsatz.dronespaceGeprueft && <span className="text-sm text-ok">geprüft am {fmtDatumZeit(einsatz.dronespaceGeprueft)}</span>}
        </div>
      )}
      {(item.unterpunkte?.length || folge.length) ? (
        <div className={cx('mt-2 flex flex-col gap-2 border-l-4 border-linie pl-3', item.typ === 'check' && !gruppe ? 'ml-3' : 'ml-7')}>
          {item.unterpunkte?.map((u) => (
            <ItemFeld key={u.id} item={u} unter {...ctx} />
          ))}
          {folge.map((u) => (
            <ItemFeld key={u.id} item={u} unter {...ctx} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function Eingabe({ item, wert, gesperrt, onAntwort }: { item: ChecklistItem; wert: ChecklistAntwort | undefined; gesperrt: boolean; onAntwort: Ctx['onAntwort'] }) {
  const aria = item.label
  switch (item.typ) {
    case 'text':
      return <AutoFeld wert={typeof wert === 'string' ? wert : ''} speichern={(v) => onAntwort(item, v.trim() ? v : undefined)} disabled={gesperrt} ariaLabel={aria} />
    case 'zahl':
      return (
        <AutoFeld
          className="max-w-xs"
          wert={typeof wert === 'number' ? String(wert).replace('.', ',') : ''}
          speichern={(v) => onAntwort(item, parseZahlAntwort(v))}
          disabled={gesperrt}
          inputMode="decimal"
          einheit={item.einheit}
          ariaLabel={aria}
        />
      )
    case 'zeit':
      return (
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            aria-label={aria}
            className="input max-w-xs"
            value={typeof wert === 'string' ? toLocalInput(wert) : ''}
            disabled={gesperrt}
            onChange={(e) => onAntwort(item, fromLocalInput(e.target.value))}
          />
          <Button variant="secondary" disabled={gesperrt} onClick={() => onAntwort(item, new Date().toISOString())}>
            Jetzt
          </Button>
        </div>
      )
    case 'janein':
      return (
        <Segmented
          value={wert === 'ja' || wert === 'nein' ? wert : undefined}
          options={[
            { value: 'ja', label: 'ja' },
            { value: 'nein', label: 'nein' },
          ]}
          onChange={(v) => onAntwort(item, v)}
          disabled={gesperrt}
        />
      )
    case 'auswahl':
      return (
        <div role="radiogroup" aria-label={aria} className="flex flex-col gap-2">
          {(item.optionen ?? []).map((o) => {
            const an = wert === o.id
            return (
              <button
                key={o.id}
                type="button"
                role="radio"
                aria-checked={an}
                disabled={gesperrt}
                onClick={() => onAntwort(item, an ? undefined : o.id)}
                className={cx(
                  'flex min-h-11 items-center gap-3 rounded-md border px-3 py-2 text-left text-base transition-colors disabled:cursor-not-allowed',
                  an ? (o.erzeugtMangel ? 'border-fehler bg-fehler-bg font-semibold text-fehler' : 'border-rot-700 bg-rot-50 font-semibold') : 'border-linie bg-white hover:bg-flaeche',
                )}
              >
                <span className={cx('h-5 w-5 shrink-0 rounded-full border-2', an ? 'border-rot-700 bg-rot-700 shadow-[inset_0_0_0_3px_white]' : 'border-gray-400')} />
                <span className="min-w-0">
                  {o.label}
                  {o.erzeugtMangel && an && <span className="block text-xs font-normal">→ Mangel wird am Gerät eingetragen</span>}
                </span>
              </button>
            )
          })}
        </div>
      )
    case 'mehrfach': {
      const ids = Array.isArray(wert) ? wert : []
      return (
        <div className="flex flex-col">
          {(item.optionen ?? []).map((o) => (
            <Checkbox
              key={o.id}
              label={o.label}
              checked={ids.includes(o.id)}
              disabled={gesperrt}
              onChange={(v) => {
                const neu = v ? [...ids, o.id] : ids.filter((x) => x !== o.id)
                onAntwort(item, neu.length ? neu : undefined)
              }}
            />
          ))}
        </div>
      )
    }
    default:
      return null
  }
}
