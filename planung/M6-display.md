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
- [ ] Umstellen auf `/display` der Web-App, Zertifikat vertrauen (oder interne HTTP-Route nur auf localhost)
- [x] Kein Mauszeiger (unsichtbares Cursor-Theme + `cursor: none`)
- [x] Keine Übersetzungsleiste/Dialoge (Chromium-Richtlinien)
- [x] systemd-Service `einlass-kiosk`: Autostart auf tty1, Neustart bei Absturz
- [ ] Auf API-Health warten (sobald die API existiert)
- [ ] RAM- und CPU-Verbrauch auf dem Pi 4 prüfen

## Aufgabe 6.3 – Display-Seite `/display` (in `apps/web`)
- [x] Layout für das Hochformat (720×1280)
- [x] WLAN-QR (`WIFI:T:WPA;S:…;P:…;;`, Sonderzeichen escapen), vorerst aus `config.env` per `qrencode`
- [x] App-QR `https://einlass.lan`
- [x] Datum und Uhrzeit groß
- [ ] Aktive Veranstaltung bzw. „Keine Veranstaltung aktiv“, Anzahl Scans
- [ ] Aktualisiert sich selbst, Fehlerzustand bei nicht erreichbarer API

## Definition of Done
- Nach dem Einschalten sind innerhalb von ca. 1–2 Minuten beide QR-Codes sichtbar und funktionieren mit iOS und Android
