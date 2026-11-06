# 07 – Web-App (React + Ant Design)

## Grundsätze
- **Mobile first**: Bedienung mit einer Hand, im Dunkeln, unter Zeitdruck
- Große Schrift, starke Farben, das Ergebnis muss **auf einen Blick** erkennbar sein
- **Dunkles Theme** (Ant Design `theme.darkAlgorithm`)
- Als **PWA** installierbar. Bei einem self-signed-Zertifikat ist die Installation eingeschränkt, das wird in M1 getestet
- Sprache: Deutsch

## Screens

### Login
- Name und Passwort
- Meldungen: falsches Passwort (mit Restversuchen), gesperrt bis HH:MM, deaktiviert, abgelaufen
- Warnung bei Zeitabweichung zwischen Gerät und Pi
- Je nach Rolle Weiterleitung zu **Scan** oder **Admin**

### Scan (Kontrolleur:in)
- **Keine aktive Veranstaltung →** Sperrbildschirm „Keine Veranstaltung aktiv“ (mit Polling bzw. Reload)
- Kamera-Vorschau mit Rahmen in Thoska-Proportion
- Live-OCR. Sobald Matrikelnummer und Geburtsdatum stabil erkannt sind, kurze Bestätigung
  (bearbeitbar), dann automatisch prüfen
- Button **„Manuell eingeben“**
- Ergebnis als Vollbild-Overlay (Farbe + Text + Vibration), Tippen → nächster Scan
- Kopfzeile: Name der Kontrolleur:in, Veranstaltung, Logout

### Admin
- **Veranstaltungen**: Liste (geplant, aktiv, vergangen), anlegen und bearbeiten (Name, Start, Ende, Listen auswählen), Statistik
- **Freilisten**: Übersicht, Detailseite mit Einträgen und Suche, Hinzufügen (einzeln oder Copy-Paste),
  Import (CSV/XLSX per Upload, Vorschau, Spaltenauswahl, append/replace, Report)
- **Kontrolleur:innen**: Tabelle mit Status, anlegen (Passwort-Generator, „gültig bis“ mit Schnellauswahl), sperren, entsperren, löschen
- **Einstellungen**: Aufbewahrungsfrist, Systemzeit anzeigen + „Zeit von diesem Gerät übernehmen“

### Display (`/display`, ohne Login, nur localhost)
- Für das 5"-Display im Hochformat: WLAN-QR, App-QR, Datum und Uhrzeit, Veranstaltung, Anzahl Scans
- Keine Interaktion, aktualisiert sich selbst

## Technik
- Vite + React + TypeScript, React Router, TanStack Query
- **Ant Design** (Komponenten, Formulare, Tabellen, Upload)
- XLSX/CSV: Parsing serverseitig (API). Vorschau optional clientseitig
- Kamera und OCR: siehe [08-ausweis-scan.md](08-ausweis-scan.md)
