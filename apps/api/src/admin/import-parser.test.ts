import { describe, expect, it } from 'vitest';
import { cellToMatrikel, detectFormat, extractMatrikel, readRows } from './import-parser.js';

describe('cellToMatrikel', () => {
  it('Zahlen aus Excel werden auf 5 Stellen aufgefüllt', () => {
    expect(cellToMatrikel(53902)).toBe('53902');
    expect(cellToMatrikel(123)).toBe('00123');
  });

  it('ungültige Werte', () => {
    expect(cellToMatrikel(123456)).toBeNull();
    expect(cellToMatrikel(5.5)).toBeNull();
    expect(cellToMatrikel(0)).toBeNull();
    expect(cellToMatrikel('abc')).toBeNull();
    expect(cellToMatrikel(null)).toBeNull();
  });

  it('Text wird normalisiert', () => {
    expect(cellToMatrikel(' 53 902 ')).toBe('53902');
  });
});

describe('readRows (CSV)', () => {
  it('erkennt Semikolon als Trennzeichen und entfernt das BOM', async () => {
    const csv = Buffer.from('﻿Name;Matrikel\nAnna;53902\nBen;12345\n');
    expect(await readRows('csv', csv)).toEqual([
      ['Name', 'Matrikel'],
      ['Anna', '53902'],
      ['Ben', '12345'],
    ]);
  });

  it('Komma und Tab funktionieren ebenfalls', async () => {
    expect(await readRows('csv', Buffer.from('a,b\n1,2'))).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(await readRows('csv', Buffer.from('a\tb\n1\t2'))).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
});

describe('detectFormat', () => {
  it('erkennt XLSX an der ZIP-Signatur oder Endung', () => {
    expect(detectFormat('x.bin', Buffer.from([0x50, 0x4b, 0x03, 0x04, 0]))).toBe('xlsx');
    expect(detectFormat('liste.XLSX', Buffer.from('egal'))).toBe('xlsx');
    expect(detectFormat('liste.csv', Buffer.from('53902'))).toBe('csv');
  });
});

describe('extractMatrikel', () => {
  it('findet die Matrikel-Spalte automatisch und erkennt die Überschrift', () => {
    const r = extractMatrikel([
      ['Name', 'Mat.-Nr.', 'Fachschaft'],
      ['Anna', '53902', 'EI'],
      ['Ben', 12345, 'EI'],
      ['Cem', 'fehlt', 'IA'],
    ]);
    expect(r.column).toBe('Mat.-Nr.');
    expect(r.hasHeader).toBe(true);
    expect(r.values).toEqual([
      { row: 2, value: '53902' },
      { row: 3, value: '12345' },
    ]);
    expect(r.invalid).toEqual([{ row: 4, value: 'fehlt' }]);
  });

  it('einspaltige Liste ohne Überschrift', () => {
    const r = extractMatrikel([['53902'], ['12345'], [''], ['54321']]);
    expect(r).toMatchObject({ hasHeader: false, column: 'Spalte 1', rows: 3 });
    expect(r.values.map((v) => v.value)).toEqual(['53902', '12345', '54321']);
  });

  it('Spalte per Überschrift oder Nummer wählbar', () => {
    const rows = [
      ['Alt', 'Neu'],
      ['11111', '22222'],
    ];
    expect(extractMatrikel(rows, 'neu').values[0]!.value).toBe('22222');
    expect(extractMatrikel(rows, '1').values[0]!.value).toBe('11111');
    expect(() => extractMatrikel(rows, 'gibtsnicht')).toThrow(/nicht gefunden/);
    expect(() => extractMatrikel(rows, '5')).toThrow(/nicht gefunden/);
  });

  it('Fehler bei leerer Datei oder ohne Matrikel-Spalte', () => {
    expect(() => extractMatrikel([])).toThrow(/keine Daten/);
    expect(() => extractMatrikel([['Name'], ['Anna']])).toThrow(/Keine Spalte/);
  });
});
