# 02 – Rollen und Abläufe

## Rollen

Admin und Kontrolleur:in sind **strikt getrennt**. Ein Admin kann nicht scannen. Wer beides machen will,
braucht zwei Accounts.

### Admin
- Meldet sich in derselben Web-App an, sieht aber **keine Scan-Funktion**
- Verwaltet **Kontrolleur:innen**: Name, Passwort, optional „gültig bis“
  - Kann manuell sperren, entsperren und löschen sowie Passwörter zurücksetzen
- Verwaltet **Freilisten**: anlegen, umbenennen, löschen
  - Einträge: einzeln eintippen, Copy-Paste, Import aus CSV oder Excel (.xlsx)
- Verwaltet **Veranstaltungen**: Name, Start, Ende, zugeordnete Freilisten
- Sieht **Statistik pro Veranstaltung**: Scans gesamt, frei je Liste, U16/U18, je Kontrolleur:in
- Stellt **Einstellungen** ein: Aufbewahrungsfrist für Scan-Protokolle, Systemzeit (vom Gerät übernehmen)

Der initiale Admin wird beim ersten Start aus Umgebungsvariablen angelegt.

### Kontrolleur:in
- Meldet sich mit Name und Passwort an
- Scannt Thoska-Ausweise per Kamera, Fallback ist die manuelle Eingabe
- Sieht ein klares Ergebnis pro Scan
- Kann sich abmelden

### Automatische Sperre von Accounts
1. **Ablaufzeitpunkt** (optional, „gültig bis“): Danach ist kein Login mehr möglich, laufende Sessions enden
2. **Fehlversuche:** Nach **5 falschen Passwörtern** wird der Account **15 Minuten** gesperrt und entsperrt sich danach automatisch

## Veranstaltungen
- Eine Veranstaltung hat **Name, Start, Ende** und **n zugeordnete Freilisten**
- Im Zeitfenster [Start, Ende] ist sie **automatisch aktiv**
- Es ist höchstens **eine Veranstaltung gleichzeitig** aktiv (keine Überschneidungen)
- **Ist keine Veranstaltung aktiv, ist der Scan gesperrt.** Die App zeigt dann „Keine Veranstaltung aktiv“
- Statistik und Doppel-Scan-Erkennung beziehen sich jeweils auf die Veranstaltung

## Lebenszyklus des Geräts

Der Pi liegt die meiste Zeit **ausgeschaltet im Schrank**, ohne Strom und ohne Netz, oft wochenlang.
Er wird nur zu zwei Anlässen eingeschaltet:

```
 Schrank (aus)  ──▶  Vorbereitung (~2 Tage vorher)  ──▶  aus  ──▶  Einlass (~3 h vorher bis Ende)  ──▶  Schrank
                     optional Ethernet mit Internet                ohne Netz, nur Strom
                     → Zeit-Sync (NTP), Auto-Update                → Admin vor Ort
```

## Ablauf: Vorbereitung (ca. 2 Tage vorher)
1. Pi aus dem Schrank nehmen und einschalten. **Optional per Ethernet mit Internet verbinden**
2. Wenn Internet da ist, passiert automatisch:
   - **Zeitabgleich per NTP**, die RTC wird nachgestellt
   - **Auto-Update**: Ist ein neues Release verfügbar, wird vorher ein DB-Backup gemacht und dann
     werden die neuen Images gezogen und gestartet (siehe [03-architektur.md](03-architektur.md#updates))
3. Admin verbindet sich (WLAN des Pi), prüft Version und Uhrzeit im Admin-Bereich
4. Admin legt bzw. aktualisiert Freilisten (Import)
5. Admin legt die Veranstaltung an (z. B. Fr 21:00 – Sa 05:00) und ordnet die Listen zu
6. Admin legt Kontrolleur-Accounts an, z. B. gültig bis Sa 06:00
7. Pi herunterfahren (Button im Admin-Bereich bzw. Power-Taste), Strom trennen

## Ablauf: Aufbau am Abend (ca. 3 Stunden vor Einlass)
1. Pi in der Nähe der Eingangstür aufstellen und an den Strom anschließen. Es gibt kein Netz
2. AP, Docker und Display-Kiosk starten automatisch
3. Display zeigt QR-Code „WLAN verbinden“, QR-Code „App öffnen“ sowie **Datum und Uhrzeit**
4. **Admin ist vor Ort und meldet sich als Erster an.** Dabei gleicht der Pi seine Uhr **automatisch** mit
   dem Handy ab (siehe [Zeitabgleich](04-hardware-und-netzwerk.md#automatischer-zeitabgleich-bei-anmeldung)).
   Der Admin prüft danach Uhrzeit und Status der Veranstaltung („geplant/aktiv“)
5. Kontrolleur:innen verbinden sich, bestätigen einmalig die Zertifikatswarnung und melden sich an
6. Mit Beginn der Veranstaltung wird der Scan freigeschaltet

> **Warum die Uhrzeit hier so wichtig ist:** Da ohne aktive Veranstaltung nicht gescannt werden kann,
> würde eine falsche Systemzeit den **ganzen Abend blockieren**, nicht nur die Altersprüfung verfälschen.
> Ohne RTC stünde die Uhr nach Tagen im Schrank auf dem Zeitpunkt des letzten Herunterfahrens.

## Ablauf: Kontrolle am Einlass

```
Kontrolleur:in                App                         API
     │  Thoska vor Kamera       │                            │
     │ ───────────────────────▶ │  OCR: Matrikel + Geb.-Dat. │
     │                          │  (Anzeige zur Bestätigung) │
     │                          │ ─── POST /checks ────────▶ │  aktive Veranstaltung?
     │                          │                            │  Abgleich zugeordnete Listen
     │                          │                            │  Altersberechnung
     │                          │                            │  Doppel-Scan?
     │                          │ ◀── Ergebnis ───────────── │
     │  Ergebnis-Screen         │                            │
     │ ◀─────────────────────── │                            │
```

### Ergebnisanzeige

| Ergebnis | Anzeige |
|---|---|
| Freier Eintritt, 18+ | **GRÜN**: „Frei – Liste: FS EI“ |
| Kein freier Eintritt, 18+ | **BLAU**: „Normaler Eintritt“ |
| 16–17 Jahre | **ORANGE**: „U18 – 17 Jahre“ |
| unter 16 | **ROT**: „U16 – 15 Jahre“ |
| Bereits gescannt | zusätzlicher Hinweis: „Bereits um 22:14 gescannt“ |

Frei-Status und Altersstufe sind **zwei unabhängige Informationen** und werden beide angezeigt.
Bei Minderjährigen dominiert die Altersfarbe, der Frei-Status steht als Text darunter.

## Ablauf: Nach dem Abend
- Veranstaltung endet automatisch, danach ist kein Scan mehr möglich
- Kontrolleur-Accounts laufen über „gültig bis“ ab
- Scan-Protokolle werden nach der eingestellten Aufbewahrungsfrist gelöscht, die Zähler bleiben erhalten
