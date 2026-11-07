# Entry Check – Quick Guide for Door Staff

_Deutsche Version: [kurzanleitung-kontrolle.de.md](kurzanleitung-kontrolle.de.md)_

## 1 · Connect

1. **Wi-Fi:** Scan the **top QR code** on the Pi's display with your phone camera.
   Or by hand: network **Einlass-Kontrolle**, the password is shown on the display.
   - Android may ask “Stay connected without internet?” → **Yes**
2. **App:** Scan the **bottom QR code** or open **https://einlass.lan** in your browser.
3. **First time only** you will see a certificate warning. This is expected:
   - iPhone/iPad (Safari): **Show Details** → **visit this website** → confirm
   - Android (Chrome): **Advanced** → **Proceed to einlass.lan (unsafe)**

## 2 · Log in

- Log in with the **name and password** you got from the admin.
- After **5 wrong attempts** the account is **locked for 15 minutes**.
- If the app says **your device's clock is off**, tell the admin.

## 3 · Scan

1. On the first scan, **allow camera access**.
2. Hold the **Thoska card landscape**, **photo on the left**, so it fills the white frame. The lines
   “geb.” (date of birth) and “Matrikel-Nr.” (student number) sit inside the **yellow frame**.
3. **Hold still** for a moment. If the card reflects, tilt it slightly. In the dark, tap **“Licht an”** (light on).
4. As soon as both values are recognised, the result appears automatically.

**Card unreadable?** → **“Manuell eingeben”** (manual entry): type the student number (5 digits) and date of birth.

## 4 · Result

| Colour                   | Meaning                              | What to do                                 |
| ------------------------ | ------------------------------------ | ------------------------------------------ |
| 🟥 **UNTER 16**          | under 16                             | Youth protection: follow your club's rules |
| 🟧 **UNTER 18**          | 16 or 17 years old                   | Youth protection: follow your club's rules |
| 🟩 **FREIER EINTRITT**   | on a guest list (free entry)         | let them in without paying                 |
| 🟦 **NORMALER EINTRITT** | adult, not on a list (regular entry) | collect the entrance fee                   |

- **⚠ “Bereits um … gescannt”** (already scanned at …): this card was checked earlier tonight. Ask whether
  the person just stepped outside or whether the card was passed on.
- The **recognised values** are shown at the bottom. Compare them with the card. If something is
  wrong → **“Falsch erkannt? Korrigieren”** (correct it).
- **Tap the screen → next scan.** The Pi's display then shows “Next please”.

## 5 · Troubleshooting

| Message / problem                              | What to do                                                                     |
| ---------------------------------------------- | ------------------------------------------------------------------------------ |
| “Keine Veranstaltung aktiv” (no event running) | The event hasn't started yet or is over → admin                                |
| “Keine Verbindung zum Pi” (no connection)      | Is your phone on the **Einlass-Kontrolle** Wi-Fi? Briefly turn off mobile data |
| Camera image is black                          | Reload the page. Check camera permission in the browser settings               |
| Account locked / expired                       | The admin unlocks or extends your account                                      |
| Recognition doesn't work                       | More light, hold the card straight, otherwise use “Manuell eingeben”           |

## 6 · Privacy and end of shift

- **No photos or screenshots** of cards or results.
- Neither the student number nor the date of birth is stored, only a pseudonym for the “already scanned” hint.
  It is deleted after the retention period.
- **Log out** at the end of your shift (icon at the top right).
