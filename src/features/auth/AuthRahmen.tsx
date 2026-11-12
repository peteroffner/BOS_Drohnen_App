import type { ReactNode } from 'react'

/** Gemeinsamer Rahmen der Anmelde-/Einrichtungsseiten (Stil wie OrgSetup). */
export function AuthRahmen({ titel, untertitel, children }: { titel: string; untertitel?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-full items-center justify-center bg-dunkel p-4">
      <div className="w-full max-w-lg overflow-hidden rounded-xl bg-white">
        <div className="border-b-4 border-rot-800 bg-rot-700 px-6 py-5 text-white">
          <div className="text-xs font-semibold uppercase tracking-widest text-rot-100">BOS Drohnen</div>
          <h1 className="text-2xl font-bold">{titel}</h1>
          {untertitel && <p className="mt-1 text-sm text-rot-50">{untertitel}</p>}
        </div>
        <div className="flex flex-col gap-4 p-6">{children}</div>
      </div>
    </div>
  )
}

export function Meldung({ art, children }: { art: 'ok' | 'fehler' | 'hinweis'; children: ReactNode }) {
  const stil = art === 'ok' ? 'border-green-200 bg-ok-bg text-ok' : art === 'fehler' ? 'border-rot-200 bg-fehler-bg text-fehler' : 'border-amber-200 bg-warn-bg text-warn'
  return (
    <div role={art === 'fehler' ? 'alert' : 'status'} className={`rounded-md border p-3 text-sm font-semibold ${stil}`}>
      {children}
    </div>
  )
}

/** Vollbild-Ladeanzeige (dunkel), optional mit Fehlermeldung und Aktionen */
export function LadeSeite({ text, fehler, aktionen }: { text: string; fehler?: string; aktionen?: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 bg-dunkel p-6 text-center text-white">
      <div className="text-xs font-semibold uppercase tracking-widest text-gray-400">BOS Drohnen</div>
      {!fehler && <div className="h-10 w-10 animate-spin rounded-full border-4 border-white/20 border-t-rot-500" aria-hidden />}
      <p className="text-lg font-semibold" role="status">
        {text}
      </p>
      {fehler && (
        <p role="alert" className="max-w-md rounded-md bg-white px-4 py-3 text-sm font-semibold text-fehler">
          {fehler}
        </p>
      )}
      {aktionen && <div className="flex flex-wrap justify-center gap-2">{aktionen}</div>}
    </div>
  )
}
