# 05 – Datenmodell (Entwurf)

```
┌────────────────────┐                     ┌───────────────────┐ 1    n ┌────────────────────┐
│ User               │                     │ FreeList          │────────│ FreeListEntry      │
├────────────────────┤                     ├───────────────────┤        ├────────────────────┤
│ id (uuid)          │                     │ id (uuid)         │        │ id                 │
│ name (unique)      │                     │ name              │        │ listId (FK)        │
│ passwordHash       │                     │ description?      │        │ matrikelnummer (5) │
│ role ADMIN|CONTROL │                     │ createdAt/updated │        │ note?              │
│ disabled           │                     └───────────────────┘        │ createdAt          │
│ validUntil?        │                              │ n                 └────────────────────┘
│ failedLoginCount   │                              │                   unique(listId, matrikelnummer)
│ lockedUntil?       │                              │ m  (EventFreeList)
│ lastLoginAt?       │                     ┌───────────────────┐
│ createdAt          │                     │ Event             │
└────────────────────┘                     ├───────────────────┤
          │ 1                              │ id (uuid)         │
          │                                │ name              │
          │ n                              │ startsAt          │
┌──────────────────────────┐   n        1  │ endsAt            │
│ CheckLog                 │───────────────│ hashSalt (secret) │
├──────────────────────────┤               │ createdAt         │
│ id                       │               └───────────────────┘
│ eventId (FK)             │
│ userId (FK)              │        ┌──────────────────────────┐
│ matrikelHash             │        │ EventStats (Zähler)      │
│ matchedListIds[]         │        ├──────────────────────────┤
│ ageGroup U16|U18|ADULT   │        │ eventId, userId?, listId?│
│ createdAt                │        │ total, free, u16, u18    │
└──────────────────────────┘        └──────────────────────────┘

┌──────────────────────────┐
│ Setting (Key/Value)      │  z. B. checkLogRetentionDays, lastKnownTime
└──────────────────────────┘

┌──────────────────────────┐
│ TimeSyncLog              │
├──────────────────────────┤
│ id                       │
│ source LOGIN|ME|ADMIN|NTP│
│ userId? (FK)             │
│ serverTimeBefore         │
│ clientTime               │
│ driftSeconds             │
│ action adjusted|rejected │
│        |warning          │
│ reason?                  │
│ createdAt                │
└──────────────────────────┘
```

## Anmerkungen

- **Rolle** als Enum am User: `ADMIN` oder `CONTROLLER`
- **Sperre:**
  - Login nur, wenn `disabled = false`, `validUntil` nicht überschritten und `lockedUntil` nicht in der Zukunft liegt
  - Falsches Passwort → `failedLoginCount++`. Bei 5 → `lockedUntil = now + 15 min` und Zähler auf 0. Ein erfolgreicher Login setzt den Zähler zurück
- **Veranstaltung:**
  - Aktiv, wenn `startsAt <= now < endsAt`
  - Überschneidungen werden beim Anlegen und Ändern abgelehnt
  - Zuordnung zu Listen über die n:m-Tabelle `EventFreeList`
- **Geburtsdatum wird nie gespeichert**, nur die `ageGroup`
- **Matrikelnummer im Log:** nur als `HMAC-SHA256(matrikel, event.hashSalt)`. Das reicht für die
  Doppel-Scan-Erkennung innerhalb der Veranstaltung. Ohne Salt ist der Hash nicht zurückrechenbar,
  denn bei nur 100.000 möglichen Nummern wäre ein Hash ohne Geheimnis trivial umkehrbar
- **Statistik:** Zähler werden beim Scan inkrementiert (oder per Aggregation berechnet) und bleiben auch
  erhalten, nachdem die Aufbewahrungsfrist die `CheckLog`-Einträge gelöscht hat. Alternativ: Beim Löschen
  einen Snapshot in `EventStats` schreiben
- **Aufbewahrung:** `Setting.checkLogRetentionDays` (Default z. B. 7). Ein Job löscht ältere `CheckLog`s
- **`lastKnownTime`** wird jede Minute und beim Herunterfahren aktualisiert. Es ist die Untergrenze für
  den Zeitabgleich. Zusätzlich als Datei auf dem Host speichern, damit es auch ohne DB lesbar ist
- **TimeSyncLog** wird nicht von der Aufbewahrungsfrist gelöscht (enthält keine Matrikeldaten), ggf. auf die letzten 500 Einträge begrenzt
- Matrikelnummer als **String** (`^\d{5}$`), damit führende Nullen erhalten bleiben
