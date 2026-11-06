# M1 – Machbarkeits-Prototyp (Risiko-PoC)

**Ziel:** Die zwei größten technischen Risiken sind geprüft, bevor viel Code entsteht:
1. Kamera im Browser auf iOS und Android im **Offline-WLAN** mit **self-signed HTTPS**
2. Zuverlässige **OCR** von Matrikelnummer (5-stellig) und Geburtsdatum auf der Thoska

Wegwerf-Code ist hier ausdrücklich erlaubt.

## Aufgabe 1.1 – Kamera über self-signed HTTPS im Offline-WLAN
- [x] Minimaler AP auf dem Pi (oder Laptop-Hotspot ohne Internet als Ersatz)
- [x] Self-signed-Zertifikat erzeugen (SAN: `einlass.lan`, `10.42.0.1`)
- [x] Statische HTML-Seite mit `getUserMedia` über nginx und HTTPS ausliefern
- [x] Test auf iPad (Safari): nach Bestätigen der Warnung wird die Kamera freigegeben ✅
- [ ] Test auf iPhone (Safari), inkl. Verhalten nach Reconnect/Neustart des Pi
- [ ] Test auf Android (Chrome), ggf. Tablet
- [ ] PWA-Installierbarkeit mit self-signed-Zertifikat prüfen
- [ ] Verhalten „WLAN ohne Internet“ dokumentieren (Android-Dialog, Umschalten auf mobile Daten)
- [ ] Falls self-signed scheitert: eigene CA testen (Plan B)

## Aufgabe 1.2 – OCR-Prototyp
- [ ] Testset: 5–10 Fotos von Thoskas (unterschiedliches Licht), Einwilligung der Besitzer:innen
- [ ] ~~Layout vermessen (ROI)~~: nicht nötig, die Erkennung auf dem ganzen Kartenrahmen reicht
- [x] Tesseract.js mit Ziffern-Whitelist auf den Fotos testen, Vorverarbeitung (Graustufen, Schwellwert) ausprobieren
- [x] Live-Stream-Test im Web Worker: Geschwindigkeit und Zuverlässigkeit auf einem Mittelklasse-Smartphone
- [x] Stabilisierung über mehrere Frames testen (3 gleiche Treffer)
- [ ] Test bei schwachem Licht (Club-Einlass), ggf. mit Taschenlampe
- [x] Ergebnis dokumentieren: Erkennungsrate, Zeit bis zur Erkennung, Probleme

## Aufgabe 1.3 – Entscheidung
- [x] OCR-Ansatz bestätigen oder Alternativen bewerten
- [x] HTTPS-Variante bestätigen: self-signed funktioniert (iPad)
- [x] Erkenntnisse in [konzept/08-ausweis-scan.md](../konzept/08-ausweis-scan.md) nachtragen

## Ergebnis (06.11.2026)

| Prüfpunkt | Ergebnis |
|---|---|
| Kamera über self-signed HTTPS im Offline-WLAN | ✅ iPad (Safari) |
| Datumsformat auf der Thoska | `TT.MM.JJJJ` |
| Erkennung Matrikelnummer + Geburtsdatum | ✅ zuverlässig |
| Live-Erkennung bis „stabil“ (3 gleiche Treffer) | ✅ unter 3 s |
| Vorgehen | Tesseract.js 7 (LSTM, `eng`), Ziffern-Whitelist, PSM 11, Graustufen + Otsu-Schwelle, Zuschnitt auf Kartenrahmen |

**Entscheidung:** OCR mit Tesseract.js im Browser und self-signed HTTPS werden für M5 übernommen.
Prototyp: [`poc/m1-kamera-ocr/`](../poc/m1-kamera-ocr/README.md).

**Noch offen (nicht blockierend):** iPhone, Android (Chrome), Tablet-Vielfalt, PWA-Installierbarkeit,
schwaches Licht am Einlass, Verhalten „WLAN ohne Internet“ auf Android.

## Definition of Done
- Kamera läuft auf iOS und Android im Offline-WLAN
- OCR-Erkennungsrate und -dauer sind dokumentiert, die Entscheidung ist festgehalten
