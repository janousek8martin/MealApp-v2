import { and, eq, isNull } from 'drizzle-orm';

import { startOfWeek, weekDates } from '../../domain/week';
import { createHouseholdWithDefaults } from '../repositories/households';
import { upsertFood, upsertRecipe } from '../repositories/library';
import {
  assignManualMeal,
  generateWeek,
  regenerateDay,
  regenerateSlot,
  setPortionStatus,
} from '../repositories/plan';
import { createProfile } from '../repositories/profiles';
import { plannedMealPortions, plannedMeals, recipes } from '../schema';
import { seedIfEmpty } from '../seed';
import { createTestDb } from '../testing/testDb';

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
