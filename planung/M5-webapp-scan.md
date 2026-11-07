# M5 – Web-App: Scan & Prüfung

**Ziel:** Kontrolleur:innen können Thoska-Ausweise schnell erfassen und sehen ein eindeutiges Ergebnis.

## Aufgabe 5.1 – Scan-Kontext
- [x] `GET /checks/context` laden. Ohne aktive Veranstaltung → Sperrbildschirm „Keine Veranstaltung aktiv“
- [x] Automatisch aktualisieren (Polling alle 30 s), wenn die Veranstaltung beginnt oder endet
- [x] Kopfzeile: Name, Veranstaltung, Ende, Freilisten, Logout

## Aufgabe 5.2 – Manuelle Eingabe (MVP-Basis)
- [x] Matrikelnummer: 5 Ziffern, numerische Tastatur
- [x] Geburtsdatum: TT / MM / JJJJ mit automatischem Fokus-Sprung
- [x] Validierung über `packages/shared`
- [x] Absenden an `POST /checks`

## Aufgabe 5.3 – Ergebnisanzeige
- [x] Vollbild-Overlay: GRÜN (frei), BLAU (normal), ORANGE (U18), ROT (U16)
- [x] Gefundene Listen, Alter in Jahren, erkannte Werte zur Kontrolle
- [x] Hinweis „Bereits um HH:MM gescannt“
- [x] Vibration (Muster je Ergebnis)
- [x] Tippen → nächster Scan

## Aufgabe 5.4 – Kamera & OCR
- [x] Kamera-Komponente (`getUserMedia`, Rückkamera, Fehler bei fehlender Berechtigung bzw. fehlendem HTTPS erklären)
- [x] Overlay-Rahmen in Thoska-Proportion mit Datenbereich
- [x] OCR-Pipeline aus M1 übernehmen: ROI-Zuschnitt, Vorverarbeitung, Tesseract.js im Web Worker
- [x] Tesseract-WASM und Sprachdaten lokal ausliefern (kein CDN, `scripts/copy-ocr.mjs`)
- [x] Stabilisierung über mehrere Frames (je Feld, Fenster 15)
- [x] Korrekturmöglichkeit: „Falsch erkannt?“ öffnet die vorausgefüllte manuelle Eingabe (kein extra Bestätigungsschritt, damit es schnell geht)
- [x] Taschenlampe ein/aus (falls das Gerät es unterstützt)
- [x] Jederzeit Wechsel zur manuellen Eingabe
- [x] Bildschirm bleibt an (Screen Wake Lock)

## Aufgabe 5.5 – Bedienbarkeit
- [ ] Test im Dunkeln und mit einer Hand
- [ ] Automatischer Logout bei abgelaufenem Account (Meldung) – API liefert 401, UI-Hinweis fehlt noch
- [ ] Performance messen: Zeit vom Hinhalten bis zum Ergebnis (Ziel < 3 s)

## Definition of Done
- Mit einer echten Thoska wird auf iOS und Android in < 3 s ein korrektes Ergebnis angezeigt
- Die manuelle Eingabe funktioniert immer als Fallback
- Ohne aktive Veranstaltung ist kein Scan möglich
