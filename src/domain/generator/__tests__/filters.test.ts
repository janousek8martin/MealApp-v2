import {
  applyHardFilterWithFallback,
  deriveRecipeTags,
  exceedsCandidateCalorieCap,
  findRestrictionConflicts,
  isRecipeAllowedForProfiles,
  passesBudgetFilter,
  passesCookingExperienceFilter,
  passesCookingTimeFilter,
  passesMealPrepFilter,
  passesRepetitionRules,
  passesSameDayRepeatRule,
  relaxAvoidedRecipesForResolutions,
} from '../filters';
import type { DietRestrictions, RecipeCandidate, RepetitionContext } from '../types';

function candidate(overrides: Partial<RecipeCandidate> = {}): RecipeCandidate {
  return {
    id: 'r1',
    category: 'lunch_dinner',
    isSide: false,
    budget: 'average',
    nutritionPerPortion: { kcal: 600, proteinG: 40, carbsG: 60, fatG: 20, fiberG: 8 },
    ingredients: [
      { foodId: 'chicken', allergens: [], dietFlags: [] },
      { foodId: 'rice', allergens: [], dietFlags: ['vegetarian', 'vegan'] },
    ],
    maxRepetitionsPerWeek: null,
    allowConsecutiveDays: null,
    canServeCold: false,
    mealPrepFriendly: false,
    ...overrides,
  };
}

describe('deriveRecipeTags', () => {
  it('unions allergens across ingredients', () => {
    const tags = deriveRecipeTags([
      { foodId: 'a', allergens: ['gluten'], dietFlags: [] },
      { foodId: 'b', allergens: ['lactose'], dietFlags: [] },
    ]);
    expect(tags.allergens.sort()).toEqual(['gluten', 'lactose']);
  });

  it('only keeps a diet flag every ingredient supports', () => {
    const tags = deriveRecipeTags([
      { foodId: 'rice', allergens: [], dietFlags: ['vegetarian', 'vegan'] },
      { foodId: 'egg', allergens: ['eggs'], dietFlags: ['vegetarian'] },
    ]);
    expect(tags.dietFlags).toEqual(expect.arrayContaining(['vegetarian']));
    expect(tags.dietFlags).not.toContain('vegan');
  });

  it('a recipe with a non-flagged ingredient (e.g. meat) supports no curated diets', () => {
    const tags = deriveRecipeTags([
      { foodId: 'chicken', allergens: [], dietFlags: [] },
      { foodId: 'rice', allergens: [], dietFlags: ['vegetarian', 'vegan'] },
    ]);
    expect(tags.dietFlags).not.toContain('vegetarian');
    expect(tags.dietFlags).not.toContain('vegan');
  });

  it('derives gluten_free/dairy_free from allergens rather than requiring curated flags', () => {
    const tags = deriveRecipeTags([
      { foodId: 'chicken', allergens: [], dietFlags: [] },
      { foodId: 'rice', allergens: [], dietFlags: ['vegetarian', 'vegan'] },
    ]);
    expect(tags.dietFlags).toEqual(expect.arrayContaining(['gluten_free', 'dairy_free']));
  });

  it('drops gluten_free/dairy_free once any ingredient carries that allergen', () => {
    const tags = deriveRecipeTags([
      { foodId: 'bread', allergens: ['gluten'], dietFlags: ['vegetarian'] },
      { foodId: 'milk', allergens: ['lactose'], dietFlags: ['vegetarian'] },
    ]);
    expect(tags.dietFlags).not.toContain('gluten_free');
    expect(tags.dietFlags).not.toContain('dairy_free');
  });
});

describe('isRecipeAllowedForProfiles', () => {
  const noRestrictions: DietRestrictions = {
    allergens: [],
    diets: [],
    avoidedRecipeIds: [],
    avoidedFoodIds: [],
  };

  it('allows a recipe with no conflicts', () => {
    expect(isRecipeAllowedForProfiles(candidate(), [noRestrictions])).toBe(true);
  });

  it('rejects a recipe touching an allergen any sharing profile must avoid', () => {
    const withGluten = candidate({
      ingredients: [{ foodId: 'bread', allergens: ['gluten'], dietFlags: ['vegetarian'] }],
    });
    expect(
      isRecipeAllowedForProfiles(withGluten, [{ ...noRestrictions, allergens: ['gluten'] }]),
    ).toBe(false);
  });

  it('rejects a recipe that does not satisfy a required diet', () => {
    // chicken ingredient carries no diet flags, so the recipe is not vegetarian.
    expect(
      isRecipeAllowedForProfiles(candidate(), [{ ...noRestrictions, diets: ['vegetarian'] }]),
    ).toBe(false);
  });

  it('must satisfy every sharing profile simultaneously', () => {
    const meatFree = candidate({
      ingredients: [{ foodId: 'rice', allergens: [], dietFlags: ['vegetarian', 'vegan'] }],
    });
    expect(
      isRecipeAllowedForProfiles(meatFree, [
        noRestrictions,
        { ...noRestrictions, diets: ['vegetarian'] },
      ]),
    ).toBe(true);
    expect(
      isRecipeAllowedForProfiles(candidate(), [
        noRestrictions,
        { ...noRestrictions, diets: ['vegetarian'] },
      ]),
    ).toBe(false);
  });

  it('rejects an explicitly avoided recipe', () => {
    expect(
      isRecipeAllowedForProfiles(candidate(), [{ ...noRestrictions, avoidedRecipeIds: ['r1'] }]),
    ).toBe(false);
  });

  it('rejects a recipe containing an explicitly avoided food', () => {
    expect(
      isRecipeAllowedForProfiles(candidate(), [{ ...noRestrictions, avoidedFoodIds: ['chicken'] }]),
    ).toBe(false);
  });

  it('rejects a high-carb recipe for a profile requiring low_carb', () => {
    // 60g carbs * 4 = 240 kcal of 600 kcal = 40% > the 26% low-carb ceiling.
    expect(
      isRecipeAllowedForProfiles(candidate(), [{ ...noRestrictions, diets: ['low_carb'] }]),
    ).toBe(false);
  });

  it('allows a low-carb recipe for a profile requiring low_carb', () => {
    const grilledChicken = candidate({
      nutritionPerPortion: { kcal: 400, proteinG: 50, carbsG: 10, fatG: 15, fiberG: 3 },
    });
    expect(
      isRecipeAllowedForProfiles(grilledChicken, [{ ...noRestrictions, diets: ['low_carb'] }]),
    ).toBe(true);
  });
});

describe('relaxAvoidedRecipesForResolutions', () => {
  const noRestrictions: DietRestrictions = {
    allergens: [],
    diets: [],
    avoidedRecipeIds: [],
    avoidedFoodIds: [],
  };

  it('removes a "rare"-resolved recipe from a disliking profile\'s avoid list', () => {
    const relaxed = relaxAvoidedRecipesForResolutions(
      [{ ...noRestrictions, avoidedRecipeIds: ['r1'] }],
      new Map([['r1', 'rare']]),
    );
    expect(relaxed[0].avoidedRecipeIds).toEqual([]);
  });

  it('removes a "serve_separately"-resolved recipe from a disliking profile\'s avoid list', () => {
    const relaxed = relaxAvoidedRecipesForResolutions(
      [{ ...noRestrictions, avoidedRecipeIds: ['r1'] }],
      new Map([['r1', 'serve_separately']]),
    );
    expect(relaxed[0].avoidedRecipeIds).toEqual([]);
  });

  it('keeps a "never"-resolved recipe excluded, same as an ordinary dislike', () => {
    const relaxed = relaxAvoidedRecipesForResolutions(
      [{ ...noRestrictions, avoidedRecipeIds: ['r1'] }],
      new Map([['r1', 'never']]),
    );
    expect(relaxed[0].avoidedRecipeIds).toEqual(['r1']);
  });

  it('leaves other avoided recipes untouched', () => {
    const relaxed = relaxAvoidedRecipesForResolutions(
      [{ ...noRestrictions, avoidedRecipeIds: ['r1', 'r2'] }],
      new Map([['r1', 'rare']]),
    );
    expect(relaxed[0].avoidedRecipeIds).toEqual(['r2']);
  });
});

describe('exceedsCandidateCalorieCap', () => {
  it('flags a candidate above 60% of the daily target', () => {
    expect(exceedsCandidateCalorieCap(1300, 2000)).toBe(true);
  });

  it('allows a candidate at or below 60% of the daily target', () => {
    expect(exceedsCandidateCalorieCap(1200, 2000)).toBe(false);
    expect(exceedsCandidateCalorieCap(500, 2000)).toBe(false);
  });

  it('never flags anything when the daily target is unknown (0)', () => {
    expect(exceedsCandidateCalorieCap(5000, 0)).toBe(false);
  });
});

describe('findRestrictionConflicts', () => {
  const noRestrictions: DietRestrictions = {
    allergens: [],
    diets: [],
    avoidedRecipeIds: [],
    avoidedFoodIds: [],
  };

  it('reports no conflicts when nothing overlaps', () => {
    expect(
      findRestrictionConflicts(
        { itemType: 'recipe', itemId: 'r1', allergens: [], dietFlags: [] },
        [noRestrictions],
      ),
    ).toEqual([]);
  });

  it('reports an allergen conflict', () => {
    expect(
      findRestrictionConflicts(
        { itemType: 'recipe', itemId: 'r1', allergens: ['gluten'], dietFlags: [] },
        [{ ...noRestrictions, allergens: ['gluten'] }],
      ),
    ).toEqual([{ kind: 'allergen', value: 'gluten' }]);
  });

  it('reports a diet conflict when the item lacks a required diet flag', () => {
    expect(
      findRestrictionConflicts(
        { itemType: 'recipe', itemId: 'r1', allergens: [], dietFlags: [] },
        [{ ...noRestrictions, diets: ['vegetarian'] }],
      ),
    ).toEqual([{ kind: 'diet', value: 'vegetarian' }]);
  });

  it('does not report a diet conflict when the item carries the flag', () => {
    expect(
      findRestrictionConflicts(
        { itemType: 'recipe', itemId: 'r1', allergens: [], dietFlags: ['vegetarian'] },
        [{ ...noRestrictions, diets: ['vegetarian'] }],
      ),
    ).toEqual([]);
  });

  it('ignores low_carb as a diet conflict (computed nutritional property, not a tag)', () => {
    expect(
      findRestrictionConflicts(
        { itemType: 'recipe', itemId: 'r1', allergens: [], dietFlags: [] },
        [{ ...noRestrictions, diets: ['low_carb'] }],
      ),
    ).toEqual([]);
  });

  it('reports an avoided-recipe conflict', () => {
    expect(
      findRestrictionConflicts(
        { itemType: 'recipe', itemId: 'r1', allergens: [], dietFlags: [] },
        [{ ...noRestrictions, avoidedRecipeIds: ['r1'] }],
      ),
    ).toEqual([{ kind: 'avoided' }]);
  });

  it('reports an avoided-food conflict for a standalone food item', () => {
    expect(
      findRestrictionConflicts(
        { itemType: 'food', itemId: 'f1', allergens: [], dietFlags: [] },
        [{ ...noRestrictions, avoidedFoodIds: ['f1'] }],
      ),
    ).toEqual([{ kind: 'avoided' }]);
  });

  it('deduplicates the same allergen conflict across multiple profiles', () => {
    expect(
      findRestrictionConflicts(
        { itemType: 'recipe', itemId: 'r1', allergens: ['gluten'], dietFlags: [] },
        [{ ...noRestrictions, allergens: ['gluten'] }, { ...noRestrictions, allergens: ['gluten'] }],
      ),
    ).toEqual([{ kind: 'allergen', value: 'gluten' }]);
  });

  it('collects multiple distinct conflict kinds together', () => {
    const conflicts = findRestrictionConflicts(
      { itemType: 'recipe', itemId: 'r1', allergens: ['gluten'], dietFlags: [] },
      [{ allergens: ['gluten'], diets: ['vegetarian'], avoidedRecipeIds: ['r1'], avoidedFoodIds: [] }],
    );
    expect(conflicts).toEqual(
      expect.arrayContaining([
        { kind: 'allergen', value: 'gluten' },
        { kind: 'diet', value: 'vegetarian' },
        { kind: 'avoided' },
      ]),
    );
    expect(conflicts).toHaveLength(3);
  });
});

describe('passesRepetitionRules', () => {
  function ctx(overrides: Partial<RepetitionContext> = {}): RepetitionContext {
    return {
      weekCounts: new Map(),
      previousDayRecipeIds: new Set(),
      household: { defaultMaxRepetitionsPerWeek: 2, defaultAllowConsecutiveDays: false },
      ...overrides,
    };
  }

  it('allows a recipe under its weekly limit', () => {
    expect(passesRepetitionRules(candidate(), ctx({ weekCounts: new Map([['r1', 1]]) }))).toBe(true);
  });

  it('blocks a recipe that reached its effective weekly limit', () => {
    expect(passesRepetitionRules(candidate(), ctx({ weekCounts: new Map([['r1', 2]]) }))).toBe(false);
  });

  it('respects a per-recipe override over the household default', () => {
    const oftenAllowed = candidate({ maxRepetitionsPerWeek: 4 });
    expect(passesRepetitionRules(oftenAllowed, ctx({ weekCounts: new Map([['r1', 3]]) }))).toBe(true);
  });

  it('blocks a recipe used yesterday when consecutive days are not allowed', () => {
    expect(
      passesRepetitionRules(candidate(), ctx({ previousDayRecipeIds: new Set(['r1']) })),
    ).toBe(false);
  });

  it('allows a recipe used yesterday when its override permits consecutive days', () => {
    const batchCookable = candidate({ allowConsecutiveDays: true });
    expect(
      passesRepetitionRules(batchCookable, ctx({ previousDayRecipeIds: new Set(['r1']) })),
    ).toBe(true);
  });

  it('allows a recipe used yesterday when the household default permits it', () => {
    expect(
      passesRepetitionRules(
        candidate(),
        ctx({
          previousDayRecipeIds: new Set(['r1']),
          household: { defaultMaxRepetitionsPerWeek: 2, defaultAllowConsecutiveDays: true },
        }),
      ),
    ).toBe(true);
  });
});

describe('applyHardFilterWithFallback', () => {
  it('restricts to items passing the predicate', () => {
    expect(applyHardFilterWithFallback([1, 2, 3, 4], (n) => n % 2 === 0)).toEqual([2, 4]);
  });

  it('falls back to the full list when the predicate would leave nothing', () => {
    expect(applyHardFilterWithFallback([1, 3, 5], (n) => n % 2 === 0)).toEqual([1, 3, 5]);
  });
});

describe('passesCookingExperienceFilter', () => {
  it('allows a recipe at or below the household ceiling', () => {
    expect(passesCookingExperienceFilter(candidate({ difficulty: 'easy' }), 'medium')).toBe(true);
    expect(passesCookingExperienceFilter(candidate({ difficulty: 'medium' }), 'medium')).toBe(true);
  });

  it('excludes a recipe above the household ceiling', () => {
    expect(passesCookingExperienceFilter(candidate({ difficulty: 'hard' }), 'easy')).toBe(false);
  });

  it('always passes a standalone food (undefined difficulty)', () => {
    expect(passesCookingExperienceFilter(candidate({ difficulty: undefined }), 'easy')).toBe(true);
  });
});

describe('passesBudgetFilter', () => {
  it('allows a recipe at or below the household budget ceiling', () => {
    expect(passesBudgetFilter(candidate({ budget: 'cheap' }), 'low')).toBe(true);
    expect(passesBudgetFilter(candidate({ budget: 'average' }), 'medium')).toBe(true);
  });

  it('excludes a recipe above the household budget ceiling', () => {
    expect(passesBudgetFilter(candidate({ budget: 'expensive' }), 'medium')).toBe(false);
  });

  it('"high" allows every budget tier', () => {
    expect(passesBudgetFilter(candidate({ budget: 'expensive' }), 'high')).toBe(true);
  });
});

describe('passesCookingTimeFilter', () => {
  it('allows a recipe at or under the limit', () => {
    expect(passesCookingTimeFilter(candidate({ prepTimeMinutes: 30 }), 30)).toBe(true);
  });

  it('excludes a recipe over the limit', () => {
    expect(passesCookingTimeFilter(candidate({ prepTimeMinutes: 45 }), 30)).toBe(false);
  });

  it('never excludes anything when the limit is "Any time" (null)', () => {
    expect(passesCookingTimeFilter(candidate({ prepTimeMinutes: 999 }), null)).toBe(true);
  });

  it('never excludes a recipe with no prep time set (missing data isn\'t a violation)', () => {
    expect(passesCookingTimeFilter(candidate({ prepTimeMinutes: null }), 15)).toBe(true);
    expect(passesCookingTimeFilter(candidate({ prepTimeMinutes: undefined }), 15)).toBe(true);
  });
});

describe('passesSameDayRepeatRule', () => {
  it('excludes a recipe already used in the other lunch/dinner slot today', () => {
    expect(passesSameDayRepeatRule(candidate({ id: 'r1' }), 'dinner', new Set(['r1']), false)).toBe(false);
  });

  it('allows it when allowSameLunchDinner is true', () => {
    expect(passesSameDayRepeatRule(candidate({ id: 'r1' }), 'dinner', new Set(['r1']), true)).toBe(true);
  });

  it('does not apply to slots other than lunch/dinner', () => {
    expect(passesSameDayRepeatRule(candidate({ id: 'r1' }), 'breakfast', new Set(['r1']), false)).toBe(true);
  });

  it('allows a recipe not used in the sibling slot', () => {
    expect(passesSameDayRepeatRule(candidate({ id: 'r2' }), 'dinner', new Set(['r1']), false)).toBe(true);
  });
});

describe('passesMealPrepFilter', () => {
  it('allows everything when mealPrepMode is off', () => {
    expect(passesMealPrepFilter(candidate({ mealPrepFriendly: false }), false)).toBe(true);
    expect(passesMealPrepFilter(candidate({ mealPrepFriendly: true }), false)).toBe(true);
  });

  it('only allows mealPrepFriendly candidates when mealPrepMode is on', () => {
    expect(passesMealPrepFilter(candidate({ mealPrepFriendly: true }), true)).toBe(true);
    expect(passesMealPrepFilter(candidate({ mealPrepFriendly: false }), true)).toBe(false);
  });
});
