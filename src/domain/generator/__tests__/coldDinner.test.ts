import { isColdDinnerDay, pickColdDinnerDates } from '../coldDinner';
import { addDays, startOfWeek, weekDates } from '../../week';

const MONDAY = startOfWeek('2031-03-12');
const DATES = weekDates(MONDAY);

describe('pickColdDinnerDates', () => {
  it('returns an empty set when frequency is 0', () => {
    expect(pickColdDinnerDates(DATES, 'household-a', 0).size).toBe(0);
  });

  it('returns exactly `frequencyPerWeek` dates when within range', () => {
    expect(pickColdDinnerDates(DATES, 'household-a', 3).size).toBe(3);
  });

  it('clamps frequency above 7 to the full week', () => {
    expect(pickColdDinnerDates(DATES, 'household-a', 99).size).toBe(DATES.length);
  });

  it('clamps a negative frequency to 0', () => {
    expect(pickColdDinnerDates(DATES, 'household-a', -2).size).toBe(0);
  });

  it('is deterministic for the same (householdId, week)', () => {
    const first = pickColdDinnerDates(DATES, 'household-a', 2);
    const second = pickColdDinnerDates(DATES, 'household-a', 2);
    expect([...first].sort()).toEqual([...second].sort());
  });

  it('only ever picks from the given week dates', () => {
    const picked = pickColdDinnerDates(DATES, 'household-a', 4);
    for (const date of picked) expect(DATES).toContain(date);
  });

  it('differs between households sharing the same week (not guaranteed every time, but not identical in this fixture)', () => {
    const a = pickColdDinnerDates(DATES, 'household-a', 3);
    const b = pickColdDinnerDates(DATES, 'household-b', 3);
    expect([...a].sort()).not.toEqual([...b].sort());
  });

  it('differs between weeks for the same household (not guaranteed every time, but not identical in this fixture)', () => {
    const nextMonday = addDays(MONDAY, 7);
    const otherWeekDates = weekDates(nextMonday);
    const week1 = pickColdDinnerDates(DATES, 'household-a', 3);
    const week2 = pickColdDinnerDates(otherWeekDates, 'household-a', 3);
    expect([...week1].sort()).not.toEqual([...week2].sort());
  });
});

describe('isColdDinnerDay', () => {
  it('agrees with pickColdDinnerDates for every date in the week', () => {
    const picked = pickColdDinnerDates(DATES, 'household-a', 3);
    for (const date of DATES) {
      expect(isColdDinnerDay(date, 'household-a', 3)).toBe(picked.has(date));
    }
  });

  it('is false for every date when frequency is 0', () => {
    for (const date of DATES) {
      expect(isColdDinnerDay(date, 'household-a', 0)).toBe(false);
    }
  });
});
