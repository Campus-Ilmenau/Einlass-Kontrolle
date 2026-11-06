# 01 – Überblick

## Ziel

Die Studi-Clubs der TU Ilmenau brauchen am Einlass eine schnelle, zuverlässige Kontrolle:

1. **Freier Eintritt?** Steht die Matrikelnummer auf einer der für den Abend aktiven Listen
   (z. B. Fachschaft X, Gruppe Y)?
2. **Jugendschutz:** Ist die Person minderjährig (unter 18), ggf. auch unter 16?

Das System soll **offline** funktionieren, mit wenig Aufwand aufzubauen sein und auf
handelsüblichen Smartphones laufen. Eine App-Installation ist nicht nötig, es reicht der Browser.

## Grundidee

```
 ┌───────────────┐      WLAN (offline)     ┌──────────────────────────────┐
 │ Smartphone /  │  ───────────────────▶   │ Raspberry Pi 4               │
 │ Tablet        │                         │  ├─ WLAN Access Point        │
 │ (Browser,     │  ◀───────────────────   │  ├─ Docker                   │
 │  Kamera, OCR) │  HTTPS (self-signed)    │  │   ├─ Web (React, nginx)   │
 └───────────────┘                         │  │   ├─ API (Fastify,TypeORM)│
                                           │  │   └─ DB (PostgreSQL)      │
                                           │  ├─ RTC-Uhr (DS3231)         │
                                           │  └─ 5"-Display (Kiosk)       │
                                           └──────────────────────────────┘
```

## Begriffe

| Begriff | Bedeutung |
|---|---|
| **Thoska+** | Studierendenausweis der Thüringer Hochschulen. Matrikelnummer und Geburtsdatum sind aufgedruckt |
| **Kontrolleur:in** | Person am Einlass, scannt Ausweise |
| **Admin** | Verwaltet Kontrolleur:innen und Listen, kontrolliert selbst nicht |
| **Freiliste** | Benannte Liste von Matrikelnummern mit freiem Eintritt (z. B. „FS EI“, „Helfer:innen“) |
| **Veranstaltung** | Abend mit Start und Ende, dem Freilisten zugeordnet sind. Nur während einer aktiven Veranstaltung kann gescannt werden |
| **Prüfung / Scan** | Ein einzelner Kontrollvorgang mit Ergebnis |

## Abgrenzung (vorerst nicht im Umfang)

- Kein Ticketverkauf, keine Bezahlung
- Keine Anbindung an Systeme der Uni (das Gerät ist offline)
- Keine Prüfung, ob der Ausweis echt oder gültig ist (Semester-Aufdruck). Das bleibt Sichtprüfung
  durch den Menschen. Erweiterung denkbar, siehe [10-offene-fragen.md](10-offene-fragen.md)
- Keine native App, nur Web-App im Browser
- Nur Thoska+, keine anderen Ausweise (z. B. Personalausweis von Gästen)
- Ein Pi pro Club, keine Mandantentrennung
