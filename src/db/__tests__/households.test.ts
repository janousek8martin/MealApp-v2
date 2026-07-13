import { and, eq, isNull } from 'drizzle-orm';

import { createHouseholdWithDefaults, renameHousehold, replaceHouseholdPreferences } from '../repositories/households';
import { upsertFood } from '../repositories/library';
import { households, householdAvoidedItems, householdRestrictions, householdSettings } from '../schema';
import { createTestDb } from '../testing/testDb';

async function makeFood(db: ReturnType<typeof createTestDb>, name: string) {
  return upsertFood(db, {
    nameCs: name,
    nameEn: name,
    category: 'other',
    baseUnit: 'g',
    kcalPer100: 100,
    proteinPer100: 5,
    carbsPer100: 10,
    fatPer100: 2,
    budget: 'cheap',
    snackSuitable: false,
    dietFlags: [],
    allergens: [],
  });
}

describe('renameHousehold', () => {
  it('persists a new name', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Original');
    await renameHousehold(db, householdId, 'Renamed');
    const [row] = await db.select().from(households).where(eq(households.id, householdId));
    expect(row.name).toBe('Renamed');
  });
});

describe('replaceHouseholdPreferences', () => {
  it('replaces diets without touching allergens', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    const now = new Date().toISOString();
    await db.insert(householdRestrictions).values([
      { id: 'a1', createdAt: now, updatedAt: now, householdId, kind: 'allergen', value: 'gluten' },
    ]);

    await replaceHouseholdPreferences(db, householdId, { diets: ['vegetarian'] });
    await replaceHouseholdPreferences(db, householdId, { diets: ['vegan'] });

    const rows = await db
      .select()
      .from(householdRestrictions)
      .where(and(eq(householdRestrictions.householdId, householdId), isNull(householdRestrictions.deletedAt)));
    expect(rows.filter((r) => r.kind === 'diet').map((r) => r.value)).toEqual(['vegan']);
    expect(rows.filter((r) => r.kind === 'allergen').map((r) => r.value)).toEqual(['gluten']);
  });

  it('replaces avoided foods without touching avoided recipes', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    const foodA = await makeFood(db, 'A');
    const foodB = await makeFood(db, 'B');
    const now = new Date().toISOString();
    await db.insert(householdAvoidedItems).values([
      { id: 'r1', createdAt: now, updatedAt: now, householdId, itemType: 'recipe', itemId: 'some-recipe' },
    ]);

    await replaceHouseholdPreferences(db, householdId, { avoidedFoodIds: [foodA] });
    await replaceHouseholdPreferences(db, householdId, { avoidedFoodIds: [foodB] });

    const rows = await db
      .select()
      .from(householdAvoidedItems)
      .where(and(eq(householdAvoidedItems.householdId, householdId), isNull(householdAvoidedItems.deletedAt)));
    expect(rows.filter((r) => r.itemType === 'food').map((r) => r.itemId)).toEqual([foodB]);
    expect(rows.filter((r) => r.itemType === 'recipe').map((r) => r.itemId)).toEqual(['some-recipe']);
  });

  it('replaces favorite cuisines', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    await replaceHouseholdPreferences(db, householdId, { favoriteCuisines: ['italian', 'czech'] });
    const [row] = await db.select().from(householdSettings).where(eq(householdSettings.householdId, householdId));
    expect(JSON.parse(row.favoriteCuisinesJson ?? '[]')).toEqual(['italian', 'czech']);
  });
});
