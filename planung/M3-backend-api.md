# M3 – Backend / API

**Ziel:** Lauffähige API (Fastify + TypeORM + PostgreSQL) mit Auth, Rollen, Sperrlogik, Verwaltung von
Usern, Listen und Veranstaltungen sowie Prüf-Endpunkt. Getestet und als arm64-Image baubar.

## Aufgabe 3.1 – Projekt-Grundgerüst
- [x] `apps/api`: Fastify + TypeScript
- [x] `packages/shared`: zod-Schemas, Matrikel-Regex, Altersberechnung, API-Typen, OCR-Auswertung der Thoska
- [x] TypeORM-DataSource für PostgreSQL, Konfiguration über Env-Variablen (zod-geprüft)
- [x] Lokale Entwicklung und Tests: `embedded-postgres` (kein Docker nötig)
- [x] Logging (pino), zentrales Fehlerformat, Request-Validierung mit zod
- [x] Health-Endpoint `/api/health`

## Aufgabe 3.2 – Datenmodell & Migrationen
- [x] Entity `User` (role, disabled, validUntil, failedLoginCount, lockedUntil)
- [x] Entity `FreeList`, `FreeListEntry` (Unique-Index auf listId + matrikelnummer, Index auf matrikelnummer)
- [x] Entity `Event` (startsAt, endsAt, hashSalt) + n:m `EventFreeList`, Überschneidung per Exclusion-Constraint verhindert
- [x] Entity `CheckLog`
- [x] Zähler bzw. `EventStats` (live aus `check_logs`, gesicherte Zusammenfassung in `event_stats`)
- [x] Entity `Setting` (checkLogRetentionDays)
- [x] Migrationen statt `synchronize`, Ausführung beim Start
- [x] Seed: initialer Admin aus Env-Variablen

## Aufgabe 3.3 – Authentifizierung & Rollen
- [x] argon2-Hashing (argon2id, `@node-rs/argon2`)
- [x] `POST /auth/login`, `POST /auth/logout`, `GET /auth/me` (`@fastify/cookie`, `@fastify/jwt`)
- [x] Sperrlogik: 5 Fehlversuche → `lockedUntil = now + 15 min`, Reset bei Erfolg
- [x] Prüfung `disabled` / `validUntil` / `lockedUntil` beim Login **und** bei jedem Request
- [x] Rollen-Hooks (`ADMIN`, `CONTROLLER`), strikt getrennt
- [x] `@fastify/rate-limit` am Login

## Aufgabe 3.3b – Automatischer Zeitabgleich
- [x] Entscheidungslogik `decideTimeSync` in `packages/shared` (Uhr wird übergeben, unit-getestet)
- [x] Service `TimeSyncService` in der API (ruft `decideTimeSync`, setzt Zeit über `einlass-hostd`)
- [x] Auslöser: erfolgreicher Login (`clientTime` im Body) und `GET /auth/me` (Header `X-Client-Time`)
- [x] Schwelle 30 s, Antwort `timeSync { driftSeconds, action, serverTime }`
- [x] Schutzregeln: Untergrenze `lastKnownTime`, Obergrenze +2 Jahre, Sperre 10 min nach letzter Korrektur, max. ±5 min während aktiver Veranstaltung
- [x] `lastKnownTime` minütlich + beim Shutdown persistieren (in `einlass-hostd`)
- [x] Anbindung an den Host-Dienst (`UnixSocketHostClient`, Noop-Variante für die Entwicklung)
- [x] Reihenfolge im Login: Passwort prüfen → **Zeitabgleich** → Sperr-/Ablaufprüfung → JWT signieren
- [x] `clockTolerance` bei der JWT-Prüfung (5 min)
- [x] Test: Pi-Uhr 2 Tage zurück → Login → Token ist nach der Korrektur gültig
- [x] Entity `TimeSyncLog`
- [x] `GET /admin/system/time-log`
- [x] Unit-Tests für alle Regeln (Sprung vor/zurück, zweiter Client, aktive Veranstaltung, Grenzwerte)

## Aufgabe 3.4 – Admin: Kontrolleur:innen
- [x] CRUD `/admin/users`
- [x] Passwort zurücksetzen, Sperre aufheben, deaktivieren, `validUntil`
- [x] Schutz: letzter Admin kann nicht gelöscht oder deaktiviert werden, eigenes Konto nicht sperren/löschen

## Aufgabe 3.5 – Admin: Freilisten
- [x] CRUD `/admin/lists`
- [x] Einträge: hinzufügen (einzeln oder als Array für Copy-Paste), entfernen, suchen, paginieren, Liste leeren
- [x] Import-Endpoint (`@fastify/multipart`): **CSV** (`csv-parse`) und **XLSX** (`read-excel-file`), Spaltenwahl/-erkennung, append/replace
- [x] Normalisierung (Leerzeichen trimmen, Duplikate, Excel-Zahlen auffüllen) und Validierung `^\d{5}$` → Import-Report

## Aufgabe 3.6 – Admin: Veranstaltungen
- [x] CRUD `/admin/events` mit Listen-Zuordnung, vorzeitig beenden
- [x] Validierung: `endsAt > startsAt`, keine Überschneidung mit anderen Veranstaltungen
- [x] `hashSalt` beim Anlegen zufällig erzeugen
- [x] Hilfsfunktion „aktive Veranstaltung jetzt“ (`TimeSyncService.isEventActive`)
- [x] `GET /admin/events/:id/stats`

## Aufgabe 3.7 – Prüf-Endpunkt
- [x] `GET /checks/context` (aktive Veranstaltung oder `null`)
- [x] `POST /checks`: keine aktive Veranstaltung → `409`
- [x] Abgleich gegen die Listen der Veranstaltung
- [x] Altersberechnung U16/U18/ADULT (Europe/Berlin, Geburtstag heute, 29.02.)
- [x] HMAC der Matrikelnummer, Doppel-Scan-Erkennung (`alreadySeenAt`)
- [x] CheckLog schreiben

## Aufgabe 3.8 – Einstellungen, System & Jobs
- [x] `GET/PATCH /admin/settings` (Aufbewahrungsfrist)
- [x] Aufbewahrungs-Job: CheckLogs älter als die Frist löschen, Zähler bleiben
- [x] `POST /admin/system/time` → Host-Mechanismus aus M2, außerdem `shutdown`/`reboot`
- [x] `GET /system/display` (öffentlich, ohne personenbezogene Daten)

## Aufgabe 3.9 – Tests & Build
- [x] Unit-Tests: Altersberechnung (Randfälle: Geburtstag heute, 29.02., Zeitzone/Sommerzeit), Matrikel-Listen-Parser
- [x] Unit-Tests: Sperrlogik, Veranstaltungs-Überschneidung, Import-Parser (CSV/XLSX)
- [x] Integrationstests mit Test-Postgres: Login, Rollen, Checks, Doppel-Scan
- [ ] Dockerfile (multi-stage, `linux/arm64`)
- [ ] OpenAPI-Doku (`@fastify/swagger`)

## Definition of Done
- Alle Endpunkte aus [konzept/06-api.md](../konzept/06-api.md) sind implementiert und getestet
- Das Image baut für `linux/arm64`
