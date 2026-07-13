import { countConsecutiveDays } from '../streak';

describe('countConsecutiveDays', () => {
  it('returns 0 for an empty set', () => {
    expect(countConsecutiveDays(new Set(), '2026-07-14')).toBe(0);
  });

  it('counts a consecutive run ending today', () => {
    const dates = new Set(['2026-07-12', '2026-07-13', '2026-07-14']);
    expect(countConsecutiveDays(dates, '2026-07-14')).toBe(3);
  });

  it('counts a consecutive run ending yesterday when today does not yet qualify', () => {
    const dates = new Set(['2026-07-12', '2026-07-13']);
    expect(countConsecutiveDays(dates, '2026-07-14')).toBe(2);
  });

  it('a gap breaks the count', () => {
    const dates = new Set(['2026-07-10', '2026-07-13', '2026-07-14']);
    expect(countConsecutiveDays(dates, '2026-07-14')).toBe(2);
  });

  it('respects maxLookbackDays', () => {
    const dates = new Set<string>();
    let cursor = '2026-07-14';
    for (let i = 0; i < 10; i++) {
      dates.add(cursor);
      cursor = new Date(new Date(cursor).getTime() - 86400000).toISOString().slice(0, 10);
    }
    expect(countConsecutiveDays(dates, '2026-07-14', 5)).toBe(5);
  });
});
