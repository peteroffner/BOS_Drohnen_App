# Backend (Supabase), Login, Rollen, Offline-Sync – Design (Phase 2)

Entscheidungen (12.11.2026): eigenes Supabase-Projekt (Region EU/Frankfurt) · **Offline-first mit Synchronisation** · neue Benutzer **nur per Einladung durch Admin**.

## Betriebsarten
| Modus | Wann | Verhalten |
|---|---|---|
| **Lokal** | `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` nicht gesetzt | wie Phase 1, kein Login, alle Rechte (`darf(null, …) === true`) |
| **Cloud** | beide Variablen gesetzt | Login Pflicht, Rolle aus Mitgliedschaft, Dexie bleibt lokaler Speicher, Sync mit Supabase |

`src/lib/supabase.ts` exportiert `supabase` (Client oder `null`) und `CLOUD = supabase !== null`.

## Datenbank (Postgres)
Fachdaten werden als **Dokument (jsonb)** gespeichert – genau das Objekt aus `src/db/types.ts`. Damit bleibt das Datenmodell an einer Stelle, und der Sync ist generisch.

Synchronisierte Tabellen (Name = Dexie-Tabelle): `organisationen`, `piloten`, `geraete`, `einsaetze`, `wartungen`, `maengel`

| Spalte | Typ | Bedeutung |
|---|---|---|
| `id` | uuid PK | = `data.id` |
| `org_id` | uuid FK organisationen | = `data.orgId` (bei `organisationen`: = id) |
| `data` | jsonb | vollständiges Objekt |
| `deleted` | bool default false | Löschungen als Grabstein (Sync) |
| `created_by` / `created_at` | uuid / timestamptz | per Default/Trigger, unveränderlich |
| `updated_by` / `updated_at` | uuid / timestamptz | **vom Server per Trigger gesetzt** (`now()`, `auth.uid()`) – Grundlage des Pull-Cursors |

Verwaltungstabellen:
- `mitglieder(org_id, user_id, rolle, pilot_id null, email, anzeigename, erstellt_am)` – PK (org_id, user_id). Phase 2: ein Benutzer gehört genau einer Organisation.
- `einladungen(id, org_id, email lower, rolle, pilot_id null, erstellt_von, erstellt_am, angenommen_am null)`.

Funktionen / Trigger:
- `organisation_anlegen(name, typ, bezirk, bundesland)` RPC (security definer): legt Organisation an und den Aufrufer als `admin` – nur wenn er noch keiner Organisation angehört (Erst-Einrichtung).
- Trigger auf `auth.users` (insert) **und** RPC `einladung_annehmen()`: offene Einladung mit gleicher E-Mail → Mitgliedschaft mit Rolle/Pilot anlegen, `angenommen_am` setzen.
- Hilfsfunktionen `meine_org()`, `meine_rolle()`, `mein_pilot()` (security definer, stable) für RLS.
- Integritätstrigger: `org_id` muss zu `data.orgId` passen; `id` = `data.id`; **abgeschlossene Einsätze**: Update nur, wenn sich außer `nachtraege`/`geaendertAm` nichts ändert, kein Löschen; **Freigabe** (`data.freigabe`) und `data.aktiv` eines Piloten nur durch `admin` änderbar; Pilot darf nur seinen eigenen Piloten-Datensatz ändern.

## Rechte (RLS) – siehe `src/lib/rechte.ts`
Lesen: alle Mitglieder der Organisation lesen alle Daten der Organisation.
Schreiben je Tabelle gemäß Matrix in `rechte.ts`:
- `einsaetze`: insert admin/teamleiter/pilot; update/delete admin/teamleiter oder (pilot und eigen: `created_by = auth.uid()` oder `data->rollen->pilot->>pilotId = mein_pilot()` oder ein Flug mit `pilotId = mein_pilot()`).
- `piloten`: admin/teamleiter; pilot nur eigener Datensatz (`id = mein_pilot()`), Freigabe/aktiv nur admin (Trigger).
- `geraete`, `wartungen`: admin/teamleiter. `maengel`: insert admin/teamleiter/pilot, update admin/teamleiter (pilot nur eigene, nicht behobene).
- `organisationen`: update nur admin. `mitglieder`/`einladungen`: lesen alle Mitglieder (eigene Org), schreiben nur admin; ein Admin kann sich nicht selbst die Admin-Rolle entziehen, wenn er der letzte ist.
- `leser`: nur lesen.

## Offline-Sync (Client)
- Dexie bleibt die Datenquelle der UI (`useLiveQuery` unverändert).
- Jede lokale Änderung an den synchronisierten Tabellen landet in einer **Outbox** (Dexie-Tabelle `outbox`: tabelle, id, op `put|delete`, zeit). Erfassung zentral (Dexie-Middleware/Hooks), nicht in den Feature-Modulen.
- **Push**: Outbox in Reihenfolge per `upsert` (`id, org_id, data, deleted`) senden; bei Erfolg Eintrag entfernen; bei RLS-Fehler (42501) Eintrag als „abgelehnt“ markieren und den Datensatz vom Server neu laden (Server gewinnt).
- **Pull**: je Tabelle `updated_at >= cursor` (Cursor = größtes gesehenes `updated_at`, in `einstellungen`), Ergebnis in Dexie schreiben **ohne** Outbox-Eintrag; `deleted = true` → lokal löschen. Datensätze mit offenem Outbox-Eintrag nicht überschreiben (lokale Änderung gewinnt bis zum Push).
- Auslöser: Login/Start, alle 60 s, `online`-Event, Supabase Realtime (Postgres Changes) auf die Tabellen, Button „Jetzt synchronisieren“.
- Konflikte: last-write-wins pro Datensatz (Server-Reihenfolge). Abgeschlossene Einsätze schützt der Server.
- Status für die UI: online/offline, Anzahl ausstehender Änderungen, letzter erfolgreicher Sync, Fehler.
- Abmelden: bei ausstehenden Änderungen warnen; danach lokale Daten löschen (geteilte Geräte).
- Erstmalige Anmeldung eines Admins mit vorhandenen lokalen Daten (Phase 1): Angebot „Lokale Daten in die Cloud übernehmen“ (orgId umschreiben, alles in die Outbox).

## Konfiguration
- `.env.local` (lokal, nicht im Git) bzw. GitHub-Repo-Variablen `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` für den Pages-Build. Der Anon-/Publishable-Key ist öffentlich; der **service_role-Key gehört niemals in den Client oder ins Repo**.
- Migrationen: `supabase/migrations/*.sql`, RLS-Tests: `supabase/tests/*.sql`.
- Auth-Einstellungen im Supabase-Dashboard: E-Mail/Passwort aktiv, Site-URL = `https://peteroffner.github.io/BOS_Drohnen_App/`, Redirect-URLs inkl. `http://localhost:5173/**`.
