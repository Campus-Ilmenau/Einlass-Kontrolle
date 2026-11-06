# 09 – Sicherheit und Datenschutz

## HTTPS

Ohne HTTPS gibt es keine Kamera (siehe [08](08-ausweis-scan.md)).

**Entscheidung: self-signed Zertifikat**
- Wird beim Setup auf dem Pi erzeugt (825 Tage gültig, weil Apple für TLS-Server-Zertifikate keine längere Laufzeit akzeptiert; SAN: `einlass.lan`, `10.42.0.1`)
- Pro Gerät muss die Browser-Warnung einmal bestätigt werden. Das steht in der Kurzanleitung
- Risiken, die in M1 getestet werden:
  - iOS Safari: Wird die Kamera nach dem Bestätigen freigegeben? Muss die Warnung nach jedem Neustart erneut bestätigt werden?
  - Die PWA-Installation funktioniert mit einem self-signed-Zertifikat ggf. nicht
- **Uhrzeit und Zertifikat:** Die Gültigkeit prüft der **Client mit seiner eigenen Uhr**, die Uhr des Pi
  spielt im Betrieb keine Rolle. Kritisch ist nur das **Erzeugen**: `notBefore` wird mit der Pi-Uhr gestempelt.
  Deshalb wird das Zertifikat nur beim Setup bei synchronisierter Zeit (NTP) erzeugt,
  `notBefore` um 1 Tag zurückdatiert. Erneuert wird es nur in der Vorbereitungsphase (Setup bzw. Auto-Update mit Internet und NTP), wenn es in < 90 Tagen abläuft, nie am Abend. Danach muss die Warnung pro Gerät einmal neu bestätigt werden
- **Plan B:** eigene CA. Das Root-Zertifikat wird einmal auf den Club-Geräten installiert, dann gibt es keine Warnung mehr

## Authentifizierung
- Passwörter mit **argon2** hashen
- JWT im **httpOnly, Secure, SameSite=Strict** Cookie, Laufzeit max. 12 h bzw. bis `validUntil`
- Bei jedem Request serverseitig prüfen: User existiert, nicht deaktiviert, nicht abgelaufen
- **Uhrzeit und Sessions:** `exp`/`iat` des JWT sowie `validUntil`/`lockedUntil` hängen an der Pi-Uhr.
  Beim Login wird **erst der Zeitabgleich durchgeführt, dann das Token signiert**. Andernfalls läge das
  `exp` eines vor der Korrektur ausgestellten Tokens nach der Korrektur in der Vergangenheit, und die Person würde sofort ausgeloggt.
  Zusätzlich gibt es eine Toleranz (`clockTolerance`) von einigen Minuten bei der Token-Prüfung
- **Rollen strikt getrennt:** Admin-Endpunkte nur für `ADMIN`, `/checks` nur für `CONTROLLER`
- **Brute-Force-Schutz:** 5 Fehlversuche → 15 min Sperre pro Account, zusätzlich IP-Rate-Limit (`@fastify/rate-limit`)
- WLAN-Passwort als zusätzliche Schutzschicht
- `/system/display` antwortet nur auf Anfragen von localhost

## Datenschutz
Matrikelnummern sind personenbezogene Daten. Eine Abstimmung mit StuRa/TU ist laut Entscheidung nicht
nötig, trotzdem setzt das System Datensparsamkeit technisch um:
- **Geburtsdatum wird nie gespeichert**, nur die Altersstufe
- **Matrikelnummer im Scan-Protokoll nur als HMAC** mit Geheimnis pro Veranstaltung
- **Konfigurierbare Aufbewahrungsfrist** für Scan-Protokolle. Danach wird automatisch gelöscht, nur die Zähler bleiben
- Freilisten können jederzeit geleert oder gelöscht werden
- Das System ist offline. Es gibt keinen Datenabfluss übers Netz. Der Datenträger im Pi enthält aber
  Freilisten, deshalb das Gerät sicher verwahren
