# Planung – Einlass-Kontrolle

Die Umsetzung ist in **Milestones** gegliedert. Jeder Milestone hat eine eigene Datei mit
**Aufgaben** (Überschriften) und **Unteraufgaben** (Checkboxen). Das Konzept dazu steht in [`../konzept/`](../konzept/README.md).

Struktur pro Milestone: **Ziel** → **Aufgaben mit Unteraufgaben** → **Definition of Done**.

## Übersicht

| # | Milestone | Ziel | Abhängig von | Status |
|---|---|---|---|---|
| M0 | [Klärung & Projekt-Setup](M0-klaerung-und-setup.md) | Restfragen klären, Hardware, Repo-Struktur | – | ☐ |
| M1 | [Machbarkeits-Prototyp](M1-machbarkeit-prototyp.md) | Größte Risiken früh prüfen: Kamera über HTTPS im Pi-WLAN, OCR der Thoska | M0 | ☐ |
| M2 | [Pi-Grundsystem](M2-pi-grundsystem.md) | Pi bootet, spannt WLAN auf, Docker läuft, Uhrzeit stimmt | M0 | ☐ |
| M3 | [Backend / API](M3-backend-api.md) | Datenmodell, Auth, Admin- und Check-Endpunkte | M0 | ☐ |
| M4 | [Web-App: Login & Admin](M4-webapp-admin.md) | Admin verwaltet Kontrolleur:innen, Freilisten, Veranstaltungen | M3 | ☐ |
| M5 | [Web-App: Scan & Prüfung](M5-webapp-scan.md) | Kontrolleur:in scannt und sieht das Ergebnis | M1, M3 | ☐ |
| M6 | [Display & QR-Codes](M6-display.md) | 5"-Display (Kiosk, Hochformat) zeigt QR-Codes, Uhrzeit, Status | M2 | ☐ |
| M7 | [Integration & Deployment](M7-integration-deployment.md) | Docker Compose auf dem Pi, CI-Images (GHCR), Update & Backup | M2–M6 | ☐ |
| M8 | [Test, Pilot & Doku](M8-test-pilot-doku.md) | Testabend im Club, Handbuch, Feedback einarbeiten | M7 | ☐ |

## Reihenfolge / Parallelisierung

```
M0 ──┬── M1 (Risiko-PoC) ───────────────┐
     ├── M2 (Pi) ──────────── M6 ───────┤
     └── M3 (API) ──┬── M4 (Admin-UI) ──┼── M7 ── M8
                    └── M5 (Scan-UI) ───┘
```

**M1 zuerst bzw. parallel:** Wenn Kamera/HTTPS oder OCR nicht funktionieren, ändert das die Architektur
(z. B. andere OCR-Lösung, eigene CA statt self-signed). Deshalb sollte M1 vor M5 abgeschlossen sein.

## MVP-Schnitt
Für einen ersten echten Einsatz reichen:
- M2 mit AP, Docker und RTC
- M3 und M4 inkl. Veranstaltungen (Statistik darf nachgezogen werden)
- M5 mit **manueller Eingabe** (OCR darf nachgezogen werden, falls M1 Probleme zeigt)
- M6 mit statischem QR-Code (zur Not ausgedruckt)
- M7 Basis

Mit *(optional)* markierte Punkte gehören nicht zum MVP.
