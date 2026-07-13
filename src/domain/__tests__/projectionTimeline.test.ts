import { formatProjectionSummary } from '../projectionTimeline';
import type { ProjectionPoint } from '../projection';

describe('formatProjectionSummary', () => {
  it('computes weeks and end date from the last projection point', () => {
    const projection: ProjectionPoint[] = [
      { week: 0, weightKg: 80, phase: 'maintenance' },
      { week: 1, weightKg: 79.5, phase: 'deficit' },
      { week: 2, weightKg: 79, phase: 'deficit' },
    ];
    const result = formatProjectionSummary(projection, '2026-07-13');
    expect(result.weeks).toBe(2);
    expect(result.endDateIso).toBe('2026-07-27');
  });

  it('returns 0 weeks and the start date for a single-point projection (goal already met)', () => {
    const projection: ProjectionPoint[] = [{ week: 0, weightKg: 80, phase: 'maintenance' }];
    const result = formatProjectionSummary(projection, '2026-07-13');
    expect(result.weeks).toBe(0);
    expect(result.endDateIso).toBe('2026-07-13');
  });
});
