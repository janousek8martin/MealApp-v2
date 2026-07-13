import { and, asc, eq, gte, isNull, sql } from 'drizzle-orm';

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
  /** Defaults to true when omitted. */
  enabled?: boolean;
};

/**
 * Default day structure per the approved plan: 25/30/25/10/10 % of the daily
 * calorie target. Breakfast sharing follows households.breakfastMode; snacks
 * are always individual (they absorb per-profile nutritional differences).
 * `second_dinner` is an optional 6th slot households can turn on later
 * (Settings) or per-profile (profile meal-slot picker) - seeded disabled so
 * it doesn't change any existing day structure by default.
 */
export const defaultSlots: SlotSeed[] = [
  { slotKey: 'breakfast', kind: 'main', sharing: 'shared', time: '07:30', calorieShare: 0.25, sortOrder: 1 },
  { slotKey: 'snack_morning', kind: 'snack', sharing: 'individual', time: '10:00', calorieShare: 0.1, sortOrder: 2 },
  { slotKey: 'lunch', kind: 'main', sharing: 'shared', time: '12:30', calorieShare: 0.3, sortOrder: 3 },
  { slotKey: 'snack_afternoon', kind: 'snack', sharing: 'individual', time: '15:30', calorieShare: 0.1, sortOrder: 4 },
  { slotKey: 'dinner', kind: 'main', sharing: 'shared', time: '18:30', calorieShare: 0.25, sortOrder: 5 },
  {
    slotKey: 'second_dinner',
    kind: 'main',
    sharing: 'shared',
    time: '21:00',
    calorieShare: 0.1,
    sortOrder: 6,
    enabled: false,
  },
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
      enabled: slot.enabled ?? true,
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
  kitchenUnitDisplayMode: 'grams' | 'hybrid' | 'kitchen';
  coldDinnerFrequencyPerWeek: number;
  allowSameLunchDinner: boolean;
  preferPantryItems: boolean;
  mealVarietyLevel: 'low' | 'medium' | 'high';
  cookingExperienceLevel: 'easy' | 'medium' | 'hard';
  cookingTimeLimitMinutes: number | null;
  budgetLevel: 'low' | 'medium' | 'high';
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

export async function insertMealSlot(
  db: AppDb,
  householdId: string,
  input: { afterSlotId: string | null; label: string; time: string },
): Promise<string> {
  const now = nowIso();
  const siblings = await db
    .select()
    .from(mealSlotSettings)
    .where(and(eq(mealSlotSettings.householdId, householdId), isNull(mealSlotSettings.deletedAt)))
    .orderBy(asc(mealSlotSettings.sortOrder));

  const beforeFirstSortOrder = (siblings[0]?.sortOrder ?? 1) - 1;
  const anchorSortOrder = input.afterSlotId
    ? (siblings.find((s) => s.id === input.afterSlotId)?.sortOrder ?? beforeFirstSortOrder)
    : beforeFirstSortOrder;
  const insertAtSortOrder = anchorSortOrder + 1;

  await db
    .update(mealSlotSettings)
    .set({ sortOrder: sql`${mealSlotSettings.sortOrder} + 1`, updatedAt: now })
    .where(
      and(
        eq(mealSlotSettings.householdId, householdId),
        isNull(mealSlotSettings.deletedAt),
        gte(mealSlotSettings.sortOrder, insertAtSortOrder),
      ),
    );

  // A brand-new slot needs a nonzero calorieShare so allocateSnackWeights
  // (src/domain/generator/portions.ts) gives it a fair weight alongside
  // existing snack slots instead of normalizing it to zero - it only falls
  // back to an equal split when EVERY slot's weight is 0, so a lone zero
  // amid nonzero siblings would otherwise starve the new slot entirely.
  const existingSnackShares = siblings.filter((s) => s.kind === 'snack').map((s) => s.calorieShare);
  const defaultCalorieShare =
    existingSnackShares.length > 0 ? existingSnackShares.reduce((sum, s) => sum + s, 0) / existingSnackShares.length : 0.1;

  const id = newId();
  await db.insert(mealSlotSettings).values({
    id,
    createdAt: now,
    updatedAt: now,
    householdId,
    slotKey: `custom_${id}`,
    kind: 'snack',
    sharing: 'individual',
    time: input.time,
    calorieShare: defaultCalorieShare,
    sortOrder: insertAtSortOrder,
    enabled: true,
    label: input.label,
  });
  return id;
}

export async function deleteMealSlot(db: AppDb, slotId: string): Promise<void> {
  await db.update(mealSlotSettings).set({ deletedAt: nowIso(), updatedAt: nowIso() }).where(eq(mealSlotSettings.id, slotId));
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

export async function renameHousehold(db: AppDb, householdId: string, name: string): Promise<void> {
  await db.update(households).set({ name, updatedAt: nowIso() }).where(eq(households.id, householdId));
}

export type ReplaceHouseholdPreferencesPatch = Partial<{
  diets: string[];
  avoidedFoodIds: string[];
  favoriteCuisines: string[];
}>;

/**
 * Settings-screen editor for the same household-wide preferences the wizard
 * writes once (see `saveHouseholdPreferences`) – each field is independently
 * optional and replaces only that slice (soft-delete current rows, insert
 * the new set), so editing diets doesn't touch avoided foods and vice versa.
 * Allergens stay per-profile-only here, same as the wizard's own convention;
 * only `diet`-kind restrictions are replaced. Avoided *recipe* items (if any)
 * are left untouched – this editor only manages foods.
 */
export async function replaceHouseholdPreferences(
  db: AppDb,
  householdId: string,
  patch: ReplaceHouseholdPreferencesPatch,
): Promise<void> {
  const now = nowIso();

  if (patch.diets) {
    await db
      .update(householdRestrictions)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(householdRestrictions.householdId, householdId),
          eq(householdRestrictions.kind, 'diet'),
          isNull(householdRestrictions.deletedAt),
        ),
      );
    if (patch.diets.length > 0) {
      await db.insert(householdRestrictions).values(
        patch.diets.map((value) => ({
          id: newId(),
          createdAt: now,
          updatedAt: now,
          householdId,
          kind: 'diet' as const,
          value,
        })),
      );
    }
  }

  if (patch.avoidedFoodIds) {
    await db
      .update(householdAvoidedItems)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(householdAvoidedItems.householdId, householdId),
          eq(householdAvoidedItems.itemType, 'food'),
          isNull(householdAvoidedItems.deletedAt),
        ),
      );
    if (patch.avoidedFoodIds.length > 0) {
      await db.insert(householdAvoidedItems).values(
        patch.avoidedFoodIds.map((itemId) => ({
          id: newId(),
          createdAt: now,
          updatedAt: now,
          householdId,
          itemType: 'food' as const,
          itemId,
        })),
      );
    }
  }

  if (patch.favoriteCuisines) {
    await db
      .update(householdSettings)
      .set({ favoriteCuisinesJson: JSON.stringify(patch.favoriteCuisines), updatedAt: now })
      .where(eq(householdSettings.householdId, householdId));
  }
}
