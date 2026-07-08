export type DayTotals = { kcal: number; proteinG: number; carbsG: number; fatG: number };

/** Absolute kcal tolerance – tighter than the macro tolerances since it's the primary budget. */
const KCAL_TOLERANCE_ABS = 100;
const PROTEIN_TOLERANCE_PCT = 0.1;
const FAT_TOLERANCE_PCT = 0.2;
const CARBS_TOLERANCE_PCT = 0.25;

function withinPercent(actual: number, target: number, pct: number): boolean {
  if (target <= 0) return true; // no target set for this macro – nothing to be out of tolerance on
  return Math.abs(actual - target) / target <= pct;
}

/**
 * Whether a day's planned nutrition totals are close enough to the profile's
 * daily target to count as "on plan" – kcal within a fixed ±100 kcal, and
 * protein/fat/carbs within their own percentage bands (protein tightest,
 * since under-eating it is the more consequential miss for this app's
 * nutrition goals; carbs loosest, since they're the macro the generator
 * has the least direct control over after protein/fat/kcal are set).
 * Mirrors the tolerance system from the legacy NutritionCalculator, ported
 * as a pure function in the current domain-layer architecture.
 */
export function isWithinDailyTolerance(actual: DayTotals, target: DayTotals): boolean {
  if (Math.abs(actual.kcal - target.kcal) > KCAL_TOLERANCE_ABS) return false;
  if (!withinPercent(actual.proteinG, target.proteinG, PROTEIN_TOLERANCE_PCT)) return false;
  if (!withinPercent(actual.fatG, target.fatG, FAT_TOLERANCE_PCT)) return false;
  if (!withinPercent(actual.carbsG, target.carbsG, CARBS_TOLERANCE_PCT)) return false;
  return true;
}
