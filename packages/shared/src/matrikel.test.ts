import { describe, expect, it } from 'vitest';
import { isValidMatrikel, normalizeMatrikel, parseMatrikelList } from './matrikel.js';

describe('isValidMatrikel', () => {
  it.each(['53902', '00001', '99999'])('%s ist gültig', (v) =>
    expect(isValidMatrikel(v)).toBe(true),
  );
  it.each(['5390', '539021', '5390a', '', ' 53902'])('%j ist ungültig', (v) =>
    expect(isValidMatrikel(v)).toBe(false),
  );
});

describe('normalizeMatrikel', () => {
  it('entfernt Leerzeichen und Trennzeichen', () => {
    expect(normalizeMatrikel(' 53 902 ')).toBe('53902');
    expect(normalizeMatrikel('53.902')).toBe('53902');
    expect(normalizeMatrikel("'53902")).toBe('53902');
  });
});

describe('parseMatrikelList', () => {
  it('verarbeitet Copy-Paste mit gemischten Trennzeichen', () => {
    const result = parseMatrikelList('53902\n12345; 54321,\t11111\r\n\n 22 222 ');
    expect(result.valid).toEqual(['53902', '12345', '54321', '11111', '22222']);
    expect(result.invalid).toEqual([]);
    expect(result.duplicates).toEqual([]);
  });

  it('meldet Duplikate und ungültige Einträge', () => {
    const result = parseMatrikelList('53902\n53902\nabc\n1234\n53902\n00007');
    expect(result.valid).toEqual(['53902', '00007']);
    expect(result.duplicates).toEqual(['53902']);
    expect(result.invalid).toEqual(['abc', '1234']);
  });
});
