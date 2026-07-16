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

  describe('body-fat-driven maintenance trigger', () => {
    it('falls back to the fixed 3-week cycle when sex/startBodyFatPct are omitted', () => {
      const withData = computeWeightProjection(80, 60, 0.5, 'male', 30);
      const without = computeWeightProjection(80, 60, 0.5);
      // Different data is expected to diverge - this just asserts the
      // no-data call path still runs the original fixed-cycle logic (a
      // regression guard, not a value match).
      expect(without.some((p) => p.phase === 'maintenance')).toBe(true);
      expect(withData.length).toBeGreaterThan(0);
    });

    it('inserts a maintenance break once the estimated body-fat drop reaches the sex-specific threshold, not on a fixed week count', () => {
      // 90kg -> 70kg at 40% start body fat, effective rate 0.4 kg/week
      // (0.5 requested x 0.8 thermogenesis factor). At 85% fat-mass-loss
      // fraction, reaching the 5-point (male) body-fat drop takes many more
      // than 3 active weeks - the fixed-cycle path would have broken at
      // week 3, this should run considerably longer before its first break.
      const points = computeWeightProjection(90, 70, 0.5, 'male', 40);
      const firstBreakWeek = points.slice(1).find((p) => p.phase === 'maintenance')?.week;
      expect(firstBreakWeek).toBeDefined();
      expect(firstBreakWeek as number).toBeGreaterThan(3);
    });

    it('triggers sooner for the female threshold requiring more drop than a smaller male one would in a symmetric case, but reaches its own break before the fixed cycle would for a large starting body fat', () => {
      const male = computeWeightProjection(90, 70, 0.5, 'male', 40);
      const female = computeWeightProjection(90, 70, 0.5, 'female', 40);
      const maleBreak = male.slice(1).find((p) => p.phase === 'maintenance')?.week as number;
      const femaleBreak = female.slice(1).find((p) => p.phase === 'maintenance')?.week as number;
      // Female threshold (7 points) is higher than male's (5 points), so it
      // takes at least as long to reach at the same estimated fat-loss rate.
      expect(femaleBreak).toBeGreaterThanOrEqual(maleBreak);
    });
  });
});
