import { and, eq, inArray, isNull } from 'drizzle-orm';

import { ageYears } from '../../domain/age';
import { computeRecipeNutrition } from '../../domain/recipeNutrition';
import { computeTargets } from '../../domain/targets';
import { addDays, daysInCalendarMonth, startOfWeek, weekDates } from '../../domain/week';
import {
  createHouseholdWithDefaults,
  enableRecommendedSnackSlots,
  insertMealSlot,
  updateHouseholdSettings,
} from '../repositories/households';
import { setRating, upsertFood, upsertRecipe } from '../repositories/library';
import {
  addMealExtra,
  assignManualMeal,
  copyDayMeals,
  generateMonth,
  generateWeek,
  regenerateDay,
  regenerateSlot,
  saveMealAsRecipe,
  setPortionStatus,
  updatePortionMultiplier,
} from '../repositories/plan';
import { createProfile, updateProfileMacroOverrides, upsertProfileSlotPortion } from '../repositories/profiles';
import { setRecipeResolution } from '../repositories/ratings';
import {
  foods,
  householdSettings,
  mealSlotSettings,
  plannedMealExtras,
  plannedMealPortions,
  plannedMeals,
  profiles,
  recipeIngredients,
  recipes,
} from '../schema';
import { seedIfEmpty } from '../seed';
import { createTestDb } from '../testing/testDb';

/** A single planned meal's kcal for one profile's portion, joining down to real recipe/food nutrition. */
async function mealKcal(db: ReturnType<typeof createTestDb>, mealId: string, profileId: string): Promise<number> {
  const [meal] = await db.select().from(plannedMeals).where(eq(plannedMeals.id, mealId));
  const [portion] = await db
    .select()
    .from(plannedMealPortions)
    .where(and(eq(plannedMealPortions.plannedMealId, mealId), eq(plannedMealPortions.profileId, profileId), isNull(plannedMealPortions.deletedAt)));
  if (meal.itemType === 'food') {
    const [food] = await db.select().from(foods).where(eq(foods.id, meal.itemId));
    return food.kcalPer100 * portion.multiplier;
  }
  const [recipe] = await db.select().from(recipes).where(eq(recipes.id, meal.itemId));
  const ingredientRows = await db.select().from(recipeIngredients).where(eq(recipeIngredients.recipeId, meal.itemId));
  const withFoods = await Promise.all(
    ingredientRows.map(async (ingredient) => {
      const [food] = await db.select().from(foods).where(eq(foods.id, ingredient.foodId));
      return { amount: ingredient.amount, food };
    }),
  );
  const nutrition = computeRecipeNutrition(withFoods, recipe.servingsBase);
  return nutrition.kcal * portion.multiplier;
}

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

  it('generates every day of a calendar month', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await createAdult(db, householdId);
    await seedIfEmpty(db);

    const monthAnchor = '2031-04-15';
    await generateMonth(db, householdId, monthAnchor, 4242);

    const days = daysInCalendarMonth(monthAnchor);
    const rows = await db.select().from(plannedMeals).where(eq(plannedMeals.householdId, householdId));
    for (const date of days) {
      const meal = rows.find((r) => r.date === date && r.slotKey === 'breakfast');
      expect(meal).toBeDefined();
    }
  });

  it('generates a full week of shared main meals and per-profile snacks for a single adult', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await enableRecommendedSnackSlots(db, householdId);
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

  it('a profile without a slot in enabledSlotKeys never gets a meal there (phase H)', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await enableRecommendedSnackSlots(db, householdId);
    await createAdult(db, householdId, {
      enabledSlotKeys: ['breakfast', 'lunch', 'dinner', 'snack_morning'], // no snack_afternoon
    });
    await seedIfEmpty(db);

    await generateWeek(db, householdId, FUTURE_MONDAY, 1234);

    const dates = weekDates(FUTURE_MONDAY);
    const rows = await db.select().from(plannedMeals).where(eq(plannedMeals.householdId, householdId));
    for (const date of dates) {
      expect(rows.find((r) => r.date === date && r.slotKey === 'snack_afternoon')).toBeUndefined();
      expect(rows.find((r) => r.date === date && r.slotKey === 'snack_morning')).toBeDefined();
    }
  });

  it('splits remaining calories across multiple snack slots instead of giving it all to the first one', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await enableRecommendedSnackSlots(db, householdId);
    await seedIfEmpty(db);

    const existingSlots = await db.select().from(mealSlotSettings).where(eq(mealSlotSettings.householdId, householdId));
    const dinner = existingSlots.find((s) => s.slotKey === 'dinner')!;
    const customSlotId = await insertMealSlot(db, householdId, { afterSlotId: dinner.id, label: 'Extra snack', time: '20:30' });
    const customSlotKey = `custom_${customSlotId}`;

    const profileId = await createAdult(db, householdId, {
      enabledSlotKeys: ['breakfast', 'lunch', 'dinner', 'snack_morning', 'snack_afternoon', customSlotKey],
    });

    await generateWeek(db, householdId, FUTURE_MONDAY, 1234);

    const rows = await db
      .select()
      .from(plannedMeals)
      .where(and(eq(plannedMeals.householdId, householdId), eq(plannedMeals.date, FUTURE_MONDAY)));
    const snackKeys = ['snack_morning', 'snack_afternoon', customSlotKey];
    const snackMeals = snackKeys.map((key) => rows.find((r) => r.slotKey === key));
    expect(snackMeals.every((m) => m !== undefined)).toBe(true);

    const kcals = await Promise.all(snackMeals.map((meal) => mealKcal(db, meal!.id, profileId)));
    const maxKcal = Math.max(...kcals);
    const minKcal = Math.min(...kcals);
    expect(minKcal).toBeGreaterThan(0);
    // Before the fix, the first slot in sortOrder claimed nearly the entire
    // remaining budget and the rest got next to nothing - a >3x spread would
    // never happen with a proportional split across 3 roughly-equal-weight slots.
    expect(maxKcal / minKcal).toBeLessThan(3);
  });

  it('skips a shared main slot entirely when no sharing profile has it enabled (phase H)', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await createAdult(db, householdId, {
      enabledSlotKeys: ['breakfast', 'lunch', 'snack_morning', 'snack_afternoon'], // no dinner
    });
    await seedIfEmpty(db);

    await generateWeek(db, householdId, FUTURE_MONDAY, 1234);

    const dates = weekDates(FUTURE_MONDAY);
    const rows = await db.select().from(plannedMeals).where(eq(plannedMeals.householdId, householdId));
    for (const date of dates) {
      expect(rows.find((r) => r.date === date && r.slotKey === 'dinner')).toBeUndefined();
      expect(rows.find((r) => r.date === date && r.slotKey === 'lunch')).toBeDefined();
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

  it('splits a "serve_separately"-resolved recipe into a shared row for the liking profile and an individual row for the disliking one', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    // A is allergic to nuts so recipeY (which contains a nut ingredient) is
    // never a valid SHARED candidate, leaving recipeX as the shared group's
    // only option regardless of scoring/RNG – makes the pick deterministic.
    const profileAId = await createAdult(db, householdId, { name: 'A', allergens: ['nuts'] });
    const profileBId = await createAdult(db, householdId, { name: 'B' });

    const plainFoodId = await upsertFood(db, {
      nameCs: 'Kuře', nameEn: 'Chicken', category: 'meat', baseUnit: 'g',
      kcalPer100: 165, proteinPer100: 31, carbsPer100: 0, fatPer100: 3.6,
      budget: 'average', snackSuitable: false, dietFlags: [], allergens: [],
    });
    const recipeXId = await upsertRecipe(db, {
      nameCs: 'Recept X', nameEn: 'Recipe X', category: 'lunch_dinner', isSide: false,
      budget: 'average', servingsBase: 1, ingredients: [{ foodId: plainFoodId, amount: 300 }],
    });

    const nutFoodId = await upsertFood(db, {
      nameCs: 'Ořechy', nameEn: 'Nuts', category: 'nuts', baseUnit: 'g',
      kcalPer100: 600, proteinPer100: 20, carbsPer100: 20, fatPer100: 50,
      budget: 'average', snackSuitable: false, dietFlags: [], allergens: ['nuts'],
    });
    const recipeYId = await upsertRecipe(db, {
      nameCs: 'Recept Y', nameEn: 'Recipe Y', category: 'lunch_dinner', isSide: false,
      budget: 'average', servingsBase: 1, ingredients: [{ foodId: nutFoodId, amount: 100 }],
    });

    await setRating(db, profileAId, 'recipe', recipeXId, 'like');
    await setRating(db, profileBId, 'recipe', recipeXId, 'dislike');
    await setRecipeResolution(db, householdId, recipeXId, 'serve_separately');

    await generateWeek(db, householdId, FUTURE_MONDAY, 1);

    const lunchDate = weekDates(FUTURE_MONDAY)[0];
    const meals = await db
      .select()
      .from(plannedMeals)
      .where(
        and(
          eq(plannedMeals.householdId, householdId),
          eq(plannedMeals.date, lunchDate),
          eq(plannedMeals.slotKey, 'lunch'),
          isNull(plannedMeals.deletedAt),
        ),
      );

    const sharedRow = meals.find((m) => m.profileId === null);
    const individualRow = meals.find((m) => m.profileId === profileBId);
    expect(sharedRow?.itemId).toBe(recipeXId);
    expect(individualRow?.itemId).toBe(recipeYId);

    const sharedPortions = await db
      .select()
      .from(plannedMealPortions)
      .where(and(eq(plannedMealPortions.plannedMealId, sharedRow!.id), isNull(plannedMealPortions.deletedAt)));
    expect(sharedPortions.map((p) => p.profileId)).toEqual([profileAId]);
  });

  it('generates two consecutive weeks without error for a profile with "wants new foods" enabled (exercises the recent-history lookup)', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await createAdult(db, householdId, { wantsNewFoods: true });
    await seedIfEmpty(db);

    await generateWeek(db, householdId, FUTURE_MONDAY, 1);
    // The second week's generation reads the first week's history for novelty scoring.
    const secondMonday = addDays(FUTURE_MONDAY, 7);
    await generateWeek(db, householdId, secondMonday, 2);

    const rows = await db.select().from(plannedMeals).where(eq(plannedMeals.householdId, householdId));
    const firstWeekRows = rows.filter((r) => weekDates(FUTURE_MONDAY).includes(r.date));
    const secondWeekRows = rows.filter((r) => weekDates(secondMonday).includes(r.date));
    expect(firstWeekRows.length).toBeGreaterThan(0);
    expect(secondWeekRows.length).toBeGreaterThan(0);
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

  it('updatePortionMultiplier updates the multiplier and refuses once the portion is eaten', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await createAdult(db, householdId);
    await seedIfEmpty(db);

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
    const [portion] = await db
      .select()
      .from(plannedMealPortions)
      .where(and(eq(plannedMealPortions.plannedMealId, meal.id), isNull(plannedMealPortions.deletedAt)));

    expect(await updatePortionMultiplier(db, portion.id, 1.5)).toBe(true);
    const [updated] = await db.select().from(plannedMealPortions).where(eq(plannedMealPortions.id, portion.id));
    expect(updated.multiplier).toBe(1.5);

    await setPortionStatus(db, portion.id, 'eaten');
    expect(await updatePortionMultiplier(db, portion.id, 2)).toBe(false);
    const [afterRefuse] = await db.select().from(plannedMealPortions).where(eq(plannedMealPortions.id, portion.id));
    expect(afterRefuse.multiplier).toBe(1.5);
  });

  it('saveMealAsRecipe clones a recipe-backed meal, scaling ingredient amounts by the portion multiplier', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    const profileId = await createAdult(db, householdId);

    const foodId = await upsertFood(db, {
      nameCs: 'Kuře', nameEn: 'Chicken', category: 'meat', baseUnit: 'g',
      kcalPer100: 165, proteinPer100: 31, carbsPer100: 0, fatPer100: 3.6,
      budget: 'average', snackSuitable: false, dietFlags: [], allergens: [],
    });
    const recipeId = await upsertRecipe(db, {
      nameCs: 'Recept', nameEn: 'Recipe', category: 'lunch_dinner', isSide: false,
      budget: 'average', servingsBase: 1, ingredients: [{ foodId, amount: 200 }],
    });

    await assignManualMeal(db, householdId, FUTURE_MONDAY, 'lunch', null, 'recipe', recipeId);
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
    const [portion] = await db
      .select()
      .from(plannedMealPortions)
      .where(and(eq(plannedMealPortions.plannedMealId, meal.id), isNull(plannedMealPortions.deletedAt)));
    await updatePortionMultiplier(db, portion.id, 2);

    const newRecipeId = await saveMealAsRecipe(db, meal.id, profileId);
    const newIngredients = await db
      .select()
      .from(recipeIngredients)
      .where(and(eq(recipeIngredients.recipeId, newRecipeId), isNull(recipeIngredients.deletedAt)));
    expect(newIngredients).toHaveLength(1);
    expect(newIngredients[0].foodId).toBe(foodId);
    expect(newIngredients[0].amount).toBe(400);
  });

  it('saveMealAsRecipe approximates a food-backed meal as a single 100g-times-multiplier ingredient', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await enableRecommendedSnackSlots(db, householdId);
    const profileId = await createAdult(db, householdId);

    const foodId = await upsertFood(db, {
      nameCs: 'Jogurt', nameEn: 'Yogurt', category: 'dairy', baseUnit: 'g',
      kcalPer100: 60, proteinPer100: 10, carbsPer100: 4, fatPer100: 0.2,
      budget: 'cheap', snackSuitable: true, dietFlags: [], allergens: [],
    });

    await assignManualMeal(db, householdId, FUTURE_MONDAY, 'snack_morning', null, 'food', foodId);
    const [meal] = await db
      .select()
      .from(plannedMeals)
      .where(
        and(
          eq(plannedMeals.householdId, householdId),
          eq(plannedMeals.date, FUTURE_MONDAY),
          eq(plannedMeals.slotKey, 'snack_morning'),
        ),
      );

    const newRecipeId = await saveMealAsRecipe(db, meal.id, profileId);
    const newIngredients = await db
      .select()
      .from(recipeIngredients)
      .where(and(eq(recipeIngredients.recipeId, newRecipeId), isNull(recipeIngredients.deletedAt)));
    expect(newIngredients).toHaveLength(1);
    expect(newIngredients[0].foodId).toBe(foodId);
    expect(newIngredients[0].amount).toBe(100);
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

  it('copyDayMeals copies shared + individual-track meals and extras, skips an eaten-locked target slot, and leaves a slot untouched that was empty on fromDate', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await createAdult(db, householdId); // shared track
    const veggieId = await createAdult(db, householdId, { name: 'Veggie', sharesMainMeals: false });

    const foodId = await upsertFood(db, {
      nameCs: 'Ovesné vločky',
      nameEn: 'Oats',
      category: 'grains',
      baseUnit: 'g',
      kcalPer100: 380,
      proteinPer100: 13,
      carbsPer100: 60,
      fatPer100: 7,
      budget: 'cheap',
      snackSuitable: true,
      dietFlags: [],
      allergens: [],
    });
    const extraFoodId = await upsertFood(db, {
      nameCs: 'Banán',
      nameEn: 'Banana',
      category: 'fruit',
      baseUnit: 'g',
      kcalPer100: 90,
      proteinPer100: 1,
      carbsPer100: 22,
      fatPer100: 0,
      budget: 'cheap',
      snackSuitable: true,
      dietFlags: [],
      allergens: [],
    });

    async function makeRecipe(name: string, category: 'breakfast' | 'lunch_dinner') {
      return upsertRecipe(db, {
        nameCs: name,
        nameEn: name,
        category,
        isSide: false,
        budget: 'cheap',
        servingsBase: 1,
        ingredients: [{ foodId, amount: 100 }],
      });
    }

    const breakfastFromRecipeId = await makeRecipe('Snídaně včera', 'breakfast');
    const breakfastTodayLockedRecipeId = await makeRecipe('Snídaně dnes (snězeno)', 'breakfast');
    const lunchSharedRecipeId = await makeRecipe('Oběd sdílený', 'lunch_dinner');
    const lunchVeggieRecipeId = await makeRecipe('Oběd veggie', 'lunch_dinner');
    const dinnerTodayRecipeId = await makeRecipe('Večeře dnes', 'lunch_dinner');

    const fromDate = FUTURE_MONDAY;
    const toDate = addDays(FUTURE_MONDAY, 1);

    // fromDate: breakfast (shared), lunch (shared) with an extra, lunch (veggie's own track).
    await assignManualMeal(db, householdId, fromDate, 'breakfast', null, 'recipe', breakfastFromRecipeId);
    await assignManualMeal(db, householdId, fromDate, 'lunch', null, 'recipe', lunchSharedRecipeId);
    await assignManualMeal(db, householdId, fromDate, 'lunch', veggieId, 'recipe', lunchVeggieRecipeId);
    const [fromLunch] = await db
      .select()
      .from(plannedMeals)
      .where(
        and(eq(plannedMeals.householdId, householdId), eq(plannedMeals.date, fromDate), eq(plannedMeals.slotKey, 'lunch'), isNull(plannedMeals.profileId)),
      );
    await addMealExtra(db, fromLunch.id, 'food', extraFoodId);

    // toDate: breakfast is already eaten (locked) with a different recipe; dinner is already planned (unlocked, not present on fromDate).
    await assignManualMeal(db, householdId, toDate, 'breakfast', null, 'recipe', breakfastTodayLockedRecipeId);
    const [toBreakfast] = await db
      .select()
      .from(plannedMeals)
      .where(and(eq(plannedMeals.householdId, householdId), eq(plannedMeals.date, toDate), eq(plannedMeals.slotKey, 'breakfast')));
    const [toBreakfastPortion] = await db.select().from(plannedMealPortions).where(eq(plannedMealPortions.plannedMealId, toBreakfast.id));
    await setPortionStatus(db, toBreakfastPortion.id, 'eaten');

    await assignManualMeal(db, householdId, toDate, 'dinner', null, 'recipe', dinnerTodayRecipeId);

    const result = await copyDayMeals(db, householdId, fromDate, toDate);
    expect(result).toEqual({ copied: 2, skipped: 1 }); // breakfast skipped (locked); lunch shared + lunch veggie copied

    const toMealsAfter = await db
      .select()
      .from(plannedMeals)
      .where(and(eq(plannedMeals.householdId, householdId), eq(plannedMeals.date, toDate)));

    const breakfastAfter = toMealsAfter.find((m) => m.slotKey === 'breakfast');
    expect(breakfastAfter!.itemId).toBe(breakfastTodayLockedRecipeId); // untouched – was locked

    const dinnerAfter = toMealsAfter.find((m) => m.slotKey === 'dinner');
    expect(dinnerAfter!.itemId).toBe(dinnerTodayRecipeId); // untouched – fromDate had no dinner

    const lunchSharedAfter = toMealsAfter.find((m) => m.slotKey === 'lunch' && m.profileId === null);
    expect(lunchSharedAfter!.itemId).toBe(lunchSharedRecipeId);
    const lunchSharedExtras = await db.select().from(plannedMealExtras).where(eq(plannedMealExtras.plannedMealId, lunchSharedAfter!.id));
    expect(lunchSharedExtras.map((e) => e.itemId)).toEqual([extraFoodId]);

    const lunchVeggieAfter = toMealsAfter.find((m) => m.slotKey === 'lunch' && m.profileId === veggieId);
    expect(lunchVeggieAfter!.itemId).toBe(lunchVeggieRecipeId);
  });

  it('never picks a recipe that exceeds the household cooking-time limit, across a whole month', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await createAdult(db, householdId);
    const foodId = await upsertFood(db, {
      nameCs: 'Test food',
      nameEn: 'Test food',
      category: 'other',
      baseUnit: 'g',
      kcalPer100: 150,
      proteinPer100: 10,
      carbsPer100: 15,
      fatPer100: 5,
      budget: 'average',
      snackSuitable: true,
      dietFlags: [],
      allergens: [],
    });
    // Enough distinct fast recipes that the 2x/week default repetition limit
    // never starves the compliant pool and forces a fallback to the slow one
    // (that fallback-when-starved behavior is real and intentional - see the
    // meal-prep-mode equivalent in filters.ts - but it would confound this
    // test, which is specifically about the filter itself, not the fallback).
    const fastRecipeIds: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      fastRecipeIds.push(
        await upsertRecipe(db, {
          nameCs: `Rychlé jídlo ${i}`,
          nameEn: `Fast meal ${i}`,
          category: 'lunch_dinner',
          isSide: false,
          budget: 'average',
          servingsBase: 1,
          prepTimeMinutes: 10,
          maxRepetitionsPerWeek: 7,
          allowConsecutiveDays: true,
          ingredients: [{ foodId, amount: 500 }],
        }),
      );
    }
    const slowRecipeId = await upsertRecipe(db, {
      nameCs: 'Pomalé jídlo',
      nameEn: 'Slow meal',
      category: 'lunch_dinner',
      isSide: false,
      budget: 'average',
      servingsBase: 1,
      prepTimeMinutes: 90,
      ingredients: [{ foodId, amount: 500 }],
    });

    await updateHouseholdSettings(db, householdId, { cookingTimeLimitMinutes: 20 });
    await generateMonth(db, householdId, '2031-05-15', 4242);

    const rows = await db.select().from(plannedMeals).where(eq(plannedMeals.householdId, householdId));
    const usedRecipeIds = new Set(rows.filter((r) => r.itemType === 'recipe').map((r) => r.itemId));
    expect(usedRecipeIds.has(slowRecipeId)).toBe(false);
    expect(fastRecipeIds.some((id) => usedRecipeIds.has(id))).toBe(true); // sanity: it did pick something, not an empty plan
  });

  it('picks the household favorite cuisine noticeably more often than a non-favorite one', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await createAdult(db, householdId);
    const foodId = await upsertFood(db, {
      nameCs: 'Test food',
      nameEn: 'Test food',
      category: 'other',
      baseUnit: 'g',
      kcalPer100: 150,
      proteinPer100: 10,
      carbsPer100: 15,
      fatPer100: 5,
      budget: 'average',
      snackSuitable: true,
      dietFlags: [],
      allergens: [],
    });
    // Several equally-plausible recipes per cuisine, so repetition limits don't force the
    // non-favorite cuisine into rotation just because the favorite one ran out of candidates.
    const favoriteRecipeIds: string[] = [];
    const otherRecipeIds: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      favoriteRecipeIds.push(
        await upsertRecipe(db, {
          nameCs: `Italské jídlo ${i}`,
          nameEn: `Italian meal ${i}`,
          category: 'lunch_dinner',
          isSide: false,
          cuisine: 'italian',
          budget: 'average',
          servingsBase: 1,
          prepTimeMinutes: 20,
          maxRepetitionsPerWeek: 7,
          allowConsecutiveDays: true,
          ingredients: [{ foodId, amount: 500 }],
        }),
      );
      otherRecipeIds.push(
        await upsertRecipe(db, {
          nameCs: `Francouzské jídlo ${i}`,
          nameEn: `French meal ${i}`,
          category: 'lunch_dinner',
          isSide: false,
          cuisine: 'french',
          budget: 'average',
          servingsBase: 1,
          prepTimeMinutes: 20,
          maxRepetitionsPerWeek: 7,
          allowConsecutiveDays: true,
          ingredients: [{ foodId, amount: 500 }],
        }),
      );
    }

    await db.update(householdSettings).set({ favoriteCuisinesJson: JSON.stringify(['italian']) }).where(eq(householdSettings.householdId, householdId));

    // Generate several months (different seeds) for a large-enough sample that the soft
    // scoring bonus's effect is distinguishable from noise.
    for (let m = 1; m <= 6; m += 1) {
      await generateMonth(db, householdId, `2032-0${m}-10`, 1000 + m);
    }

    const rows = await db.select().from(plannedMeals).where(eq(plannedMeals.householdId, householdId));
    const favoriteCount = rows.filter((r) => r.itemType === 'recipe' && favoriteRecipeIds.includes(r.itemId)).length;
    const otherCount = rows.filter((r) => r.itemType === 'recipe' && otherRecipeIds.includes(r.itemId)).length;
    expect(favoriteCount + otherCount).toBeGreaterThan(0);
    expect(favoriteCount).toBeGreaterThan(otherCount);
  });
});
