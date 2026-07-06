import { jumpDirection, paneDates, weekJumpTarget } from '../planPager';

describe('jumpDirection', () => {
  it('slides forward for a later date', () => {
    expect(jumpDirection('2026-07-06', '2026-07-09')).toBe(1);
  });

  it('slides backward for an earlier date', () => {
    expect(jumpDirection('2026-07-06', '2026-06-30')).toBe(-1);
  });

  it('does not move for the same date', () => {
    expect(jumpDirection('2026-07-06', '2026-07-06')).toBe(0);
  });

  it('handles month and year boundaries via plain ISO ordering', () => {
    expect(jumpDirection('2026-12-31', '2027-01-01')).toBe(1);
    expect(jumpDirection('2027-01-01', '2026-12-31')).toBe(-1);
  });
});

describe('paneDates', () => {
  it('flanks the selected day with its neighbours when idle', () => {
    expect(paneDates('2026-07-06')).toEqual(['2026-07-05', '2026-07-06', '2026-07-07']);
  });

  it('overrides the right pane for a forward jump', () => {
    expect(paneDates('2026-07-06', { date: '2026-07-13', dir: 1 })).toEqual([
      '2026-07-05',
      '2026-07-06',
      '2026-07-13',
    ]);
  });

  it('overrides the left pane for a backward jump', () => {
    expect(paneDates('2026-07-06', { date: '2026-06-29', dir: -1 })).toEqual([
      '2026-06-29',
      '2026-07-06',
      '2026-07-07',
    ]);
  });

  it('ignores an override that targets the already-selected date', () => {
    expect(paneDates('2026-07-06', { date: '2026-07-06', dir: 1 })).toEqual([
      '2026-07-05',
      '2026-07-06',
      '2026-07-07',
    ]);
  });

  it('crosses month boundaries', () => {
    expect(paneDates('2026-07-31')).toEqual(['2026-07-30', '2026-07-31', '2026-08-01']);
  });
});

describe('weekJumpTarget', () => {
  it('jumps to the same weekday one week ahead', () => {
    // 2026-07-08 is a Wednesday -> next Wednesday
    expect(weekJumpTarget('2026-07-08', 1)).toBe('2026-07-15');
  });

  it('jumps to the same weekday one week back', () => {
    expect(weekJumpTarget('2026-07-08', -1)).toBe('2026-07-01');
  });

  it('crosses month boundaries', () => {
    expect(weekJumpTarget('2026-07-29', 1)).toBe('2026-08-05');
  });
});
