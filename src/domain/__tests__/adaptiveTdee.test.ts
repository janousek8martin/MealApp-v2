import { estimateAdaptiveTdee, type LoggedDailyKcal, type WeighIn } from '../adaptiveTdee';

function datesFrom(startIso: string, offsets: number[]): string[] {
  const start = new Date(startIso + 'T00:00:00Z').getTime();
  return offsets.map((offset) => new Date(start + offset * 86400000).toISOString().slice(0, 10));
}

describe('estimateAdaptiveTdee', () => {
  it('happy path: computes an estimate with enough weight and intake data', () => {
    // 21-day window, weight drops 0.7kg over 20 days (deficit), avg intake 2200 kcal logged on 12 days.
    const dates = datesFrom('2026-01-01', [0, 7, 13, 20]);
    const weighIns: WeighIn[] = [
      { date: dates[0], weightKg: 80 },
      { date: dates[1], weightKg: 79.7 },
      { date: dates[2], weightKg: 79.5 },
      { date: dates[3], weightKg: 79.3 },
    ];
    const loggedDailyKcal: LoggedDailyKcal[] = Array.from({ length: 12 }, (_, i) => ({
      date: datesFrom('2026-01-01', [i])[0],
      kcal: 2200,
    }));

    const result = estimateAdaptiveTdee({ weighIns, loggedDailyKcal, windowDays: 21 });

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.spanDays).toBe(20);
    expect(result.loggedDaysCount).toBe(12);
    // Weight trending down -> estimated TDEE should exceed average logged intake.
    expect(result.estimatedTdeeKcal).toBeGreaterThan(2200);
    expect(result.weightTrendKgPerWeek).toBeLessThan(0);
  });

  it('returns insufficient_data with reason "weight" when there are too few weigh-ins', () => {
    const dates = datesFrom('2026-01-01', [0, 15]);
    const weighIns: WeighIn[] = [
      { date: dates[0], weightKg: 80 },
      { date: dates[1], weightKg: 79 },
    ];
    const loggedDailyKcal: LoggedDailyKcal[] = Array.from({ length: 10 }, (_, i) => ({
      date: datesFrom('2026-01-01', [i])[0],
      kcal: 2000,
    }));

    const result = estimateAdaptiveTdee({ weighIns, loggedDailyKcal, windowDays: 21 });
    expect(result).toEqual({ status: 'insufficient_data', reason: 'weight' });
  });

  it('returns insufficient_data with reason "weight" when weigh-ins are not spread out enough', () => {
    // 4 weigh-ins but all within 5 days - span too short even though count is fine.
    const dates = datesFrom('2026-01-01', [0, 2, 4, 5]);
    const weighIns: WeighIn[] = dates.map((date, i) => ({ date, weightKg: 80 - i * 0.1 }));
    const loggedDailyKcal: LoggedDailyKcal[] = Array.from({ length: 10 }, (_, i) => ({
      date: datesFrom('2026-01-01', [i])[0],
      kcal: 2000,
    }));

    const result = estimateAdaptiveTdee({ weighIns, loggedDailyKcal, windowDays: 21 });
    expect(result).toEqual({ status: 'insufficient_data', reason: 'weight' });
  });

  it('returns insufficient_data with reason "intake" when too few days are logged', () => {
    const dates = datesFrom('2026-01-01', [0, 7, 13, 20]);
    const weighIns: WeighIn[] = dates.map((date, i) => ({ date, weightKg: 80 - i * 0.2 }));
    const loggedDailyKcal: LoggedDailyKcal[] = Array.from({ length: 3 }, (_, i) => ({
      date: datesFrom('2026-01-01', [i])[0],
      kcal: 2000,
    }));

    const result = estimateAdaptiveTdee({ weighIns, loggedDailyKcal, windowDays: 21 });
    expect(result).toEqual({ status: 'insufficient_data', reason: 'intake' });
  });

  it('returns insufficient_data with reason "both" when neither weight nor intake data is enough', () => {
    const weighIns: WeighIn[] = [{ date: '2026-01-01', weightKg: 80 }];
    const loggedDailyKcal: LoggedDailyKcal[] = [{ date: '2026-01-01', kcal: 2000 }];

    const result = estimateAdaptiveTdee({ weighIns, loggedDailyKcal, windowDays: 21 });
    expect(result).toEqual({ status: 'insufficient_data', reason: 'both' });
  });

  it('uses the observed span between weigh-ins (spanDays), not windowDays, when data covers only part of the window', () => {
    // Weight data only spans 12 of the 21 requested window days.
    const dates = datesFrom('2026-01-01', [0, 4, 8, 12]);
    const weighIns: WeighIn[] = [
      { date: dates[0], weightKg: 80 },
      { date: dates[1], weightKg: 79.6 },
      { date: dates[2], weightKg: 79.2 },
      { date: dates[3], weightKg: 78.8 },
    ];
    const loggedDailyKcal: LoggedDailyKcal[] = Array.from({ length: 8 }, (_, i) => ({
      date: datesFrom('2026-01-01', [i])[0],
      kcal: 2100,
    }));

    const result = estimateAdaptiveTdee({ weighIns, loggedDailyKcal, windowDays: 21 });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    // spanDays reflects the actual observed weigh-in range (12), not the nominal windowDays (21).
    expect(result.spanDays).toBe(12);

    // Sanity: re-deriving the estimate manually from spanDays (not windowDays) should match exactly.
    const slopeKgPerDay = (78.8 - 80) / 12;
    const expectedTdee = 2100 - (slopeKgPerDay * 12 * 7700) / 12;
    expect(result.estimatedTdeeKcal).toBeCloseTo(expectedTdee, 5);
  });

  it('a weight gain (surplus) yields an estimated TDEE below average logged intake', () => {
    const dates = datesFrom('2026-01-01', [0, 6, 12, 18]);
    const weighIns: WeighIn[] = [
      { date: dates[0], weightKg: 70 },
      { date: dates[1], weightKg: 70.3 },
      { date: dates[2], weightKg: 70.6 },
      { date: dates[3], weightKg: 70.9 },
    ];
    const loggedDailyKcal: LoggedDailyKcal[] = Array.from({ length: 10 }, (_, i) => ({
      date: datesFrom('2026-01-01', [i])[0],
      kcal: 3000,
    }));

    const result = estimateAdaptiveTdee({ weighIns, loggedDailyKcal, windowDays: 21 });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.estimatedTdeeKcal).toBeLessThan(3000);
    expect(result.weightTrendKgPerWeek).toBeGreaterThan(0);
  });

  it('a weight loss (deficit) yields an estimated TDEE above average logged intake', () => {
    const dates = datesFrom('2026-01-01', [0, 6, 12, 18]);
    const weighIns: WeighIn[] = [
      { date: dates[0], weightKg: 90 },
      { date: dates[1], weightKg: 89.6 },
      { date: dates[2], weightKg: 89.2 },
      { date: dates[3], weightKg: 88.8 },
    ];
    const loggedDailyKcal: LoggedDailyKcal[] = Array.from({ length: 10 }, (_, i) => ({
      date: datesFrom('2026-01-01', [i])[0],
      kcal: 2000,
    }));

    const result = estimateAdaptiveTdee({ weighIns, loggedDailyKcal, windowDays: 21 });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.estimatedTdeeKcal).toBeGreaterThan(2000);
    expect(result.weightTrendKgPerWeek).toBeLessThan(0);
  });

  it('does not treat a day with no logged meal as 0 kcal - it is simply absent from the average', () => {
    // Flat weight (no trend) isolates the intake side of the formula: with
    // zero weight change, estimatedTdeeKcal must equal the average of only
    // the logged days, not the 21-day window diluted by unlogged zeros.
    const dates = datesFrom('2026-01-01', [0, 7, 13, 20]);
    const weighIns: WeighIn[] = dates.map((date) => ({ date, weightKg: 80 }));
    // Only 6 days logged (out of a 21-day window) - gaps are simply absent, not zero.
    const loggedDailyKcal: LoggedDailyKcal[] = [0, 2, 5, 10, 15, 19].map((offset) => ({
      date: datesFrom('2026-01-01', [offset])[0],
      kcal: 2500,
    }));

    const result = estimateAdaptiveTdee({ weighIns, loggedDailyKcal, windowDays: 21 });
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.loggedDaysCount).toBe(6);
    // If the 15 unlogged window days had silently counted as 0 kcal, the
    // average would collapse toward ~2500*6/21 ≈ 714 instead of staying 2500.
    expect(result.estimatedTdeeKcal).toBeCloseTo(2500, 5);
  });
});
