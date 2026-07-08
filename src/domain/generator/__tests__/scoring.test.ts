import { createSeededRng } from '../rng';
import { pickWeightedRandom, scoreCandidate } from '../scoring';
import type { RecipeCandidate, ScoringContext } from '../types';

function candidate(overrides: Partial<RecipeCandidate> = {}): RecipeCandidate {
  return {
    id: 'r1',
    category: 'lunch_dinner',
    isSide: false,
    budget: 'average',
    nutritionPerPortion: { kcal: 600, proteinG: 40, carbsG: 60, fatG: 20, fiberG: 4 },
    ingredients: [],
    maxRepetitionsPerWeek: null,
    allowConsecutiveDays: null,
    ...overrides,
  };
}

function ctx(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    weekCounts: new Map(),
    previousDayRecipeIds: new Set(),
    household: { defaultMaxRepetitionsPerWeek: 2, defaultAllowConsecutiveDays: false },
    favoriteRecipeIds: new Set(),
    expiringFoodIds: new Set(),
    ...overrides,
  };
}

describe('scoreCandidate', () => {
  it('penalizes a recipe closer to its repetition limit', () => {
    const fresh = scoreCandidate(candidate(), ctx());
    const usedOnce = scoreCandidate(candidate(), ctx({ weekCounts: new Map([['r1', 1]]) }));
    expect(usedOnce).toBeLessThan(fresh);
  });

  it('applies a smaller relative penalty to a recipe with a higher personal limit', () => {
    const tightLimit = scoreCandidate(
      candidate({ maxRepetitionsPerWeek: 2 }),
      ctx({ weekCounts: new Map([['r1', 1]]) }),
    );
    const looseLimit = scoreCandidate(
      candidate({ maxRepetitionsPerWeek: 4 }),
      ctx({ weekCounts: new Map([['r1', 1]]) }),
    );
    expect(looseLimit).toBeGreaterThan(tightLimit);
  });

  it('rewards favorites', () => {
    const notFavorite = scoreCandidate(candidate(), ctx());
    const favorite = scoreCandidate(candidate(), ctx({ favoriteRecipeIds: new Set(['r1']) }));
    expect(favorite).toBeGreaterThan(notFavorite);
  });

  it('rewards cheaper recipes over more expensive ones', () => {
    const cheap = scoreCandidate(candidate({ budget: 'cheap' }), ctx());
    const expensive = scoreCandidate(candidate({ budget: 'expensive' }), ctx());
    expect(cheap).toBeGreaterThan(expensive);
  });

  it('rewards recipes using soon-to-expire pantry ingredients', () => {
    const withExpiring = candidate({ ingredients: [{ foodId: 'spinach', allergens: [], dietFlags: [] }] });
    const base = scoreCandidate(withExpiring, ctx());
    const boosted = scoreCandidate(withExpiring, ctx({ expiringFoodIds: new Set(['spinach']) }));
    expect(boosted).toBeGreaterThan(base);
  });

  it('does not change the score when there is no macro-fit target (default candidate() has no override)', () => {
    expect(scoreCandidate(candidate(), ctx())).toBe(scoreCandidate(candidate(), ctx({ macroFitTarget: undefined })));
  });

  it('rewards a recipe whose protein/fat density matches the slot macro-fit target over one that does not', () => {
    // Target: 0.1 g protein/kcal, 0.03 g fat/kcal (e.g. 60g protein, 18g fat @ 600 kcal).
    const target = { kcal: 600, proteinG: 60, fatG: 18 };
    const matching = candidate({ nutritionPerPortion: { kcal: 600, proteinG: 60, carbsG: 40, fatG: 18, fiberG: 4 } });
    const mismatched = candidate({ nutritionPerPortion: { kcal: 600, proteinG: 10, carbsG: 100, fatG: 40, fiberG: 4 } });
    const matchingScore = scoreCandidate(matching, ctx({ macroFitTarget: target }));
    const mismatchedScore = scoreCandidate(mismatched, ctx({ macroFitTarget: target }));
    expect(matchingScore).toBeGreaterThan(mismatchedScore);
  });
});

describe('pickWeightedRandom', () => {
  it('only ever returns candidates from the shortlist', () => {
    const scored = [
      { candidate: candidate({ id: 'a' }), score: 100 },
      { candidate: candidate({ id: 'b' }), score: 90 },
      { candidate: candidate({ id: 'c' }), score: 10 },
    ];
    const rng = createSeededRng(1);
    for (let i = 0; i < 50; i += 1) {
      const pick = pickWeightedRandom(scored, 2, rng);
      expect(['a', 'b']).toContain(pick.id);
    }
  });

  it('is deterministic for a fixed seed', () => {
    const scored = [
      { candidate: candidate({ id: 'a' }), score: 100 },
      { candidate: candidate({ id: 'b' }), score: 80 },
      { candidate: candidate({ id: 'c' }), score: 60 },
    ];
    const picksA = Array.from({ length: 10 }, () => 0);
    const rngA = createSeededRng(123);
    const resultA = picksA.map(() => pickWeightedRandom(scored, 3, rngA).id);
    const rngB = createSeededRng(123);
    const resultB = picksA.map(() => pickWeightedRandom(scored, 3, rngB).id);
    expect(resultA).toEqual(resultB);
  });

  it('favors higher-scored candidates over many draws', () => {
    const scored = [
      { candidate: candidate({ id: 'best' }), score: 100 },
      { candidate: candidate({ id: 'worst' }), score: 10 },
    ];
    const rng = createSeededRng(99);
    const counts = { best: 0, worst: 0 };
    for (let i = 0; i < 500; i += 1) {
      const pick = pickWeightedRandom(scored, 2, rng);
      counts[pick.id as 'best' | 'worst'] += 1;
    }
    expect(counts.best).toBeGreaterThan(counts.worst);
  });
});
