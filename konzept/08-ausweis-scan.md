# 08 – Ausweis-Scan (Thoska+)

Das ist der **technisch riskanteste Teil**. Der Prototyp (M1) zeigt auf dem iPad: Die Matrikelnummer wird praktisch
in jedem Bild erkannt, das Geburtsdatum nur in einem Teil der Bilder. Die Stabilisierung zählt deshalb jedes Feld
einzeln ([Ergebnis](../planung/M1-machbarkeit-prototyp.md#ergebnis-06112026)).

## Ausgangslage
- Unterstützt wird **nur die Thoska+**
- Auf der Karte sind Matrikelnummer (**5-stellig, numerisch**) und Geburtsdatum aufgedruckt
- Es gibt **keinen Barcode oder QR-Code**. Die Erfassung läuft deshalb per **OCR**, Fallback ist die manuelle Eingabe
- Der NFC-Chip (MIFARE DESFire) ist nicht frei auslesbar und wird nicht genutzt
- Datumsformat auf der Karte: **`TT.MM.JJJJ`**

### Kartenlayout (Querformat, Werte relativ zur Kartenbreite/-höhe)

```
┌─────┬──────────────────────────────────────────────┐
│  t  │ Studienausweis ███████   TECHNISCHE UNIV. IL. │  y 0.00–0.15
│  h  │ ┌───────┐  Nachname                           │  y ≈ 0.33
│  o  │ │ Foto  │  Vorname                            │  y ≈ 0.40
│  s  │ │       │  geb. 27.07.1994        ┐ Daten-    │  y ≈ 0.46
│  k  │ │       │  Matrikel-Nr. 53902     ┘ bereich   │  y ≈ 0.55
│  a  │ └───────┘                                     │
│  +  │  Semesterticket gültig bis 30.09.2018  (!)   │  y 0.70–0.93
└─────┴──────────────────────────────────────────────┘
 x 0–0.12  Foto x 0.22–0.42   Daten x 0.45–0.71
```

- **Achtung:** Der wiederbeschreibbare Bereich unten enthält ein **zweites Datum** („gültig bis“) im selben
  Format. Es darf nie als Geburtsdatum gewertet werden
- Ausgewerteter Datenbereich (ROI): x 0.40–0.86, y 0.36–0.66
- **Anker** für die Zuordnung: `geb.` vor dem Geburtsdatum, `Matrikel-Nr.` vor der Matrikelnummer
- Die Karte glänzt. Spiegelungen über dem Datenbereich sind am Einlass das größte praktische Problem
  (Karte leicht kippen)
- Noch zu prüfen: verschiedene Kartengenerationen

## Erfassung per OCR im Browser
- Kamera-Stream per `getUserMedia({ video: { facingMode: 'environment' } })`
- Overlay-Rahmen in Kartenproportion. Frames werden ins Canvas kopiert und auf die Bereiche (ROI) von
  Matrikelnummer und Geburtsdatum zugeschnitten. Vorverarbeitung: Graustufen, Kontrast, Schwellwert
- OCR mit **Tesseract.js** (WASM) in einem **Web Worker** auf dem Smartphone, nicht auf dem Pi
  - Sprachdaten und WASM werden **lokal vom Pi** ausgeliefert, kein CDN
  - Nur der Datenbereich (ROI) wird ausgewertet, PSM 6 (Block), Whitelist: Ziffern, `.`, `-` und die Buchstaben der Anker
  - Zuordnung bevorzugt über die Anker `geb.` / `Nr.`. Fallback: Kandidaten ohne Daten nach „bis“
- **Plausibilisierung:**
  - Matrikelnummer `^\d{5}$`
  - Datum gültig und plausibel
  - Jedes Feld wird **einzeln** in einem gleitenden Fenster (15 Frames) abgestimmt: Matrikelnummer 3× gleich,
    Datum 2× gleich. Die Treffer müssen nicht direkt hintereinander liegen
  - Datums-Regex tolerant gegenüber fehlenden Punkten (`27071994`, `27 07 1994`) mit anschließender Plausibilitätsprüfung
  - Vorverarbeitung im Wechsel (S/W-Schwelle und Graustufen)
- Der erkannte Wert wird angezeigt und kann vor dem Absenden korrigiert werden
- *(Alternative, falls Tesseract zu langsam oder ungenau ist)*: Text-Detection-API (nur Chrome/Android, experimentell) oder ein schlankeres, eigenes Ziffern-Modell

## Manuelle Eingabe (immer verfügbar)
- Matrikelnummer: 5 Ziffern, numerische Tastatur
- Geburtsdatum: drei Felder TT / MM / JJJJ mit automatischem Fokus-Sprung

## Voraussetzung: HTTPS
Browser erlauben die Kamera nur in einem **sicheren Kontext** (HTTPS oder `localhost`). Die App kommt vom
Pi, für das Handy ist das also nicht `localhost`. Entscheidung: **self-signed Zertifikat**. Die Warnung
wird pro Gerät einmal bestätigt. In M1 ist zu prüfen, ob die Kamera danach auf iOS (Safari) und Android
(Chrome) zuverlässig freigegeben wird. Plan B: eigene CA, deren Root-Zertifikat auf den Geräten installiert wird.
