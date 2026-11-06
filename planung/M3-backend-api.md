# M3 – Backend / API

**Ziel:** Lauffähige API (Fastify + TypeORM + PostgreSQL) mit Auth, Rollen, Sperrlogik, Verwaltung von
Usern, Listen und Veranstaltungen sowie Prüf-Endpunkt. Getestet und als arm64-Image baubar.

## Aufgabe 3.1 – Projekt-Grundgerüst
- [ ] `apps/api`: Fastify + TypeScript
- [x] `packages/shared`: zod-Schemas, Matrikel-Regex, Altersberechnung, API-Typen, OCR-Auswertung der Thoska
- [ ] TypeORM-DataSource für PostgreSQL, Konfiguration über Env-Variablen
- [ ] Lokale Entwicklung: `docker-compose.dev.yml` mit Postgres
- [ ] Logging (pino), zentrales Fehlerformat, Request-Validierung mit zod
- [ ] Health-Endpoint `/api/health`

## Aufgabe 3.2 – Datenmodell & Migrationen
- [ ] Entity `User` (role, disabled, validUntil, failedLoginCount, lockedUntil)
- [ ] Entity `FreeList`, `FreeListEntry` (Unique-Index auf listId + matrikelnummer, Index auf matrikelnummer)
- [ ] Entity `Event` (startsAt, endsAt, hashSalt) + n:m `EventFreeList`
- [ ] Entity `CheckLog`, Zähler bzw. `EventStats`
- [ ] Entity `Setting` (checkLogRetentionDays)
- [ ] Migrationen statt `synchronize`, Ausführung beim Start
- [ ] Seed: initialer Admin aus Env-Variablen

## Aufgabe 3.3 – Authentifizierung & Rollen
- [ ] argon2-Hashing
- [ ] `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` (`@fastify/cookie`, `@fastify/jwt`)
- [ ] Sperrlogik: 5 Fehlversuche → `lockedUntil = now + 15 min`, Reset bei Erfolg
- [ ] Prüfung `disabled` / `validUntil` / `lockedUntil` beim Login **und** bei jedem Request
- [ ] Rollen-Hooks (`ADMIN`, `CONTROLLER`), strikt getrennt
- [ ] `@fastify/rate-limit` am Login

## Aufgabe 3.3b – Automatischer Zeitabgleich
- [x] Entscheidungslogik `decideTimeSync` in `packages/shared` (Uhr wird übergeben, unit-getestet)
- [ ] Service `TimeSyncService` in der API (ruft `decideTimeSync`, setzt Zeit über `einlass-hostd`)
- [ ] Auslöser: erfolgreicher Login (`clientTime` im Body) und `GET /auth/me` (Header `X-Client-Time`)
- [ ] Schwelle 30 s, Antwort `timeSync { driftSeconds, action, serverTime }`
- [ ] Schutzregeln: Untergrenze `lastKnownTime`, Obergrenze +2 Jahre, Sperre 10 min nach letzter Korrektur, max. ±5 min während aktiver Veranstaltung
- [ ] `lastKnownTime` minütlich + beim Shutdown persistieren
- [ ] Anbindung an den Host-Dienst (setzt `date` + `hwclock -w`, aus M2)
- [ ] Reihenfolge im Login: Passwort prüfen → **Zeitabgleich** → Sperr-/Ablaufprüfung → JWT signieren
- [ ] `clockTolerance` bei der JWT-Prüfung (z. B. 5 min)
- [ ] Test: Pi-Uhr 2 Tage zurück → Login → Token ist nach der Korrektur gültig
- [ ] Entity `TimeSyncLog`, `GET /admin/system/time-log`
- [x] Unit-Tests für alle Regeln (Sprung vor/zurück, zweiter Client, aktive Veranstaltung, Grenzwerte)

## Aufgabe 3.4 – Admin: Kontrolleur:innen
- [ ] CRUD `/admin/users`
- [ ] Passwort zurücksetzen, Sperre aufheben, deaktivieren, `validUntil`
- [ ] Schutz: letzter Admin kann nicht gelöscht oder deaktiviert werden

## Aufgabe 3.5 – Admin: Freilisten
- [ ] CRUD `/admin/lists`
- [ ] Einträge: hinzufügen (einzeln oder als Array für Copy-Paste), entfernen, suchen, paginieren
- [ ] Import-Endpoint (`@fastify/multipart`): **CSV** und **XLSX** (z. B. `exceljs`), Spaltenwahl, append/replace
- [ ] Normalisierung (Leerzeichen trimmen, Duplikate) und Validierung `^\d{5}$` → Import-Report

## Aufgabe 3.6 – Admin: Veranstaltungen
- [ ] CRUD `/admin/events` mit Listen-Zuordnung
- [ ] Validierung: `endsAt > startsAt`, keine Überschneidung mit anderen Veranstaltungen
- [ ] `hashSalt` beim Anlegen zufällig erzeugen
- [ ] Hilfsfunktion „aktive Veranstaltung jetzt“
- [ ] `GET /admin/events/:id/stats`

## Aufgabe 3.7 – Prüf-Endpunkt
- [ ] `GET /checks/context` (aktive Veranstaltung oder `null`)
- [ ] `POST /checks`: keine aktive Veranstaltung → `409`
- [ ] Abgleich gegen die Listen der Veranstaltung
- [ ] Altersberechnung U16/U18/ADULT (Europe/Berlin, Geburtstag heute, 29.02.)
- [ ] HMAC der Matrikelnummer, Doppel-Scan-Erkennung (`alreadySeenAt`)
- [ ] CheckLog schreiben, Zähler erhöhen

## Aufgabe 3.8 – Einstellungen, System & Jobs
- [ ] `GET/PATCH /admin/settings` (Aufbewahrungsfrist)
- [ ] Aufbewahrungs-Job: CheckLogs älter als die Frist löschen, Zähler bleiben
- [ ] `POST /admin/system/time` → Host-Mechanismus aus M2
- [ ] `GET /system/display` (nur localhost)

## Aufgabe 3.9 – Tests & Build
- [x] Unit-Tests: Altersberechnung (Randfälle: Geburtstag heute, 29.02., Zeitzone/Sommerzeit), Matrikel-Listen-Parser
- [ ] Unit-Tests: Sperrlogik, Veranstaltungs-Überschneidung, Import-Parser (CSV/XLSX)
- [ ] Integrationstests mit Test-Postgres: Login, Rollen, Checks, Doppel-Scan
- [ ] Dockerfile (multi-stage, `linux/arm64`)
- [ ] OpenAPI-Doku (`@fastify/swagger`)

## Definition of Done
- Alle Endpunkte aus [konzept/06-api.md](../konzept/06-api.md) sind implementiert und getestet
- Das Image baut für `linux/arm64`
