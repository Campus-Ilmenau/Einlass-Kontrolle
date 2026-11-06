# M1 – Machbarkeits-Prototyp (Risiko-PoC)

**Ziel:** Die zwei größten technischen Risiken sind geprüft, bevor viel Code entsteht:
1. Kamera im Browser auf iOS und Android im **Offline-WLAN** mit **self-signed HTTPS**
2. Zuverlässige **OCR** von Matrikelnummer (5-stellig) und Geburtsdatum auf der Thoska

Wegwerf-Code ist hier ausdrücklich erlaubt.

## Aufgabe 1.1 – Kamera über self-signed HTTPS im Offline-WLAN
- [ ] Minimaler AP auf dem Pi (oder Laptop-Hotspot ohne Internet als Ersatz)
- [ ] Self-signed-Zertifikat erzeugen (SAN: `einlass.lan`, `10.42.0.1`)
- [ ] Statische HTML-Seite mit `getUserMedia` über nginx und HTTPS ausliefern
- [ ] Test auf iPhone (Safari): Warnung bestätigen → Kamera freigegeben? Bleibt das nach Reconnect/Neustart erhalten?
- [ ] Test auf Android (Chrome), ggf. Tablet
- [ ] PWA-Installierbarkeit mit self-signed-Zertifikat prüfen
- [ ] Verhalten „WLAN ohne Internet“ dokumentieren (Android-Dialog, Umschalten auf mobile Daten)
- [ ] Falls self-signed scheitert: eigene CA testen (Plan B)

## Aufgabe 1.2 – OCR-Prototyp
- [ ] Testset: 5–10 Fotos von Thoskas (unterschiedliches Licht), Einwilligung der Besitzer:innen
- [ ] Layout vermessen: ROI für Matrikelnummer und Geburtsdatum relativ zum Kartenrahmen
- [ ] Tesseract.js mit Ziffern-Whitelist auf den Fotos testen, Vorverarbeitung (Graustufen, Schwellwert) ausprobieren
- [ ] Live-Stream-Test im Web Worker: Geschwindigkeit und Zuverlässigkeit auf einem Mittelklasse-Smartphone
- [ ] Stabilisierung über mehrere Frames testen
- [ ] Test bei schwachem Licht (Club-Einlass), ggf. mit Taschenlampe
- [ ] Ergebnis dokumentieren: Erkennungsrate, Zeit bis zur Erkennung, Probleme

## Aufgabe 1.3 – Entscheidung
- [ ] OCR-Ansatz bestätigen oder Alternativen bewerten
- [ ] HTTPS-Variante bestätigen (self-signed oder Plan B)
- [ ] Erkenntnisse in [konzept/08-ausweis-scan.md](../konzept/08-ausweis-scan.md) nachtragen

## Definition of Done
- Kamera läuft auf iOS und Android im Offline-WLAN
- OCR-Erkennungsrate und -dauer sind dokumentiert, die Entscheidung ist festgehalten
