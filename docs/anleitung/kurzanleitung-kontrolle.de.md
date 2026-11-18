# Einlass-Kontrolle – Kurzanleitung für die Kontrolle

_English version: [quick-guide-door-staff.en.md](quick-guide-door-staff.en.md)_

## 1 · Verbinden

1. **WLAN:** Mit der Handy-Kamera den **oberen QR-Code** auf dem Display am Pi scannen.
   Alternativ von Hand: Netz **Einlass-Kontrolle**, das Passwort steht auf dem Display.
   - Android fragt evtl. „Ohne Internet verbunden bleiben?“ → **Ja**
2. **App:** Den **unteren QR-Code** scannen oder im Browser **https://einlass.lan** öffnen.
3. **Nur beim ersten Mal** kommt eine Zertifikatswarnung. Das ist bei uns normal:
   - iPhone/iPad (Safari): **Details einblenden** → **diese Website besuchen** → bestätigen
   - Android (Chrome): **Erweitert** → **Weiter zu einlass.lan (unsicher)**

## 2 · Anmelden

- Mit **Name und Passwort** anmelden, die du vom Admin bekommen hast.
- Nach **5 falschen Versuchen** ist das Konto **15 Minuten gesperrt**.
- Meldet die App, dass die **Uhr deines Geräts abweicht**, gib dem Admin Bescheid.

## 3 · Scannen

1. Beim ersten Scan die **Kamera erlauben**.
2. Die **Thoska quer** halten, **Foto links**, sodass sie den weißen Rahmen füllt. Die Zeilen
   „geb.“ und „Matrikel-Nr.“ liegen im **gelben Rahmen**.
3. Kurz **ruhig halten**. Spiegelt die Karte, leicht kippen. Bei Dunkelheit **„Licht an“**.
4. Sobald beide Werte erkannt sind, erscheint das Ergebnis automatisch.

**Karte unlesbar?** → **„Manuell eingeben“**: Matrikelnummer (5 Ziffern) und Geburtsdatum abtippen.

## 4 · Ergebnis

| Farbe                    | Bedeutung                         | Was tun?                                  |
| ------------------------ | --------------------------------- | ----------------------------------------- |
| 🟥 **UNTER 16**          | jünger als 16                     | Jugendschutz: Regeln eures Clubs beachten |
| 🟧 **UNTER 18**          | 16 oder 17 Jahre                  | Jugendschutz: Regeln eures Clubs beachten |
| 🟩 **FREIER EINTRITT**   | steht auf einer Freiliste         | ohne Eintritt einlassen                   |
| 🟦 **NORMALER EINTRITT** | volljährig, nicht auf einer Liste | Eintritt kassieren                        |

- **⚠ „Bereits um … gescannt“:** Diese Karte wurde heute schon geprüft. Nachfragen, ob die Person
  nur kurz draußen war oder die Karte weitergegeben wurde.
- Unten stehen die **erkannten Werte**. Kurz mit der Karte vergleichen. Stimmt etwas nicht →
  **„Falsch erkannt? Korrigieren“**.
- **Bildschirm antippen → nächster Scan.** Auf dem Display am Pi erscheint dann „Nächster bitte“.

## 5 · Wenn etwas nicht klappt

| Meldung / Problem           | Lösung                                                                     |
| --------------------------- | -------------------------------------------------------------------------- |
| „Keine Veranstaltung aktiv“ | Die Veranstaltung hat noch nicht begonnen oder ist vorbei → Admin          |
| „Keine Verbindung zum Pi“   | Ist das Handy im WLAN **Einlass-Kontrolle**? Mobile Daten kurz ausschalten |
| Kamerabild schwarz          | Seite neu laden. Kamera-Erlaubnis in den Browser-Einstellungen prüfen      |
| Konto gesperrt / abgelaufen | Admin entsperrt bzw. verlängert dein Konto                                 |
| Erkennung klappt nicht      | Mehr Licht, Karte gerade halten, sonst „Manuell eingeben“                  |

## 6 · Datenschutz und Feierabend

- **Keine Fotos oder Screenshots** von Karten oder Ergebnissen.
- Gespeichert wird weder Matrikelnummer noch Geburtsdatum, nur ein Pseudonym für den Doppel-Scan-Hinweis.
  Es wird nach der Aufbewahrungsfrist gelöscht.
- Am Ende der Schicht **abmelden** (Symbol oben rechts).
