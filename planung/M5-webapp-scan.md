# M5 – Web-App: Scan & Prüfung

**Ziel:** Kontrolleur:innen können Thoska-Ausweise schnell erfassen und sehen ein eindeutiges Ergebnis.

## Aufgabe 5.1 – Scan-Kontext
- [ ] `GET /checks/context` laden. Ohne aktive Veranstaltung → Sperrbildschirm „Keine Veranstaltung aktiv“
- [ ] Automatisch aktualisieren (Polling), wenn die Veranstaltung beginnt oder endet
- [ ] Kopfzeile: Name, Veranstaltung, Logout

## Aufgabe 5.2 – Manuelle Eingabe (MVP-Basis)
- [ ] Matrikelnummer: 5 Ziffern, numerische Tastatur
- [ ] Geburtsdatum: TT / MM / JJJJ mit automatischem Fokus-Sprung
- [ ] Validierung über die Schemas aus `packages/shared`
- [ ] Absenden an `POST /checks`

## Aufgabe 5.3 – Ergebnisanzeige
- [ ] Vollbild-Overlay: GRÜN (frei), BLAU (normal), ORANGE (U18), ROT (U16)
- [ ] Gefundene Listen, Alter in Jahren
- [ ] Hinweis „Bereits um HH:MM gescannt“
- [ ] Vibration bzw. Ton (abschaltbar)
- [ ] Tippen oder Timeout → nächster Scan

## Aufgabe 5.4 – Kamera & OCR
- [ ] Kamera-Komponente (`getUserMedia`, Rückkamera, Fehler bei fehlender Berechtigung bzw. fehlendem HTTPS erklären)
- [ ] Overlay-Rahmen in Thoska-Proportion
- [ ] OCR-Pipeline aus M1 übernehmen: ROI-Zuschnitt, Vorverarbeitung, Tesseract.js im Web Worker
- [ ] Tesseract-WASM und Sprachdaten lokal ausliefern (kein CDN)
- [ ] Stabilisierung über mehrere Frames
- [ ] Bestätigungsschritt mit Korrekturmöglichkeit
- [ ] Taschenlampe ein/aus (falls das Gerät es unterstützt)
- [ ] Jederzeit Wechsel zur manuellen Eingabe

## Aufgabe 5.5 – Bedienbarkeit
- [ ] Test im Dunkeln und mit einer Hand
- [ ] Automatischer Logout bei abgelaufenem Account (Meldung)
- [ ] Performance messen: Zeit vom Hinhalten bis zum Ergebnis (Ziel < 3 s)

## Definition of Done
- Mit einer echten Thoska wird auf iOS und Android in < 3 s ein korrektes Ergebnis angezeigt
- Die manuelle Eingabe funktioniert immer als Fallback
- Ohne aktive Veranstaltung ist kein Scan möglich
