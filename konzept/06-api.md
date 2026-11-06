# 06 – API (Entwurf)

Basis: `https://einlass.lan/api`, JSON, Fastify, Auth per httpOnly-Cookie (JWT).
Gemeinsame Schemas (zod) liegen in `packages/shared` und werden von API und Web genutzt.

## Auth
| Methode | Pfad | Rolle | Beschreibung |
|---|---|---|---|
| POST | `/auth/login` | – | `{ name, password, clientTime }` → Cookie, `{ user, timeSync }`. Fehler: `INVALID`, `LOCKED (until)`, `DISABLED`, `EXPIRED` |
| POST | `/auth/logout` | alle | Cookie löschen |
| GET | `/auth/me` | alle | aktueller User. Header `X-Client-Time` → ebenfalls Zeitabgleich, Antwort enthält `timeSync` |

`timeSync` = `{ driftSeconds, action: "none" | "adjusted" | "rejected" | "warning", serverTime }`.
Die App zeigt bei `adjusted` kurz „Uhrzeit des Systems wurde korrigiert“, bei `warning`/`rejected`
„Deine Geräteuhr weicht ab“. Logik siehe [04-hardware-und-netzwerk.md](04-hardware-und-netzwerk.md#automatischer-zeitabgleich-bei-anmeldung).

## Kontrolle (nur CONTROLLER)
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/checks/context` | `{ event, serverTime }`: aktive Veranstaltung (Name, Start, Ende, Listen) oder `null` → UI sperrt den Scan |
| POST | `/checks` | `{ matrikelnummer, birthDate (YYYY-MM-DD) }` → `{ isFree, matchedLists[], age, ageGroup, alreadySeenAt }`. `alreadySeenAt` = Zeitpunkt des **ersten** Scans dieser Person bei dieser Veranstaltung. Fehler: `409 NO_ACTIVE_EVENT`, `400 INVALID_BIRTH_DATE` |

## Admin: Kontrolleur:innen
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/admin/users` | Liste inkl. Status (aktiv, gesperrt bis, abgelaufen) |
| POST | `/admin/users` | `{ name, password, role, validUntil? }` |
| PATCH | `/admin/users/:id` | Name, Passwort, Rolle, `disabled`, `validUntil`, `unlock: true` (Sperre aufheben). Schutz: eigenes Konto nicht sperren/herabstufen, letzter aktiver Admin bleibt (`SELF`, `LAST_ADMIN`) |
| DELETE | `/admin/users/:id` | löschen (nicht das eigene Konto, nicht den letzten aktiven Admin) |

## Admin: Freilisten
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/admin/lists` | alle Listen inkl. Anzahl Einträge |
| POST | `/admin/lists` | `{ name, description? }` |
| PATCH | `/admin/lists/:id` | umbenennen |
| DELETE | `/admin/lists/:id` | löschen |
| GET | `/admin/lists/:id/entries` | Einträge (paginiert, Suche) |
| POST | `/admin/lists/:id/entries` | `{ matrikelnummern: string[] }`, für einzeln und Copy-Paste |
| POST | `/admin/lists/:id/import` | Multipart (`file`, optional `mode` = `append`/`replace`, `column` = Überschrift oder Nummer). **CSV** (`;` `,` Tab) oder **XLSX**, max. 5 MB. Spalte wird sonst automatisch erkannt → Bericht (neu, schon vorhanden, entfernt, doppelt, ungültige Zeilen) |
| DELETE | `/admin/lists/:id/entries/:entryId` | Eintrag entfernen |
| DELETE | `/admin/lists/:id/entries` | Liste leeren → `{ removed }` |

## Admin: Veranstaltungen
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/admin/events` | Liste (vergangen, aktiv, geplant) |
| POST | `/admin/events` | `{ name, startsAt, endsAt, listIds[] }`. Überschneidung → `409 EVENT_OVERLAP` (Exclusion-Constraint in der DB) |
| GET | `/admin/events/:id` | eine Veranstaltung |
| PATCH | `/admin/events/:id` | ändern (auch Listen-Zuordnung) |
| POST | `/admin/events/:id/end` | laufende Veranstaltung sofort beenden |
| DELETE | `/admin/events/:id` | löschen |
| GET | `/admin/events/:id/stats` | `scans`, `persons`, `repeatedScans`, `freePersons`, `perList[]`, `ageGroups {U16,U18,ADULT}`, `perUser[]`, `archived` (Protokolle schon gelöscht → gesicherte Werte) |

## Admin: Einstellungen & System
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET/PATCH | `/admin/settings` | z. B. `checkLogRetentionDays` |
| GET | `/admin/system/time` | Serverzeit, hostd erreichbar, NTP, RTC, letzte bekannte Zeit |
| POST | `/admin/system/time` | `{ time }`, setzt Systemzeit und RTC (manuell, ohne Schutzregeln). `503 HOST_UNAVAILABLE` ohne hostd |
| GET | `/admin/system/time-log` | Zeit-Protokoll: Zeitpunkt, Quelle (Login/Me/Admin/NTP), User, alte → neue Zeit, Ergebnis |
| GET | `/admin/system/info` | installierte Version, letztes Update (Zeit, Erfolg), letzter NTP-Sync, Internet ja/nein |
| POST | `/admin/system/shutdown` | Pi sauber herunterfahren (`202`) |
| POST | `/admin/system/reboot` | Pi neu starten (`202`) |
| GET | `/system/maintenance-allowed` | nur localhost: `false` während einer aktiven Veranstaltung (wird vom Update-Skript abgefragt) |
| GET | `/system/display` | ohne Login: Serverzeit, aktive Veranstaltung (Name, Ende), Anzahl Personen. Bewusst ohne personenbezogene Daten (WLAN-QR erzeugt der Pi selbst) |

## Prüflogik `POST /checks`
1. Aktive Veranstaltung ermitteln, sonst `409 NO_ACTIVE_EVENT`
2. Validieren: Matrikelnummer `^\d{5}$`, Geburtsdatum gültig, nicht in der Zukunft, plausibel (z. B. 1930 bis heute)
3. Suche in `FreeListEntry` über die Listen der Veranstaltung → `matchedLists`
4. Alter in vollen Jahren am heutigen Tag (Europe/Berlin), `ageGroup`: `<16` → `U16`, `<18` → `U18`, sonst `ADULT`
5. `matrikelHash` = HMAC-SHA256(Geheimnis der Veranstaltung, Matrikelnummer), ersten `CheckLog` dieser Veranstaltung suchen → `alreadySeenAt`
6. `CheckLog` schreiben (ohne Matrikelnummer und Geburtsdatum)

## Aufräum-Job
Stündlich (und kurz nach dem Start): Für beendete Veranstaltungen mit Protokollen älter als `checkLogRetentionDays` wird die Statistik in `event_stats` gesichert und das Protokoll gelöscht. Laufende Veranstaltungen werden nie angefasst.
