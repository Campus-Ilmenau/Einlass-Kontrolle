# 03 – Architektur

## Komponenten

| Komponente | Technologie | Läuft wo |
|---|---|---|
| Access Point, DHCP, DNS | NetworkManager-Hotspot bzw. hostapd + dnsmasq | Host-OS (nicht in Docker, siehe unten) |
| Reverse Proxy / Webserver | nginx (TLS, self-signed) | Docker |
| Web-App | React + Vite + TypeScript + **Ant Design**, als statische Dateien | Docker (vom Proxy ausgeliefert) |
| API | Node.js, TypeScript, **Fastify**, **TypeORM** | Docker |
| Datenbank | **PostgreSQL** | Docker (Volume für Daten) |
| Display-Anzeige | Kiosk: `cage` + Chromium → `https://localhost/display` | Host (systemd-Service) |

## Repo-Struktur (pnpm Workspaces)

```
apps/
  api/        Fastify + TypeORM
  web/        React + Vite + Ant Design (inkl. /display-Seite)
packages/
  shared/     gemeinsame Typen und Validierung (z. B. zod-Schemas, Matrikel-Regex, Altersberechnung)
infra/
  pi/         Setup-Skripte für den Pi (AP, DNS, RTC, Docker, Kiosk)
  docker/     docker-compose.yml, nginx-Konfiguration
.github/workflows/  CI: Lint, Test, arm64-Images → GHCR
```

## Docker Compose (Skizze)

```yaml
services:
  proxy:   # nginx: TLS (self-signed), liefert / → React-Build, /api → api:3000
    image: ghcr.io/<org>/einlass-web:<version>
    ports: ["443:443", "80:80"]   # 80 leitet nur auf 443 um
  api:
    image: ghcr.io/<org>/einlass-api:<version>
    environment: [DATABASE_URL, JWT_SECRET, ADMIN_INITIAL_NAME, ADMIN_INITIAL_PASSWORD, TZ=Europe/Berlin]
    depends_on: [db]
  db:
    image: postgres:16-alpine
    volumes: [dbdata:/var/lib/postgresql/data]
volumes:
  dbdata:
```

Alle Container laufen mit `restart: unless-stopped` und starten beim Booten automatisch.

## Warum der Access Point auf dem Host läuft
WLAN-AP und DHCP brauchen direkten Zugriff auf die Netzwerk-Hardware. In Docker geht das nur mit
`network_mode: host` plus Privilegien und ist fehleranfälliger. Der AP wird deshalb einmalig per
Setup-Skript auf dem Host eingerichtet, die Anwendung läuft in Docker. Dasselbe gilt für den Display-Kiosk.

## Hintergrund-Jobs in der API
- **Aufbewahrung:** regelmäßig (z. B. stündlich) Scan-Protokolle löschen, die älter als die eingestellte Frist sind
- Ob eine Veranstaltung aktiv ist, wird **beim Request** aus Start/Ende berechnet. Dafür braucht es keinen Job

## Updates

Der Pi ist nur selten online, typischerweise in der Vorbereitungsphase per Ethernet
(siehe [Lebenszyklus](02-rollen-und-ablaeufe.md#lebenszyklus-des-geräts)). Updates laufen deshalb **pull-basiert**:
Der Pi fragt selbst nach, sobald er Internet hat.

### Bauen (Cloud)
- **GitHub Actions** baut bei einem Release-Tag `v*` Multi-Arch-Images (`linux/arm64`) und pusht sie nach **GHCR**
- Zusätzlich gibt es einen beweglichen Tag `stable`, der auf das aktuelle Release zeigt

### Einspielen (auf dem Pi): Auto-Update-Dienst
- Ein **systemd-Service** (`einlass-update`) wird ausgelöst:
  - beim Boot und wenn eine Netzwerkverbindung hochkommt (NetworkManager-Dispatcher auf `eth0 up`)
  - zusätzlich per systemd-Timer (z. B. alle 30 min), solange er online ist
- Ablauf von `infra/pi/update.sh`:
  1. Internet erreichbar? (z. B. `ghcr.io` auflösen und erreichen) Wenn nicht → Ende
  2. **Ist gerade eine Veranstaltung aktiv?** Dann **kein Update** (API fragen) → Ende
  3. Zeit per NTP synchronisieren und RTC schreiben (`hwclock -w`)
  4. `docker compose pull`. Gibt es keine neuen Images → Ende
  5. DB-Backup (`pg_dump`) lokal ablegen
  6. `docker compose up -d`, Healthcheck abwarten
  7. Healthcheck fehlgeschlagen → **Rollback** auf die vorherigen Image-Digests
  8. Alte Images aufräumen, Ergebnis in ein Status-File schreiben (Version, Zeitpunkt, Erfolg)
- Der Admin-Bereich zeigt die **installierte Version**, das **letzte Update** und die **letzte Zeitsynchronisierung**
- Fallback ganz ohne Internet: Images auf dem Laptop holen (`docker save`), per USB übertragen und mit `docker load` einspielen

### Warum kein Self-hosted Runner auf dem Pi?
Einen GitHub-Self-hosted-Runner (das Pendant zum GitLab Runner) gibt es auch für ARM64, und er würde auf
dem Pi laufen. Für diesen Fall passt er aber schlecht:
- **Push- statt Pull-Modell:** Ein Runner arbeitet Jobs ab, die eine Pipeline anstößt. Ist der Pi beim
  Release offline, wartet der Job und verfällt nach spätestens 24 h. Der Pi ist aber oft wochenlang offline
- **Sicherheit:** Das Repo ist öffentlich (MIT). GitHub rät ausdrücklich davon ab, Self-hosted Runner an
  öffentliche Repos zu hängen, weil Pull-Requests sonst Code auf dem Gerät ausführen können. Das Gerät
  enthält Matrikellisten
- Der Pull-Dienst ist einfacher, braucht keinen Token mit Repo-Rechten und funktioniert genauso mit GitLab
  (Container Registry), falls das Projekt dorthin umzieht
