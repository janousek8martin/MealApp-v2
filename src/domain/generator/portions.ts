import type { RecipeNutritionPerPortion } from './types';

/**
 * Single multiplier applied to the whole recipe – keeps its internal macro
 * ratio intact, per the approved algorithm (portion scaling, not per-component
 * adjustment).
 */
export function scalingMultiplier(targetKcal: number, recipeKcalPerPortion: number): number {
  if (recipeKcalPerPortion <= 0) return 1;
  return targetKcal / recipeKcalPerPortion;
}

export type MacroTarget = { kcal: number; proteinG: number; carbsG: number; fatG: number };

export type SnackCandidate<T> = { item: T; nutrition: RecipeNutritionPerPortion };

/**
 * Weighted-distance match to the remaining daily target. kcal dominates (it's
 * the primary budget); protein deviation is weighted extra since under-eating
 * protein is the more consequential miss for the app's nutrition goals.
 */
function distanceToTarget(target: MacroTarget, nutrition: RecipeNutritionPerPortion): number {
  const kcalDiff = Math.abs(target.kcal - nutrition.kcal);
  const proteinDiff = Math.abs(target.proteinG - nutrition.proteinG) * 4;
  const carbsDiff = Math.abs(target.carbsG - nutrition.carbsG);
  const fatDiff = Math.abs(target.fatG - nutrition.fatG);
  return kcalDiff + proteinDiff + carbsDiff + fatDiff;
}

/** Picks the snack candidate whose nutrition is closest to what's left of the daily target. */
export function pickClosestSnack<T>(
  target: MacroTarget,
  candidates: SnackCandidate<T>[],
): SnackCandidate<T> | null {
  if (candidates.length === 0) return null;
  return candidates.reduce((best, current) =>
    distanceToTarget(target, current.nutrition) < distanceToTarget(target, best.nutrition)
      ? current
      : best,
  );
}
