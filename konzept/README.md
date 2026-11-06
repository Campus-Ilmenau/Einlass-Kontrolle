# Konzept – Einlass-Kontrolle für Studi-Clubs (TU Ilmenau)

Dieses Verzeichnis beschreibt **was** das System tun soll und **wie** es grundsätzlich aufgebaut ist.
Die konkrete Umsetzung (Milestones, Aufgaben) steht in [`../planung/`](../planung/README.md).

## Inhalt

| Datei | Thema |
|---|---|
| [01-ueberblick.md](01-ueberblick.md) | Ziel, Idee, Begriffe, Abgrenzung |
| [02-rollen-und-ablaeufe.md](02-rollen-und-ablaeufe.md) | Admin, Kontrolleur:in, typische Abläufe |
| [03-architektur.md](03-architektur.md) | Komponenten, Docker-Setup, Tech-Stack |
| [04-hardware-und-netzwerk.md](04-hardware-und-netzwerk.md) | Raspberry Pi, WLAN-Access-Point, Display, Uhrzeit |
| [05-datenmodell.md](05-datenmodell.md) | Entitäten und Beziehungen (TypeORM) |
| [06-api.md](06-api.md) | REST-Endpunkte |
| [07-webapp.md](07-webapp.md) | Screens und UX der React-App |
| [08-ausweis-scan.md](08-ausweis-scan.md) | Thoska+ erfassen: Kamera, OCR, Fallbacks |
| [09-sicherheit-und-datenschutz.md](09-sicherheit-und-datenschutz.md) | HTTPS, Auth, DSGVO |
| [10-offene-fragen.md](10-offene-fragen.md) | Getroffene Entscheidungen und offene Fragen |

## Kurzfassung

Ein Raspberry Pi spannt ein eigenes, vom Internet getrenntes WLAN auf. Ein angeschlossenes Display zeigt einen
QR-Code zum Verbinden. Kontrolleur:innen verbinden ihr Smartphone/Tablet, öffnen die vom Pi ausgelieferte
React-App, melden sich an und scannen die Thoska+ der Gäste. Die App liest **Matrikelnummer** und
**Geburtsdatum** per OCR, prüft gegen die **Freilisten** der aktiven **Veranstaltung** und zeigt an, ob die
Person **freien Eintritt** hat, welche Altersstufe sie hat (**U16 / U18 / 18+**) und ob sie schon gescannt wurde.
Admins verwalten Kontrolleur:innen, Freilisten und Veranstaltungen, führen aber selbst keine Kontrollen durch.
Datenbank (PostgreSQL), API (Fastify + TypeORM) und Web-App (React + Ant Design) laufen als Docker-Container
auf einem Raspberry Pi 4.

Alle getroffenen Entscheidungen stehen in [10-offene-fragen.md](10-offene-fragen.md).
