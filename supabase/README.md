# Supabase einrichten – Anleitung für den Feuerwehr-Admin

Diese Anleitung richtet die Cloud-Datenbank für die BOS Drohnen-App ein. Sie brauchen
**kein Datenbankwissen** – nur einen Browser und ca. 20 Minuten.

Was Sie am Ende haben:
- ein eigenes Supabase-Projekt in Frankfurt (EU),
- die Datenbank mit allen Tabellen und Zugriffsregeln,
- zwei Werte (URL und Schlüssel), die in die App eingetragen werden.

---

## 1. Projekt anlegen

1. Auf <https://supabase.com> registrieren / anmelden.
2. **New project** klicken.
3. Ausfüllen:
   - **Name**: z. B. `bos-drohnen`
   - **Database Password**: ein langes, zufälliges Passwort erzeugen lassen und sicher
     ablegen (Passwort-Manager). Die App braucht es nicht, aber Sie für Notfälle.
   - **Region**: **Central EU (Frankfurt)** – wichtig für den Datenschutz (DSGVO).
4. **Create new project** – die Einrichtung dauert 1–2 Minuten.

> Datenschutz: Für den Echtbetrieb mit Pilotendaten einen Auftragsverarbeitungsvertrag
> (DPA) mit Supabase abschließen (Dashboard → Organization → Legal Documents).

## 2. Datenbank einspielen (Migration)

Die Datei `supabase/migrations/20261112000001_init.sql` enthält alles: Tabellen,
Zugriffsregeln, Schutz abgeschlossener Einsätze usw. Sie wird **genau einmal** eingespielt.

### Variante A – im Browser (empfohlen, ohne Installation)
1. Im Projekt links **SQL Editor** öffnen → **New query**.
2. Die Datei `supabase/migrations/20261112000001_init.sql` öffnen (auf GitHub: Datei
   öffnen → Schaltfläche „Raw“ oder „Copy raw file“), **gesamten Inhalt** kopieren.
3. In den SQL-Editor einfügen und **Run** klicken.
4. Ergebnis muss „Success. No rows returned“ sein. Bei einer Fehlermeldung nicht
   erneut ausführen, sondern die Meldung an den Entwickler schicken.

Kommen später weitere Dateien in `supabase/migrations/` dazu, werden diese **in
Reihenfolge der Nummer** genauso eingespielt (jeweils nur die neuen).

### Variante B – mit der Supabase CLI (für Entwickler)
```bash
npx supabase login
npx supabase link --project-ref <projekt-ref>   # steht in der Projekt-URL
npx supabase db push                             # spielt alle neuen Migrationen ein
```

## 3. Anmeldung (Auth) einstellen

Links **Authentication**:

1. **Sign In / Providers → Email**: aktiviert lassen.
   - **Confirm email**: **AN** (dringend empfohlen, siehe Kasten).
   - Andere Anbieter (Google, Apple …) werden nicht benötigt.
2. **URL Configuration**:
   - **Site URL**: `https://peteroffner.github.io/BOS_Drohnen_App/`
   - **Redirect URLs** (je Zeile „Add URL“):
     - `https://peteroffner.github.io/BOS_Drohnen_App/**`
     - `http://localhost:5173/**` (nur für die Entwicklung)
3. Optional, aber empfohlen: unter **Emails → SMTP Settings** einen eigenen
   E-Mail-Server eintragen. Der eingebaute Versand von Supabase ist auf sehr wenige
   E-Mails pro Stunde begrenzt.

> **Warum „Confirm email“ an?** Neue Benutzer erhalten ihre Rolle über eine Einladung,
> die an eine E-Mail-Adresse gebunden ist. Die Datenbank löst eine Einladung erst ein,
> wenn die Adresse **bestätigt** ist. Ist die Bestätigung ausgeschaltet, gilt jede
> Adresse sofort als bestätigt – dann könnte sich jemand mit einer fremden,
> eingeladenen Adresse registrieren und deren Rolle erhalten.

## 4. Werte für die App

Links **Project Settings → API** (bzw. **API Keys**):

| Wert in Supabase | Eintrag für die App |
|---|---|
| **Project URL** (`https://xxxx.supabase.co`) | `VITE_SUPABASE_URL` |
| **anon public** bzw. **Publishable key** | `VITE_SUPABASE_ANON_KEY` |

- Lokal: Datei `.env.local` im Projektordner anlegen:
  ```
  VITE_SUPABASE_URL=https://xxxx.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJ...
  ```
- Für die veröffentlichte App: auf GitHub im Repository → **Settings → Secrets and
  variables → Actions → Variables** die beiden Variablen anlegen.

Der anon/publishable-Schlüssel ist öffentlich (er steckt in jeder App) – die
Sicherheit kommt aus den Zugriffsregeln der Datenbank.

> ⚠️ Der **service_role**- bzw. **Secret key** umgeht alle Zugriffsregeln.
> **Niemals** weitergeben, nicht in die App, nicht ins GitHub-Repository, nicht per E-Mail.

## 5. Erster Administrator

1. Die App öffnen (Cloud-Modus) und sich mit Ihrer E-Mail **registrieren**.
2. Den Bestätigungslink in der E-Mail anklicken und anmelden.
3. Die App fragt nach der Organisation → **Organisation anlegen** (Name, Typ, Bezirk,
   Bundesland). Sie sind damit **Administrator** dieser Organisation.
   Das geht nur einmal pro Benutzer – wer schon einer Organisation angehört, kann
   keine weitere anlegen.
4. Weitere Personen **einladen** (in der App unter Benutzer): E-Mail-Adresse und Rolle
   eintragen, bei Piloten den zugehörigen Piloten-Datensatz auswählen. Die Person
   registriert sich danach mit genau dieser Adresse und erhält automatisch die Rolle.
   Hat sie schon ein Konto, bekommt sie die Rolle beim nächsten Anmelden.

Rollen:

| Rolle | darf |
|---|---|
| Administrator | alles, inkl. Benutzer, Freigaben, Einstellungen |
| Drohnen-Teamleiter | alle Einsätze, Piloten-Stammdaten, Geräte, Wartung, Mängel beheben |
| Pilot | Einsätze anlegen, eigene Einsätze bearbeiten, Nachträge, Mängel melden, eigene Stammdaten |
| Nur lesen | alles ansehen und exportieren, nichts ändern |

Es muss immer mindestens ein Administrator bleiben – die Datenbank verhindert, dass
der letzte Administrator entfernt oder herabgestuft wird. Tipp: einen zweiten
Administrator als Vertretung einladen.

## 6. Tests lokal ausführen (Entwickler)

Voraussetzung: PostgreSQL 16 (`/usr/lib/postgresql/16/bin`), kein Supabase nötig.

```bash
supabase/tests/run.sh
```

Das Skript startet einen eigenen Datenbank-Cluster (`/tmp/claude-0/pg`, Port 54329;
änderbar über `PGTEST_DIR`, `PGTEST_PORT`, `PGBIN`), legt die Datenbank `bos_test` neu
an und spielt ein:
1. `tests/supabase_stub.sql` – Nachbau der Supabase-Umgebung (Rollen `anon`,
   `authenticated`, `service_role`, `auth.users`, `auth.uid()/email()/jwt()`,
   Publikation `supabase_realtime`) – **nicht** in Supabase einspielen,
2. alle `migrations/*.sql`,
3. `tests/00_helpers.sql` und danach alle Testdateien `tests/[1-9]*_*.sql`.

Jeder Test meldet `ok - …`; der erste Fehlschlag bricht mit `FEHLGESCHLAGEN: …` ab,
Exit-Code ≠ 0. Als root ausgeführt, läuft Postgres als Benutzer `postgres`.
Server stoppen: `su postgres -c "/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/claude-0/pg stop"`.

---

## Technische Hinweise (für Entwickler)

Design: `docs/BACKEND.md`, Rechte: `src/lib/rechte.ts`.

**Tabellen**: `organisationen, piloten, geraete, einsaetze, wartungen, maengel` als
Dokument (`id, org_id, data jsonb, deleted, created_by/at, updated_by/at`), dazu
`mitglieder`, `einladungen`. Rolle ist der Enum `public.rolle`.

**Sync-Vertrag**
- Push per Upsert `{id, org_id, data, deleted}` (`on conflict (id)`). `created_*`,
  `updated_*` setzt der Server; mitgeschickte Werte werden ignoriert.
- **Kein hartes DELETE** auf Dokument-Tabellen (kein Grant) – nur `deleted = true`.
- Fehlercodes: `42501` = Recht/Schutz verletzt (RLS, abgeschlossener Einsatz,
  Freigabe, letzter Admin) → Outbox-Eintrag „abgelehnt“, Datensatz neu laden.
  `23514` = Integrität (`id ≠ data.id`, `org_id ≠ data.orgId`, Pilot fremder Org).
  Achtung: Ein UPDATE, das RLS herausfiltert, liefert **keinen** Fehler, sondern
  0 Zeilen; ein Upsert auf einen nicht änderbaren Datensatz liefert dagegen 42501.
- `updated_at = now()` ist die Startzeit der Transaktion. Eine lange Transaktion kann
  mit einem Zeitstempel sichtbar werden, der kleiner als ein bereits gelesener Cursor
  ist. Empfehlung für den Pull: Cursor mit kleiner Überlappung (z. B. −5 s) abfragen;
  doppelte Zeilen sind harmlos.

**RPCs** (alle nur für `authenticated`):
- `organisation_anlegen(p_name, p_typ, p_bezirk, p_bundesland) → uuid`
- `einladung_annehmen() → uuid | null` (null = keine offene Einladung; idempotent;
  nur mit bestätigter E-Mail)
- `mitglied_rolle_aendern(p_user_id, p_rolle)`, `mitglied_pilot_zuordnen(p_user_id, p_pilot_id)`,
  `mitglied_entfernen(p_user_id)` – nur admin, eigene Org
- `meine_org()`, `meine_rolle()`, `mein_pilot()`
- Einladungen legt der Admin direkt per `insert into einladungen (org_id, email, rolle, pilot_id)` an.

**Entscheidungen / Abweichungen vom Design**
1. *Einladung nur für bestätigte E-Mail*: Trigger auf `auth.users` feuert bei Insert
   **und** bei Setzen von `email_confirmed_at`; ohne Bestätigung keine Mitgliedschaft.
   Fehler im Trigger brechen die Registrierung nie ab (nur Warnung).
   Gibt es mehrere offene Einladungen (verschiedene Orgs), gilt die neueste.
   Wer schon Mitglied ist, wird durch eine Einladung nicht verschoben.
2. *`aktiv` eines Piloten*: `rechte.ts` nennt „deaktivieren“ unter `pilot.verwalten`
   (auch Teamleiter), `BACKEND.md` sagt „aktiv nur admin“. Umgesetzt ist **nur admin**
   (wie BACKEND.md). Teamleiter dürfen Piloten anlegen (ohne erteilte Freigabe),
   bearbeiten und als gelöscht markieren. Die UI sollte den Aktiv-Schalter nur Admins zeigen.
3. *Nachträge an abgeschlossenen Einsätzen*: `einsatz.nachtrag` gilt in `rechte.ts`
   für jeden Piloten ohne „eigen“-Einschränkung → jeder Pilot der Org darf an
   abgeschlossene Einsätze Nachträge **anhängen**. Bestehende Nachträge sind
   unveränderlich (nur anhängen), sonst ändert sich nur `geaendertAm`.
   Der Schutz gilt auch für `service_role`/SQL-Editor (Ausnahme: Löschen der ganzen Organisation).
4. *Mängel*: Pilot legt nur offene Mängel an, ändert nur selbst angelegte offene und
   kann sie nicht als behoben markieren (`mangel.beheben` = admin/teamleiter).
5. *Mitglieder*: neue Mitglieder **nur** über Einladungen (kein direktes Insert).
   Ein Benutzer gehört genau einer Organisation (`unique(user_id)`).
   Löschen eines Benutzerkontos ist auch für den letzten Admin möglich.
6. *Organisationen*: Anlegen nur per RPC; die INSERT-Policy lässt nur die eigene
   Org-ID zu, damit der Upsert des Sync-Clients funktioniert. Eine Organisation kann
   nicht als gelöscht markiert werden.
7. *Freigabe-Konflikte*: Ändert ein Teamleiter einen Piloten, dessen Freigabe der Admin
   inzwischen geändert hat, schickt der Client die alte Freigabe mit → 42501 →
   Server-Version wird neu geladen (Server gewinnt).
8. Ohne angemeldeten Benutzer (SQL-Editor, `service_role`) entfallen die
   Rollenprüfungen der Piloten-Trigger; RLS gilt ohnehin nur für `authenticated`.
