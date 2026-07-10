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

  it('projects a weight-loss goal at a steady rate before any maintenance break', () => {
    const points = computeWeightProjection(80, 75, 0.5);
    // 10 deficit weeks at 0.5 kg/week = 5 kg, so all 10 active weeks land before goal.
    const first10 = points.slice(1, 11);
    expect(first10).toHaveLength(10);
    expect(first10.every((p) => p.phase === 'deficit')).toBe(true);
    expect(first10[9].weightKg).toBeCloseTo(75, 5);
  });

  it('inserts a maintenance break after 10 active weeks when the goal needs more', () => {
    const points = computeWeightProjection(90, 75, 0.5);
    // 15 kg to lose at 0.5 kg/week needs 30 active weeks - more than the 10-week block.
    const week10 = points.find((p) => p.week === 10)!;
    const week11 = points.find((p) => p.week === 11)!;
    const week12 = points.find((p) => p.week === 12)!;
    expect(week10.phase).toBe('deficit');
    expect(week11.phase).toBe('maintenance');
    expect(week12.phase).toBe('maintenance');
    expect(week11.weightKg).toBeCloseTo(week10.weightKg, 5);
    const week13 = points.find((p) => p.week === 13)!;
    expect(week13.phase).toBe('deficit');
  });

  it('reaches exactly the goal weight on the final point without overshooting', () => {
    const points = computeWeightProjection(82, 80, 0.7);
    expect(points[points.length - 1].weightKg).toBeCloseTo(80, 5);
  });

  it('projects a muscle-gain goal upward using the surplus phase', () => {
    const points = computeWeightProjection(70, 73, 0.25);
    expect(points[points.length - 1].weightKg).toBeCloseTo(73, 5);
    expect(points.slice(1).some((p) => p.phase === 'surplus')).toBe(true);
    expect(points.slice(1).some((p) => p.phase === 'deficit')).toBe(false);
  });
});
