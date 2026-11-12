# Entwicklung – Konventionen

Konzept: [KONZEPT.md](KONZEPT.md)

## Befehle
```
npm install
npm run dev        # Entwicklungsserver
npm run build      # Typecheck + Produktions-Build (PWA)
npm test           # Unit-Tests (Vitest)
npx oxlint src     # Lint
```

## Struktur
| Pfad | Inhalt |
|---|---|
| `src/db/types.ts` | **Datenmodell** – gemeinsamer Vertrag aller Module |
| `src/db/db.ts` | Dexie/IndexedDB (offline). Schemaänderung nur via neuer `version(n)` |
| `src/templates/` | Checklisten-Vorlagen aus den BFV-PDFs (v9, Notfall v2, Wartung v2) |
| `src/lib/calc.ts` | Sicherheitsabstände (CV, GRB, Menschenansammlung), Dauer |
| `src/lib/stats.ts` | Flugstunden, Pilot-Ampel, Gerätestunden, Akkuzyklen (berechnet, nie gespeichert) |
| `src/lib/format.ts` | Datum/Zeit de-AT, Input-Konvertierung |
| `src/lib/useOrg.ts` | aktive Organisation |
| `src/components/ui.tsx` | UI-Bausteine (Button, Card, TextInput, Select, Checkbox, Segmented, Badge, AmpelBadge, Modal, Stat …) |
| `src/components/Layout.tsx` | Navigation, NOTFALL-Button |
| `src/features/<modul>/` | Seiten je Modul |

## Regeln
- Sprache der Oberfläche: Deutsch (Österreich), Bezeichnungen wie in den BFV-Formularen.
- Farben nur über Theme-Tokens (`rot-700`, `anthrazit`, `dunkel`, `linie`, `flaeche`, `ok`, `warn`, `fehler`).
- Touch-tauglich: Ziele ≥ 44 px, funktioniert ab 360 px Breite.
- Daten über `useLiveQuery` (dexie-react-hooks) lesen, immer nach `orgId` filtern.
- Abgeleitete Werte (Stunden, Zyklen) immer über `src/lib/stats.ts`.
- Abgeschlossene Einsätze sind schreibgeschützt; Änderungen nur als Nachtrag.
