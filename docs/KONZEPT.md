# BOS Drohnen-App – Konzept (v0.1)

Stand: 12.11.2026 · Zielgruppe Phase 1: Feuerwehr (Österreich) · später: weitere BOS (Rettung, Polizei, Bergrettung, Wasserrettung …)

## 1. Ziel

Eine App, die die bestehenden Papierformulare der Projektgruppe „Einsatz-Drohnen“ (BOS Drohnenausbildung) digital abbildet und dabei Doppelerfassung vermeidet:

| Bestehendes Formular | Wird in der App zu |
|---|---|
| Checkliste Drohnenflug v9 (7 Seiten) | Geführter Einsatz-Workflow: Einsatzdaten → Vorbereitung → Vorflugkontrolle → Betriebskontrolle → Flüge/Akkus → Einsatzende → Nachkontrolle |
| Flugbuch v2 | Wird **automatisch** aus den Flügen des Einsatzes erzeugt |
| Notfall-Checkliste v2 | Jederzeit per „NOTFALL“-Button erreichbar (auch im laufenden Flug) |
| Wartungsbuch v2 (Excel) | Geräteverwaltung mit monatlicher Prüfung pro Gerät |

Kernidee: **Ein Einsatz wird einmal erfasst** – daraus entstehen Checkliste, Flugbuch-Einträge, Flugstunden der Piloten, Akku-Zyklen und Wartungshinweise.

## 2. Module

### 2.1 Einsatz / Flugtagebuch (Kernmodul)
Ein **Einsatz** (Mission) enthält 1..n **Flüge** (= Zeilen „Verwendete Akkus / Flug“ der Checkliste).

**Einsatzdaten** (Checkliste S. 1):
- Datum/Uhrzeit, Art: Einsatzflug / Trainingsflug / Checkflug
- Alarmierung/Auftrag von, Grund des Fluges, Bezeichnung Fluggebiet, Gemeindegebiet
- Fluggerät(e) aus Geräteverwaltung (mit Registrierungsnummer)
- Rechtsgrundlage: Bescheid Austro Control / OPEN (A1/A2/A3) / SPECIFIC BOS (Bescheid-Nr.)
- VLOS / EVLOS / BVLOS
- Geplante Flughöhe (max. 120 m, Warnung bei Überschreitung)
- **Automatische Berechnung**: Contingency Volume (10 % Flughöhe), Ground Risk Buffer (Flughöhe + CV), Abstand zu Menschenansammlungen (GRB + CV + 120 m) – Hinweis 1:1-Regel
- Rollen: Gesamt-Einsatzleiter, Drohnen-Teamleiter, Drohnen-Abschnittsleiter, Pilot, Luftraumbeobachter/Helfer (Piloten aus Verwaltung wählbar, Freitext für Externe)
- GPS-Position des Startpunkts (automatisch vom Gerät)

**Vorbereitung** (Punkte 1–14): Genehmigung EL (Zeit), Kommunikation, Flugroute, Wetter/Wind/Temperatur, Risikobeurteilung, Tetra-Funkgeräte (ISSI), informierte Stellen, Kontrollzone/Militärzone/Flugplatz < 2,5 km (je mit Freigabe/Betriebszeiten), Absperrung Start/Landezone, Hilfskräfte, höchstes Hindernis.

**Vorflugkontrolle** (Punkt 15–16) und **Betriebskontrolle** (Punkt 17) als abhakbare Listen. „Flug kann durchgeführt werden“ erst, wenn alle Pflichtpunkte erledigt sind (Übersteuern möglich mit Begründung → wird dokumentiert).

**Während des Einsatzes**:
- Flug starten / landen per Button (Zeitstempel automatisch, Dauer berechnet)
- je Flug: Akku-Nr., Spannung vor/nach, Zwischencheck erledigt
- Ereignis-Log mit Zeitstempel („Informationsweitergabe an EL über …“)
- NOTFALL-Button → Notfall-Checkliste (10 Szenarien inkl. „siehe auch“-Verknüpfung), Vorfall wird ins Ereignis-Log übernommen

**Einsatzende**: Abmeldung EL / Leitstelle / Tower / andere LFZ-Betreiber (Zeitstempel per Tipp).

**Nachkontrolle** (Punkte 18–23): Schäden Drohne, Rotoren, Motoren, Kamera/Gimbal/Sensoren, Akkus, Speicherkarte. „Wartung erforderlich“ erzeugt automatisch einen offenen Wartungspunkt am Gerät.

**Abschluss**: Anmerkungen/Vorfälle (Bezug lfd. Nr.), Unfall ja/nein (+ Datum der Meldung, Meldung an), Unterschrift Pilot (Signatur-Feld am Touchscreen), danach Einsatz gesperrt (nur noch Nachtrag mit Protokoll).

**Flugbuch-Ansicht**: Tabelle aller Flüge wie Flugbuch v2 (Datum, Pilot, Gerät, Einsatzort, Start/Landung/Dauer, VLOS/EVLOS/BVLOS, Payload, Einsatz/Ausbildung, Beschreibung, Einsatzleiter, Unfall, Bemerkungen) mit Filter und Suche.

### 2.2 Checklisten-Vorlagen (konfigurierbar)
Checklisten werden **nicht hart codiert**, sondern als Vorlagen (JSON) gespeichert:
- Standardvorlage „BFV Checkliste Drohnenflug v9“ + „Notfall v2“ vorinstalliert
- Versioniert: ein abgeschlossener Einsatz behält die Version, mit der er geflogen wurde
- Andere BOS-Organisationen können später eigene Vorlagen anlegen → Grundlage für die Erweiterung

### 2.3 Luftraum / Karte
- Eigene Karte (OpenStreetMap + Leaflet) mit Standort, Startpunkt und Radien (Ground Risk Buffer, Abstand Menschenansammlungen, 2,5 km Flugplatz)
- **Austro Control / Dronespace**: Die offizielle Karte ist map.dronespace.at.
  - Stufe 1 (sicher machbar): Button „Dronespace öffnen“ mit aktueller Position – öffnet die offizielle Karte.
  - Stufe 2 (zu prüfen): UAS-Geozonen als eigene Kartenebene. Nach EU-VO 2019/947 Art. 15 müssen die Mitgliedstaaten Geozonen in einem gemeinsamen digitalen Format (ED-269) veröffentlichen. Ob Austro Control diese Daten frei abrufbar/lizenzrechtlich nutzbar anbietet, muss geklärt werden (ggf. Anfrage bei Austro Control). Ein direktes Einbetten der Dronespace-Seite ist voraussichtlich technisch/rechtlich nicht vorgesehen.
  - Wichtig: Die App ersetzt **nicht** die verbindliche Prüfung in Dronespace – sie dokumentiert nur, dass geprüft wurde (Checkpunkt „Luftraum in Dronespace geprüft“ + Zeitstempel/Screenshot-Upload).

### 2.4 Pilotenverwaltung
- Stammdaten: Name, Feuerwehr (Organisation), Dienstgrad, Kontakt, Foto (optional)
- Ausbildungen/Qualifikationen mit Gültigkeit: EU-Kompetenznachweis A1/A3, Fernpilotenzeugnis A2, STS, BOS-Drohnenausbildung (Module), Funk/Tetra, sonstige – mit Ablaufdatum und Nachweis-Upload
- **Flugstunden automatisch** aus dem Flugtagebuch: gesamt, letzte 12 Monate, letzte 90 Tage, getrennt nach Einsatz / Training, je Gerätetyp
- **Freigabe als Einsatzpilot**: erteilt von (Person), Datum, gültig bis, Geräte-/Kategoriefreigabe
- **Ampel-Status**: grün = einsatzbereit; gelb = Qualifikation läuft in < 60 Tagen ab oder Flugpraxis knapp; rot = abgelaufen / keine Freigabe / Mindestpraxis unterschritten (z. B. < 3 Flüge in 90 Tagen – Regel konfigurierbar)
- Bei Einsatzanlage Warnung, wenn ein Pilot ohne gültige Freigabe gewählt wird

### 2.5 Geräteverwaltung & Wartung
- Gerät: Name (z. B. „Hornisse 1“), Hersteller/Modell, Payload, Registrierungsnummer, Seriennummer, Geräteverantwortlicher, Status (einsatzbereit / Wartung / außer Dienst)
- Akkus (Drohne & Fernbedienung) mit Nr., Zyklen (automatisch aus Flügen), Status
- **Wartungsbuch**: monatliche Prüfung nach Vorlage Wartungsbuch v2 (22 Prüfpunkte), Herstellerservice mit Fälligkeit, offene Mängel aus Nachkontrollen
- Betriebsstunden je Gerät automatisch aus den Flügen

### 2.6 Auswertung & Export
- Dashboard: Einsätze/Flüge/Stunden je Zeitraum, je Pilot, je Gerät, Einsatz vs. Training, Vorfälle
- Exporte:
  - **PDF Einsatzprotokoll** im Layout der Checkliste v9 (für Akt/Archiv, inkl. Unterschrift)
  - **PDF Flugbuch** im Layout Flugbuch v2
  - **Excel/CSV** Flugbuch, Pilotenstunden, Wartungsbuch (Jahresübersicht wie v2)
  - Jahresbericht (z. B. für Bezirks-/Landesfeuerwehrverband)
- Backup/Restore als JSON-Datei

## 3. Benutzer & Rollen
| Rolle | Rechte |
|---|---|
| Pilot | eigene Einsätze anlegen/durchführen, eigene Daten sehen |
| Drohnen-Teamleiter / Gruppenkommandant | alle Einsätze der Feuerwehr, Wartung, Auswertung |
| Administrator (Feuerwehr) | Piloten anlegen, Freigaben erteilen, Geräte, Vorlagen |
| (später) Bezirk/Land/Organisation | lesende Auswertung über mehrere Feuerwehren |

Mandantenfähig von Anfang an: jede Datenzeile gehört zu einer **Organisation** (Feuerwehr) mit Typ (FF, BF, BtF, später Rettung/Polizei …).

## 4. Technische Architektur (Vorschlag)

**Progressive Web App (PWA)** – läuft auf Tablet, Smartphone und PC, installierbar, **offline-fähig** (Einsatzort ohne Netz ist realistisch).

| Bereich | Technologie |
|---|---|
| Frontend | React + TypeScript + Vite |
| UI | Tailwind CSS, große Touch-Ziele, Dark-Mode (Nacht-/Sonneneinsatz) |
| Lokale Daten | IndexedDB via Dexie.js (offline-first) |
| Karte | Leaflet + OpenStreetMap |
| Export | pdfmake / jsPDF (PDF), SheetJS (Excel), CSV |
| Tests | Vitest + Playwright |
| Phase 2: Sync/Login | Backend (z. B. Supabase oder selbst gehostet, EU-Hosting) mit Synchronisation, Benutzerkonten, Rollen |

Warum PWA statt native App: eine Codebasis, keine App-Store-Freigaben, sofort im Browser testbar; kann später mit Capacitor als echte Android/iOS-App verpackt werden.

### Datenmodell (vereinfacht)
```
Organisation ─┬─ Pilot ── Qualifikation, Freigabe
              ├─ Geraet ── Akku, Wartung, Mangel
              ├─ ChecklistenVorlage (versioniert)
              └─ Einsatz ── Rollen, Checklisten-Antworten, Ereignis, Flug(Pilot, Geraet, Akku, Start, Landung, Spannung)
```
Flugstunden, Akkuzyklen und Gerätestunden werden **berechnet**, nicht doppelt gespeichert.

## 5. Datenschutz & Recht
- Personenbezogene Daten (Piloten, Einsatzorte) → DSGVO: Datenminimierung, lokale Speicherung in Phase 1, bei Cloud EU-Hosting, Auftragsverarbeitungsvertrag
- Abgeschlossene Einsätze unveränderlich (Änderungen nur als protokollierter Nachtrag) – wichtig für Nachweis gegenüber Behörde
- Aufbewahrungsfristen konfigurierbar
- Hinweis: Rechtsgrundlagen (EU 2019/947, Luftfahrtgesetz, BOS-Regelungen) werden nicht von der App geprüft; die App unterstützt nur die Dokumentation

## 6. Umsetzung in Phasen

**Phase 1 – MVP (lokal, offline, eine Feuerwehr)**
1. Grundgerüst: PWA, Navigation, Datenbank, Organisation einrichten
2. Piloten- und Geräteverwaltung
3. Einsatz-Workflow mit Checkliste v9 + Notfall-Checkliste
4. Flugbuch (automatisch) + Flugstunden
5. Wartungsbuch
6. Karte mit Radien + Dronespace-Link
7. Exporte PDF/Excel/CSV + Backup

**Phase 2** – Login, Cloud-Sync, mehrere Geräte/Benutzer pro Feuerwehr, Rollen
**Phase 3** – weitere BOS-Organisationen, eigene Vorlagen, übergeordnete Auswertungen, ggf. Geozonen-Layer, Import von DJI-Flugprotokollen

## 7. Umsetzung mit Agents (Plan)
1. **Agent „Fundament“** (sequenziell): Projekt-Setup, Datenmodell, Layout/Navigation, Checklisten-Vorlagen als JSON aus den PDFs
2. Danach **parallel** (je eigener Bereich, gemeinsames Datenmodell):
   - Agent A: Einsatz-Workflow + Checklisten + Notfall
   - Agent B: Piloten + Geräte + Wartung
   - Agent C: Karte + Auswertung/Dashboard + Exporte
3. **Agent „Review/Test“**: Code-Review, Tests, Durchklicken mit Playwright, Screenshots

## 8. Entscheidungen (12.11.2026)
- Plattform: **PWA** (offline-fähig, später ggf. mit Capacitor als App)
- Daten Phase 1: **lokal (IndexedDB) + Backup per Export/Import**, Login/Cloud in Phase 2
- Einsatzpilot-Freigabe: **konfigurierbar** (Pflicht-Qualifikationen + Mindestpraxis, Standard 3 Flüge / 90 Tage → Ampel)

## 9. Offene Fragen
1. Gibt es ein Corporate Design (Farben/Logo BFV / LFV) das verwendet werden soll/darf?
2. Geozonen: Kontakt zu Austro Control für Datenzugang vorhanden?
