import { createSeededRng } from '../rng';
import { pickMealForSlot, pickSnackForSlot, recordPick, type GeneratorItem } from '../select';
import type { DietRestrictions, RecipeCandidate, RepetitionContext } from '../types';

function item(id: string, overrides: Partial<RecipeCandidate> = {}): GeneratorItem {
  const candidate: RecipeCandidate = {
    id,
    category: 'lunch_dinner',
    isSide: false,
    budget: 'average',
    nutritionPerPortion: { kcal: 600, proteinG: 40, carbsG: 60, fatG: 20, fiberG: 4 },
    ingredients: [],
    maxRepetitionsPerWeek: null,
    allowConsecutiveDays: null,
    canServeCold: false,
    mealPrepFriendly: false,
    ...overrides,
  };
  return { itemType: 'recipe', candidate };
}

const noRestrictions: DietRestrictions = {
  allergens: [],
  diets: [],
  avoidedRecipeIds: [],
  avoidedFoodIds: [],
};

function repetitionCtx(overrides: Partial<RepetitionContext> = {}): RepetitionContext {
  return {
    weekCounts: new Map(),
    previousDayRecipeIds: new Set(),
    household: { defaultMaxRepetitionsPerWeek: 2, defaultAllowConsecutiveDays: false },
    ...overrides,
  };
}

const baseScoringExtras = {
  likedItemIds: new Set<string>(),
  expiringFoodIds: new Set<string>(),
  inStockFoodIds: new Set<string>(),
  mealVariety: { level: 'medium' as const, recentRecipeIds: new Set<string>() },
  preferPantryItems: true,
};

describe('pickMealForSlot', () => {
  it('returns null when every candidate is filtered out', () => {
    const glutenItem = item('bread', {
      ingredients: [{ foodId: 'wheat', allergens: ['gluten'], dietFlags: [], needsReview: false }],
    });
    const result = pickMealForSlot(
      [glutenItem],
      [{ ...noRestrictions, allergens: ['gluten'] }],
      repetitionCtx(),
      baseScoringExtras,
      createSeededRng(1),
    );
    expect(result).toBeNull();
  });

  it('never returns a candidate that violates a hard filter', () => {
    const candidates = [
      item('a', { ingredients: [{ foodId: 'wheat', allergens: ['gluten'], dietFlags: [], needsReview: false }] }),
      item('b'),
      item('c'),
    ];
    const rng = createSeededRng(5);
    for (let i = 0; i < 30; i += 1) {
      const result = pickMealForSlot(
        candidates,
        [{ ...noRestrictions, allergens: ['gluten'] }],
        repetitionCtx(),
        baseScoringExtras,
        rng,
      );
      expect(result?.candidate.id).not.toBe('a');
    }
  });

  it('is deterministic for a fixed seed', () => {
    const candidates = [item('a'), item('b'), item('c')];
    const pick = () =>
      pickMealForSlot(
        candidates,
        [noRestrictions],
        repetitionCtx(),
        baseScoringExtras,
        createSeededRng(77),
      )?.candidate.id;
    expect(pick()).toBe(pick());
  });

  it('excludes a candidate whose calories exceed 0.6x a relevant profile\'s daily target', () => {
    const candidates = [
      item('oversized', { nutritionPerPortion: { kcal: 1300, proteinG: 40, carbsG: 60, fatG: 20, fiberG: 4 } }),
      item('reasonable', { nutritionPerPortion: { kcal: 500, proteinG: 40, carbsG: 60, fatG: 20, fiberG: 4 } }),
    ];
    const rng = createSeededRng(3);
    for (let i = 0; i < 20; i += 1) {
      const result = pickMealForSlot(
        candidates,
        [noRestrictions],
        repetitionCtx(),
        baseScoringExtras,
        rng,
        [2000],
      );
      expect(result?.candidate.id).toBe('reasonable');
    }
  });

  it('falls back to an over-cap candidate rather than leaving the slot empty when nothing else passes', () => {
    const candidates = [item('oversized', { nutritionPerPortion: { kcal: 1300, proteinG: 40, carbsG: 60, fatG: 20, fiberG: 4 } })];
    const result = pickMealForSlot(
      candidates,
      [noRestrictions],
      repetitionCtx(),
      baseScoringExtras,
      createSeededRng(1),
      [2000],
    );
    expect(result?.candidate.id).toBe('oversized');
  });

  it('restricts to cold-eligible candidates when requireColdEligible is set and at least one exists', () => {
    const candidates = [item('warm', { canServeCold: false }), item('cold', { canServeCold: true })];
    const rng = createSeededRng(2);
    for (let i = 0; i < 20; i += 1) {
      const result = pickMealForSlot(
        candidates,
        [noRestrictions],
        repetitionCtx(),
        baseScoringExtras,
        rng,
        [],
        undefined,
        true,
      );
      expect(result?.candidate.id).toBe('cold');
    }
  });

  it('falls back to a non-cold-eligible candidate rather than leaving the slot empty when none are cold-eligible', () => {
    const candidates = [item('warm', { canServeCold: false })];
    const result = pickMealForSlot(
      candidates,
      [noRestrictions],
      repetitionCtx(),
      baseScoringExtras,
      createSeededRng(1),
      [],
      undefined,
      true,
    );
    expect(result?.candidate.id).toBe('warm');
  });

  const baseHouseholdFilters = {
    cookingExperienceLevel: 'hard' as const,
    cookingTimeLimitMinutes: null,
    budgetLevel: 'high' as const,
    allowSameLunchDinner: true,
  };

  it('when mealPrepMode is on, only picks mealPrepFriendly main-meal candidates', () => {
    const candidates = [item('boxed', { mealPrepFriendly: true }), item('freshOnly', { mealPrepFriendly: false })];
    const rng = createSeededRng(3);
    for (let i = 0; i < 20; i += 1) {
      const result = pickMealForSlot(
        candidates,
        [noRestrictions],
        repetitionCtx(),
        baseScoringExtras,
        rng,
        [],
        undefined,
        false,
        { ...baseHouseholdFilters, mealPrepMode: true },
      );
      expect(result?.candidate.id).toBe('boxed');
    }
  });

  it('falls back to a non-mealPrepFriendly candidate rather than leaving the slot empty when none are flagged', () => {
    const candidates = [item('freshOnly', { mealPrepFriendly: false })];
    const result = pickMealForSlot(
      candidates,
      [noRestrictions],
      repetitionCtx(),
      baseScoringExtras,
      createSeededRng(1),
      [],
      undefined,
      false,
      { ...baseHouseholdFilters, mealPrepMode: true },
    );
    expect(result?.candidate.id).toBe('freshOnly');
  });

  it('mealPrepMode off allows any candidate regardless of the flag', () => {
    const candidates = [item('freshOnly', { mealPrepFriendly: false })];
    const result = pickMealForSlot(
      candidates,
      [noRestrictions],
      repetitionCtx(),
      baseScoringExtras,
      createSeededRng(1),
      [],
      undefined,
      false,
      { ...baseHouseholdFilters, mealPrepMode: false },
    );
    expect(result?.candidate.id).toBe('freshOnly');
  });
});

describe('pickSnackForSlot', () => {
  it('picks the candidate closest to the remaining target, not the highest scored', () => {
    const candidates = [
      item('big', { nutritionPerPortion: { kcal: 550, proteinG: 15, carbsG: 15, fatG: 45, fiberG: 8 } }),
      item('closest', { nutritionPerPortion: { kcal: 210, proteinG: 22, carbsG: 20, fatG: 6, fiberG: 0 } }),
    ];
    const result = pickSnackForSlot(candidates, noRestrictions, repetitionCtx(), {
      kcal: 200,
      proteinG: 20,
      carbsG: 20,
      fatG: 6,
    });
    expect(result?.candidate.id).toBe('closest');
  });

  it('excludes a candidate that fails the diet/allergy hard filter even if it is closest', () => {
    const candidates = [
      item('gluten_closest', {
        nutritionPerPortion: { kcal: 200, proteinG: 20, carbsG: 20, fatG: 6, fiberG: 0 },
        ingredients: [{ foodId: 'wheat', allergens: ['gluten'], dietFlags: [], needsReview: false }],
      }),
      item('safe_further', { nutritionPerPortion: { kcal: 400, proteinG: 10, carbsG: 10, fatG: 20, fiberG: 2 } }),
    ];
    const result = pickSnackForSlot(
      candidates,
      { ...noRestrictions, allergens: ['gluten'] },
      repetitionCtx(),
      { kcal: 200, proteinG: 20, carbsG: 20, fatG: 6 },
    );
    expect(result?.candidate.id).toBe('safe_further');
  });

  it('excludes a candidate that already hit its repetition limit', () => {
    const candidates = [
      item('maxed', { nutritionPerPortion: { kcal: 200, proteinG: 20, carbsG: 20, fatG: 6, fiberG: 0 } }),
      item('available', { nutritionPerPortion: { kcal: 400, proteinG: 10, carbsG: 10, fatG: 20, fiberG: 2 } }),
    ];
    const result = pickSnackForSlot(
      candidates,
      noRestrictions,
      repetitionCtx({ weekCounts: new Map([['maxed', 2]]) }),
      { kcal: 200, proteinG: 20, carbsG: 20, fatG: 6 },
    );
    expect(result?.candidate.id).toBe('available');
  });

  it('returns null when everything is filtered out', () => {
    const candidates = [item('gluten', { ingredients: [{ foodId: 'wheat', allergens: ['gluten'], dietFlags: [], needsReview: false }] })];
    const result = pickSnackForSlot(
      candidates,
      { ...noRestrictions, allergens: ['gluten'] },
      repetitionCtx(),
      { kcal: 200, proteinG: 20, carbsG: 20, fatG: 6 },
    );
    expect(result).toBeNull();
  });

  it('mealPrepMode does not restrict snacks - a non-mealPrepFriendly snack still gets picked', () => {
    const candidates = [item('snack', { mealPrepFriendly: false, nutritionPerPortion: { kcal: 200, proteinG: 20, carbsG: 20, fatG: 6, fiberG: 0 } })];
    const result = pickSnackForSlot(
      candidates,
      noRestrictions,
      repetitionCtx(),
      { kcal: 200, proteinG: 20, carbsG: 20, fatG: 6 },
      {
        cookingExperienceLevel: 'hard',
        cookingTimeLimitMinutes: null,
        budgetLevel: 'high',
        allowSameLunchDinner: true,
        mealPrepMode: true,
      },
    );
    expect(result?.candidate.id).toBe('snack');
  });
});

describe('recordPick', () => {
  it('increments the count for the picked recipe without mutating the original', () => {
    const original = repetitionCtx();
    const updated = recordPick(original, 'r1');
    expect(original.weekCounts.get('r1')).toBeUndefined();
    expect(updated.weekCounts.get('r1')).toBe(1);
  });

  it('accumulates across repeated picks of the same recipe', () => {
    let ctx = repetitionCtx();
    ctx = recordPick(ctx, 'r1');
    ctx = recordPick(ctx, 'r1');
    expect(ctx.weekCounts.get('r1')).toBe(2);
  });
});
