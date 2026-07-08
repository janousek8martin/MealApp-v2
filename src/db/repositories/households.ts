import { eq } from 'drizzle-orm';

import { newId } from '../id';
import { households, householdAvoidedItems, householdRestrictions, householdSettings, mealSlotSettings } from '../schema';
import { nowIso } from '../time';
import { defaultNotificationSettings, type AppDb, type NotificationSettings } from '../types';

export type SlotSeed = {
  slotKey: string;
  kind: 'main' | 'snack';
  sharing: 'shared' | 'individual';
  time: string;
  calorieShare: number;
  sortOrder: number;
};

/**
 * Default day structure per the approved plan: 25/30/25/10/10 % of the daily
 * calorie target. Breakfast sharing follows households.breakfastMode; snacks
 * are always individual (they absorb per-profile nutritional differences).
 */
export const defaultSlots: SlotSeed[] = [
  { slotKey: 'breakfast', kind: 'main', sharing: 'shared', time: '07:30', calorieShare: 0.25, sortOrder: 1 },
  { slotKey: 'snack_morning', kind: 'snack', sharing: 'individual', time: '10:00', calorieShare: 0.1, sortOrder: 2 },
  { slotKey: 'lunch', kind: 'main', sharing: 'shared', time: '12:30', calorieShare: 0.3, sortOrder: 3 },
  { slotKey: 'snack_afternoon', kind: 'snack', sharing: 'individual', time: '15:30', calorieShare: 0.1, sortOrder: 4 },
  { slotKey: 'dinner', kind: 'main', sharing: 'shared', time: '18:30', calorieShare: 0.25, sortOrder: 5 },
];

export async function createHouseholdWithDefaults(db: AppDb, name: string): Promise<string> {
  const householdId = newId();
  const now = nowIso();

  await db.insert(households).values({
    id: householdId,
    createdAt: now,
    updatedAt: now,
    name,
  });

  await db.insert(householdSettings).values({
    id: newId(),
    createdAt: now,
    updatedAt: now,
    householdId,
    notificationsJson: JSON.stringify(defaultNotificationSettings),
  });

  await db.insert(mealSlotSettings).values(
    defaultSlots.map((slot) => ({
      id: newId(),
      createdAt: now,
      updatedAt: now,
      householdId,
      ...slot,
    })),
  );

  return householdId;
}

export type HouseholdSettingsPatch = Partial<{
  unitSystem: 'metric' | 'us';
  language: 'cs' | 'en';
  defaultMaxRepetitionsPerWeek: number;
  defaultAllowConsecutiveDays: boolean;
  fiberMode: 'efsa_min' | 'gender_specific';
  notifications: NotificationSettings;
  kitchenUnitDisplayMode: 'grams' | 'hybrid';
}>;

export async function updateHouseholdSettings(
  db: AppDb,
  householdId: string,
  patch: HouseholdSettingsPatch,
): Promise<void> {
  const { notifications, ...rest } = patch;
  await db
    .update(householdSettings)
    .set({
      ...rest,
      ...(notifications ? { notificationsJson: JSON.stringify(notifications) } : {}),
      updatedAt: nowIso(),
    })
    .where(eq(householdSettings.householdId, householdId));
}

export type MealSlotPatch = Partial<{ time: string; calorieShare: number; enabled: boolean }>;

export async function updateMealSlotSetting(db: AppDb, slotId: string, patch: MealSlotPatch): Promise<void> {
  await db
    .update(mealSlotSettings)
    .set({ ...patch, updatedAt: nowIso() })
    .where(eq(mealSlotSettings.id, slotId));
}

export type HouseholdPreferencesInput = {
  allergens: string[];
  diets: string[];
  avoidedRecipeIds: string[];
  avoidedFoodIds: string[];
  favoriteCuisines: string[];
};

/**
 * Written once by the setup wizard. Household-level restrictions/avoid
 * items are unioned with each profile's own at generation time (see
 * loadGeneratorContext in repositories/plan.ts).
 */
export async function saveHouseholdPreferences(
  db: AppDb,
  householdId: string,
  input: HouseholdPreferencesInput,
): Promise<void> {
  const now = nowIso();

  const restrictionRows = [
    ...input.allergens.map((value) => ({ kind: 'allergen' as const, value })),
    ...input.diets.map((value) => ({ kind: 'diet' as const, value })),
  ];
  if (restrictionRows.length > 0) {
    await db.insert(householdRestrictions).values(
      restrictionRows.map((row) => ({ id: newId(), createdAt: now, updatedAt: now, householdId, ...row })),
    );
  }

  const avoidedItemRows = [
    ...input.avoidedRecipeIds.map((itemId) => ({ itemType: 'recipe' as const, itemId })),
    ...input.avoidedFoodIds.map((itemId) => ({ itemType: 'food' as const, itemId })),
  ];
  if (avoidedItemRows.length > 0) {
    await db.insert(householdAvoidedItems).values(
      avoidedItemRows.map((row) => ({ id: newId(), createdAt: now, updatedAt: now, householdId, ...row })),
    );
  }

  await db
    .update(householdSettings)
    .set({ favoriteCuisinesJson: JSON.stringify(input.favoriteCuisines), updatedAt: now })
    .where(eq(householdSettings.householdId, householdId));
}
