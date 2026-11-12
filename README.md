# BOS Drohnen-App

Offline-fähige Web-App (PWA) zur Dokumentation von Drohneneinsätzen für Feuerwehren (später weitere BOS).
Grundlage sind die Formulare der Projektgruppe „Einsatz-Drohnen“ (BOS Drohnenausbildung):
Checkliste Drohnenflug v9, Flugbuch v2, Notfall-Checkliste v2, Wartungsbuch v2.

## Funktionen
- **Einsatz-Workflow** nach Checkliste v9: Einsatzdaten mit automatischer Berechnung der Sicherheitsabstände → Vorbereitung → Vorflug- und Betriebskontrolle → Flüge mit Akkus (Start/Landung per Knopfdruck) → Einsatzende → Nachkontrolle → Unterschrift und Abschluss
- **Flugbuch** wird automatisch aus den Flügen erzeugt
- **NOTFALL**-Checkliste jederzeit erreichbar, Vorfälle werden im Einsatz protokolliert
- **Piloten**: Qualifikationen mit Ablaufdatum, Freigabe als Einsatzpilot, Flugstunden automatisch, Ampel nach konfigurierbaren Regeln
- **Geräte**: Akkus mit Zyklen, Wartungsbuch (Jahresmatrix), Mängel (auch automatisch aus der Nachkontrolle)
- **Karte**: Startpunkt mit Sicherheitsradien, Link zu Dronespace (Austro Control)
- **Auswertung & Export**: Dashboard, PDF (Flugbuch, Einsatzprotokoll), Excel, CSV, Backup/Restore, Demodaten

Alle Daten bleiben lokal im Browser (IndexedDB). Regelmäßig ein Backup über *Einstellungen → Datensicherung* erstellen.

## Starten
```
npm install
npm run dev
```
Produktions-Build: `npm run build` (Ausgabe in `dist/`, als statische Seite über HTTPS ausliefern, damit die App installierbar ist und offline läuft).

Weitere Infos: [docs/KONZEPT.md](docs/KONZEPT.md), [docs/ENTWICKLUNG.md](docs/ENTWICKLUNG.md)

> Die App unterstützt die Dokumentation. Sie ersetzt nicht die verbindliche Luftraumprüfung in Dronespace und prüft keine Rechtsgrundlagen.
