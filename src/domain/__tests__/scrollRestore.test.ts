import { shouldRestoreScroll } from '../scrollRestore';

describe('shouldRestoreScroll', () => {
  it('never restores when the feature is disabled, even if returning instantly', () => {
    expect(shouldRestoreScroll({ enabled: false, leftAt: 1000, now: 1000, timeoutSec: 1 })).toBe(false);
  });

  it('never restores on the very first focus (no prior leftAt)', () => {
    expect(shouldRestoreScroll({ enabled: true, leftAt: null, now: 1000, timeoutSec: 1 })).toBe(false);
  });

  it('restores when returning within the timeout window', () => {
    expect(shouldRestoreScroll({ enabled: true, leftAt: 1000, now: 1500, timeoutSec: 1 })).toBe(true);
  });

  it('does not restore once the timeout window has elapsed', () => {
    expect(shouldRestoreScroll({ enabled: true, leftAt: 1000, now: 2001, timeoutSec: 1 })).toBe(false);
  });

  it('respects a configurable timeout, not just the 1s default', () => {
    expect(shouldRestoreScroll({ enabled: true, leftAt: 1000, now: 5999, timeoutSec: 5 })).toBe(true);
    expect(shouldRestoreScroll({ enabled: true, leftAt: 1000, now: 6000, timeoutSec: 5 })).toBe(false);
  });
});
