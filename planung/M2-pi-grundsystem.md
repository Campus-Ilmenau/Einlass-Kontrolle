# M2 – Pi-Grundsystem

**Ziel:** Der Pi 4 bootet ohne Eingriff, spannt das WLAN auf, vergibt IPs, löst den App-Namen auf,
Docker läuft und die Uhrzeit stimmt dank RTC. Das Setup ist per Skript reproduzierbar (`infra/pi/`).

## Aufgabe 2.1 – Betriebssystem
- [ ] Raspberry Pi OS Lite 64 Bit flashen (SSH-Key, Hostname, User per Imager)
- [ ] System aktualisieren, Zeitzone `Europe/Berlin`, Locale
- [ ] Unnötige Dienste deaktivieren
- [ ] *(optional)* Log2RAM gegen SD-Verschleiß

## Aufgabe 2.2 – WLAN-Access-Point
- [ ] NetworkManager-Hotspot (Bookworm-Standard) oder hostapd einrichten
- [ ] SSID und WPA2-Passwort aus Konfig-Datei (`/etc/einlass/wifi.env`), die auch Display und API lesen
- [ ] Statische IP `10.42.0.1` für `wlan0`, DHCP-Bereich
- [ ] Kein IP-Forwarding / kein Routing nach außen
- [ ] Test: mehrere Geräte gleichzeitig (≥ 5), Reichweite

## Aufgabe 2.3 – DNS
- [ ] dnsmasq: `einlass.lan` → `10.42.0.1`
- [ ] *(optional)* Captive-Portal-Hinweisseite mit Link zur App
- [ ] Prüfen, dass es keine Konflikte mit dem Docker-DNS gibt

## Aufgabe 2.4 – RTC & Uhrzeit
- [ ] DS3231 anschließen, I²C aktivieren, `dtoverlay=i2c-rtc,ds3231`
- [ ] `fake-hwclock` deaktivieren, `hwclock` testen
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
- [ ] Docker Engine + Compose-Plugin installieren, Autostart
- [ ] Test-Container aus dem WLAN erreichbar

## Aufgabe 2.6 – Zertifikat
- [ ] Self-signed-Zertifikat beim Setup erzeugen (10 Jahre, SAN `einlass.lan` + `10.42.0.1`)
- [ ] Erzeugung nur bei synchronisierter Zeit (NTP-Check im Skript), `notBefore` um 1 Tag zurückdatieren
- [ ] Keine automatische Neuerzeugung im Betrieb
- [ ] Ablage für den nginx-Container und Vertrauen im Kiosk-Chromium (M6)

## Aufgabe 2.7 – Reproduzierbarkeit
- [ ] Setup-Skript `infra/pi/setup.sh` (idempotent)
- [ ] Doku „Neuen Pi aufsetzen“

## Definition of Done
- Frisch geflashter Pi + Skript → nach dem Neustart ist das WLAN sichtbar, ein Handy verbindet sich,
  `https://einlass.lan` liefert eine Testseite, die Uhrzeit stimmt nach Stromtrennung
