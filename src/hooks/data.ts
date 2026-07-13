import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import {
  bodyMetrics,
  householdAvoidedItems,
  householdCustomUnits,
  householdRestrictions,
  householdSettings,
  households,
  profileRestrictions,
  profileSlotPortions,
  profiles,
} from '@/db/schema';
import type { CustomKitchenUnit } from '@/domain/units';
import { applyWorkoutDayCycling } from '@/domain/workoutDays';
import { targetsForProfile, type ProfileRow } from '@/hooks/dataMapping';
import { useAppStore } from '@/stores/appStore';

/**
 * V1 is single-household; the first (only) active household row.
 *
 * `useLiveQuery` seeds `data` with `[]` synchronously on the very first
 * render (not `undefined`) and only overwrites it once the query's promise
 * resolves. `updatedAt` is what actually distinguishes "resolved at least
 * once" from "not queried yet" – gating on `data !== undefined` would make
 * `loaded` true immediately, before real data arrives.
 */
export function useHousehold() {
  const { data, updatedAt } = useLiveQuery(db.select().from(households).where(isNull(households.deletedAt)));
  return { household: data?.[0] ?? null, loaded: updatedAt !== undefined };
}

export function useHouseholdSettings(householdId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(householdSettings)
      .where(
        and(
          eq(householdSettings.householdId, householdId ?? ''),
          isNull(householdSettings.deletedAt),
        ),
      ),
    [householdId],
  );
  return data?.[0] ?? null;
}

/** Household-defined kitchen units (e.g. a specific mug/scoop), for the Settings kitchen-units table. */
export function useCustomKitchenUnits(householdId: string | undefined): CustomKitchenUnit[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(householdCustomUnits)
      .where(and(eq(householdCustomUnits.householdId, householdId ?? ''), isNull(householdCustomUnits.deletedAt))),
    [householdId],
  );
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    unitType: row.unitType,
    conversionValue: row.conversionValue,
    aliases: row.aliasesJson ? (JSON.parse(row.aliasesJson) as string[]) : [],
  }));
}

export function useProfiles(householdId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(profiles)
      .where(and(eq(profiles.householdId, householdId ?? ''), isNull(profiles.deletedAt))),
    [householdId],
  );
  return data ?? [];
}

export function useProfile(profileId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(profiles)
      .where(and(eq(profiles.id, profileId ?? ''), isNull(profiles.deletedAt))),
    [profileId],
  );
  return data?.[0] ?? null;
}

/** Active profile = user selection, falling back to the first member. */
export function useActiveProfile(householdId: string | undefined) {
  const memberList = useProfiles(householdId);
  const activeProfileId = useAppStore((state) => state.activeProfileId);
  return memberList.find((p) => p.id === activeProfileId) ?? memberList[0] ?? null;
}

/** A profile's own allergen/diet restrictions, split by kind – for prefilling the edit form. */
export function useProfileRestrictions(profileId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(profileRestrictions)
      .where(and(eq(profileRestrictions.profileId, profileId ?? ''), isNull(profileRestrictions.deletedAt))),
    [profileId],
  );
  const rows = data ?? [];
  return {
    allergens: rows.filter((row) => row.kind === 'allergen').map((row) => row.value),
    diets: rows.filter((row) => row.kind === 'diet').map((row) => row.value),
  };
}

/** Household-wide allergen/diet restrictions (set in the setup wizard) – apply to every profile in addition to their own. */
export function useHouseholdRestrictions(householdId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(householdRestrictions)
      .where(and(eq(householdRestrictions.householdId, householdId ?? ''), isNull(householdRestrictions.deletedAt))),
    [householdId],
  );
  const rows = data ?? [];
  return {
    allergens: rows.filter((row) => row.kind === 'allergen').map((row) => row.value),
    diets: rows.filter((row) => row.kind === 'diet').map((row) => row.value),
  };
}

/** Household-wide "nobody wants this" foods/recipes, split by item type – for the Domácnost settings editor. */
export function useHouseholdAvoidedItems(householdId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(householdAvoidedItems)
      .where(and(eq(householdAvoidedItems.householdId, householdId ?? ''), isNull(householdAvoidedItems.deletedAt))),
    [householdId],
  );
  const rows = data ?? [];
  return {
    avoidedFoodIds: rows.filter((row) => row.itemType === 'food').map((row) => row.itemId),
    avoidedRecipeIds: rows.filter((row) => row.itemType === 'recipe').map((row) => row.itemId),
  };
}

/**
 * Allergens across a set of profiles, unioned – an approximate hint for
 * visually flagging conflicting items in the manual meal/food pickers before
 * the user picks. The actual gate is the domain-level guard in
 * `assignManualMeal`/`addMealExtra`, which also checks diets/avoid-lists;
 * this hook only needs to be good enough for the allergen icon.
 */
export function useProfilesAllergens(profileIds: string[]): string[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(profileRestrictions)
      .where(
        and(
          inArray(profileRestrictions.profileId, profileIds.length > 0 ? profileIds : ['']),
          eq(profileRestrictions.kind, 'allergen'),
          isNull(profileRestrictions.deletedAt),
        ),
      ),
    [profileIds.slice().sort().join(',')],
  );
  return [...new Set((data ?? []).map((row) => row.value))];
}

/** A profile's per-slot portion overrides (calorie share % + snack macro grams), keyed by slotId. */
export function useProfileSlotPortions(profileId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(profileSlotPortions)
      .where(and(eq(profileSlotPortions.profileId, profileId ?? ''), isNull(profileSlotPortions.deletedAt))),
    [profileId],
  );
  return data ?? [];
}

/** Latest weight/body-fat entry – the single source of truth for "current". */
export function useLatestBodyMetric(profileId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(bodyMetrics)
      .where(and(eq(bodyMetrics.profileId, profileId ?? ''), isNull(bodyMetrics.deletedAt)))
      .orderBy(desc(bodyMetrics.date), desc(bodyMetrics.createdAt))
      .limit(1),
    [profileId],
  );
  return data?.[0] ?? null;
}

/** Full weight/body-fat history, oldest first – the basis for the progress graph. */
export function useBodyMetricHistory(profileId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(bodyMetrics)
      .where(and(eq(bodyMetrics.profileId, profileId ?? ''), isNull(bodyMetrics.deletedAt)))
      .orderBy(asc(bodyMetrics.date)),
    [profileId],
  );
  return data ?? [];
}

/**
 * Live TDCI/macros for a profile. Because inputs come from live queries and
 * the computation is pure, any change (weight, activity, manual adjustment)
 * re-renders every consumer immediately – no stale values, no app restart.
 */
export function useProfileTargets(profile: ProfileRow | null) {
  const latestMetric = useLatestBodyMetric(profile?.id);
  const settings = useHouseholdSettings(profile?.householdId);
  if (!profile) return null;
  return targetsForProfile(profile, latestMetric, settings?.fiberMode ?? 'efsa_min');
}

/**
 * A profile's target for a specific date, applying workout-day carb cycling
 * on top of the weekly-average TDCI (training days get more, rest days less,
 * so the weekly average always matches `useProfileTargets`) and any
 * per-weekday macro override for `dateIso` (see `targetsForProfile`'s
 * optional 4th param), applied before workout cycling runs on top.
 */
export function useDailyProfileTargets(profile: ProfileRow | null, dateIso: string) {
  const latestMetric = useLatestBodyMetric(profile?.id);
  const settings = useHouseholdSettings(profile?.householdId);
  const workoutDaysJson = profile?.workoutDaysJson;
  const workoutDays = useMemo<number[]>(
    () => (workoutDaysJson ? (JSON.parse(workoutDaysJson) as number[]) : []),
    [workoutDaysJson],
  );
  if (!profile) return null;
  const targets = targetsForProfile(profile, latestMetric, settings?.fiberMode ?? 'efsa_min', dateIso);
  if (!targets) return null;
  return applyWorkoutDayCycling(
    {
      kcal: targets.adjustedTdciKcal,
      proteinG: targets.macros.proteinG,
      carbsG: targets.macros.carbsG,
      fatG: targets.macros.fatG,
    },
    workoutDays,
    dateIso,
  );
}
