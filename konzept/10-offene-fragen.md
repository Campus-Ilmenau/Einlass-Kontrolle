# 10 – Entscheidungen und offene Fragen

Status: ☐ offen · ☑ entschieden

## Ausweis / Scan
- ☑ Barcode/QR-Code auf der Thoska+? → **Nein.** Erfassung per **OCR**, Fallback ist die manuelle Eingabe
- ☑ Format der Matrikelnummer → **immer 5-stellig, numerisch** (`^\d{5}$`)
- ☑ Unterstützte Ausweise → **nur Thoska** (Gäste ohne Thoska werden nicht über das System geprüft)
- ☑ Format des Geburtsdatums auf der Karte → **TT.MM.JJJJ**
- ☑ OCR-Machbarkeit → **grundsätzlich bestätigt** (M1, iPad): Matrikel sofort, Datum ist der Engpass
- ☐ Ziel < 3 s bis zum stabilen Ergebnis → Nachtest mit Stabilisierung v2

## Hardware / Netzwerk
- ☑ Pi-Modell → **Raspberry Pi 4**
- ☑ Display → **offizielles 5"-Display, Hochformat**
- ☑ Display-Software → **Kiosk-Browser** (cage + Chromium zeigt `/display`)
- ☑ Uhrzeit → **RTC-Modul (DS3231) + NTP bei Ethernet + automatischer Abgleich bei jeder Client-Anmeldung**
  (Login und Sitzungs-Wiederaufnahme, mit Schutzregeln). Details in [04-hardware-und-netzwerk.md](04-hardware-und-netzwerk.md#automatischer-zeitabgleich-bei-anmeldung)
- ☑ HTTPS → **self-signed Zertifikat** (Browser-Warnung einmal pro Gerät bestätigen).
  Kamera-Freigabe auf iPad bestätigt (M1). iPhone/Android noch testen. Plan B ist eine eigene CA
- ☑ Ein Pi pro Club, keine Mandantentrennung

## Fachlich
- ☑ Automatische Sperre → **beides**:
  - „gültig bis“-Zeitpunkt pro Account (optional)
  - **5 Fehlversuche → 15 min Sperre** (entsperrt sich automatisch)
- ☑ Accounts sind **nicht** an Veranstaltungen gekoppelt, sie haben nur „gültig bis“
- ☑ Altersstufen → **U16 / U18 / 18+**
- ☑ Doppel-Scan → **ja, als Hinweis** („bereits um 22:14 gescannt“). Die Matrikelnummer wird dafür nur gehasht gespeichert
- ☑ Abend-Konzept → **Veranstaltungen** mit Start/Ende und zugeordneten Freilisten.
  Im Zeitfenster sind sie automatisch aktiv
- ☑ Keine Veranstaltung aktiv → **Scan gesperrt**
- ☑ Rollen → **strikt getrennt** (Admin scannt nicht)
- ☑ Statistik → **einfache Zähler pro Veranstaltung** (gesamt, frei je Liste, U16/U18, je Kontrolleur:in)
- ☑ Listen-Import → **CSV, Excel (.xlsx), Copy-Paste, einzeln eintippen**
- ☑ Aufbewahrung → **konfigurierbare Frist** (Admin-Einstellung). Danach werden Scan-Protokolle
  gelöscht, nur die Zähler bleiben
- ☐ Dürfen sich Veranstaltungen zeitlich überschneiden? *(Annahme: nein, wird beim Anlegen validiert)*

## Technik
- ☑ API → **Fastify** (TypeScript) + **TypeORM**
- ☑ DB → **PostgreSQL**
- ☑ UI → **Ant Design**
- ☑ Repo → **pnpm Workspaces** (`apps/api`, `apps/web`, `packages/shared`)
- ☑ Updates → **CI (GitHub Actions) baut arm64-Images** und veröffentlicht sie in GHCR. Ein **Auto-Update-Dienst
  auf dem Pi** zieht sie, sobald er per Ethernet online ist, aber nie während einer Veranstaltung.
  Kein Self-hosted Runner (Begründung in [03-architektur.md](03-architektur.md#warum-kein-self-hosted-runner-auf-dem-pi))
- ☑ Betriebsmodell: Pi liegt aus im Schrank. Vorbereitung ca. 2 Tage vorher (optional mit Ethernet und
  Internet), danach aus. Am Abend ca. 3 h vor Einlass nur Strom, kein Netz, Admin vor Ort

## Organisatorisch
- ☑ Datenschutz-Abstimmung mit StuRa/TU → **nicht nötig** (wird anders geregelt)
- ☑ Lizenz → **MIT**
- ☐ Wer betreibt und wartet das Gerät?
