# Docker-Setup

Die Anwendung läuft auf dem Pi als Docker Compose-Projekt `einlass` mit drei Containern:

| Container | Image                                  | Aufgabe                                                                                 |
| --------- | -------------------------------------- | --------------------------------------------------------------------------------------- |
| `proxy`   | `ghcr.io/campus-ilmenau/einlass-proxy` | nginx mit Web-App: HTTPS (self-signed), `/api` → API, `/` → Web-App, `/poc/` → Prototyp |
| `api`     | `ghcr.io/campus-ilmenau/einlass-api`   | Fastify-API (Port 3000, nur intern)                                                     |
| `db`      | `postgres:18-alpine`                   | Datenbank (Volume `einlass_dbdata`)                                                     |

```
WLAN-Client ──HTTPS──▶ proxy :443 ──▶ api :3000 ──▶ db :5432
                                        │
                                        └──▶ /run/einlass/hostd.sock (einlass-hostd auf dem Host)
```

## Auf dem Pi

Eingerichtet wird alles von [`infra/pi/setup.sh`](../pi/README.md), Schritt `app`:

- `/opt/einlass/compose.yml` (Kopie von [`compose.yml`](compose.yml))
- `/opt/einlass/.env` (Rechte `0600`): Datenbank-Passwort, JWT-Geheimnis, Start-Passwort des ersten
  Admins, GID der Gruppe `einlass`, Image-Version
- Start mit `docker compose up -d --no-build --wait`

Nützliche Befehle (auf dem Pi):

```bash
cd /opt/einlass
sudo docker compose ps                 # Status
sudo docker compose logs -f api        # Logs der API
sudo docker compose pull && sudo docker compose up -d   # Update aus der Registry
sudo grep ADMIN_INITIAL_PASSWORD .env  # Start-Passwort des ersten Admins
```

## Images

- **CI:** [`.github/workflows/docker.yml`](../../.github/workflows/docker.yml) baut für `linux/arm64` (Pi) und
  `linux/amd64` und veröffentlicht in GHCR: `main` bei jedem Push auf `main`, `1.2.3` / `1.2` / `stable`
  bei einem Tag `v1.2.3`.
- **Lokal aus dem Quellcode** (z. B. direkt auf dem Pi, Build-Kontext ist die Repository-Wurzel):

  ```bash
  docker compose -f infra/docker/compose.yml --env-file /opt/einlass/.env build
  ```

## Sicherheit

- Der Proxy überschreibt `X-Forwarded-For` mit der echten Client-Adresse, Clients können sie nicht fälschen.
- Die API läuft als Benutzer `node` (nicht root) und kommt an Zeit/Herunterfahren nur über den Socket von
  `einlass-hostd` (Gruppe `einlass` per `group_add`).
- Die Datenbank ist nur im internen Docker-Netz erreichbar (kein Port nach außen).
