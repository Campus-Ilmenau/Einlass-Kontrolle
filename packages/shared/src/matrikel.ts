/** Matrikelnummern an der TU Ilmenau sind immer 5-stellig und rein numerisch. */
export const MATRIKEL_LENGTH = 5;
export const MATRIKEL_REGEX = /^\d{5}$/;

/** Entfernt Leerzeichen und typische Trennzeichen aus einer Eingabe (Copy-Paste, CSV, OCR). */
export function normalizeMatrikel(input: string): string {
  return input.replace(/[\s\u00a0'".-]/g, '');
}

export function isValidMatrikel(value: string): boolean {
  return MATRIKEL_REGEX.test(value);
}

export interface MatrikelListParseResult {
  /** Gültige, normalisierte und deduplizierte Nummern in Eingabereihenfolge */
  valid: string[];
  /** Nummern, die mehrfach vorkamen (je einmal aufgeführt) */
  duplicates: string[];
  /** Ungültige Einträge im Originaltext */
  invalid: string[];
}

/**
 * Zerlegt eine Liste aus Copy-Paste oder einer einspaltigen Datei.
 * Trennzeichen: Zeilenumbruch, Komma, Semikolon, Tab. Leerzeichen innerhalb einer Nummer werden entfernt.
 */
export function parseMatrikelList(text: string): MatrikelListParseResult {
  const valid: string[] = [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  const invalid: string[] = [];

  for (const raw of text.split(/[\r\n,;\t]+/)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const value = normalizeMatrikel(trimmed);
    if (!isValidMatrikel(value)) {
      invalid.push(trimmed);
    } else if (seen.has(value)) {
      duplicates.add(value);
    } else {
      seen.add(value);
      valid.push(value);
    }
  }
  return { valid, duplicates: [...duplicates], invalid };
}
