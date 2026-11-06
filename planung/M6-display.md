# M6 – Display & QR-Codes

**Ziel:** Das offizielle 5"-Display (Hochformat) zeigt nach dem Booten automatisch per Kiosk-Browser die
QR-Codes für WLAN und App sowie Uhrzeit und Status.

## Aufgabe 6.1 – Display-Hardware
- [ ] 5"-Display am Pi 4 anschließen (DSI), Treiber bzw. Overlay prüfen
- [ ] Rotation ins Hochformat (90°/270°)
- [ ] Helligkeit, Abschaltung bzw. Bildschirmschoner deaktivieren

## Aufgabe 6.2 – Kiosk
- [ ] `cage` + Chromium installieren (ohne Desktop)
- [ ] Chromium im Kiosk-Modus auf `https://localhost/display`, Zertifikat vertrauen (oder interne HTTP-Route nur auf localhost)
- [ ] systemd-Service: startet nach Docker, wartet auf API-Health, Neustart bei Absturz
- [ ] RAM- und CPU-Verbrauch auf dem Pi 4 prüfen

## Aufgabe 6.3 – Display-Seite `/display` (in `apps/web`)
- [ ] Layout für das Hochformat (800×480 gedreht → 480×800)
- [ ] WLAN-QR aus `/system/display` (`WIFI:T:WPA;S:…;P:…;;`, Sonderzeichen escapen)
- [ ] App-QR `https://einlass.lan`
- [ ] Datum und Uhrzeit groß
- [ ] Aktive Veranstaltung bzw. „Keine Veranstaltung aktiv“, Anzahl Scans
- [ ] Aktualisiert sich selbst, Fehlerzustand bei nicht erreichbarer API

## Definition of Done
- Nach dem Einschalten sind innerhalb von ca. 1–2 Minuten beide QR-Codes sichtbar und funktionieren mit iOS und Android
