import { and, eq, inArray, isNull } from 'drizzle-orm';

import { ageYears } from '../../domain/age';
import { computeRecipeNutrition } from '../../domain/recipeNutrition';
import { computeTargets } from '../../domain/targets';
import { startOfWeek, weekDates } from '../../domain/week';
import { createHouseholdWithDefaults, updateHouseholdSettings } from '../repositories/households';
import { upsertFood, upsertRecipe } from '../repositories/library';
import {
  addMealExtra,
  assignManualMeal,
  generateWeek,
  regenerateDay,
  regenerateSlot,
  setPortionStatus,
} from '../repositories/plan';
import { createProfile, updateProfileMacroOverrides, upsertProfileSlotPortion } from '../repositories/profiles';
import { foods, mealSlotSettings, plannedMealExtras, plannedMealPortions, plannedMeals, profiles, recipeIngredients, recipes } from '../schema';
import { seedIfEmpty } from '../seed';
import { createTestDb } from '../testing/testDb';

/** Sums a profile's planned kcal for one date, joining down to real recipe/food nutrition – mirrors the generator's own math for the accuracy check below. */
async function sumPlannedKcal(db: ReturnType<typeof createTestDb>, householdId: string, profileId: string, date: string): Promise<number> {
  const meals = await db.select().from(plannedMeals).where(and(eq(plannedMeals.householdId, householdId), eq(plannedMeals.date, date)));
  const portions = await db
    .select()
    .from(plannedMealPortions)
    .where(
      and(
        inArray(plannedMealPortions.plannedMealId, meals.map((m) => m.id)),
        eq(plannedMealPortions.profileId, profileId),
        isNull(plannedMealPortions.deletedAt),
      ),
    );

  let total = 0;
  for (const portion of portions) {
    const meal = meals.find((m) => m.id === portion.plannedMealId)!;
    if (meal.itemType === 'food') {
      const [food] = await db.select().from(foods).where(eq(foods.id, meal.itemId));
      total += food.kcalPer100 * portion.multiplier;
    } else {
      const [recipe] = await db.select().from(recipes).where(eq(recipes.id, meal.itemId));
      const ingredientRows = await db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, meal.itemId));
      const withFoods = await Promise.all(
        ingredientRows.map(async (ingredient) => {
          const [food] = await db.select().from(foods).where(eq(foods.id, ingredient.foodId));
          return { amount: ingredient.amount, food };
        }),
      );
      const nutrition = computeRecipeNutrition(withFoods, recipe.servingsBase);
      total += nutrition.kcal * portion.multiplier;
    }
  }
  return total;
}

// A week comfortably in the future relative to any real test-run date, so
// every date in it is unambiguously "not the past" for the read-only guard.
const FUTURE_MONDAY = startOfWeek('2031-03-12');

async function createAdult(db: ReturnType<typeof createTestDb>, householdId: string, overrides: Partial<Parameters<typeof createProfile>[1]> = {}) {
  return createProfile(db, {
    householdId,
    name: 'Adult',
    profileType: 'adult',
    sex: 'male',
    birthDate: '1990-01-01',
    heightCm: 180,
    activityLevel: 'moderate',
    goal: 'maintain',
    weightKg: 80,
    bodyFatPct: 20,
    ...overrides,
  });
}

describe('plan generator (repository)', () => {
  it('never writes rows for a week entirely in the past', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await createAdult(db, householdId);
    await seedIfEmpty(db);

    const pastMonday = startOfWeek('2000-01-10');
    await generateWeek(db, householdId, pastMonday);

    const rows = await db.select().from(plannedMeals).where(eq(plannedMeals.householdId, householdId));
    expect(rows).toHaveLength(0);
  });

  it('generates a full week of shared main meals and per-profile snacks for a single adult', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    const profileId = await createAdult(db, householdId);
    await seedIfEmpty(db);

    await generateWeek(db, householdId, FUTURE_MONDAY, 1234);

    const dates = weekDates(FUTURE_MONDAY);
    const rows = await db.select().from(plannedMeals).where(eq(plannedMeals.householdId, householdId));
    expect(rows.length).toBeGreaterThan(0);

    for (const date of dates) {
      for (const slotKey of ['breakfast', 'lunch', 'dinner']) {
        const meal = rows.find((r) => r.date === date && r.slotKey === slotKey);
        expect(meal).toBeDefined();
        expect(meal!.profileId).toBeNull(); // shared track for a single sharing profile

        const portions = await db
          .select()
          .from(plannedMealPortions)
          .where(and(eq(plannedMealPortions.plannedMealId, meal!.id), isNull(plannedMealPortions.deletedAt)));
        expect(portions).toHaveLength(1);
        expect(portions[0].profileId).toBe(profileId);
        expect(portions[0].multiplier).toBeGreaterThan(0);
      }

      for (const slotKey of ['snack_morning', 'snack_afternoon']) {
        const meal = rows.find((r) => r.date === date && r.slotKey === slotKey);
        // A snack may legitimately be unassigned if nothing fits, but with the
        // seed database it should always find a candidate.
        expect(meal).toBeDefined();
        expect(meal!.profileId).toBe(profileId);
      }
    }
  });

  it("keeps a full day's planned calories within ±100 kcal of the profile's daily target", async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    const profileId = await createAdult(db, householdId);
    await seedIfEmpty(db);

    await generateWeek(db, householdId, FUTURE_MONDAY, 777);

    const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId));
    const targets = computeTargets({
      profileType: 'adult',
      sex: profile.sex,
      ageYears: ageYears(profile.birthDate),
      heightCm: profile.heightCm,
      weightKg: 80,
      bodyFatPct: 20,
      activityLevel: profile.activityLevel,
      goal: 'maintain',
      manualAdjustmentKcal: profile.tdciManualAdjustmentKcal,
      fiberMode: 'efsa_min',
    });

    for (const date of weekDates(FUTURE_MONDAY)) {
      const plannedKcal = await sumPlannedKcal(db, householdId, profileId, date);
      expect(Math.abs(plannedKcal - targets.adjustedTdciKcal)).toBeLessThanOrEqual(100);
    }
  });

  it('keeps every recipe within its effective weekly repetition limit', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await createAdult(db, householdId);
    await seedIfEmpty(db);

    await generateWeek(db, householdId, FUTURE_MONDAY, 42);

    const rows = await db
      .select()
      .from(plannedMeals)
      .where(and(eq(plannedMeals.householdId, householdId), eq(plannedMeals.itemType, 'recipe')));

    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.itemId, (counts.get(row.itemId) ?? 0) + 1);

    for (const [recipeId, count] of counts) {
      const [recipe] = await db.select().from(recipes).where(eq(recipes.id, recipeId));
      const limit = recipe.maxRepetitionsPerWeek ?? 2; // household default from createHouseholdWithDefaults
      expect(count).toBeLessThanOrEqual(limit);
    }
  });

  it('locks an eaten meal so regenerating the day leaves it untouched', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await createAdult(db, householdId);
    await seedIfEmpty(db);

    await generateWeek(db, householdId, FUTURE_MONDAY, 7);

    const [breakfast] = await db
      .select()
      .from(plannedMeals)
      .where(
        and(
          eq(plannedMeals.householdId, householdId),
          eq(plannedMeals.date, FUTURE_MONDAY),
          eq(plannedMeals.slotKey, 'breakfast'),
        ),
      );
    const [portion] = await db
      .select()
      .from(plannedMealPortions)
      .where(eq(plannedMealPortions.plannedMealId, breakfast.id));

    await setPortionStatus(db, portion.id, 'eaten');
    const lockedRecipeId = breakfast.itemId;

    await regenerateDay(db, householdId, FUTURE_MONDAY, 999);

    const [breakfastAfter] = await db
      .select()
      .from(plannedMeals)
      .where(
        and(
          eq(plannedMeals.householdId, householdId),
          eq(plannedMeals.date, FUTURE_MONDAY),
          eq(plannedMeals.slotKey, 'breakfast'),
        ),
      );
    expect(breakfastAfter.itemId).toBe(lockedRecipeId);
    expect(breakfastAfter.id).toBe(breakfast.id); // same row, never cleared

    const [portionAfter] = await db
      .select()
      .from(plannedMealPortions)
      .where(eq(plannedMealPortions.id, portion.id));
    expect(portionAfter.status).toBe('eaten');
  });

  it('never picks a main-meal recipe whose calories exceed 0.6x the profile\'s daily target when a reasonable one exists', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    const profileId = await createAdult(db, householdId);
    await seedIfEmpty(db);

    const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId));
    const targets = computeTargets({
      profileType: 'adult',
      sex: profile.sex,
      ageYears: ageYears(profile.birthDate),
      heightCm: profile.heightCm,
      weightKg: 80,
      bodyFatPct: 20,
      activityLevel: profile.activityLevel,
      goal: 'maintain',
      manualAdjustmentKcal: profile.tdciManualAdjustmentKcal,
      fiberMode: 'efsa_min',
    });

    const oversizedFoodId = await upsertFood(db, {
      nameCs: 'Obří hostina',
      nameEn: 'Giant feast',
      category: 'grain',
      baseUnit: 'g',
      kcalPer100: 200,
      proteinPer100: 10,
      carbsPer100: 20,
      fatPer100: 8,
      budget: 'average',
      snackSuitable: false,
      dietFlags: [],
      allergens: [],
    });
    const oversizedRecipeId = await upsertRecipe(db, {
      nameCs: 'Obří hostina',
      nameEn: 'Giant feast',
      category: 'lunch_dinner',
      isSide: false,
      budget: 'average',
      servingsBase: 1,
      // ~0.7x the daily target in a single portion – well over the 0.6x cap.
      ingredients: [{ foodId: oversizedFoodId, amount: (targets.adjustedTdciKcal * 0.7 * 100) / 200 }],
    });

    await generateWeek(db, householdId, FUTURE_MONDAY, 999);

    const rows = await db
      .select()
      .from(plannedMeals)
      .where(
        and(
          eq(plannedMeals.householdId, householdId),
          inArray(plannedMeals.slotKey, ['lunch', 'dinner']),
          isNull(plannedMeals.deletedAt),
        ),
      );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.itemId !== oversizedRecipeId)).toBe(true);
  });

  it("favors a main-slot recipe matching a profile's protein/fat slot override over one that doesn't (item 7)", async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    // A generous per-recipe cap so 7 days of picks from only 2 candidates
    // never exhausts either one's weekly repetition budget mid-week.
    await updateHouseholdSettings(db, householdId, { defaultMaxRepetitionsPerWeek: 7, defaultAllowConsecutiveDays: true });
    const profileId = await createAdult(db, householdId);
    // No seedIfEmpty here: isolates the two candidates below as the *only*
    // lunch_dinner recipes, so the macro-fit signal isn't diluted by an
    // unrelated seeded pool competing on repetition/favorite/budget scoring.

    const [lunchSlot] = await db.select().from(mealSlotSettings).where(eq(mealSlotSettings.slotKey, 'lunch'));
    // Fixes the slot's kcal budget (0.2 × daily target) so the target
    // protein/fat ratio below is exactly known, independent of the profile's
    // own computed daily target.
    await upsertProfileSlotPortion(db, profileId, lunchSlot.id, {
      calorieSharePercent: 0.2,
      proteinTargetG: 50,
      fatTargetG: 15,
    });

    // Ratios engineered to match the slot target (50g protein / 15g fat @
    // ~540 kcal, i.e. 0.2 × a ~2700 kcal daily target): 18.5g protein and
    // 5.6g fat per 100 kcal.
    const balancedFoodId = await upsertFood(db, {
      nameCs: 'Vyvážené jídlo',
      nameEn: 'Balanced meal',
      category: 'meat',
      baseUnit: 'g',
      kcalPer100: 200,
      proteinPer100: 18.5,
      carbsPer100: 19,
      fatPer100: 5.6,
      budget: 'average',
      snackSuitable: false,
      dietFlags: [],
      allergens: [],
    });
    const matchingRecipeId = await upsertRecipe(db, {
      nameCs: 'Vyvážené jídlo',
      nameEn: 'Balanced meal',
      category: 'lunch_dinner',
      isSide: false,
      budget: 'average',
      servingsBase: 1,
      ingredients: [{ foodId: balancedFoodId, amount: 270 }], // ~540 kcal, ~50g protein, ~15g fat
    });

    const pastaId = await upsertFood(db, {
      nameCs: 'Těstoviny',
      nameEn: 'Pasta',
      category: 'grain',
      baseUnit: 'g',
      kcalPer100: 350,
      proteinPer100: 8,
      carbsPer100: 75,
      fatPer100: 1,
      budget: 'average',
      snackSuitable: false,
      dietFlags: [],
      allergens: ['gluten'],
    });
    const mismatchedRecipeId = await upsertRecipe(db, {
      nameCs: 'Těstoviny',
      nameEn: 'Pasta',
      category: 'lunch_dinner',
      isSide: false,
      budget: 'average',
      servingsBase: 1,
      ingredients: [{ foodId: pastaId, amount: 154 }], // ~539 kcal, ~12g protein, ~1.5g fat
    });

    // generateWeek scores every day's lunch independently (unlike
    // regenerateSlot, which excludes the current pick and would force a
    // strict alternation between exactly two candidates regardless of
    // score) – re-running it several times samples the weighted-random
    // pick enough to show the macro-fit bonus's effect on win rate.
    const picks = { matching: 0, mismatched: 0, other: 0 };
    for (let seed = 1; seed <= 20; seed += 1) {
      await generateWeek(db, householdId, FUTURE_MONDAY, seed);
      const rows = await db
        .select()
        .from(plannedMeals)
        .where(
          and(
            eq(plannedMeals.householdId, householdId),
            eq(plannedMeals.slotKey, 'lunch'),
            isNull(plannedMeals.deletedAt),
          ),
        );
      for (const row of rows) {
        if (row.itemId === matchingRecipeId) picks.matching += 1;
        else if (row.itemId === mismatchedRecipeId) picks.mismatched += 1;
        else picks.other += 1;
      }
    }

    expect(picks.matching).toBeGreaterThan(picks.mismatched);
  });

  it('swap replaces a slot with a different recipe than the one being excluded', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await createAdult(db, householdId);
    await seedIfEmpty(db);

    await generateWeek(db, householdId, FUTURE_MONDAY, 55);

    const [lunchBefore] = await db
      .select()
      .from(plannedMeals)
      .where(
        and(
          eq(plannedMeals.householdId, householdId),
          eq(plannedMeals.date, FUTURE_MONDAY),
          eq(plannedMeals.slotKey, 'lunch'),
        ),
      );

    await regenerateSlot(db, householdId, FUTURE_MONDAY, 'lunch', null, 1);

    const [lunchAfter] = await db
      .select()
      .from(plannedMeals)
      .where(
        and(
          eq(plannedMeals.householdId, householdId),
          eq(plannedMeals.date, FUTURE_MONDAY),
          eq(plannedMeals.slotKey, 'lunch'),
        ),
      );

    expect(lunchAfter.itemId).not.toBe(lunchBefore.itemId);
    const portions = await db
      .select()
      .from(plannedMealPortions)
      .where(and(eq(plannedMealPortions.plannedMealId, lunchAfter.id), isNull(plannedMealPortions.deletedAt)));
    expect(portions).toHaveLength(1);
    expect(portions[0].multiplier).toBeGreaterThan(0);
  });

  it('does not touch an eaten slot when swap is attempted on it', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await createAdult(db, householdId);
    await seedIfEmpty(db);
    await generateWeek(db, householdId, FUTURE_MONDAY, 3);

    const [dinner] = await db
      .select()
      .from(plannedMeals)
      .where(
        and(
          eq(plannedMeals.householdId, householdId),
          eq(plannedMeals.date, FUTURE_MONDAY),
          eq(plannedMeals.slotKey, 'dinner'),
        ),
      );
    const [portion] = await db.select().from(plannedMealPortions).where(eq(plannedMealPortions.plannedMealId, dinner.id));
    await setPortionStatus(db, portion.id, 'eaten');

    await regenerateSlot(db, householdId, FUTURE_MONDAY, 'dinner', null, 9);

    const [dinnerAfter] = await db.select().from(plannedMeals).where(eq(plannedMeals.id, dinner.id));
    expect(dinnerAfter.itemId).toBe(dinner.itemId);
  });

  it('gives a profile with an independent diet its own recipe track that respects its diet', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await createAdult(db, householdId); // shares the household track

    const veggieId = await createAdult(db, householdId, {
      name: 'Veggie',
      sharesMainMeals: false,
      diets: ['vegetarian'],
    });

    // Two minimal lunch_dinner recipes: one vegetarian-compatible, one not.
    const veggieFoodId = await upsertFood(db, {
      nameCs: 'Čočka',
      nameEn: 'Lentils',
      category: 'legumes',
      baseUnit: 'g',
      kcalPer100: 350,
      proteinPer100: 25,
      carbsPer100: 60,
      fatPer100: 1,
      budget: 'cheap',
      snackSuitable: false,
      dietFlags: ['vegetarian', 'vegan'],
      allergens: [],
    });
    const meatFoodId = await upsertFood(db, {
      nameCs: 'Kuře',
      nameEn: 'Chicken',
      category: 'meat',
      baseUnit: 'g',
      kcalPer100: 120,
      proteinPer100: 22,
      carbsPer100: 0,
      fatPer100: 3,
      budget: 'average',
      snackSuitable: false,
      dietFlags: [],
      allergens: [],
    });

    const veggieRecipeId = await upsertRecipe(db, {
      nameCs: 'Čočka na kyselo',
      nameEn: 'Lentil stew',
      category: 'lunch_dinner',
      isSide: false,
      budget: 'cheap',
      servingsBase: 1,
      ingredients: [{ foodId: veggieFoodId, amount: 200 }],
    });
    const meatRecipeId = await upsertRecipe(db, {
      nameCs: 'Kuřecí prsa',
      nameEn: 'Chicken breast',
      category: 'lunch_dinner',
      isSide: false,
      budget: 'average',
      servingsBase: 1,
      ingredients: [{ foodId: meatFoodId, amount: 200 }],
    });

    await generateWeek(db, householdId, FUTURE_MONDAY, 21);

    const veggieMeals = await db
      .select()
      .from(plannedMeals)
      .where(
        and(
          eq(plannedMeals.householdId, householdId),
          eq(plannedMeals.date, FUTURE_MONDAY),
          eq(plannedMeals.profileId, veggieId),
        ),
      );
    const lunch = veggieMeals.find((m) => m.slotKey === 'lunch');
    expect(lunch).toBeDefined();
    expect(lunch!.itemId).toBe(veggieRecipeId);
    expect(lunch!.itemId).not.toBe(meatRecipeId);
  });

  it('assignManualMeal fills an empty slot and scales it to the profile target', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await createAdult(db, householdId);
    await seedIfEmpty(db);

    // No generation has run yet – the slot starts empty.
    const [recipe] = await db.select().from(recipes).where(eq(recipes.category, 'lunch_dinner'));
    await assignManualMeal(db, householdId, FUTURE_MONDAY, 'lunch', null, 'recipe', recipe.id);

    const [meal] = await db
      .select()
      .from(plannedMeals)
      .where(
        and(
          eq(plannedMeals.householdId, householdId),
          eq(plannedMeals.date, FUTURE_MONDAY),
          eq(plannedMeals.slotKey, 'lunch'),
        ),
      );
    expect(meal.itemId).toBe(recipe.id);

    const portions = await db
      .select()
      .from(plannedMealPortions)
      .where(and(eq(plannedMealPortions.plannedMealId, meal.id), isNull(plannedMealPortions.deletedAt)));
    expect(portions).toHaveLength(1);
    expect(portions[0].multiplier).toBeGreaterThan(0);
  });

  it("uses the profile's activity multiplier and macro overrides for the generator's daily target, same as the UI (G1 regression)", async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    // A fine-grained multiplier away from 'moderate's 1.55 midpoint, plus a
    // protein override well outside the default 1.4-2.0 g/kg-LBM range –
    // if the generator recomputed targets independently (the G1 bug) it
    // would ignore both and use the level-midpoint/default-range target.
    const profileId = await createAdult(db, householdId, { activityMultiplier: 1.7 });
    await updateProfileMacroOverrides(db, profileId, { proteinPerKgLbm: 2.4 });
    await seedIfEmpty(db);

    await generateWeek(db, householdId, FUTURE_MONDAY, 777);

    const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId));
    const uiTargets = computeTargets({
      profileType: 'adult',
      sex: profile.sex,
      ageYears: ageYears(profile.birthDate),
      heightCm: profile.heightCm,
      weightKg: 80,
      bodyFatPct: 20,
      activityLevel: profile.activityLevel,
      activityMultiplier: profile.activityMultiplier,
      goal: 'maintain',
      manualAdjustmentKcal: profile.tdciManualAdjustmentKcal,
      proteinPerKgLbm: 2.4,
      fiberMode: 'efsa_min',
    });

    for (const date of weekDates(FUTURE_MONDAY)) {
      const plannedKcal = await sumPlannedKcal(db, householdId, profileId, date);
      expect(Math.abs(plannedKcal - uiTargets.adjustedTdciKcal)).toBeLessThanOrEqual(100);
    }
  });

  it('assignManualMeal blocks a manual pick that conflicts with an allergy unless acknowledged', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await createAdult(db, householdId, { allergens: ['gluten'] });
    await seedIfEmpty(db);

    const breadId = await upsertFood(db, {
      nameCs: 'Chleba',
      nameEn: 'Bread',
      category: 'grain',
      baseUnit: 'g',
      kcalPer100: 250,
      proteinPer100: 8,
      carbsPer100: 45,
      fatPer100: 2,
      budget: 'cheap',
      snackSuitable: false,
      dietFlags: [],
      allergens: ['gluten'],
    });
    const glutenRecipeId = await upsertRecipe(db, {
      nameCs: 'Toast',
      nameEn: 'Toast',
      category: 'lunch_dinner',
      isSide: false,
      budget: 'cheap',
      servingsBase: 1,
      ingredients: [{ foodId: breadId, amount: 200 }],
    });

    const blocked = await assignManualMeal(db, householdId, FUTURE_MONDAY, 'lunch', null, 'recipe', glutenRecipeId);
    expect(blocked.conflicts).toEqual([{ kind: 'allergen', value: 'gluten' }]);

    const [mealAfterBlock] = await db
      .select()
      .from(plannedMeals)
      .where(
        and(
          eq(plannedMeals.householdId, householdId),
          eq(plannedMeals.date, FUTURE_MONDAY),
          eq(plannedMeals.slotKey, 'lunch'),
        ),
      );
    expect(mealAfterBlock).toBeUndefined();

    const acknowledged = await assignManualMeal(
      db,
      householdId,
      FUTURE_MONDAY,
      'lunch',
      null,
      'recipe',
      glutenRecipeId,
      true,
    );
    expect(acknowledged.conflicts).toEqual([{ kind: 'allergen', value: 'gluten' }]);

    const [mealAfterAck] = await db
      .select()
      .from(plannedMeals)
      .where(
        and(
          eq(plannedMeals.householdId, householdId),
          eq(plannedMeals.date, FUTURE_MONDAY),
          eq(plannedMeals.slotKey, 'lunch'),
        ),
      );
    expect(mealAfterAck?.itemId).toBe(glutenRecipeId);
  });

  it('addMealExtra blocks an extra that conflicts with an allergy unless acknowledged', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await createAdult(db, householdId, { allergens: ['nuts'] });
    await seedIfEmpty(db);

    const walnutsId = await upsertFood(db, {
      nameCs: 'Vlašské ořechy',
      nameEn: 'Walnuts',
      category: 'snack',
      baseUnit: 'g',
      kcalPer100: 650,
      proteinPer100: 15,
      carbsPer100: 14,
      fatPer100: 65,
      budget: 'average',
      snackSuitable: true,
      dietFlags: [],
      allergens: ['nuts'],
    });

    const [recipe] = await db.select().from(recipes).where(eq(recipes.category, 'lunch_dinner'));
    await assignManualMeal(db, householdId, FUTURE_MONDAY, 'lunch', null, 'recipe', recipe.id);
    const [meal] = await db
      .select()
      .from(plannedMeals)
      .where(
        and(
          eq(plannedMeals.householdId, householdId),
          eq(plannedMeals.date, FUTURE_MONDAY),
          eq(plannedMeals.slotKey, 'lunch'),
        ),
      );

    const blocked = await addMealExtra(db, meal.id, 'food', walnutsId);
    expect(blocked.conflicts).toEqual([{ kind: 'allergen', value: 'nuts' }]);
    const extrasAfterBlock = await db.select().from(plannedMealExtras).where(eq(plannedMealExtras.plannedMealId, meal.id));
    expect(extrasAfterBlock).toHaveLength(0);

    const acknowledged = await addMealExtra(db, meal.id, 'food', walnutsId, true);
    expect(acknowledged.conflicts).toEqual([{ kind: 'allergen', value: 'nuts' }]);
    const extrasAfterAck = await db.select().from(plannedMealExtras).where(eq(plannedMealExtras.plannedMealId, meal.id));
    expect(extrasAfterAck).toHaveLength(1);
  });

  it('assignManualMeal refuses to overwrite an eaten-locked slot', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await createAdult(db, householdId);
    await seedIfEmpty(db);
    await generateWeek(db, householdId, FUTURE_MONDAY, 11);

    const [breakfast] = await db
      .select()
      .from(plannedMeals)
      .where(
        and(
          eq(plannedMeals.householdId, householdId),
          eq(plannedMeals.date, FUTURE_MONDAY),
          eq(plannedMeals.slotKey, 'breakfast'),
        ),
      );
    const [portion] = await db.select().from(plannedMealPortions).where(eq(plannedMealPortions.plannedMealId, breakfast.id));
    await setPortionStatus(db, portion.id, 'eaten');

    const breakfastRecipes = await db.select().from(recipes).where(eq(recipes.category, 'breakfast'));
    const otherRecipe = breakfastRecipes.find((r) => r.id !== breakfast.itemId);
    expect(otherRecipe).toBeDefined();
    await assignManualMeal(db, householdId, FUTURE_MONDAY, 'breakfast', null, 'recipe', otherRecipe!.id);

    const [breakfastAfter] = await db.select().from(plannedMeals).where(eq(plannedMeals.id, breakfast.id));
    expect(breakfastAfter.itemId).toBe(breakfast.itemId);
  });
});
