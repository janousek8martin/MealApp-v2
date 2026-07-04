import type { bodyMetrics, profiles } from '@/db/schema';
import { ageYears } from '@/domain/age';
import { computeTargets, type TargetsResult } from '@/domain/targets';

export type ProfileRow = typeof profiles.$inferSelect;
export type MetricRow = typeof bodyMetrics.$inferSelect;

/**
 * Pure mapping from DB rows to the domain calculation. Kept free of any
 * expo imports so it is unit-testable in node.
 */
type MacroOverrides = {
  proteinPerKgLbm?: number;
  surplusKcal?: number;
  fatShareOfTdci?: number;
};

function parseMacroOverrides(json: string | null): MacroOverrides {
  if (!json) return {};
  try {
    return JSON.parse(json) as MacroOverrides;
  } catch {
    return {};
  }
}

export function targetsForProfile(
  profile: ProfileRow,
  latestMetric: MetricRow | null,
  fiberMode: 'efsa_min' | 'gender_specific' = 'efsa_min',
): TargetsResult | null {
  if (!latestMetric) return null;
  const overrides = parseMacroOverrides(profile.macroOverridesJson);
  return computeTargets({
    profileType: profile.profileType,
    sex: profile.sex,
    ageYears: ageYears(profile.birthDate),
    heightCm: profile.heightCm,
    weightKg: latestMetric.weightKg,
    bodyFatPct: latestMetric.bodyFatPct ?? undefined,
    activityLevel: profile.activityLevel,
    activityMultiplier: profile.activityMultiplier,
    goal: profile.goal,
    goalBodyFatPct: profile.goalBodyFatPct ?? undefined,
    fitnessExperience: profile.fitnessExperience ?? undefined,
    manualAdjustmentKcal: profile.tdciManualAdjustmentKcal,
    proteinPerKgLbm: overrides.proteinPerKgLbm,
    surplusKcal: overrides.surplusKcal,
    fatShareOfTdci: overrides.fatShareOfTdci,
    fiberMode,
  });
}
