import { addDays, previousDay, startOfWeek, weekDates } from '../week';

describe('startOfWeek', () => {
  it('returns the same date when it is already a Monday', () => {
    expect(startOfWeek('2026-07-06')).toBe('2026-07-06');
  });

  it('rolls back to Monday for a mid-week date', () => {
    expect(startOfWeek('2026-07-09')).toBe('2026-07-06'); // Thursday
  });

  it('rolls back a Sunday to the preceding Monday', () => {
    expect(startOfWeek('2026-07-12')).toBe('2026-07-06');
  });
});

describe('weekDates', () => {
  it('returns 7 consecutive dates starting Monday', () => {
    expect(weekDates('2026-07-06')).toEqual([
      '2026-07-06',
      '2026-07-07',
      '2026-07-08',
      '2026-07-09',
      '2026-07-10',
      '2026-07-11',
      '2026-07-12',
    ]);
  });

  it('handles a month boundary', () => {
    expect(weekDates('2026-06-29')).toEqual([
      '2026-06-29',
      '2026-06-30',
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
      '2026-07-04',
      '2026-07-05',
    ]);
  });
});

describe('previousDay / addDays', () => {
  it('steps back one day across a month boundary', () => {
    expect(previousDay('2026-07-01')).toBe('2026-06-30');
  });

  it('adds days across a month boundary', () => {
    expect(addDays('2026-06-29', 3)).toBe('2026-07-02');
  });
});
