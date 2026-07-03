import { and, eq, isNull } from 'drizzle-orm';

import { newId } from '../id';
import { bodyMetrics, profileRestrictions, profileSlotPortions, profiles } from '../schema';
import { nowIso, todayIsoDate } from '../time';
import type { AppDb } from '../types';

export type CreateProfileInput = {
  householdId: string;
  name: string;
  color?: string;
  profileType: 'adult' | 'child';
  sex: 'male' | 'female';
  birthDate: string;
  heightCm: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  goal?: 'lose' | 'maintain' | 'gain';
  goalWeightKg?: number;
  goalBodyFatPct?: number;
  fitnessExperience?: 'beginner' | 'intermediate' | 'advanced';
  sharesMainMeals?: boolean;
  snackPositions?: string[];
  /** ISO weekday numbers (1 = Monday .. 7 = Sunday) this profile trains on. */
  workoutDays?: number[];
  /** Initial measurement – stored as the first body_metrics row. */
  weightKg: number;
  bodyFatPct?: number;
  bodyFatMethod?: 'navy' | 'manual' | 'bia' | 'dexa';
  allergens?: string[];
  diets?: string[];
};

export async function createProfile(db: AppDb, input: CreateProfileInput): Promise<string> {
  const profileId = newId();
  const now = nowIso();

  await db.insert(profiles).values({
    id: profileId,
    createdAt: now,
    updatedAt: now,
    householdId: input.householdId,
    name: input.name,
    color: input.color,
    profileType: input.profileType,
    sex: input.sex,
    birthDate: input.birthDate,
    heightCm: input.heightCm,
    activityLevel: input.activityLevel,
    // Children are always maintenance – the goal is locked in domain logic too.
    goal: input.profileType === 'child' ? 'maintain' : (input.goal ?? 'maintain'),
    goalWeightKg: input.goalWeightKg,
    goalBodyFatPct: input.goalBodyFatPct,
    fitnessExperience: input.fitnessExperience,
    sharesMainMeals: input.sharesMainMeals ?? true,
    snackPositionsJson: JSON.stringify(input.snackPositions ?? ['snack_morning', 'snack_afternoon']),
    workoutDaysJson: JSON.stringify(input.workoutDays ?? []),
  });

  await db.insert(bodyMetrics).values({
    id: newId(),
    createdAt: now,
    updatedAt: now,
    profileId,
    date: todayIsoDate(),
    weightKg: input.weightKg,
    bodyFatPct: input.bodyFatPct,
    method: input.bodyFatPct !== undefined ? (input.bodyFatMethod ?? 'manual') : undefined,
  });

  const restrictionRows = [
    ...(input.allergens ?? []).map((value) => ({ kind: 'allergen' as const, value })),
    ...(input.diets ?? []).map((value) => ({ kind: 'diet' as const, value })),
  ];
  if (restrictionRows.length > 0) {
    await db.insert(profileRestrictions).values(
      restrictionRows.map((row) => ({
        id: newId(),
        createdAt: now,
        updatedAt: now,
        profileId,
        ...row,
      })),
    );
  }

  return profileId;
}

export type UpdateProfileInput = {
  name: string;
  sex: 'male' | 'female';
  birthDate: string;
  heightCm: number;
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
  goal: 'lose' | 'maintain' | 'gain';
  goalWeightKg?: number;
  goalBodyFatPct?: number;
  fitnessExperience?: 'beginner' | 'intermediate' | 'advanced';
  sharesMainMeals: boolean;
  workoutDays: number[];
  allergens: string[];
  diets: string[];
};

/** Updates a profile's editable fields and replaces its allergen/diet restrictions. */
export async function updateProfile(db: AppDb, profileId: string, input: UpdateProfileInput): Promise<void> {
  const now = nowIso();

  await db
    .update(profiles)
    .set({
      name: input.name,
      sex: input.sex,
      birthDate: input.birthDate,
      heightCm: input.heightCm,
      activityLevel: input.activityLevel,
      goal: input.goal,
      goalWeightKg: input.goalWeightKg ?? null,
      goalBodyFatPct: input.goalBodyFatPct ?? null,
      fitnessExperience: input.fitnessExperience ?? null,
      sharesMainMeals: input.sharesMainMeals,
      workoutDaysJson: JSON.stringify(input.workoutDays),
      updatedAt: now,
    })
    .where(eq(profiles.id, profileId));

  await db
    .update(profileRestrictions)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(profileRestrictions.profileId, profileId), isNull(profileRestrictions.deletedAt)));

  const restrictionRows = [
    ...input.allergens.map((value) => ({ kind: 'allergen' as const, value })),
    ...input.diets.map((value) => ({ kind: 'diet' as const, value })),
  ];
  if (restrictionRows.length > 0) {
    await db.insert(profileRestrictions).values(
      restrictionRows.map((row) => ({
        id: newId(),
        createdAt: now,
        updatedAt: now,
        profileId,
        ...row,
      })),
    );
  }
}

/** Manual ±kcal correction applied on top of the computed TDCI, adjusted in steps of 100. */
export async function updateTdciManualAdjustment(db: AppDb, profileId: string, kcal: number): Promise<void> {
  await db.update(profiles).set({ tdciManualAdjustmentKcal: kcal, updatedAt: nowIso() }).where(eq(profiles.id, profileId));
}

export async function listActiveProfiles(db: AppDb, householdId: string) {
  return db
    .select()
    .from(profiles)
    .where(and(eq(profiles.householdId, householdId), isNull(profiles.deletedAt)));
}

export type AddBodyMetricInput = {
  date?: string;
  weightKg: number;
  bodyFatPct?: number | null;
  method?: 'navy' | 'manual' | 'bia' | 'dexa' | null;
  neckCm?: number | null;
  waistCm?: number | null;
  hipCm?: number | null;
  note?: string | null;
};

/**
 * Logs a weight/body-composition entry. Upserts by date – re-logging the
 * same day (e.g. correcting a mistake) replaces that day's row rather than
 * creating a second one, keeping the progress graph one point per day.
 */
export async function addBodyMetric(db: AppDb, profileId: string, input: AddBodyMetricInput): Promise<void> {
  const date = input.date ?? todayIsoDate();
  const now = nowIso();

  const [existing] = await db
    .select()
    .from(bodyMetrics)
    .where(and(eq(bodyMetrics.profileId, profileId), eq(bodyMetrics.date, date), isNull(bodyMetrics.deletedAt)));

  const values = {
    weightKg: input.weightKg,
    bodyFatPct: input.bodyFatPct ?? null,
    method: input.method ?? null,
    neckCm: input.neckCm ?? null,
    waistCm: input.waistCm ?? null,
    hipCm: input.hipCm ?? null,
    note: input.note ?? null,
    updatedAt: now,
  };

  if (existing) {
    await db.update(bodyMetrics).set(values).where(eq(bodyMetrics.id, existing.id));
  } else {
    await db.insert(bodyMetrics).values({ id: newId(), createdAt: now, profileId, date, ...values });
  }
}

export type MacroOverrides = {
  proteinPerKgLbm?: number;
  surplusKcal?: number;
  fatShareOfTdci?: number;
};

/** Pass `null` to clear all overrides and fall back to the domain defaults. */
export async function updateProfileMacroOverrides(
  db: AppDb,
  profileId: string,
  overrides: MacroOverrides | null,
): Promise<void> {
  await db
    .update(profiles)
    .set({
      macroOverridesJson: overrides ? JSON.stringify(overrides) : null,
      updatedAt: nowIso(),
    })
    .where(eq(profiles.id, profileId));
}

export async function getProfileSlotPortions(db: AppDb, profileId: string) {
  return db
    .select()
    .from(profileSlotPortions)
    .where(and(eq(profileSlotPortions.profileId, profileId), isNull(profileSlotPortions.deletedAt)));
}

export type ProfileSlotPortionPatch = {
  calorieSharePercent?: number | null;
  proteinTargetG?: number | null;
  fatTargetG?: number | null;
};

/**
 * Upserts a profile's override for one household meal slot. Any field left
 * `undefined` keeps its previous value; pass `null` explicitly to clear a
 * field back to "use the household/remaining-target default".
 */
export async function upsertProfileSlotPortion(
  db: AppDb,
  profileId: string,
  slotId: string,
  patch: ProfileSlotPortionPatch,
): Promise<void> {
  const now = nowIso();
  const [existing] = await db
    .select()
    .from(profileSlotPortions)
    .where(
      and(
        eq(profileSlotPortions.profileId, profileId),
        eq(profileSlotPortions.slotId, slotId),
        isNull(profileSlotPortions.deletedAt),
      ),
    );

  if (existing) {
    await db
      .update(profileSlotPortions)
      .set({
        calorieSharePercent: patch.calorieSharePercent !== undefined ? patch.calorieSharePercent : existing.calorieSharePercent,
        proteinTargetG: patch.proteinTargetG !== undefined ? patch.proteinTargetG : existing.proteinTargetG,
        fatTargetG: patch.fatTargetG !== undefined ? patch.fatTargetG : existing.fatTargetG,
        updatedAt: now,
      })
      .where(eq(profileSlotPortions.id, existing.id));
  } else {
    await db.insert(profileSlotPortions).values({
      id: newId(),
      createdAt: now,
      updatedAt: now,
      profileId,
      slotId,
      calorieSharePercent: patch.calorieSharePercent ?? null,
      proteinTargetG: patch.proteinTargetG ?? null,
      fatTargetG: patch.fatTargetG ?? null,
    });
  }
}
