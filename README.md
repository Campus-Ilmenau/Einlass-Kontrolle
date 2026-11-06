# Einlass-Kontrolle

Offline-Einlasskontrolle für die Studi-Clubs der TU Ilmenau.

Ein Raspberry Pi spannt ein eigenes WLAN auf und stellt eine Web-App bereit. Kontrolleur:innen scannen
damit per Smartphone-Kamera die Thoska+ der Gäste und sehen sofort:

- ob die Matrikelnummer auf einer Freiliste der aktiven Veranstaltung steht (freier Eintritt)
- ob die Person minderjährig ist (U16 / U18 / 18+)
- ob der Ausweis an diesem Abend schon gescannt wurde

## Dokumentation

- [Konzept](konzept/README.md): was das System tut und wie es aufgebaut ist
- [Planung](planung/README.md): Milestones, Aufgaben, Unteraufgaben

## Repository-Struktur

```
apps/api/         API (Fastify, TypeORM, PostgreSQL)
apps/web/         Web-App (React, Vite, Ant Design)
packages/shared/  gemeinsame Typen, Schemas, Fachlogik
infra/pi/         Einrichtung des Raspberry Pi (Access Point, DNS, RTC, Docker, TLS)
infra/docker/     Docker Compose & Proxy-Konfiguration
```

## Entwicklung

Voraussetzungen: Node.js ≥ 24 und pnpm (über `corepack enable`).

```bash
pnpm install
pnpm lint
pnpm format:check
```

## Lizenz

[MIT](LICENSE)
