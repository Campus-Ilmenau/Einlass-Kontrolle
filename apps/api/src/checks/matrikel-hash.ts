import { createHmac } from 'node:crypto';

/**
 * Pseudonym der Matrikelnummer im Scan-Protokoll: HMAC-SHA256 mit dem Geheimnis der Veranstaltung.
 *
 * Ein einfacher Hash wäre bei nur 100.000 möglichen Nummern in Sekunden zurückzurechnen.
 * Mit dem Geheimnis pro Veranstaltung lassen sich Scans nur innerhalb derselben Veranstaltung
 * zuordnen (Doppel-Scan-Erkennung), aber nicht über Veranstaltungen hinweg.
 */
export function matrikelHash(eventSalt: string, matrikelnummer: string): string {
  return createHmac('sha256', eventSalt).update(matrikelnummer).digest('hex');
}
