import { ChevronLeft, ChevronRight, ClipboardCheck } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { db, jetzt, neueId } from '../../db/db'
import type { Geraet, Mangel, WartungsPruefung } from '../../db/types'
import { Button, Card, Modal, Select, TextArea, TextInput, cx } from '../../components/ui'
import { fmtDatum, fromDateInput, toDateInput } from '../../lib/format'
import { INTERVALL_LABEL, istFaellig, MONATE, MONATE_KURZ, neueMaengelAusPruefung, vorbelegung, wartungsMatrix, wartungsPunkte, type Ergebnis, type WartungsPunkt } from './logic'

const ZEICHEN: Record<Ergebnis, string> = { ok: '✓', mangel: '✗', na: '–' }
const ZELL_STIL: Record<Ergebnis, string> = { ok: 'text-ok', mangel: 'bg-fehler-bg text-fehler', na: 'text-gray-500' }

export function Wartungsbuch({ geraet, wartungen, maengel }: { geraet: Geraet; wartungen: WartungsPruefung[]; maengel: Mangel[] }) {
  const [heute] = useState(() => new Date())
  const [jahr, setJahr] = useState(heute.getFullYear())
  const [formular, setFormular] = useState<{ jahr: number; monat: number } | null>(null)
  const matrix = wartungsMatrix(geraet, wartungen, jahr)
  const aktJahr = heute.getFullYear()
  const aktMonat = heute.getMonth() + 1
  const scroller = useRef<HTMLDivElement>(null)
  // Smartphone: aktuellen Monat in den sichtbaren Bereich scrollen
  useEffect(() => {
    const el = scroller.current
    const th = el?.querySelector<HTMLElement>('[data-aktuell]')
    if (el && th) el.scrollLeft = Math.max(0, th.offsetLeft - el.clientWidth + th.offsetWidth * 2)
  }, [jahr])

  return (
    <Card
      title="Wartungsbuch (monatliche Prüfung)"
      actions={
        <Button size="sm" icon={<ClipboardCheck size={16} />} onClick={() => setFormular({ jahr: aktJahr, monat: aktMonat })}>
          Monatsprüfung durchführen
        </Button>
      }
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1" role="group" aria-label="Jahr">
          <Button variant="secondary" size="sm" className="min-h-11 min-w-11" aria-label="Vorjahr" onClick={() => setJahr(jahr - 1)}>
            <ChevronLeft size={18} />
          </Button>
          <span className="min-w-16 text-center text-lg font-bold tabular-nums" data-testid="wartung-jahr">
            {jahr}
          </span>
          <Button variant="secondary" size="sm" className="min-h-11 min-w-11" aria-label="Folgejahr" onClick={() => setJahr(jahr + 1)} disabled={jahr >= aktJahr + 1}>
            <ChevronRight size={18} />
          </Button>
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-gray-600">
          <span>
            <b className="text-ok">✓</b> in Ordnung
          </span>
          <span>
            <b className="text-fehler">✗</b> Mangel
          </span>
          <span>
            <b>–</b> nicht anwendbar
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 border border-linie bg-flaeche" /> nicht fällig
          </span>
        </div>
      </div>

      <div ref={scroller} className="-mx-4 overflow-x-auto border-y border-linie sm:mx-0 sm:rounded-md sm:border" data-testid="wartung-matrix">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-flaeche">
              <th className="sticky left-0 z-10 min-w-44 max-w-44 border-b border-r border-linie bg-flaeche px-2 py-2 text-left text-xs font-semibold sm:min-w-72 sm:max-w-none">
                Prüfpunkt
              </th>
              {MONATE_KURZ.map((m, i) => {
                const p = matrix.pruefungen[i]
                const aktuell = jahr === aktJahr && i + 1 === aktMonat
                return (
                  <th key={m} data-aktuell={aktuell || undefined} className={cx('border-b border-linie p-0 text-xs font-semibold', aktuell && 'bg-rot-50')}>
                    <button
                      type="button"
                      className={cx('flex min-h-11 w-full min-w-11 flex-col items-center justify-center px-1 hover:bg-rot-100', p ? 'text-dunkel' : 'text-gray-500')}
                      title={p ? `${MONATE[i]}: geprüft am ${fmtDatum(p.datum)} von ${p.pruefer} – bearbeiten` : `${MONATE[i]} ${jahr}: Prüfung erfassen`}
                      onClick={() => setFormular({ jahr, monat: i + 1 })}
                    >
                      {m}
                      {p && <span className="h-1.5 w-1.5 rounded-full bg-ok" />}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {matrix.zeilen.map(({ punkt, zellen }) => (
              <tr key={punkt.id} className="border-b border-linie last:border-0">
                <th scope="row" className="sticky left-0 z-10 min-w-44 max-w-44 border-r border-linie bg-white px-2 py-1.5 text-left text-xs font-normal leading-snug sm:min-w-72 sm:max-w-none">
                  {punkt.label}
                  {punkt.intervall !== 'monatlich' && <span className="block text-[11px] text-gray-500">{INTERVALL_LABEL[punkt.intervall]}</span>}
                </th>
                {zellen.map((z, i) => (
                  <td
                    key={i}
                    className={cx(
                      'h-9 border-l border-linie text-center text-base font-bold',
                      z ? ZELL_STIL[z] : !istFaellig(punkt.intervall, i + 1) && 'bg-flaeche',
                    )}
                    aria-label={z ? { ok: 'in Ordnung', mangel: 'Mangel', na: 'nicht anwendbar' }[z] : undefined}
                  >
                    {z ? ZEICHEN[z] : ''}
                  </td>
                ))}
              </tr>
            ))}
            <tr className="border-t-2 border-linie bg-flaeche text-xs">
              <th scope="row" className="sticky left-0 z-10 border-r border-linie bg-flaeche px-2 py-1.5 text-left font-semibold">
                Datum / Prüfer
              </th>
              {matrix.pruefungen.map((p, i) => (
                <td key={i} className="border-l border-linie px-0.5 py-1 text-center align-top text-[10px] leading-tight text-gray-600">
                  {p && (
                    <>
                      {fmtDatum(p.datum).slice(0, 6)}
                      <br />
                      {p.pruefer.split(' ').at(-1)}
                    </>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-gray-600">Monat antippen, um die Prüfung zu erfassen oder zu bearbeiten. Je Monat gibt es genau eine Prüfung.</p>

      {formular && (
        <PruefungModal
          key={`${formular.jahr}-${formular.monat}`}
          geraet={geraet}
          wartungen={wartungen}
          maengel={maengel}
          start={formular}
          onClose={() => setFormular(null)}
          onSaved={(j) => {
            setFormular(null)
            setJahr(j)
          }}
        />
      )}
    </Card>
  )
}

const ERGEBNIS_OPTIONEN: { value: Ergebnis; label: string; aktiv: string }[] = [
  { value: 'ok', label: 'ok', aktiv: 'border-ok bg-ok text-white' },
  { value: 'mangel', label: 'Mangel', aktiv: 'border-rot-700 bg-rot-700 text-white' },
  { value: 'na', label: 'n. a.', aktiv: 'border-anthrazit bg-anthrazit text-white' },
]

function PruefungModal({
  geraet,
  wartungen,
  maengel,
  start,
  onClose,
  onSaved,
}: {
  geraet: Geraet
  wartungen: WartungsPruefung[]
  maengel: Mangel[]
  start: { jahr: number; monat: number }
  onClose: () => void
  onSaved: (jahr: number) => void
}) {
  const finde = (j: number, m: number) => wartungen.find((w) => w.geraetId === geraet.id && w.jahr === j && w.monat === m)
  const letzte = [...wartungen].sort((a, b) => b.datum.localeCompare(a.datum))[0]
  const init = (j: number, m: number) => {
    const b = finde(j, m)
    const punkte = wartungsPunkte(geraet, b ? [b] : [])
    return {
      jahr: j,
      monat: m,
      punkte,
      ergebnisse: vorbelegung(punkte, m, b),
      pruefer: b?.pruefer ?? letzte?.pruefer ?? '',
      datum: b?.datum ?? jetzt(),
      bemerkung: b?.bemerkung ?? '',
    }
  }
  const [f, setF] = useState(() => init(start.jahr, start.monat))
  const [speichert, setSpeichert] = useState(false)
  const bestehend = finde(f.jahr, f.monat)
  const faellig = f.punkte.filter((p) => istFaellig(p.intervall, f.monat))
  const nichtFaellig = f.punkte.filter((p) => !istFaellig(p.intervall, f.monat))
  const fehlend = f.punkte.filter((p) => !f.ergebnisse[p.id]).length
  const anzMangel = f.punkte.filter((p) => f.ergebnisse[p.id] === 'mangel').length
  const setze = (id: string, e: Ergebnis) => setF({ ...f, ergebnisse: { ...f.ergebnisse, [id]: e } })
  const wechsel = (j: number, m: number) => setF({ ...init(j, m), pruefer: f.pruefer || init(j, m).pruefer })
  const [heuteJahr] = useState(() => new Date().getFullYear())
  const jahre = Array.from({ length: 6 }, (_, i) => heuteJahr + 1 - i)

  const speichern = async () => {
    if (fehlend || !f.pruefer.trim()) return
    setSpeichert(true)
    const ergebnisse: WartungsPruefung['ergebnisse'] = {}
    for (const p of f.punkte) ergebnisse[p.id] = f.ergebnisse[p.id]!
    const pruefung: WartungsPruefung = {
      id: bestehend?.id ?? neueId(),
      orgId: geraet.orgId,
      geraetId: geraet.id,
      datum: f.datum,
      jahr: f.jahr,
      monat: f.monat,
      pruefer: f.pruefer.trim(),
      ergebnisse: { ...bestehend?.ergebnisse, ...ergebnisse },
      bemerkung: f.bemerkung.trim() || undefined,
    }
    const neu: Mangel[] = neueMaengelAusPruefung(pruefung, f.punkte, maengel).map((m) => ({ ...m, id: neueId(), orgId: geraet.orgId, erstelltAm: jetzt() }))
    await db.transaction('rw', db.wartungen, db.maengel, async () => {
      await db.wartungen.put(pruefung)
      if (neu.length) await db.maengel.bulkAdd(neu)
    })
    onSaved(f.jahr)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`${bestehend ? 'Monatsprüfung bearbeiten' : 'Monatsprüfung'} – ${geraet.name}`}
      footer={
        <>
          <span className="mr-auto self-center text-sm text-gray-600">{fehlend ? `${fehlend} Punkt${fehlend === 1 ? '' : 'e'} offen` : anzMangel ? `${anzMangel} Mangel → wird angelegt` : 'alle Punkte erfasst'}</span>
          <Button variant="secondary" onClick={onClose}>
            Abbrechen
          </Button>
          <Button disabled={!!fehlend || !f.pruefer.trim() || speichert} onClick={speichern}>
            Speichern
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Select label="Monat" value={String(f.monat)} onChange={(e) => wechsel(f.jahr, Number(e.target.value))} options={MONATE.map((m, i) => ({ value: String(i + 1), label: m }))} />
        <Select label="Jahr" value={String(f.jahr)} onChange={(e) => wechsel(Number(e.target.value), f.monat)} options={jahre.map((j) => ({ value: String(j), label: String(j) }))} />
        <TextInput label="Prüfdatum" type="date" value={toDateInput(f.datum)} onChange={(e) => setF({ ...f, datum: fromDateInput(e.target.value) ?? f.datum })} />
        <TextInput label="Prüfer *" value={f.pruefer} onChange={(e) => setF({ ...f, pruefer: e.target.value })} />
      </div>
      {bestehend && <p className="mt-2 rounded-md bg-warn-bg px-3 py-2 text-sm text-warn">Für {MONATE[f.monat - 1]} {f.jahr} existiert bereits eine Prüfung – sie wird bearbeitet.</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold">Fällige Prüfpunkte ({faellig.length})</h3>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const e = { ...f.ergebnisse }
            for (const p of faellig) if (!e[p.id]) e[p.id] = 'ok'
            setF({ ...f, ergebnisse: e })
          }}
        >
          Offene Punkte auf „ok“
        </Button>
      </div>
      <PunktListe punkte={faellig} ergebnisse={f.ergebnisse} setze={setze} />

      {nichtFaellig.length > 0 && (
        <details className="mt-4 rounded-md border border-linie">
          <summary className="flex min-h-11 cursor-pointer items-center px-3 font-semibold">In diesem Monat nicht fällig ({nichtFaellig.length}) – optional erfassen</summary>
          <div className="px-3 pb-2">
            <PunktListe punkte={nichtFaellig} ergebnisse={f.ergebnisse} setze={setze} />
          </div>
        </details>
      )}
      <TextArea className="mt-4" label="Bemerkung" value={f.bemerkung} onChange={(e) => setF({ ...f, bemerkung: e.target.value })} />
    </Modal>
  )
}

function PunktListe({ punkte, ergebnisse, setze }: { punkte: WartungsPunkt[]; ergebnisse: Record<string, Ergebnis | undefined>; setze: (id: string, e: Ergebnis) => void }) {
  return (
    <ul className="divide-y divide-linie">
      {punkte.map((p) => (
        <li key={p.id} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between" data-punkt={p.id}>
          <span className="text-sm">
            {p.label}
            {p.intervall !== 'monatlich' && <span className="block text-xs text-gray-500">{INTERVALL_LABEL[p.intervall]}</span>}
          </span>
          <div className="grid shrink-0 grid-cols-3 gap-1" role="radiogroup" aria-label={p.label}>
            {ERGEBNIS_OPTIONEN.map((o) => (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={ergebnisse[p.id] === o.value}
                onClick={() => setze(p.id, o.value)}
                className={cx('min-h-11 min-w-20 rounded-md border px-2 text-sm font-semibold', ergebnisse[p.id] === o.value ? o.aktiv : 'border-linie bg-white text-anthrazit hover:bg-flaeche')}
              >
                {o.label}
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}
