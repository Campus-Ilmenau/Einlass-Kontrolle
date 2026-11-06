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
| GET | `/checks/context` | aktive Veranstaltung (Name, Ende, Listen) oder `null` → UI sperrt den Scan |
| POST | `/checks` | `{ matrikelnummer, birthDate }` → `{ isFree, matchedLists[], age, ageGroup, alreadySeenAt? }`. `409 NO_ACTIVE_EVENT`, wenn keine Veranstaltung aktiv ist |

## Admin: Kontrolleur:innen
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/admin/users` | Liste inkl. Status (aktiv, gesperrt bis, abgelaufen) |
| POST | `/admin/users` | `{ name, password, role, validUntil? }` |
| PATCH | `/admin/users/:id` | Name, Passwort, `disabled`, `validUntil`, Sperre aufheben |
| DELETE | `/admin/users/:id` | löschen |

## Admin: Freilisten
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/admin/lists` | alle Listen inkl. Anzahl Einträge |
| POST | `/admin/lists` | `{ name, description? }` |
| PATCH | `/admin/lists/:id` | umbenennen |
| DELETE | `/admin/lists/:id` | löschen |
| GET | `/admin/lists/:id/entries` | Einträge (paginiert, Suche) |
| POST | `/admin/lists/:id/entries` | `{ matrikelnummern: string[] }`, für einzeln und Copy-Paste |
| POST | `/admin/lists/:id/import` | Multipart-Upload **CSV oder XLSX**, Modus `append` oder `replace`, optional Spalte → Report (neu, doppelt, ungültig) |
| DELETE | `/admin/lists/:id/entries/:entryId` | Eintrag entfernen |

## Admin: Veranstaltungen
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET | `/admin/events` | Liste (vergangen, aktiv, geplant) |
| POST | `/admin/events` | `{ name, startsAt, endsAt, listIds[] }`, Überschneidungsprüfung |
| PATCH | `/admin/events/:id` | ändern (auch Listen-Zuordnung), z. B. vorzeitig beenden: `endsAt = now` |
| DELETE | `/admin/events/:id` | löschen |
| GET | `/admin/events/:id/stats` | Zähler: gesamt, frei je Liste, U16, U18, je Kontrolleur:in, Doppel-Scans |

## Admin: Einstellungen & System
| Methode | Pfad | Beschreibung |
|---|---|---|
| GET/PATCH | `/admin/settings` | z. B. `checkLogRetentionDays` |
| POST | `/admin/system/time` | `{ time }`, setzt Systemzeit und RTC (manuell, ohne Schutzregeln außer Bestätigung) |
| GET | `/admin/system/time-log` | Zeit-Protokoll: Zeitpunkt, Quelle (Login/Me/Admin/NTP), User, alte → neue Zeit, Ergebnis |
| GET | `/admin/system/info` | installierte Version, letztes Update (Zeit, Erfolg), letzter NTP-Sync, Internet ja/nein |
| POST | `/admin/system/shutdown` | Pi sauber herunterfahren |
| GET | `/system/maintenance-allowed` | nur localhost: `false` während einer aktiven Veranstaltung (wird vom Update-Skript abgefragt) |
| GET | `/system/display` | ohne Login, nur von localhost: aktive Veranstaltung, Anzahl Scans, Uhrzeit, WLAN-Daten für den QR-Code |

## Prüflogik `POST /checks`
1. Aktive Veranstaltung ermitteln, sonst `409 NO_ACTIVE_EVENT`
2. Validieren: Matrikelnummer `^\d{5}$`, Geburtsdatum gültig, nicht in der Zukunft, plausibel (z. B. 1930 bis heute)
3. Suche in `FreeListEntry` über die Listen der Veranstaltung → `matchedLists`
4. Alter in vollen Jahren am heutigen Tag (Europe/Berlin), `ageGroup`: `<16` → `U16`, `<18` → `U18`, sonst `ADULT`
5. `matrikelHash` berechnen, frühere `CheckLog` dieser Veranstaltung suchen → `alreadySeenAt`
6. `CheckLog` schreiben, Zähler erhöhen
