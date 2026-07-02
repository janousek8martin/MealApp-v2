import { applyWorkoutDayCycling, isTrainingDay } from '../workoutDays';

// 2026-07-06 is a Monday (isoWeekday 1); 2026-07-05 is the Sunday before it (isoWeekday 7).
const MONDAY = '2026-07-06';
const TUESDAY = '2026-07-07';
const SUNDAY = '2026-07-05';

describe('isTrainingDay', () => {
  it('matches the ISO weekday against the workout-days list', () => {
    expect(isTrainingDay([1, 3, 5], MONDAY)).toBe(true);
    expect(isTrainingDay([1, 3, 5], TUESDAY)).toBe(false);
  });
});

describe('applyWorkoutDayCycling', () => {
  const base = { kcal: 2500, proteinG: 150, carbsG: 280, fatG: 70 };

  it('returns the base target unchanged when there are no training days', () => {
    expect(applyWorkoutDayCycling(base, [], MONDAY)).toEqual(base);
  });

  it('returns the base target unchanged when every day is a training day', () => {
    expect(applyWorkoutDayCycling(base, [1, 2, 3, 4, 5, 6, 7], MONDAY)).toEqual(base);
  });

  it('adds the +12% kcal bonus entirely to carbs on a training day', () => {
    const result = applyWorkoutDayCycling(base, [1, 3, 5], MONDAY);
    expect(result.kcal).toBeCloseTo(2800, 5);
    expect(result.proteinG).toBe(150);
    expect(result.fatG).toBe(70);
    expect(result.carbsG).toBeCloseTo(355, 5);
  });

  it('reduces rest-day kcal so the weekly average still equals the base target', () => {
    const result = applyWorkoutDayCycling(base, [1, 3, 5], TUESDAY);
    expect(result.kcal).toBeCloseTo(2275, 5);
    expect(result.proteinG).toBe(150);
    expect(result.carbsG).toBeCloseTo(223.75, 5);
    expect(result.fatG).toBe(70);

    // Weekly average check: 3 training days + 4 rest days = 7×base.kcal.
    const trainingKcal = applyWorkoutDayCycling(base, [1, 3, 5], MONDAY).kcal;
    const weeklyTotal = trainingKcal * 3 + result.kcal * 4;
    expect(weeklyTotal).toBeCloseTo(base.kcal * 7, 5);
  });

  it('never drops protein and never drops fat below the 20 % floor, even under a large deficit', () => {
    const tightBase = { kcal: 2000, proteinG: 150, carbsG: 50, fatG: 100 };
    // 6 training days / 1 rest day (Sunday) → a large rest-day deficit that exhausts carbs.
    const result = applyWorkoutDayCycling(tightBase, [1, 2, 3, 4, 5, 6], SUNDAY);
    expect(result.proteinG).toBe(150);
    expect(result.carbsG).toBe(0);
    expect(result.fatG).toBeCloseTo(0.2 * result.kcal / 9, 5);
  });
});
