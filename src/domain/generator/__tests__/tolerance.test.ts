import { isWithinDailyTolerance } from '../tolerance';

const target = { kcal: 2000, proteinG: 150, carbsG: 200, fatG: 60 };

describe('isWithinDailyTolerance', () => {
  it('accepts an exact match', () => {
    expect(isWithinDailyTolerance(target, target)).toBe(true);
  });

  it('accepts kcal within ±100', () => {
    expect(isWithinDailyTolerance({ ...target, kcal: 2095 }, target)).toBe(true);
    expect(isWithinDailyTolerance({ ...target, kcal: 1905 }, target)).toBe(true);
  });

  it('rejects kcal beyond ±100', () => {
    expect(isWithinDailyTolerance({ ...target, kcal: 2101 }, target)).toBe(false);
    expect(isWithinDailyTolerance({ ...target, kcal: 1899 }, target)).toBe(false);
  });

  it('rejects protein beyond ±10%', () => {
    expect(isWithinDailyTolerance({ ...target, proteinG: 150 * 1.11 }, target)).toBe(false);
  });

  it('accepts protein within ±10%', () => {
    expect(isWithinDailyTolerance({ ...target, proteinG: 150 * 1.09 }, target)).toBe(true);
  });

  it('rejects fat beyond ±20%', () => {
    expect(isWithinDailyTolerance({ ...target, fatG: 60 * 1.21 }, target)).toBe(false);
  });

  it('accepts fat within ±20%', () => {
    expect(isWithinDailyTolerance({ ...target, fatG: 60 * 1.19 }, target)).toBe(true);
  });

  it('rejects carbs beyond ±25%', () => {
    expect(isWithinDailyTolerance({ ...target, carbsG: 200 * 1.26 }, target)).toBe(false);
  });

  it('accepts carbs within ±25%', () => {
    expect(isWithinDailyTolerance({ ...target, carbsG: 200 * 1.24 }, target)).toBe(true);
  });

  it('does not divide by zero when a macro target is 0', () => {
    expect(isWithinDailyTolerance({ kcal: 0, proteinG: 5, carbsG: 0, fatG: 0 }, { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 })).toBe(true);
  });
});
