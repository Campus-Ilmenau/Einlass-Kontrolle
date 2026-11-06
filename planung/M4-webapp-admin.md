# M4 – Web-App: Grundgerüst, Login & Admin

**Ziel:** Die React-App (Ant Design) existiert, Login funktioniert und Admins können Kontrolleur:innen,
Freilisten, Veranstaltungen und Einstellungen verwalten.

## Aufgabe 4.1 – Grundgerüst
- [x] `apps/web`: Vite + React + TypeScript
- [x] Ant Design mit Dark-Theme, deutsche Locale (`de_DE`, dayjs)
- [x] React Router, geschützte Routen nach Rolle
- [x] API-Client + TanStack Query, Typen aus `packages/shared`, 401 → Login
- [x] Dev-Proxy `/api` → lokale API
- [x] PWA-Manifest und Icon
- [x] Mobile-first Layout (Admin-Navigation als Tab-Leiste unten)

## Aufgabe 4.2 – Login
- [x] Login-Formular
- [x] `clientTime` beim Login mitsenden, `X-Client-Time` bei `GET /auth/me` (App-Start und Rückkehr in den Vordergrund)
- [x] `timeSync` auswerten: Hinweis „Systemzeit korrigiert“ bzw. Warnung „Geräteuhr weicht ab“
- [x] Meldungen: falsches Passwort (mit Restversuchen), gesperrt bis HH:MM, deaktiviert, abgelaufen
- [x] Weiterleitung je nach Rolle, Logout

## Aufgabe 4.3 – Admin: Veranstaltungen
- [x] Liste: aktiv / geplant / vergangen
- [x] Anlegen und Bearbeiten: Name, Start, Ende (DatePicker), Freilisten (Mehrfachauswahl)
- [x] Fehleranzeige bei Überschneidung
- [x] „Jetzt beenden“-Button
- [x] Statistik-Ansicht: gesamt, frei je Liste, U16, U18, je Kontrolleur:in, Doppel-Scans (live während der Veranstaltung)

## Aufgabe 4.4 – Admin: Freilisten
- [x] Übersicht mit Anzahl Einträge, anlegen, umbenennen, löschen
- [x] Detailseite: Einträge mit Suche und Pagination, einzeln entfernen, Liste leeren
- [x] Hinzufügen: Textfeld für Eintippen und Copy-Paste mit Live-Prüfung
- [x] Import: Upload CSV/XLSX, Spaltenauswahl, ergänzen/ersetzen, Import-Bericht

## Aufgabe 4.5 – Admin: Kontrolleur:innen
- [x] Liste: Name, Rolle, Status (aktiv / gesperrt / deaktiviert / abgelaufen), gültig bis, letzter Login
- [x] Anlegen: Name, Passwort (Generator), gültig bis (Schnellauswahl „morgen 06:00“)
- [x] Bearbeiten, Sperre aufheben, deaktivieren, Passwort zurücksetzen, löschen (mit Bestätigung)

## Aufgabe 4.6 – Admin: Einstellungen
- [x] Aufbewahrungsfrist für Scan-Protokolle
- [x] Systemzeit anzeigen + „Zeit von diesem Gerät übernehmen“
- [x] Herunterfahren / Neu starten
- [x] Zeit-Protokoll anzeigen, Hinweis bei Abweichung

## Definition of Done
- Ein Admin kann auf dem Smartphone alle Verwaltungsaufgaben erledigen
- Kontrolleur:innen sehen keine Admin-Seiten (auch nicht per URL), Admins keine Scan-Seite
