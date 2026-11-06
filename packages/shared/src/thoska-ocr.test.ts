import { describe, expect, it } from 'vitest';
import { majorityVote, parseThoskaText } from './thoska-ocr.js';

const today = { year: 2026, month: 11, day: 6 };

describe('parseThoskaText', () => {
  it('erkennt beide Felder über die Anker', () => {
    const r = parseThoskaText('Gcthe\nKai\ngeb. 27.07.1994\nMatrikel-Nr. 53902', today);
    expect(r).toMatchObject({
      matrikel: '53902',
      birthDate: '1994-07-27',
      anchors: { geb: true, nr: true },
    });
  });

  it('toleriert fehlende Punkte und Leerzeichen', () => {
    const r = parseThoskaText('geb 27071994 Nr 53902', today);
    expect(r.birthDate).toBe('1994-07-27');
    expect(r.matrikel).toBe('53902');
  });

  it('ignoriert das Semesterticket-Datum ("gültig bis")', () => {
    const r = parseThoskaText('27.07.1994 53902 Semesterticket gultig bis 30.09.2018', today);
    expect(r.birthDate).toBe('1994-07-27');
    expect(r.birthDateCandidates).toEqual(['1994-07-27']);
  });

  it('nur das Semesterticket-Datum → kein Geburtsdatum', () => {
    expect(parseThoskaText('gultig bis 30.09.2018', today).birthDate).toBeNull();
  });

  it('Datum in der Zukunft ist kein Geburtsdatum', () => {
    expect(parseThoskaText('12.12.2030 53902', today).birthDate).toBeNull();
  });

  it('mehrdeutig → null, aber Kandidaten bleiben sichtbar', () => {
    const r = parseThoskaText('11111 22222 01.01.2000 02.02.2001', today);
    expect(r.matrikel).toBeNull();
    expect(r.birthDate).toBeNull();
    expect(r.matrikelCandidates).toEqual(['11111', '22222']);
    expect(r.birthDateCandidates).toEqual(['2000-01-01', '2001-02-02']);
  });

  it('unvollständige Matrikelnummer wird nicht erkannt', () => {
    expect(parseThoskaText('eb. 27.07.1994 Matrikel-Nr. 5390', today).matrikel).toBeNull();
  });

  it('Anker "Nr." hat Vorrang vor anderen 5-stelligen Zahlen', () => {
    expect(parseThoskaText('98765 Matrikel-Nr. 53902', today).matrikel).toBe('53902');
  });
});

describe('majorityVote', () => {
  it('liefert den häufigsten Wert ab der Mindestanzahl', () => {
    expect(majorityVote(['a', null, 'a', 'b', 'a'], 3)).toBe('a');
  });

  it('null, wenn zu selten', () => {
    expect(majorityVote(['a', 'b', null, 'a'], 3)).toBeNull();
  });

  it('Beispiel aus dem M1-Log: Datum selten, aber 2× gleich', () => {
    const dates = [null, null, null, '1994-07-27', null, '1994-07-27'];
    expect(majorityVote(dates, 2)).toBe('1994-07-27');
  });
});
