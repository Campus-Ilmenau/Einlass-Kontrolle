# M7 – Integration & Deployment

**Ziel:** Das komplette System läuft per Docker Compose auf dem Pi. Die CI baut die Images, Updates und
Backups sind geregelt.

## Aufgabe 7.1 – Docker Compose (Produktion)
- [x] `infra/docker/compose.yml`: proxy (nginx), api, db
- [ ] Web-Image: multi-stage (pnpm build → nginx), vorerst Platzhalterseite im Proxy-Image
- [x] nginx: TLS (self-signed), `/` → SPA mit Fallback, `/api` → API, Security-Header, Umleitung 80 → 443
- [x] Zertifikat als read-only Mount, hostd-Socket über Gruppe `einlass`
- [x] `.env` wird vom Setup mit zufälligen Geheimnissen erzeugt (DB-Passwort, JWT-Secret, initialer Admin)
- [x] `restart: unless-stopped`, Healthchecks, Log-Begrenzung
- [ ] Ressourcenlimits
- [x] Migrationen laufen automatisch beim Start der API

## Aufgabe 7.2 – CI/CD (GitHub Actions)
- [ ] Workflow „CI“: pnpm install, Lint, Typecheck, Tests (bei jedem Push und PR)
- [x] Workflow „Docker-Images“: bei Push auf `main` und Tag `v*` Multi-Arch-Images (`linux/arm64`, `linux/amd64`) mit buildx
- [x] Push nach **GHCR** (`ghcr.io/campus-ilmenau/einlass-api`, `einlass-proxy`)
- [ ] GHCR-Pakete öffentlich schalten (sonst braucht der Pi ein Token)
- [ ] Versionsnummer in der App bzw. im Admin-Bereich sichtbar

## Aufgabe 7.3 – Auto-Update auf dem Pi (pull-basiert)
- [x] Compose nutzt `EINLASS_VERSION` aus `.env` (vorerst `main`, später `stable` bzw. gepinnte Version)
- [ ] `infra/pi/update.sh`:
  - [x] Internet-Check (GHCR erreichbar)
  - [x] Abbruch, wenn eine Veranstaltung aktiv ist (über `/api/system/display`)
  - [x] NTP-Sync + `hwclock -w`
  - [x] `docker compose pull`. Bei neuen Images: DB-Backup → `up -d` → Healthcheck
  - [x] Rollback auf die vorherigen Images, wenn der Healthcheck fehlschlägt (noch nicht live getestet)
  - [x] Alte Images aufräumen, Status-File schreiben (Version, Zeitpunkt, Ergebnis)
- [x] systemd-Service `einlass-update` + Timer (alle 15 min) + NetworkManager-Dispatcher-Hook (`eth0 up`)
- [x] Lock-Datei gegen parallele Läufe
- [ ] Anzeige im Admin-Bereich: Version, letztes Update, letzter NTP-Sync (`/admin/system/info`)
- [ ] Test: Pi offline → Release erstellen → Ethernet einstecken → Update läuft automatisch
- [x] Test: neues Image → Backup → Neustart; laufende Veranstaltung → kein Update
- [ ] Offline-Fallback dokumentieren: `docker save` auf dem Laptop → USB → `docker load`

## Aufgabe 7.4 – Backup & Robustheit
- [x] DB-Backup vor jedem Update (`pg_dump` nach `/var/lib/einlass/backups`)
- [ ] Backup auf USB-Stick
- [ ] Restore testen
- [ ] Stromausfall-Test: Pi hart ausschalten → bootet sauber, DB konsistent, Uhrzeit korrekt
- [ ] Aufbewahrungs-Job im Betrieb verifizieren

## Definition of Done
- Release-Tag → Images in GHCR → Pi zieht sie automatisch, sobald er per Ethernet online ist (nicht während einer Veranstaltung)
- Stromausfall-Test bestanden, Backup und Restore getestet
