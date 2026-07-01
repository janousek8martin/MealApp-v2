import { and, eq, isNull } from 'drizzle-orm';

import { newId } from '../id';
import { bodyMetrics, profileRestrictions, profiles } from '../schema';
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

export async function listActiveProfiles(db: AppDb, householdId: string) {
  return db
    .select()
    .from(profiles)
    .where(and(eq(profiles.householdId, householdId), isNull(profiles.deletedAt)));
}
