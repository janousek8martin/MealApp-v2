import { eq, isNull } from 'drizzle-orm';

import { newId } from '../id';
import { createHouseholdWithDefaults, defaultSlots, saveHouseholdPreferences } from '../repositories/households';
import {
  foods,
  householdAvoidedItems,
  householdSettings,
  households,
  mealSlotSettings,
  profiles,
  recipeIngredients,
  recipes,
} from '../schema';
import { seedIfEmpty } from '../seed';
import { nowIso } from '../time';
import { createTestDb } from '../testing/testDb';

describe('data layer', () => {
  it('applies migrations and creates a household with default settings and slots', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Janouškovi');

    const [household] = await db.select().from(households).where(eq(households.id, householdId));
    expect(household.name).toBe('Janouškovi');
    expect(household.breakfastMode).toBe('shared');

    const settings = await db
      .select()
      .from(householdSettings)
      .where(eq(householdSettings.householdId, householdId));
    expect(settings).toHaveLength(1);
    expect(settings[0].unitSystem).toBe('metric');
    expect(settings[0].language).toBe('cs');
    expect(settings[0].defaultMaxRepetitionsPerWeek).toBe(2);

    const slots = await db
      .select()
      .from(mealSlotSettings)
      .where(eq(mealSlotSettings.householdId, householdId));
    expect(slots).toHaveLength(defaultSlots.length);

    const totalShare = slots.reduce((sum, slot) => sum + slot.calorieShare, 0);
    expect(totalShare).toBeCloseTo(1, 5);

    const snacks = slots.filter((slot) => slot.kind === 'snack');
    expect(snacks.every((slot) => slot.sharing === 'individual')).toBe(true);
  });

  it('seeds foods and recipes once and stays idempotent', async () => {
    const db = createTestDb();

    const firstRun = await seedIfEmpty(db);
    expect(firstRun).toBe(true);

    const seededFoods = await db.select().from(foods);
    const seededRecipes = await db.select().from(recipes);
    expect(seededFoods.length).toBeGreaterThan(0);
    expect(seededRecipes.length).toBeGreaterThan(0);

    // seedKey must persist so avoid-food groups (src/constants/options.ts)
    // can resolve a stable seed key to the runtime food row across installs.
    expect(seededFoods.every((f) => typeof f.seedKey === 'string' && f.seedKey.length > 0)).toBe(
      true,
    );

    const secondRun = await seedIfEmpty(db);
    expect(secondRun).toBe(false);
    expect((await db.select().from(foods)).length).toBe(seededFoods.length);

    // Every recipe must have resolvable ingredients.
    for (const recipe of seededRecipes) {
      const ingredients = await db
        .select()
        .from(recipeIngredients)
        .where(eq(recipeIngredients.recipeId, recipe.id));
      expect(ingredients.length).toBeGreaterThan(0);
    }
  });

  it('saveHouseholdPreferences writes both recipe and food avoidance as itemType-discriminated rows', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test household');

    await saveHouseholdPreferences(db, householdId, {
      allergens: ['gluten'],
      diets: ['vegetarian'],
      avoidedRecipeIds: ['recipe-1'],
      avoidedFoodIds: ['food-1', 'food-2'],
      favoriteCuisines: ['czech'],
    });

    const rows = await db
      .select()
      .from(householdAvoidedItems)
      .where(eq(householdAvoidedItems.householdId, householdId));

    expect(rows.filter((r) => r.itemType === 'recipe').map((r) => r.itemId)).toEqual(['recipe-1']);
    expect(rows.filter((r) => r.itemType === 'food').map((r) => r.itemId).sort()).toEqual([
      'food-1',
      'food-2',
    ]);
  });

  it('enforces foreign keys', async () => {
    const db = createTestDb();
    const now = nowIso();

    await expect(
      db.insert(recipeIngredients).values({
        id: newId(),
        createdAt: now,
        updatedAt: now,
        recipeId: 'missing-recipe',
        foodId: 'missing-food',
        amount: 100,
      }),
    ).rejects.toThrow();
  });

  it('supports the soft-delete pattern', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    const now = nowIso();

    const profileId = newId();
    await db.insert(profiles).values({
      id: profileId,
      createdAt: now,
      updatedAt: now,
      householdId,
      name: 'Martin',
      sex: 'male',
      birthDate: '1990-05-01',
      heightCm: 180,
      activityLevel: 'moderate',
    });

    await db
      .update(profiles)
      .set({ deletedAt: nowIso(), updatedAt: nowIso() })
      .where(eq(profiles.id, profileId));

    const active = await db.select().from(profiles).where(isNull(profiles.deletedAt));
    expect(active).toHaveLength(0);

    // Row still exists for future sync propagation.
    const all = await db.select().from(profiles);
    expect(all).toHaveLength(1);
  });
});
