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
- Noch zu prüfen: verschiedene Kartengenerationen

## Erfassung per OCR im Browser
- Kamera-Stream per `getUserMedia({ video: { facingMode: 'environment' } })`
- Overlay-Rahmen in Kartenproportion. Frames werden ins Canvas kopiert und auf die Bereiche (ROI) von
  Matrikelnummer und Geburtsdatum zugeschnitten. Vorverarbeitung: Graustufen, Kontrast, Schwellwert
- OCR mit **Tesseract.js** (WASM) in einem **Web Worker** auf dem Smartphone, nicht auf dem Pi
  - Sprachdaten und WASM werden **lokal vom Pi** ausgeliefert, kein CDN
  - Zeichen-Whitelist: Ziffern und `.`
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
