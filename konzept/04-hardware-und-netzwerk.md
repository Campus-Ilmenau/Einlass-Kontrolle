# 04 – Hardware und Netzwerk

## Hardware

| Teil | Entscheidung |
|---|---|
| Rechner | **Raspberry Pi 4** (≥ 2 GB RAM, besser 4 GB, wegen Postgres, Node und Chromium-Kiosk) |
| OS | Raspberry Pi OS Lite (Bookworm, 64 Bit), kein Desktop |
| Display | **Offizielles Raspberry Pi 5"-Display, Hochformat** (DSI) |
| Uhr | **RTC-Modul DS3231** (I²C, mit Knopfzelle) |
| Speicher | hochwertige SD-Karte (High Endurance) oder USB-SSD, wegen möglicher Stromausfälle |
| Sonstiges | Gehäuse mit Display-Halterung, offizielles Netzteil |

## WLAN-Access-Point

- Der Pi spannt ein eigenes WLAN auf, z. B. SSID `Einlass-<Club>`, WPA2-Passwort
- **Kein Routing** zwischen WLAN und Ethernet. Clients im WLAN kommen nie ins Internet
- **Ethernet (`eth0`)** ist optional und wird nur in der Vorbereitungsphase genutzt. Der Pi selbst bekommt
  darüber per DHCP Internet für NTP und Auto-Update. Am Einlass ist kein Kabel angeschlossen
- DHCP vergibt IPs (z. B. `10.42.0.0/24`). Ein lokaler DNS-Name, z. B. `einlass.lan` → `10.42.0.1`
- SSID und Passwort stehen in einer Konfig-Datei. Der QR-Code auf dem Display wird daraus erzeugt

### Hinweise zu Smartphones in einem WLAN ohne Internet
- Android und iOS merken, dass es kein Internet gibt. Android fragt dann „Verbunden bleiben?“ und
  schaltet sonst ggf. auf mobile Daten um. Das muss getestet und in der Kurzanleitung erklärt werden
- Die Captive-Portal-Erkennung kann eine Hinweisseite automatisch öffnen. Die Kamera funktioniert im
  Captive-Portal-Mini-Browser aber **nicht**, die App muss im richtigen Browser geöffnet werden

## Display (5", Hochformat)

- **Kiosk-Modus:** `cage` (Wayland-Kiosk) + Chromium öffnet `https://localhost/display` im Vollbild
- Display-Rotation per Konfiguration (90° bzw. 270°)
- systemd-Service startet nach Docker, Neustart bei Absturz, Bildschirm-Abschaltung deaktiviert
- Inhalt (untereinander, Hochformat):
  1. **QR-Code WLAN**: `WIFI:T:WPA;S:<SSID>;P:<Passwort>;;`
  2. **QR-Code App**: `https://einlass.lan`
  3. **Datum und Uhrzeit** (groß, damit eine falsche Systemzeit sofort auffällt)
  4. Name der aktiven Veranstaltung bzw. „Keine Veranstaltung aktiv“, Anzahl Scans
- Das Self-signed-Zertifikat muss im Kiosk-Chromium als vertrauenswürdig hinterlegt sein, oder der Kiosk
  greift über eine interne HTTP-Route zu, die nur auf localhost lauscht

## Uhrzeit (kritisch für die Altersprüfung)

Der Pi 4 hat keine batteriegepufferte Uhr. Er liegt oft wochenlang **stromlos im Schrank** und hat am
Einlass kein Netz. Ohne RTC stünde die Uhr nach dem Einschalten auf dem Zeitpunkt des letzten
Herunterfahrens. Dann würde keine Veranstaltung als aktiv erkannt und der Scan wäre gesperrt.
Deshalb gibt es drei Ebenen:

1. **RTC-Modul DS3231** (`dtoverlay=i2c-rtc,ds3231`) mit Knopfzelle (hält Jahre). Die Systemzeit wird
   beim Boot aus der RTC gesetzt. Gangabweichung ca. ±1 min pro Jahr
2. **NTP bei Internet:** Hängt der Pi in der Vorbereitungsphase am Ethernet, synchronisiert er per NTP
   und schreibt die Zeit in die RTC zurück. Dadurch werden Abweichungen regelmäßig korrigiert
3. **Automatischer Client-Abgleich bei jeder Anmeldung:** siehe nächster Abschnitt
4. **Manuell:** Der Admin kann unter „Einstellungen“ jederzeit die Zeit vom eigenen Gerät übernehmen
5. Das Display zeigt immer Datum und Uhrzeit. Der Admin prüft sie beim Aufbau (Checkliste)

### Automatischer Zeitabgleich bei Anmeldung

Smartphones holen ihre Zeit über das Mobilfunknetz bzw. NTP und sind praktisch immer sekundengenau.
Deshalb übernimmt der Pi die Zeit automatisch vom Client.

**Auslöser:**
- jeder **erfolgreiche Login** (`POST /auth/login`)
- jede **Sitzungs-Wiederaufnahme** (`GET /auth/me` beim App-Start bzw. wenn die App wieder in den
  Vordergrund kommt). So wird auch abgeglichen, wenn noch ein gültiges Cookie vorhanden ist und kein
  neuer Login nötig ist

**Ablauf:**
1. Die App sendet `clientTime` (ISO-Zeitstempel mit Zeitzonen-Offset, `Date.now()` kurz vor dem Senden)
2. Die API misst `drift = clientTime − serverTime`. Die Übertragungszeit im lokalen WLAN (< 100 ms) wird vernachlässigt
3. Ist `|drift| ≤ 30 s` → nichts tun
4. Ist `|drift| > 30 s` → Plausibilitätsprüfung (siehe unten). Wenn ok: **Systemzeit und RTC setzen**
   über den Host-Dienst (`date` + `hwclock -w`). Alle Container teilen sich die Kernel-Uhr und sind sofort aktuell
5. Eintrag ins **Zeit-Protokoll** (wer, alte Zeit, neue Zeit, Drift). Ist die Abweichung > 5 min,
   erscheint im Admin-Bereich ein deutlicher Hinweis „Uhr wurde korrigiert, RTC-Batterie prüfen?“

**Schutzmechanismen** (damit ein einzelnes falsch gestelltes Handy die Uhr nicht verstellt):
- Nur **authentifizierte** Anfragen nach erfolgreicher Passwortprüfung lösen einen Abgleich aus
- **Untergrenze:** Die Zeit wird nie vor den Zeitpunkt der letzten bekannten Aktivität gesetzt.
  Dazu wird regelmäßig ein „last known time“-Wert gespeichert, z. B. jede Minute und beim Herunterfahren.
  Fällt die RTC aus, geht die Uhr nach, nicht vor. Ein Sprung zurück vor diesen Wert ist also immer ein Fehler des Clients
- **Obergrenze:** Sprünge um mehr als 2 Jahre in die Zukunft werden abgelehnt (offensichtlich falsche Geräteuhr)
- **Kein Hin- und Herspringen:** Wurde die Uhr in den letzten 10 Minuten bereits durch einen anderen
  Client korrigiert, wird ein weiterer abweichender Client **nicht** übernommen. Er erhält nur eine Warnung
  „Deine Geräteuhr weicht ab“. Der Admin kann im Zweifel manuell entscheiden
- Ein Abgleich **während einer aktiven Veranstaltung** ist nur bis ±5 min erlaubt. Größere Sprünge
  muss der Admin bestätigen, damit eine laufende Veranstaltung nicht versehentlich „endet“
- Die Zeitzone ist auf dem Pi fest `Europe/Berlin`. Übertragen wird nur der absolute Zeitpunkt (UTC),
  sodass Handy-Zeitzonen keine Rolle spielen

Zum sauberen Herunterfahren vor dem Abstecken (SD-Karte schonen) gibt es einen Button im Admin-Bereich
und/oder einen Hardware-Taster (GPIO 3).
