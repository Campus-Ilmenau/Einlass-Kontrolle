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
- [ ] Liste: geplant / aktiv / vergangen
- [ ] Anlegen und Bearbeiten: Name, Start, Ende (DatePicker), Freilisten (Mehrfachauswahl)
- [ ] Fehleranzeige bei Überschneidung
- [ ] „Jetzt beenden“-Button
- [ ] Statistik-Ansicht: gesamt, frei je Liste, U16, U18, je Kontrolleur:in, Doppel-Scans

## Aufgabe 4.4 – Admin: Freilisten
- [ ] Übersicht mit Anzahl Einträge, anlegen, umbenennen, löschen
- [ ] Detailseite: Einträge mit Suche und Pagination, einzeln entfernen
- [ ] Hinzufügen: einzelnes Feld + Textfeld für Copy-Paste (eine Nummer pro Zeile oder getrennt)
- [ ] Import: Upload CSV/XLSX, Spaltenauswahl, append/replace, Import-Report

## Aufgabe 4.5 – Admin: Kontrolleur:innen
- [ ] Tabelle: Name, Rolle, Status (aktiv / gesperrt bis / deaktiviert / abgelaufen), gültig bis, letzter Login
- [ ] Anlegen: Name, Passwort (Generator), gültig bis (Schnellauswahl „morgen 06:00“)
- [ ] Bearbeiten, Sperre aufheben, deaktivieren, Passwort zurücksetzen, löschen (mit Bestätigung)

## Aufgabe 4.6 – Admin: Einstellungen
- [ ] Aufbewahrungsfrist für Scan-Protokolle
- [ ] Systemzeit anzeigen + „Zeit von diesem Gerät übernehmen“
- [ ] Zeit-Protokoll anzeigen, Hinweis-Banner nach großer Korrektur (> 5 min) bzw. abgelehntem Abgleich

## Definition of Done
- Ein Admin kann auf dem Smartphone alle Verwaltungsaufgaben erledigen
- Kontrolleur:innen sehen keine Admin-Seiten (auch nicht per URL), Admins keine Scan-Seite
