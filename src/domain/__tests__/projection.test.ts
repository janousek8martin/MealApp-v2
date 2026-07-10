import { computeWeightProjection } from '../projection';

describe('computeWeightProjection', () => {
  it('returns just the starting point when goal already equals current weight', () => {
    const points = computeWeightProjection(80, 80, 0.5);
    expect(points).toEqual([{ week: 0, weightKg: 80, phase: 'maintenance' }]);
  });

  it('returns just the starting point when rate is zero', () => {
    const points = computeWeightProjection(80, 70, 0);
    expect(points).toEqual([{ week: 0, weightKg: 80, phase: 'maintenance' }]);
  });

  it('projects a weight-loss goal at the thermogenesis-adjusted rate before any maintenance break', () => {
    // Requested 0.5 kg/week is scaled by ADAPTIVE_THERMOGENESIS_FACTOR (0.8) to
    // an effective 0.4 kg/week; 3 active weeks (MAINTENANCE_PHASE.deficitWeeks)
    // at 0.4 kg/week = 1.2 kg, exactly the goal here, so no break is needed.
    const points = computeWeightProjection(80, 78.8, 0.5);
    const first3 = points.slice(1, 4);
    expect(first3).toHaveLength(3);
    expect(first3.every((p) => p.phase === 'deficit')).toBe(true);
    expect(first3[2].weightKg).toBeCloseTo(78.8, 5);
  });

  it('inserts a 1-week maintenance break after 3 active weeks when the goal needs more', () => {
    // 2 kg to lose at an effective 0.4 kg/week (0.5 requested x 0.8 factor)
    // needs more than the first 3-week block.
    const points = computeWeightProjection(80, 78, 0.5);
    const week3 = points.find((p) => p.week === 3)!;
    const week4 = points.find((p) => p.week === 4)!;
    const week5 = points.find((p) => p.week === 5)!;
    expect(week3.phase).toBe('deficit');
    expect(week4.phase).toBe('maintenance');
    expect(week4.weightKg).toBeCloseTo(week3.weightKg, 5);
    expect(week5.phase).toBe('deficit');
    expect(points[points.length - 1].weightKg).toBeCloseTo(78, 5);
  });

  it('reaches exactly the goal weight on the final point without overshooting', () => {
    const points = computeWeightProjection(82, 80, 0.7);
    expect(points[points.length - 1].weightKg).toBeCloseTo(80, 5);
  });

  it('projects a muscle-gain goal upward using the surplus phase, as a straight line with no breaks or thermogenesis correction', () => {
    const points = computeWeightProjection(70, 73, 0.25);
    expect(points[points.length - 1].weightKg).toBeCloseTo(73, 5);
    expect(points.slice(1).some((p) => p.phase === 'surplus')).toBe(true);
    expect(points.slice(1).some((p) => p.phase === 'deficit')).toBe(false);
    // No maintenance breaks during a bulk (rešerše-c) - every point after the
    // start should be a surplus week at the full, uncorrected rate.
    expect(points.slice(1).every((p) => p.phase === 'surplus')).toBe(true);
    expect(points[1].weightKg).toBeCloseTo(70.25, 5);
  });
});
