import { Download, FileText, Trash2, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import type { Anhang } from '../../db/types'
import { Button } from '../../components/ui'
import { ANHANG_ACCEPT, dateiZuAnhang } from './logic'

/** Nachweis-Upload (Bild/PDF als dataUrl, max. 2 MB) mit Vorschau und Download. */
export function AnhangFeld({ label = 'Nachweis', wert, onChange }: { label?: string; wert?: Anhang; onChange: (a?: Anhang) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [fehler, setFehler] = useState<string | null>(null)
  return (
    <div>
      <span className="label">{label}</span>
      {wert ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-linie bg-flaeche p-2">
          {wert.mime.startsWith('image/') ? (
            <img src={wert.dataUrl} alt={wert.name} className="h-16 w-16 rounded border border-linie bg-white object-cover" />
          ) : (
            <FileText size={40} className="text-gray-500" />
          )}
          <span className="min-w-0 flex-1 break-all text-sm">{wert.name}</span>
          <AnhangLink anhang={wert} />
          <Button variant="ghost" size="sm" icon={<Trash2 size={16} />} onClick={() => onChange(undefined)}>
            Entfernen
          </Button>
        </div>
      ) : (
        <Button variant="secondary" icon={<Upload size={18} />} onClick={() => input.current?.click()}>
          Datei wählen (Bild/PDF)
        </Button>
      )}
      <input
        ref={input}
        type="file"
        accept={ANHANG_ACCEPT}
        className="hidden"
        data-testid="nachweis-upload"
        onChange={async (e) => {
          const datei = e.target.files?.[0]
          e.target.value = ''
          if (!datei) return
          try {
            onChange(await dateiZuAnhang(datei))
            setFehler(null)
          } catch (err) {
            setFehler((err as Error).message)
          }
        }}
      />
      {fehler && <p className="mt-1 text-xs font-semibold text-fehler">{fehler}</p>}
      {!wert && !fehler && <p className="mt-1 text-xs text-gray-600">max. 2 MB</p>}
    </div>
  )
}

export function AnhangLink({ anhang }: { anhang: Anhang }) {
  return (
    <a
      href={anhang.dataUrl}
      download={anhang.name}
      className="inline-flex min-h-9 items-center gap-1 rounded-md px-2 text-sm font-semibold text-rot-700 hover:bg-rot-50"
    >
      <Download size={16} /> Herunterladen
    </a>
  )
}
