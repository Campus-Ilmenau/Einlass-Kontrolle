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

| Schritt       | Datei                                          | Was passiert                                                                                                     |
| ------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `base`        | [lib/10-base.sh](lib/10-base.sh)               | apt update/upgrade, Pakete, Zeitzone, `/etc/hosts`                                                               |
| `docker`      | [lib/20-docker.sh](lib/20-docker.sh)           | Docker CE + Compose-Plugin (offizielles Repo), Log-Limits                                                        |
| `firewall`    | [lib/30-firewall.sh](lib/30-firewall.sh)       | nftables: **kein Routing** zwischen `wlan0` und `eth0` (systemd-Service `einlass-firewall`)                      |
| `accesspoint` | [lib/40-accesspoint.sh](lib/40-accesspoint.sh) | NetworkManager-AP `einlass-ap`, WPA2, feste IP `10.42.0.1`, kein NAT                                             |
| `dns`         | [lib/50-dns.sh](lib/50-dns.sh)                 | dnsmasq nur auf `wlan0`: DHCP + `einlass.lan → 10.42.0.1`, kein Upstream                                         |
| `rtc`         | [lib/60-rtc.sh](lib/60-rtc.sh)                 | I²C an, DS3231-Overlay **nur wenn Modul erkannt**, `fake-hwclock` entfernen                                      |
| `tls`         | [lib/70-tls.sh](lib/70-tls.sh)                 | Self-signed-Zertifikat in `/etc/einlass/tls/` (nur bei NTP-synchroner Uhr)                                       |
| `kiosk`       | [lib/80-kiosk.sh](lib/80-kiosk.sh)             | cage + Chromium auf dem DSI-Display (Hochformat), unsichtbarer Cursor, Statusseite mit WLAN-/App-QR-Code und Uhr |

## Kiosk

- Dienst `einlass-kiosk` startet `cage` (Wayland-Kiosk) auf tty1 als Systembenutzer `kiosk`, darin Chromium im Vollbild
- `einlass-display-render` erzeugt `/opt/einlass/display/` (QR-Codes per `qrencode`) aus `config.env`.
  Es läuft vor jedem Kiosk-Start, Änderungen an SSID oder Passwort erscheinen also nach `sudo systemctl restart einlass-kiosk`
- **Drehung:** `DISPLAY_TRANSFORM` in `/etc/einlass/config.env` (`normal`, `90`, `180`, `270`), danach den Kiosk neu starten
- **Kein Mauszeiger:** unsichtbares Xcursor-Theme `einlass-blank` + `cursor: none` auf der Seite
- Chromium-Richtlinien in `/etc/chromium/policies/managed/einlass-kiosk.json` (keine Übersetzungsleiste, kein Passwortmanager)
- Screenshot zur Kontrolle (vom Pi aus):
  `sudo -u kiosk env XDG_RUNTIME_DIR=/run/user/$(id -u kiosk) WAYLAND_DISPLAY=wayland-0 grim -c /tmp/kiosk.png`
- Später zeigt `KIOSK_URL` auf die `/display`-Seite der Web-App

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
