import type { bodyMetrics, profiles } from '@/db/schema';
import { ageYears } from '@/domain/age';
import { computeTargets, type TargetsResult } from '@/domain/targets';

export type ProfileRow = typeof profiles.$inferSelect;
export type MetricRow = typeof bodyMetrics.$inferSelect;

/**
 * Pure mapping from DB rows to the domain calculation. Kept free of any
 * expo imports so it is unit-testable in node.
 */
export function targetsForProfile(
  profile: ProfileRow,
  latestMetric: MetricRow | null,
  fiberMode: 'efsa_min' | 'gender_specific' = 'efsa_min',
): TargetsResult | null {
  if (!latestMetric) return null;
  return computeTargets({
    profileType: profile.profileType,
    sex: profile.sex,
    ageYears: ageYears(profile.birthDate),
    heightCm: profile.heightCm,
    weightKg: latestMetric.weightKg,
    bodyFatPct: latestMetric.bodyFatPct ?? undefined,
    activityLevel: profile.activityLevel,
    goal: profile.goal,
    goalBodyFatPct: profile.goalBodyFatPct ?? undefined,
    manualAdjustmentKcal: profile.tdciManualAdjustmentKcal,
    fiberMode,
  });
}
