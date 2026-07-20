import { countPlannedDays } from '../weeklyRecap';

describe('countPlannedDays', () => {
  const weekDates = ['2026-07-13', '2026-07-14', '2026-07-15', '2026-07-16', '2026-07-17', '2026-07-18', '2026-07-19'];

  it('counts distinct dates with at least one meal row', () => {
    const meals = [
      { date: '2026-07-13' },
      { date: '2026-07-13' }, // same day, multiple meals - still counts once
      { date: '2026-07-15' },
    ];
    expect(countPlannedDays(meals, weekDates)).toBe(2);
  });

  it('returns 0 when nothing is planned', () => {
    expect(countPlannedDays([], weekDates)).toBe(0);
  });

  it('returns the full week length when every day has a meal', () => {
    const meals = weekDates.map((date) => ({ date }));
    expect(countPlannedDays(meals, weekDates)).toBe(7);
  });

  it('ignores meal dates outside the given week', () => {
    const meals = [{ date: '2026-07-01' }, { date: '2026-07-13' }];
    expect(countPlannedDays(meals, weekDates)).toBe(1);
  });
});
