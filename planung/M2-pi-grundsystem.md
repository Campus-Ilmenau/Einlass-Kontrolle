# M2 – Pi-Grundsystem

**Ziel:** Der Pi 4 bootet ohne Eingriff, spannt das WLAN auf, vergibt IPs, löst den App-Namen auf,
Docker läuft und die Uhrzeit stimmt dank RTC. Das Setup ist per Skript reproduzierbar (`infra/pi/`).

## Aufgabe 2.1 – Betriebssystem
- [x] Raspberry Pi OS Lite 64 Bit flashen (SSH-Key, Hostname, User per Imager)
- [x] System aktualisieren, Zeitzone `Europe/Berlin`, Locale
- [ ] Unnötige Dienste deaktivieren
- [ ] *(optional)* Log2RAM gegen SD-Verschleiß

## Aufgabe 2.2 – WLAN-Access-Point
- [x] NetworkManager-Access-Point `einlass-ap` (ohne NAT, DHCP/DNS über dnsmasq)
- [x] SSID und WPA2-Passwort aus Konfig-Datei (`/etc/einlass/config.env`, Passwort wird beim ersten Setup erzeugt)
- [x] Statische IP `10.42.0.1` für `wlan0`, DHCP-Bereich
- [x] Kein Routing nach außen (nftables-Tabelle `inet einlass`, da Docker `ip_forward` selbst einschaltet)
- [ ] Test: mehrere Geräte gleichzeitig (≥ 5), Reichweite

## Aufgabe 2.3 – DNS
- [x] dnsmasq: `einlass.lan` → `10.42.0.1`
- [ ] *(optional)* Captive-Portal-Hinweisseite mit Link zur App
- [x] Prüfen, dass es keine Konflikte mit dem Docker-DNS gibt (dnsmasq lauscht nur auf `10.42.0.1`)

## Aufgabe 2.4 – RTC & Uhrzeit
- [ ] DS3231 anschließen (I²C ist aktiviert, Overlay wird vom Setup automatisch gesetzt, sobald das Modul erkannt wird)
- [ ] `hwclock` mit Modul testen (fake-hwclock ist auf Trixie nicht installiert, Fallback ist die Uhr-Datei von systemd-timesyncd)
- [ ] Stromausfall-Test: Zeit stimmt nach Neustart ohne Netz
- [ ] Host-Mechanismus zum Setzen der Zeit (für die API): kleiner Dienst oder Unix-Socket, der nur `date` + `hwclock -w` ausführt
- [ ] NTP (`systemd-timesyncd`/chrony) nur über `eth0`. Nach erfolgreichem Sync `hwclock -w`
- [ ] Langzeittest: Pi mehrere Tage stromlos → Uhrzeit nach Boot korrekt

## Aufgabe 2.4b – Ethernet & Herunterfahren
- [ ] `eth0` per DHCP als optionaler Uplink (nur für den Pi selbst)
- [ ] Sicherstellen, dass kein Forwarding/NAT von `wlan0` nach `eth0` stattfindet
- [ ] Hardware-Taster für sauberes Herunterfahren (`dtoverlay=gpio-shutdown`)
- [ ] Host-Mechanismus für den Shutdown-Befehl aus der API

## Aufgabe 2.5 – Docker
- [x] Docker Engine + Compose-Plugin installieren, Autostart
- [ ] Test-Container aus dem WLAN erreichbar

## Aufgabe 2.6 – Zertifikat
- [x] Self-signed-Zertifikat beim Setup erzeugen (825 Tage – Apple-Limit, SAN `einlass.lan` + `10.42.0.1`)
- [x] Erzeugung nur bei synchronisierter Zeit (NTP-Check im Skript), `notBefore` um 1 Tag zurückdatieren
- [x] Erneuerung nur im Setup bzw. Update-Lauf mit Internet, wenn < 90 Tage Restlaufzeit (nie am Abend)
- [ ] Ablage für den nginx-Container und Vertrauen im Kiosk-Chromium (M6)

## Aufgabe 2.7 – Reproduzierbarkeit
- [x] Setup-Skript `infra/pi/setup.sh` (idempotent)
- [x] Doku „Neuen Pi aufsetzen“ ([infra/pi/README.md](../infra/pi/README.md))

## Definition of Done
- Frisch geflashter Pi + Skript → nach dem Neustart ist das WLAN sichtbar, ein Handy verbindet sich,
  `https://einlass.lan` liefert eine Testseite, die Uhrzeit stimmt nach Stromtrennung
