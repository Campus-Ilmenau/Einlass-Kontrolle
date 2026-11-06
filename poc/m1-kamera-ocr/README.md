# M1 – Kamera & OCR (Prototyp)

Wegwerf-Prototyp für [M1](../../planung/M1-machbarkeit-prototyp.md). Prüft:

1. ob die Kamera im Browser (iOS/Android) über das **self-signed HTTPS** im Offline-WLAN freigegeben wird
2. wie gut und wie schnell **Tesseract.js** Matrikelnummer und Geburtsdatum auf der Thoska erkennt

Alle Bilder werden nur im Browser verarbeitet, es wird nichts an den Pi gesendet oder gespeichert.

## Auf den Pi bringen

```bash
./fetch-vendor.sh                      # Tesseract.js, WASM-Kern, Sprachdaten → public/vendor/
scp -r ../m1-kamera-ocr <user>@<pi>:~/einlass-poc/
ssh <user>@<pi> 'cd ~/einlass-poc/m1-kamera-ocr && docker compose up -d'
```

Dann im WLAN `Einlass-Kontrolle` `https://einlass.lan` öffnen und die Zertifikatswarnung bestätigen.

## Test-Ablauf

1. **Umgebung:** Alle Punkte sollten ✅ sein, vor allem „Sicherer Kontext“
2. **Kamera starten:** Die Berechtigung erteilen, die Rückkamera sollte laufen. Licht-Button nur, wenn das Gerät es kann
3. **Einzelbild erkennen:** Die Thoska in den Rahmen halten und auslösen. Matrikelnummer und Datum werden angezeigt
4. **Live-Erkennung:** Die Erkennung läuft, bis dasselbe Paar dreimal hintereinander erkannt wurde
5. Schwellwert an/aus vergleichen, verschiedenes Licht ausprobieren
6. **Bericht kopieren** und in [M1](../../planung/M1-machbarkeit-prototyp.md) bzw. im Issue festhalten

Nach dem Test: `docker compose down`, damit Port 443 für die echte App frei wird.
