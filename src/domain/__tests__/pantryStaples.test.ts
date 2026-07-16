import { PANTRY_STAPLE_SEED_KEYS } from '../pantryStaples';

describe('PANTRY_STAPLE_SEED_KEYS', () => {
  it('has no duplicate seed keys', () => {
    const keys = PANTRY_STAPLE_SEED_KEYS.map((s) => s.seedKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every quantity is positive', () => {
    for (const staple of PANTRY_STAPLE_SEED_KEYS) {
      expect(staple.quantity).toBeGreaterThan(0);
    }
  });
});
