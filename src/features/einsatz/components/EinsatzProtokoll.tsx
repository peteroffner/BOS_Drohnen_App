import { useState } from 'react'
import type { ReactNode } from 'react'
import type { ChecklistItem, ChecklistVorlage, Einsatz, Geraet, Organisation, Pilot } from '../../../db/types'
import { dauerMinuten, sicherheitsabstaende } from '../../../lib/calc'
import { fmtDatum, fmtDatumZeit, fmtZeit, pilotName } from '../../../lib/format'
import { antwortText, findeItem, gewaehlteOptionen, itemErledigt } from '../logic/checkliste'
import { akkuNummer, ART_LABEL, EINSATZENDE_ZEILEN, EREIGNIS_TYP_LABEL, rechtsgrundlageText, rolleName, sortierteEreignisse, STATUS_LABEL } from '../logic/einsatz'

/**
 * Druckfreundliche Gesamtansicht im Aufbau der Checkliste Drohnenflug v9.
 * (Fallback zum PDF-Export aus Modul C – wird über window.print() gedruckt.)
 */
export function EinsatzProtokoll({
  einsatz: e,
  vorlage,
  org,
  piloten,
  geraete,
}: {
  einsatz: Einsatz
  vorlage?: ChecklistVorlage
  org?: Organisation
  piloten: Pilot[]
  geraete: Geraet[]
}) {
  const s = e.geplanteFlughoeheM ? sicherheitsabstaende(e.geplanteFlughoeheM) : undefined
  const einsatzGeraete = geraete.filter((g) => e.geraetIds.includes(g.id))
  const pName = (id: string) => {
    const p = piloten.find((x) => x.id === id)
    return p ? pilotName(p) : rolleName(e.rollen.pilot)
  }
  const fluege = [...e.fluege].sort((a, b) => a.nr - b.nr)
  const [gedruckt] = useState(() => new Date().toISOString())
  const ueb = new Map((e.uebersteuerungen ?? []).map((u) => [u.itemId, u]))

  return (
    <article className="protokoll text-[11pt] leading-snug text-dunkel">
      <header className="mb-3 flex items-end justify-between border-b-2 border-dunkel pb-2">
        <div>
          <div className="text-xs uppercase tracking-widest">{org?.name}</div>
          <h1 className="text-xl font-bold">{vorlage?.name ?? 'Checkliste Drohnenflug'}</h1>
          <div className="text-xs">
            {vorlage?.version} · {vorlage?.quelle}
          </div>
        </div>
        <div className="text-right text-xs">
          Status: {STATUS_LABEL[e.status]}
          <br />
          Gedruckt: {fmtDatumZeit(gedruckt)}
        </div>
      </header>

      <Abschnitt titel="Einsatzdaten">
        <Tabelle
          zeilen={[
            ['Datum / Uhrzeit', fmtDatumZeit(e.datum)],
            ['Art', ART_LABEL[e.art]],
            ['Alarmierung / Auftrag von', e.alarmierungVon],
            ['Grund des Fluges', e.grund],
            ['Bezeichnung Fluggebiet', e.fluggebiet],
            ['Gemeindegebiet', e.gemeinde],
            ['GPS-Position', e.position ? `${e.position.lat.toFixed(5)}, ${e.position.lng.toFixed(5)}` : ''],
            [
              'Fluggerät(e)',
              einsatzGeraete.map((g) => `${g.name} (${g.hersteller} ${g.modell}${g.registrierungsnummer ? `, Reg.-Nr. ${g.registrierungsnummer}` : ''})`).join('; '),
            ],
            ['Payload', e.payload],
            ['Rechtsgrundlage', rechtsgrundlageText(e)],
            ['Flugart', e.flugart],
            ['Geplante Flughöhe', e.geplanteFlughoeheM !== undefined ? `${e.geplanteFlughoeheM} m` : ''],
            ...(s
              ? ([
                  ['Contingency Volume', `${s.contingencyVolume} m`],
                  ['Ground Risk Buffer', `${s.groundRiskBuffer} m`],
                  ['Abstand Menschenansammlung', `${s.abstandMenschenansammlung} m`],
                ] as [string, string][])
              : []),
            ['Gesamt-Einsatzleiter', rolleName(e.rollen.gesamtEinsatzleiter)],
            ['Drohnen-Teamleiter', rolleName(e.rollen.teamleiter)],
            ['Drohnen-Abschnittsleiter', rolleName(e.rollen.abschnittsleiter)],
            ['Pilot', rolleName(e.rollen.pilot)],
            ['Luftraumbeobachter / Helfer', (e.rollen.luftraumbeobachter ?? []).map(rolleName).filter(Boolean).join(', ')],
          ]}
        />
      </Abschnitt>

      {vorlage?.sektionen
        .filter((sek) => sek.items.length > 0)
        .map((sek) => (
          <Abschnitt key={sek.id} titel={sek.titel}>
            <table className="w-full border-collapse">
              <tbody>
                {sek.items.map((it) => (
                  <ItemZeilen key={it.id} item={it} e={e} tiefe={0} ueb={ueb} />
                ))}
              </tbody>
            </table>
            {sek.id === 'vorbereitung' && e.dronespaceGeprueft && <p className="mt-1 text-xs">Dronespace geprüft: {fmtDatumZeit(e.dronespaceGeprueft)}</p>}
          </Abschnitt>
        ))}

      {(e.uebersteuerungen ?? []).length > 0 && (
        <Abschnitt titel="Übersteuerte Pflichtpunkte">
          <ul className="list-disc pl-5">
            {(e.uebersteuerungen ?? []).map((u) => (
              <li key={u.itemId}>
                {fmtDatumZeit(u.zeit)} – {(vorlage && findeItem(vorlage, u.itemId)?.label) ?? u.itemId}: {u.begruendung}
              </li>
            ))}
          </ul>
        </Abschnitt>
      )}

      <Abschnitt titel="Verwendete Akkus / Flug">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {['Nr.', 'Gerät', 'Akku', 'Spannung vor', 'Spannung nach', 'Start', 'Landung', 'Dauer', 'Zwischencheck', 'Pilot'].map((h) => (
                <th key={h} className="border border-anthrazit px-1 py-0.5 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fluege.length === 0 && (
              <tr>
                <td colSpan={10} className="border border-anthrazit px-1 py-0.5">
                  keine Flüge
                </td>
              </tr>
            )}
            {fluege.map((f) => (
              <tr key={f.id}>
                <Td>{f.nr}</Td>
                <Td>{geraete.find((g) => g.id === f.geraetId)?.name}</Td>
                <Td>{akkuNummer(geraete, f)}</Td>
                <Td>{f.spannungVor !== undefined ? `${f.spannungVor} V` : ''}</Td>
                <Td>{f.spannungNach !== undefined ? `${f.spannungNach} V` : ''}</Td>
                <Td>{fmtZeit(f.start)}</Td>
                <Td>{fmtZeit(f.landung)}</Td>
                <Td>{f.landung ? `${dauerMinuten(f.start, f.landung)} min` : ''}</Td>
                <Td>{f.nr === 1 ? '–' : f.zwischencheck ? '✓' : '✗'}</Td>
                <Td>{pName(f.pilotId)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </Abschnitt>

      <Abschnitt titel="Ereignisse / Informationsweitergabe">
        {e.ereignisse.length === 0 ? (
          <p>keine</p>
        ) : (
          <Tabelle
            zeilen={sortierteEreignisse(e).map((ev) => [
              fmtDatumZeit(ev.zeit),
              `${EREIGNIS_TYP_LABEL[ev.typ]}${ev.bezug ? ` (Bezug ${ev.bezug})` : ''}: ${ev.text}`,
            ])}
          />
        )}
      </Abschnitt>

      <Abschnitt titel="Einsatzende">
        <Tabelle zeilen={EINSATZENDE_ZEILEN.map((z) => [z.label, fmtDatumZeit(e.einsatzende[z.key])])} />
      </Abschnitt>

      <Abschnitt titel="Abschluss">
        <Tabelle
          zeilen={[
            ['Anmerkungen / Vorfälle', e.anmerkungen],
            ['Kurzbeschreibung Flugbuch', e.beschreibung],
            ['Unfall', e.unfall ? 'ja' : 'nein'],
            ...(e.unfall
              ? ([
                  ['Datum der Meldung', fmtDatum(e.unfallMeldungDatum)],
                  ['Meldung an', e.unfallMeldungAn ?? ''],
                ] as [string, string][])
              : []),
            ['Abgeschlossen am', fmtDatumZeit(e.abgeschlossenAm)],
          ]}
        />
        <div className="mt-3 flex items-end gap-4" style={{ breakInside: 'avoid' }}>
          <div>
            <div className="text-xs">Unterschrift Pilot</div>
            {e.unterschrift?.dataUrl ? (
              <img src={e.unterschrift.dataUrl} alt="Unterschrift" className="h-24 border-b border-dunkel" />
            ) : (
              <div className="h-24 w-64 border-b border-dunkel" />
            )}
            <div className="text-sm">
              {e.unterschrift?.name} {e.unterschrift?.dataUrl && `· ${fmtDatumZeit(e.unterschrift.zeit)}`}
            </div>
          </div>
        </div>
      </Abschnitt>

      {(e.nachtraege ?? []).length > 0 && (
        <Abschnitt titel="Nachträge">
          <Tabelle zeilen={(e.nachtraege ?? []).map((n) => [`${fmtDatumZeit(n.zeit)} – ${n.autor}`, n.text])} />
        </Abschnitt>
      )}
    </article>
  )
}

function Abschnitt({ titel, children }: { titel: string; children: ReactNode }) {
  return (
    <section className="mb-4">
      <h2 className="mb-1 border-b border-anthrazit text-base font-bold uppercase tracking-wide" style={{ breakAfter: 'avoid' }}>
        {titel}
      </h2>
      {children}
    </section>
  )
}

function Td({ children }: { children?: ReactNode }) {
  return <td className="border border-anthrazit px-1 py-0.5 align-top">{children}</td>
}

function Tabelle({ zeilen }: { zeilen: [string, string | undefined][] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <tbody>
        {zeilen.map(([k, v], i) => (
          <tr key={i} style={{ breakInside: 'avoid' }}>
            <th className="w-1/3 border border-anthrazit px-1 py-0.5 text-left align-top font-semibold">{k}</th>
            <td className="whitespace-pre-wrap border border-anthrazit px-1 py-0.5 align-top">{v ?? ''}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ItemZeilen({ item, e, tiefe, ueb }: { item: ChecklistItem; e: Einsatz; tiefe: number; ueb: Map<string, { begruendung: string }> }) {
  const wert = e.antworten[item.id]
  const ok = itemErledigt(item, e.antworten)
  const text = antwortText(item, wert, fmtDatumZeit)
  const u = ueb.get(item.id)
  const kinder = [...(item.unterpunkte ?? []), ...gewaehlteOptionen(item, wert).flatMap((o) => o.folgeFelder ?? [])]
  return (
    <>
      <tr style={{ breakInside: 'avoid' }}>
        <td className="w-10 border border-anthrazit px-1 py-0.5 align-top font-semibold">{item.nr ?? ''}</td>
        <td className="border border-anthrazit px-1 py-0.5 align-top" style={{ paddingLeft: `${0.25 + tiefe}rem` }}>
          {item.label}
          {item.pflicht && ' *'}
          {u && !ok && <span className="block text-xs italic">übersteuert: {u.begruendung}</span>}
        </td>
        <td className="w-2/5 border border-anthrazit px-1 py-0.5 align-top">{item.typ === 'check' ? (wert === true || (ok && item.unterpunkte) ? '✓' : '☐') : text}</td>
      </tr>
      {kinder.map((k) => (
        <ItemZeilen key={k.id} item={k} e={e} tiefe={tiefe + 1} ueb={ueb} />
      ))}
    </>
  )
}
