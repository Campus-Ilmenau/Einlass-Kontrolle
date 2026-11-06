# 08 – Ausweis-Scan (Thoska+)

Das war der **technisch riskanteste Teil**. Der Prototyp (M1) hat ihn bestätigt: Auf dem iPad wurden Matrikelnummer
und Geburtsdatum zuverlässig und in **unter 3 Sekunden** stabil erkannt ([Ergebnis](../planung/M1-machbarkeit-prototyp.md#ergebnis-06112026)).

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
  - Ein Wert gilt erst als erkannt, wenn er in **mehreren aufeinanderfolgenden Frames** gleich gelesen wurde
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
