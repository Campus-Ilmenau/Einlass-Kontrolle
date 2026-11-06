# M7 – Integration & Deployment

**Ziel:** Das komplette System läuft per Docker Compose auf dem Pi. Die CI baut die Images, Updates und
Backups sind geregelt.

## Aufgabe 7.1 – Docker Compose (Produktion)
- [ ] `infra/docker/docker-compose.yml`: proxy (nginx + Web-Build), api, db
- [ ] Web-Image: multi-stage (pnpm build → nginx)
- [ ] nginx: TLS (self-signed), `/` → SPA mit Fallback, `/api` → API, Security-Header, Umleitung 80 → 443
- [ ] Zertifikat und WLAN-Konfig als Volumes bzw. read-only Mounts
- [ ] `.env.example` (DB-Passwort, JWT-Secret, initialer Admin)
- [ ] `restart: unless-stopped`, Healthchecks, Ressourcenlimits
- [ ] Migrationen laufen automatisch beim Start der API

## Aufgabe 7.2 – CI/CD (GitHub Actions)
- [ ] Workflow „CI“: pnpm install, Lint, Typecheck, Tests (bei jedem Push und PR)
- [ ] Workflow „Release“: bei Tag `v*` Multi-Arch-Images (`linux/arm64`, optional `amd64`) mit buildx bauen
- [ ] Push nach **GHCR** (`ghcr.io/<org>/einlass-api`, `einlass-web`)
- [ ] Versionsnummer in der App bzw. im Admin-Bereich sichtbar

## Aufgabe 7.3 – Auto-Update auf dem Pi (pull-basiert)
- [ ] Compose nutzt Tag `stable` (bzw. gepinnte Version per `.env`)
- [ ] `infra/pi/update.sh`:
  - [ ] Internet-Check (GHCR erreichbar)
  - [ ] Abbruch, wenn eine Veranstaltung aktiv ist (`/system/maintenance-allowed`)
  - [ ] NTP-Sync + `hwclock -w`
  - [ ] `docker compose pull`. Bei neuen Images: DB-Backup → `up -d` → Healthcheck
  - [ ] Rollback auf die vorherigen Image-Digests, wenn der Healthcheck fehlschlägt
  - [ ] Alte Images aufräumen, Status-File schreiben (Version, Zeitpunkt, Ergebnis)
- [ ] systemd-Service `einlass-update` + Timer (alle 30 min) + NetworkManager-Dispatcher-Hook (`eth0 up`)
- [ ] Lock-Datei gegen parallele Läufe
- [ ] Anzeige im Admin-Bereich: Version, letztes Update, letzter NTP-Sync (`/admin/system/info`)
- [ ] Test: Pi offline → Release erstellen → Ethernet einstecken → Update läuft automatisch
- [ ] Offline-Fallback dokumentieren: `docker save` auf dem Laptop → USB → `docker load`

## Aufgabe 7.4 – Backup & Robustheit
- [ ] DB-Backup-Skript (`pg_dump` auf USB-Stick)
- [ ] Restore testen
- [ ] Stromausfall-Test: Pi hart ausschalten → bootet sauber, DB konsistent, Uhrzeit korrekt
- [ ] Aufbewahrungs-Job im Betrieb verifizieren

## Definition of Done
- Release-Tag → Images in GHCR → Pi zieht sie automatisch, sobald er per Ethernet online ist (nicht während einer Veranstaltung)
- Stromausfall-Test bestanden, Backup und Restore getestet
