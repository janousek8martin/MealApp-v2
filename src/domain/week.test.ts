import { addMonths, daysInCalendarMonth, monthGridDates } from './week';

describe('addMonths', () => {
  it('adds whole months', () => {
    expect(addMonths('2026-07-15', 1)).toBe('2026-08-15');
    expect(addMonths('2026-07-15', -1)).toBe('2026-06-15');
  });

  it('clamps to the target month length', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2024-01-31', 1)).toBe('2024-02-29'); // leap year
  });

  it('crosses year boundaries', () => {
    expect(addMonths('2026-12-05', 1)).toBe('2027-01-05');
    expect(addMonths('2026-01-05', -1)).toBe('2025-12-05');
  });
});

describe('daysInCalendarMonth', () => {
  it('returns every day of a 31-day month', () => {
    const days = daysInCalendarMonth('2026-07-15');
    expect(days).toHaveLength(31);
    expect(days[0]).toBe('2026-07-01');
    expect(days[30]).toBe('2026-07-31');
  });

  it('handles February in a leap year', () => {
    const days = daysInCalendarMonth('2024-02-10');
    expect(days).toHaveLength(29);
    expect(days[28]).toBe('2024-02-29');
  });
});

describe('monthGridDates', () => {
  it('returns 42 dates starting on a Monday', () => {
    const grid = monthGridDates('2026-07-15');
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe('2026-06-29'); // Monday before July 1, 2026 (Wed)
  });

  it('covers every day of the month', () => {
    const grid = monthGridDates('2026-02-10');
    expect(grid).toContain('2026-02-01');
    expect(grid).toContain('2026-02-28');
  });
});
