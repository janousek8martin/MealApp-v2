import { findSimilarTag } from '../recipeTags';

describe('findSimilarTag', () => {
  const candidates = [
    { tag: 'quick', label: 'Quick' },
    { tag: 'batch_friendly', label: 'Batch-friendly' },
    { tag: 'no_cook', label: 'No-cook' },
  ];

  it('returns null when nothing is close', () => {
    expect(findSimilarTag('spicy', candidates)).toBeNull();
  });

  it('matches an exact normalized duplicate regardless of case/diacritics', () => {
    expect(findSimilarTag('QUICK', candidates)?.tag).toBe('quick');
    expect(findSimilarTag('quick', candidates)?.tag).toBe('quick');
  });

  it('matches on a substring in either direction once past the minimum length', () => {
    expect(findSimilarTag('batch', candidates)?.tag).toBe('batch_friendly');
    expect(findSimilarTag('batch-friendly-freezer', candidates)?.tag).toBe('batch_friendly');
  });

  it('ignores substring matches shorter than the minimum length to avoid noise', () => {
    expect(findSimilarTag('no', candidates)).toBeNull();
  });

  it('returns null for an empty or whitespace-only input', () => {
    expect(findSimilarTag('', candidates)).toBeNull();
    expect(findSimilarTag('   ', candidates)).toBeNull();
  });
});
