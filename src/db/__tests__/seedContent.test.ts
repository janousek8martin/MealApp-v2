import { seedFoods } from '../seed/foods';
import { seedRecipes } from '../seed/recipes';
import { usdaSeedFoods } from '../seed/usdaFoods.generated';

describe('seed content integrity', () => {
  const foodKeys = new Set(seedFoods.map((f) => f.key));

  it('has a usable library size', () => {
    expect(seedFoods.length).toBeGreaterThanOrEqual(60);
    expect(seedRecipes.length).toBeGreaterThanOrEqual(25);
  });

  it('covers all meal categories incl. sides and a snack pool', () => {
    expect(seedRecipes.filter((r) => r.category === 'breakfast').length).toBeGreaterThanOrEqual(5);
    expect(
      seedRecipes.filter((r) => r.category === 'lunch_dinner' && !r.isSide).length,
    ).toBeGreaterThanOrEqual(10);
    expect(seedRecipes.filter((r) => r.isSide).length).toBeGreaterThanOrEqual(3);
    expect(seedRecipes.filter((r) => r.category === 'snack').length).toBeGreaterThanOrEqual(5);
  });

  it('never references an unknown food', () => {
    for (const recipe of seedRecipes) {
      for (const ingredient of recipe.ingredients) {
        expect(foodKeys.has(ingredient.foodKey)).toBe(true);
      }
    }
  });

  it('has unique keys', () => {
    expect(new Set(seedFoods.map((f) => f.key)).size).toBe(seedFoods.length);
    expect(new Set(seedRecipes.map((r) => r.key)).size).toBe(seedRecipes.length);
  });

  it('macro energy roughly matches stated kcal (Atwater sanity check)', () => {
    for (const food of seedFoods) {
      const macroKcal = food.proteinPer100 * 4 + food.carbsPer100 * 4 + food.fatPer100 * 9;
      // Fiber, rounding and label conventions cause deviations – flag only
      // gross typos (>25 % and >40 kcal difference).
      const diff = Math.abs(macroKcal - food.kcalPer100);
      const tolerance = Math.max(40, food.kcalPer100 * 0.25);
      if (diff > tolerance) {
        throw new Error(
          `${food.key}: stated ${food.kcalPer100} kcal vs macros ${macroKcal.toFixed(0)} kcal`,
        );
      }
    }
  });

  it('piece-based foods define gramsPerPiece', () => {
    for (const food of seedFoods) {
      if (food.baseUnit === 'piece') {
        expect(food.gramsPerPiece).toBeGreaterThan(0);
      }
    }
  });
});

describe('USDA bulk-imported seed foods', () => {
  it('has a substantial library (Foundation + SR Legacy)', () => {
    expect(usdaSeedFoods.length).toBeGreaterThan(1000);
  });

  it('every bulk-imported food is flagged needsReview - curated foods are not', () => {
    for (const food of usdaSeedFoods) {
      expect(food.needsReview).toBe(true);
    }
    for (const food of seedFoods) {
      expect(food.needsReview).toBeFalsy();
    }
  });

  it('has no key collisions with the curated seed or within itself', () => {
    const curatedKeys = new Set(seedFoods.map((f) => f.key));
    const usdaKeys = new Set(usdaSeedFoods.map((f) => f.key));
    expect(usdaKeys.size).toBe(usdaSeedFoods.length);
    for (const key of usdaKeys) {
      expect(curatedKeys.has(key)).toBe(false);
    }
  });

  it('macro energy roughly matches stated kcal for a random sample (Atwater sanity check)', () => {
    // Full population check would be slow across ~8000 rows; a fixed-stride
    // sample is enough to catch a systematic unit/parsing bug.
    const sample = usdaSeedFoods.filter((_, i) => i % 50 === 0);
    let offenders = 0;
    for (const food of sample) {
      const macroKcal = food.proteinPer100 * 4 + food.carbsPer100 * 4 + food.fatPer100 * 9;
      const diff = Math.abs(macroKcal - food.kcalPer100);
      const tolerance = Math.max(60, food.kcalPer100 * 0.3);
      if (diff > tolerance) offenders += 1;
    }
    // A handful of genuine label/rounding outliers is expected at USDA's
    // scale; only fail if a large fraction are off, which would indicate a
    // systematic parsing bug rather than per-item label noise.
    expect(offenders / sample.length).toBeLessThan(0.1);
  });
});
