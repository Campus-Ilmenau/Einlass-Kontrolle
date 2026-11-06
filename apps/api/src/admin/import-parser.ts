import { isValidMatrikel, normalizeMatrikel } from '@einlass/shared';
import { parse as parseCsv } from 'csv-parse/sync';
import { readSheet } from 'read-excel-file/node';
import { badRequest } from '../http/errors.js';

export type Cell = string | number | boolean | Date | null | undefined | object;
export type ImportFormat = 'csv' | 'xlsx';

const XLSX_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // ZIP

export function detectFormat(filename: string | undefined, data: Buffer): ImportFormat {
  if (data.subarray(0, 4).equals(XLSX_MAGIC) || /\.xlsx$/i.test(filename ?? '')) return 'xlsx';
  return 'csv';
}

/** Liest CSV (Trennzeichen `,`, `;` oder Tab, UTF-8 mit/ohne BOM) oder die erste Tabelle einer XLSX-Datei. */
export async function readRows(format: ImportFormat, data: Buffer): Promise<Cell[][]> {
  if (format === 'xlsx') {
    try {
      return (await readSheet(data)) as Cell[][];
    } catch {
      throw badRequest('INVALID_FILE', 'Excel-Datei konnte nicht gelesen werden');
    }
  }
  try {
    return parseCsv(data, {
      bom: true,
      delimiter: [';', ',', '\t'],
      relax_column_count: true,
      relax_quotes: true,
      skip_empty_lines: true,
      trim: true,
    }) as string[][];
  } catch {
    throw badRequest('INVALID_FILE', 'CSV-Datei konnte nicht gelesen werden');
  }
}

/**
 * Wandelt eine Zelle in eine Matrikelnummer um.
 * Excel speichert Zahlen ohne führende Nullen → ganze Zahlen < 100000 werden auf 5 Stellen aufgefüllt.
 */
export function cellToMatrikel(cell: Cell): string | null {
  if (typeof cell === 'number') {
    if (!Number.isInteger(cell) || cell < 1 || cell > 99999) return null;
    return String(cell).padStart(5, '0');
  }
  if (typeof cell !== 'string') return null;
  const value = normalizeMatrikel(cell);
  return isValidMatrikel(value) ? value : null;
}

const cellText = (cell: Cell) =>
  cell === null || cell === undefined
    ? ''
    : cell instanceof Date
      ? cell.toISOString()
      : String(cell);

export interface ExtractResult {
  /** Gewählte Spalte als Beschriftung (Überschrift oder "Spalte N") */
  column: string;
  hasHeader: boolean;
  rows: number;
  values: { row: number; value: string }[];
  invalid: { row: number; value: string }[];
}

/**
 * Wählt die Spalte mit den Matrikelnummern und liest sie aus.
 * `column`: Überschrift (ohne Groß-/Kleinschreibung) oder Spaltennummer (1-basiert).
 * Ohne Angabe wird die Spalte mit den meisten gültigen Matrikelnummern genommen.
 */
export function extractMatrikel(rows: Cell[][], column?: string): ExtractResult {
  const nonEmpty = rows.filter((r) => r.some((c) => cellText(c).trim() !== ''));
  if (nonEmpty.length === 0) throw badRequest('EMPTY_FILE', 'Die Datei enthält keine Daten');

  const first = nonEmpty[0]!;
  const hasHeader =
    first.every((c) => cellToMatrikel(c) === null) && first.some((c) => typeof c === 'string');
  const header = hasHeader ? first.map((c) => cellText(c).trim()) : [];
  const dataRows = hasHeader ? nonEmpty.slice(1) : nonEmpty;
  const width = Math.max(...nonEmpty.map((r) => r.length));

  let index: number;
  if (column !== undefined && column.trim() !== '') {
    const wanted = column.trim();
    if (/^\d+$/.test(wanted)) {
      index = Number(wanted) - 1;
    } else {
      index = header.findIndex((h) => h.toLowerCase() === wanted.toLowerCase());
    }
    if (index < 0 || index >= width) {
      throw badRequest('UNKNOWN_COLUMN', `Spalte "${wanted}" nicht gefunden`);
    }
  } else {
    let best = -1;
    let bestCount = 0;
    for (let i = 0; i < width; i++) {
      const count = dataRows.filter((r) => cellToMatrikel(r[i]) !== null).length;
      if (count > bestCount) {
        best = i;
        bestCount = count;
      }
    }
    if (best < 0) {
      throw badRequest('NO_MATRIKEL_COLUMN', 'Keine Spalte mit Matrikelnummern gefunden');
    }
    index = best;
  }

  const values: ExtractResult['values'] = [];
  const invalid: ExtractResult['invalid'] = [];
  const offset = hasHeader ? 2 : 1;
  dataRows.forEach((r, i) => {
    const raw = r[index];
    const text = cellText(raw).trim();
    if (text === '') return;
    const value = cellToMatrikel(raw);
    if (value) values.push({ row: i + offset, value });
    else invalid.push({ row: i + offset, value: text.slice(0, 50) });
  });

  return {
    column: header[index] || `Spalte ${index + 1}`,
    hasHeader,
    rows: dataRows.length,
    values,
    invalid,
  };
}
