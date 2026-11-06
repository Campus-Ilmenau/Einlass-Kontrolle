# M0 – Klärung & Projekt-Setup

**Ziel:** Alle Entscheidungen, die die Architektur betreffen, sind getroffen. Das Repo hat eine Grundstruktur.

## Aufgabe 0.1 – Offene Fragen klären
- [x] Grundsatzentscheidungen getroffen (siehe [konzept/10-offene-fragen.md](../konzept/10-offene-fragen.md))
- [ ] Muster-Thoska fotografieren (Vorder- und Rückseite), Layout dokumentieren (Position von Matrikelnummer und Geburtsdatum, Datumsformat)
- [ ] Überschneidung von Veranstaltungen: Annahme „nicht erlaubt“ bestätigen
- [ ] Festlegen, wer das Gerät betreibt und wartet

## Aufgabe 0.2 – Hardware beschaffen
- [ ] Raspberry Pi 4 (4 GB)
- [ ] Offizielles 5"-Display + Gehäuse bzw. Halterung für das Hochformat
- [ ] RTC-Modul DS3231 + Knopfzelle
- [ ] SD-Karte (High Endurance) oder USB-SSD
- [ ] Offizielles Netzteil

## Aufgabe 0.3 – Repository-Setup
- [ ] pnpm-Workspace anlegen: `apps/api`, `apps/web`, `packages/shared`, `infra/pi`, `infra/docker`
- [ ] TypeScript-Basiskonfiguration (`tsconfig.base.json`)
- [ ] `.gitignore`, `.editorconfig`, Prettier, ESLint
- [ ] `LICENSE` (MIT)
- [ ] README mit Projektbeschreibung und Links zu Konzept und Planung
- [ ] Milestones M0–M8 als GitHub-Milestones und Issues anlegen
- [ ] GitHub Actions: Lint + Test bei jedem Push

## Definition of Done
- Hardware ist bestellt oder vorhanden
- Repo-Grundstruktur ist gepusht, CI läuft grün
