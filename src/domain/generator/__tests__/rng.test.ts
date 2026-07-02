import { createSeededRng } from '../rng';

describe('createSeededRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createSeededRng(42);
    const b = createSeededRng(42);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces values in [0, 1)', () => {
    const rng = createSeededRng(7);
    for (let i = 0; i < 100; i += 1) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('differs across seeds', () => {
    const a = createSeededRng(1)();
    const b = createSeededRng(2)();
    expect(a).not.toBe(b);
  });
});
