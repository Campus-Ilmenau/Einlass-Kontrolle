# Raspberry Pi einrichten

Richtet einen frisch installierten Raspberry Pi 4 als Einlass-Gerät ein: WLAN-Access-Point, DHCP/DNS,
Firewall, Docker, RTC, TLS-Zertifikat und Kiosk-Anzeige auf dem Display.

## Voraussetzungen

- Raspberry Pi OS Lite 64 Bit (getestet mit **Debian 13 „Trixie“**), per Raspberry Pi Imager mit
  Hostname, Benutzer und aktiviertem SSH geflasht
- Pi per **Ethernet mit Internet** verbunden (für Pakete, Docker und NTP-Zeit)
- Optional: RTC-Modul DS3231 an I²C (Adresse `0x68`)

## Ausführen

```bash
scp -r infra/pi <user>@<pi-ip>:~/einlass-infra/
ssh <user>@<pi-ip>
cd ~/einlass-infra/pi
sudo ./setup.sh                  # alle Schritte
sudo ./setup.sh --skip-upgrade   # ohne apt full-upgrade
sudo ./setup.sh dns tls          # nur einzelne Schritte
```

Das Skript ist **idempotent** und kann gefahrlos mehrfach laufen.

## Konfiguration

Beim ersten Lauf wird [`config.env.example`](config.env.example) nach **`/etc/einlass/config.env`** kopiert.
Dort stehen SSID, **WLAN-Passwort** (wird beim ersten Lauf zufällig erzeugt), IP-Bereich, Domain und
TLS-Laufzeit. Nach Änderungen einfach `sudo ./setup.sh accesspoint dns tls` erneut ausführen.

## Schritte

| Schritt       | Datei                                          | Was passiert                                                                                                                                  |
| ------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `base`        | [lib/10-base.sh](lib/10-base.sh)               | apt update/upgrade, Pakete, Zeitzone, `/etc/hosts`                                                                                            |
| `docker`      | [lib/20-docker.sh](lib/20-docker.sh)           | Docker CE + Compose-Plugin (offizielles Repo), Log-Limits                                                                                     |
| `firewall`    | [lib/30-firewall.sh](lib/30-firewall.sh)       | nftables: **kein Routing** zwischen `wlan0` und `eth0` (systemd-Service `einlass-firewall`)                                                   |
| `accesspoint` | [lib/40-accesspoint.sh](lib/40-accesspoint.sh) | NetworkManager-AP `einlass-ap`, WPA2, feste IP `10.42.0.1`, kein NAT                                                                          |
| `dns`         | [lib/50-dns.sh](lib/50-dns.sh)                 | dnsmasq nur auf `wlan0`: DHCP + `einlass.lan → 10.42.0.1`, kein Upstream                                                                      |
| `rtc`         | [lib/60-rtc.sh](lib/60-rtc.sh)                 | I²C an, DS3231-Overlay **nur wenn Modul erkannt**, `fake-hwclock` entfernen                                                                   |
| `tls`         | [lib/70-tls.sh](lib/70-tls.sh)                 | Self-signed-Zertifikat in `/etc/einlass/tls/` (nur bei NTP-synchroner Uhr)                                                                    |
| `hostd`       | [lib/90-hostd.sh](lib/90-hostd.sh)             | Host-Dienst `einlass-hostd` für die API: Zeit setzen, RTC schreiben, Herunterfahren                                                           |
| `kiosk`       | [lib/80-kiosk.sh](lib/80-kiosk.sh)             | cage + Chromium auf dem DSI-Display (Hochformat), unsichtbarer Cursor, Statusseite mit WLAN-/App-QR-Code und Uhr                              |
| `app`         | [lib/95-app.sh](lib/95-app.sh)                 | `/opt/einlass` mit `compose.yml` und `.env` (Geheimnisse werden erzeugt), Start per Docker Compose, siehe [infra/docker](../docker/README.md) |
| `update`      | [lib/97-update.sh](lib/97-update.sh)           | Auto-Update `einlass-update`: Timer alle 15 min + sofort bei `eth0 up`                                                                        |

## Host-Dienst `einlass-hostd`

Die API läuft in Docker und darf weder die Uhr stellen noch den Pi herunterfahren. Das übernimmt
[`files/einlass-hostd`](files/einlass-hostd) (Python, nur Standardbibliothek) über einen Unix-Socket:

| Methode | Pfad        | Wirkung                                                                         |
| ------- | ----------- | ------------------------------------------------------------------------------- |
| GET     | `/health`   | `{"ok": true}`                                                                  |
| GET     | `/time`     | Systemzeit, NTP-Status, RTC vorhanden/Zeit, letzte bekannte Zeit                |
| POST    | `/time`     | `{"time": "2026-11-06T20:15:00Z", "source": "login"}` → Systemzeit + RTC setzen |
| POST    | `/shutdown` | Pi nach 2 s herunterfahren                                                      |
| POST    | `/reboot`   | Pi nach 2 s neu starten                                                         |

- Socket `/run/einlass/hostd.sock`, Rechte `0660 root:einlass`. Der API-Container bekommt
  `group_add: [<GID von einlass>]` und mountet `/run/einlass`
- Fachliche Regeln (Schwelle 30 s, Untergrenze, Sperrzeit, aktive Veranstaltung) prüft die **API**.
  Der Dienst lehnt nur Unplausibles ab (ohne Zeitzone, Jahr außerhalb 2024–2100)
- Speichert jede Minute die **letzte bekannte Zeit** (`/var/lib/einlass/last-known-time`) und setzt die mtime
  der Uhr-Datei von systemd-timesyncd. Liegt die Systemzeit beim Start davor, wird sie vorgestellt
- Bei NTP-synchroner Uhr und vorhandener RTC wird die RTC stündlich nachgestellt. NTP gibt es nur über
  `eth0`, weil das WLAN keine Route nach außen hat
- Gehärteter systemd-Dienst (`ProtectSystem=strict`, `PrivateNetwork`, nur `AF_UNIX`, eingeschränkte Capabilities)

Test vom Pi aus:

```bash
sudo curl -s --unix-socket /run/einlass/hostd.sock http://hostd/time
```

## Auto-Update `einlass-update`

Holt neue Docker-Images aus GHCR, sobald der Pi Internet hat ([`files/einlass-update`](files/einlass-update)):

1. Lock (nur ein Lauf gleichzeitig), Internet-Check (`ghcr.io` erreichbar), sonst Ende
2. **Läuft eine Veranstaltung? → kein Update** (`skipped`, mit `--force` übergehbar)
3. RTC aus NTP-Zeit nachstellen (falls vorhanden)
4. `compose.yml` aus dem Repository holen (`main` bzw. Tag `v<EINLASS_VERSION>`), nur wenn gültig übernehmen
5. `docker compose pull`. Ohne neue Images → `current`
6. Datenbank-Backup nach `/var/lib/einlass/backups/` (die letzten 10 bleiben)
7. Neustart mit Healthcheck. Schlägt er fehl → **Rollback** auf die vorherigen Images (`:rollback`)
8. Status in `/var/lib/einlass/update-status.json` (`current` / `updated` / `skipped` / `rolled-back` / `failed`)

Auslöser: systemd-Timer (2 min nach dem Boot, dann alle 15 min) und NetworkManager-Hook beim Einstecken des
Ethernet-Kabels. Manuell:

```bash
sudo systemctl start einlass-update && journalctl -u einlass-update -n 30
sudo einlass-update --force   # auch während einer Veranstaltung
```

Kanal: `EINLASS_VERSION` in `/opt/einlass/.env`: `main` (Entwicklungsstand) oder später z. B. `stable`.

## Kiosk

- Dienst `einlass-kiosk` startet `cage` (Wayland-Kiosk) auf tty1 als Systembenutzer `kiosk`, darin Chromium im Vollbild
- `einlass-display-render` erzeugt `/opt/einlass/display/` (QR-Codes per `qrencode`) aus `config.env`.
  Es läuft vor jedem Kiosk-Start, Änderungen an SSID oder Passwort erscheinen also nach `sudo systemctl restart einlass-kiosk`
- **Drehung:** `DISPLAY_TRANSFORM` in `/etc/einlass/config.env` (`normal`, `90`, `180`, `270`), danach den Kiosk neu starten
- **Kein Mauszeiger:** unsichtbares Xcursor-Theme `einlass-blank` + `cursor: none` auf der Seite
- Chromium-Richtlinien in `/etc/chromium/policies/managed/einlass-kiosk.json` (keine Übersetzungsleiste, kein Passwortmanager)
- Screenshot zur Kontrolle (vom Pi aus):
  `sudo -u kiosk env XDG_RUNTIME_DIR=/run/user/$(id -u kiosk) WAYLAND_DISPLAY=wayland-0 grim -c /tmp/kiosk.png`
- **Display der Web-App** (`KIOSK_MODE=app`, Standard): `https://<DOMAIN>/display?token=…` mit drei wischbaren
  Ansichten: ① QR-Codes für WLAN und App mit Uhr · ② Statistik mit Zeitverlauf · ③ letzter Scan (live, zweisprachig)
- Das Token (`DISPLAY_TOKEN`) erzeugt der Schritt `app` in `/opt/einlass/.env`. `kiosk.env` ist nur für root und den
  Kiosk-Benutzer lesbar
- Das Zertifikat wird in der NSS-Datenbank des Kiosk-Benutzers als vertrauenswürdig hinterlegt (keine Warnung)
- Beim Booten wartet der Kiosk bis zu 2 min auf die Seite. Danach zeigt er die statische Seite als Rückfallebene
  (`KIOSK_MODE=static` erzwingt sie)

## Hinweise

- **Zertifikat:** Laufzeit 825 Tage, weil Apple für TLS-Server-Zertifikate keine längere Laufzeit akzeptiert.
  `notBefore` wird um einen Tag zurückdatiert. Läuft es in weniger als 90 Tagen ab, erneuert der
  `tls`-Schritt es beim nächsten Lauf mit Internet. Danach muss die Browser-Warnung auf den Geräten
  einmal neu bestätigt werden.
- **Docker und Forwarding:** Docker schaltet `ip_forward` ein. Die Regeln in `inet einlass` greifen
  vorher und blockieren jeden Verkehr zwischen WLAN und Ethernet. WLAN-Clients erreichen nur den Pi
  bzw. dessen Container.
- **Ohne RTC-Modul** setzt `systemd-timesyncd` die Uhr beim Boot auf den zuletzt gespeicherten Stand
  (`/var/lib/systemd/timesync/clock`). Sie geht dann um die Zeit nach, die der Pi aus war, und muss
  per Client-Abgleich beim Login korrigiert werden.
- **DNS-Test:** dnsmasq beantwortet nur Anfragen, die über `wlan0` kommen. Ein Test aus einem
  Docker-Container heraus schlägt deshalb erwartungsgemäß fehl.
