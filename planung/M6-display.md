# M6 – Display & QR-Codes

**Ziel:** Das offizielle 5"-Display (Hochformat) zeigt nach dem Booten automatisch per Kiosk-Browser die
QR-Codes für WLAN und App sowie Uhrzeit und Status.

## Aufgabe 6.1 – Display-Hardware
- [x] 5"-Display am Pi 4 anschließen (DSI), Treiber bzw. Overlay prüfen (Touch Display 2, 720×1280 nativ hochkant, `display_auto_detect`)
- [x] Ausrichtung konfigurierbar (`DISPLAY_TRANSFORM`), nativ bereits Hochformat
- [x] Keine Bildschirmabschaltung (cage hat kein Idle-Blanking)
- [ ] Helligkeit prüfen

## Aufgabe 6.2 – Kiosk
- [x] `cage` + Chromium installieren (ohne Desktop)
- [x] Chromium im Kiosk-Modus, vorerst mit lokaler Statusseite (`file://`)
- [x] Umstellen auf `/display` der Web-App (Token-geschützt), Zertifikat im Kiosk-Browser hinterlegt
- [x] Kein Mauszeiger (unsichtbares Cursor-Theme + `cursor: none`)
- [x] Keine Übersetzungsleiste/Dialoge (Chromium-Richtlinien)
- [x] systemd-Service `einlass-kiosk`: Autostart auf tty1, Neustart bei Absturz
- [x] Auf die Display-Seite warten (max. 2 min), sonst statische Rückfallseite
- [ ] RAM- und CPU-Verbrauch auf dem Pi 4 prüfen

## Aufgabe 6.3 – Display-Seite `/display` (in `apps/web`)
- [x] Layout für das Hochformat (720×1280)
- [x] WLAN-QR (`WIFI:T:WPA;S:…;P:…;;`, Sonderzeichen escapen), vorerst aus `config.env` per `qrencode`
- [x] App-QR `https://einlass.lan`
- [x] Datum und Uhrzeit groß
- [x] Aktive Veranstaltung bzw. „Keine Veranstaltung aktiv“, Anzahl Scans
- [x] Aktualisiert sich selbst (Statistik alle 15 s, Live-Scans per Server-Sent Events), Verbindungsanzeige

## Aufgabe 6.4 – Touch-Bedienung (Wunsch aus dem Test)
- [x] Drei Ansichten, per Wischen oder Punkten wechselbar: Willkommen (QR) · Statistik · letzter Scan
- [x] Statistik: Personen, frei, je Liste, U18/U16, Zeitverlauf in 15-min-Balken mit Spitzenzeit
- [x] Letzter Scan live (springt bei jedem Scan nach vorn), Texte deutsch/englisch, ohne Matrikelnummer

## Definition of Done
- Nach dem Einschalten sind innerhalb von ca. 1–2 Minuten beide QR-Codes sichtbar und funktionieren mit iOS und Android
