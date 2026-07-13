import type { bodyMetrics, profiles } from '@/db/schema';
import { parseMacroDayOverrides, parseMacroOverrides } from '@/db/repositories/profiles';
import { ageYears } from '@/domain/age';
import { mergeMacroOverrides } from '@/domain/macroOverrides';
import { computeTargets, type TargetsResult } from '@/domain/targets';
import { isoWeekday } from '@/domain/week';

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
  /** When given, layers that weekday's macroDayOverridesJson entry (if any) over the profile-wide overrides. */
  dateIso?: string,
): TargetsResult | null {
  if (!latestMetric) return null;
  const profileWideOverrides = parseMacroOverrides(profile.macroOverridesJson);
  const overrides = dateIso
    ? mergeMacroOverrides(profileWideOverrides, parseMacroDayOverrides(profile.macroDayOverridesJson)[String(isoWeekday(dateIso))])
    : profileWideOverrides;
  return computeTargets({
    profileType: profile.profileType,
    sex: profile.sex,
    ageYears: ageYears(profile.birthDate),
    heightCm: profile.heightCm,
    weightKg: latestMetric.weightKg,
    bodyFatPct: latestMetric.bodyFatPct ?? undefined,
    activityLevel: profile.activityLevel,
    activityMultiplier: profile.activityMultiplier,
    customTdeeKcal: profile.customTdeeKcal ?? undefined,
    goal: profile.goal,
    goalBodyFatPct: profile.goalBodyFatPct ?? undefined,
    fitnessExperience: profile.fitnessExperience ?? undefined,
    goalRateKgPerWeek: profile.goalRateKgPerWeek ?? undefined,
    manualAdjustmentKcal: profile.tdciManualAdjustmentKcal,
    proteinPerKgLbm: overrides.proteinPerKgLbm,
    surplusKcal: overrides.surplusKcal,
    fatShareOfTdci: overrides.fatShareOfTdci,
    fiberMode,
  });
}
