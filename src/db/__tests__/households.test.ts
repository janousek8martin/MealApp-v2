import { and, asc, eq, isNull } from 'drizzle-orm';

import {
  createHouseholdWithDefaults,
  deleteMealSlot,
  insertMealSlot,
  renameHousehold,
  replaceHouseholdPreferences,
} from '../repositories/households';
import { upsertFood } from '../repositories/library';
import { households, householdAvoidedItems, householdRestrictions, householdSettings, mealSlotSettings } from '../schema';
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

describe('insertMealSlot', () => {
  it('inserts a new slot immediately after the given anchor, shifting later slots', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test');
    const before = await db
      .select()
      .from(mealSlotSettings)
      .where(and(eq(mealSlotSettings.householdId, householdId), isNull(mealSlotSettings.deletedAt)))
      .orderBy(asc(mealSlotSettings.sortOrder));
    const breakfast = before.find((s) => s.slotKey === 'breakfast')!;
    const originalLunchSortOrder = before.find((s) => s.slotKey === 'lunch')!.sortOrder;

    const newSlotId = await insertMealSlot(db, householdId, {
      afterSlotId: breakfast.id,
      label: 'Pre-lunch snack',
      time: '10:30',
    });

    const after = await db
      .select()
      .from(mealSlotSettings)
      .where(and(eq(mealSlotSettings.householdId, householdId), isNull(mealSlotSettings.deletedAt)))
      .orderBy(asc(mealSlotSettings.sortOrder));

    const newSlot = after.find((s) => s.id === newSlotId)!;
    expect(newSlot.sortOrder).toBe(breakfast.sortOrder + 1);
    expect(newSlot.label).toBe('Pre-lunch snack');
    expect(newSlot.time).toBe('10:30');
    expect(newSlot.kind).toBe('snack');
    expect(newSlot.sharing).toBe('individual');
    expect(newSlot.enabled).toBe(true);

    const lunch = after.find((s) => s.slotKey === 'lunch')!;
    expect(lunch.sortOrder).toBe(originalLunchSortOrder + 1);
  });

  it('inserts as the first slot when afterSlotId is null', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test2');
    const before = await db
      .select()
      .from(mealSlotSettings)
      .where(and(eq(mealSlotSettings.householdId, householdId), isNull(mealSlotSettings.deletedAt)))
      .orderBy(asc(mealSlotSettings.sortOrder));
    const originalFirstSortOrder = before[0].sortOrder;

    const newSlotId = await insertMealSlot(db, householdId, { afterSlotId: null, label: 'Early snack', time: '06:00' });

    const after = await db
      .select()
      .from(mealSlotSettings)
      .where(and(eq(mealSlotSettings.householdId, householdId), isNull(mealSlotSettings.deletedAt)))
      .orderBy(asc(mealSlotSettings.sortOrder));

    expect(after[0].id).toBe(newSlotId);
    expect(after[0].sortOrder).toBe(originalFirstSortOrder);
    expect(after[1].sortOrder).toBe(originalFirstSortOrder + 1);
  });
});

describe('deleteMealSlot', () => {
  it('soft-deletes the slot and excludes it from subsequent queries', async () => {
    const db = createTestDb();
    const householdId = await createHouseholdWithDefaults(db, 'Test3');
    const slotId = await insertMealSlot(db, householdId, { afterSlotId: null, label: 'Removable', time: '08:00' });

    await deleteMealSlot(db, slotId);

    const remaining = await db
      .select()
      .from(mealSlotSettings)
      .where(and(eq(mealSlotSettings.householdId, householdId), isNull(mealSlotSettings.deletedAt)));
    expect(remaining.find((s) => s.id === slotId)).toBeUndefined();

    const raw = await db.select().from(mealSlotSettings).where(eq(mealSlotSettings.id, slotId));
    expect(raw[0].deletedAt).not.toBeNull();
  });
});
