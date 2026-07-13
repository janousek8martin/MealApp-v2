import type { RecipeNutritionPerPortion } from './types';

/**
 * A portion scaled below 0.25x or above 4x the recipe's base serving is no
 * longer a sensible amount to cook/serve (e.g. a sliver of lasagna, or five
 * servings of a snack) – clamping keeps the generator from ever producing
 * that, at the cost of missing the calorie target exactly (surfaced via
 * `isScalingMultiplierClamped` so the caller can flag the day accordingly).
 */
const MIN_SCALING_MULTIPLIER = 0.25;
const MAX_SCALING_MULTIPLIER = 4;

/**
 * Single multiplier applied to the whole recipe – keeps its internal macro
 * ratio intact, per the approved algorithm (portion scaling, not per-component
 * adjustment).
 */
export function scalingMultiplier(targetKcal: number, recipeKcalPerPortion: number): number {
  if (recipeKcalPerPortion <= 0) return 1;
  const raw = targetKcal / recipeKcalPerPortion;
  return Math.min(MAX_SCALING_MULTIPLIER, Math.max(MIN_SCALING_MULTIPLIER, raw));
}

/** Whether `scalingMultiplier` would clamp this target/recipe pair rather than hitting it exactly. */
export function isScalingMultiplierClamped(targetKcal: number, recipeKcalPerPortion: number): boolean {
  if (recipeKcalPerPortion <= 0) return false;
  const raw = targetKcal / recipeKcalPerPortion;
  return raw < MIN_SCALING_MULTIPLIER || raw > MAX_SCALING_MULTIPLIER;
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

/** A profile's per-slot portion customization (P2-C); any field may be unset. */
export type SlotPortionOverride = {
  calorieSharePercent: number | null;
  proteinTargetG: number | null;
  fatTargetG: number | null;
};

/** Resolves the calorie share to scale a main-slot recipe by: the profile's own override if set, else the household default. */
export function resolveSlotCalorieShare(householdShare: number, override: SlotPortionOverride | undefined): number {
  return override?.calorieSharePercent ?? householdShare;
}

/**
 * A main slot's target macros, for *candidate scoring* only – not for
 * scaling (a main dish is always scaled by one recipe-wide multiplier, see
 * `scalingMultiplier`, so it can't be pushed toward an independent protein/
 * fat target the way a snack can). Mirrors `resolveSnackTarget`'s override
 * precedence: an explicit protein/fat target replaces its calorie-share-
 * proportional default, and carbs fill whatever kcal budget is left.
 */
export function resolveMainSlotTarget(
  dailyTarget: MacroTarget,
  householdCalorieShare: number,
  override: SlotPortionOverride | undefined,
): MacroTarget {
  const effectiveShare = resolveSlotCalorieShare(householdCalorieShare, override);
  const kcal = effectiveShare * dailyTarget.kcal;
  const proteinG = override?.proteinTargetG ?? dailyTarget.proteinG * effectiveShare;
  const fatG = override?.fatTargetG ?? dailyTarget.fatG * effectiveShare;
  const carbsG = Math.max(0, (kcal - proteinG * 4 - fatG * 9) / 4);
  return { kcal, proteinG, fatG, carbsG };
}

/**
 * Resolves the target macros for a snack slot. With no override this is just
 * "whatever remains of the daily target" (the default). Once the profile sets
 * an explicit protein/fat (and optionally calorie-share) target for the slot,
 * carbs are computed from whatever kcal is left after protein and fat, so the
 * three macros plus kcal stay internally consistent.
 */
export function resolveSnackTarget(
  remaining: MacroTarget,
  dailyTargetKcal: number,
  override: SlotPortionOverride | undefined,
): MacroTarget {
  const hasOverride =
    override && (override.calorieSharePercent != null || override.proteinTargetG != null || override.fatTargetG != null);
  if (!hasOverride) return remaining;

  const kcal = override!.calorieSharePercent != null ? override!.calorieSharePercent * dailyTargetKcal : remaining.kcal;
  const proteinG = override!.proteinTargetG ?? remaining.proteinG;
  const fatG = override!.fatTargetG ?? remaining.fatG;
  const carbsG = Math.max(0, (kcal - proteinG * 4 - fatG * 9) / 4);
  return { kcal, proteinG, carbsG, fatG };
}

/**
 * Normalizes weights (summing to 1) for a set of snack-kind slots being
 * filled in the same generateDay pass, so the remaining post-mains budget
 * is split up front rather than greedily consumed by whichever slot is
 * processed first (the bug this fixes: with a fixed remaining-kcal target
 * recomputed after each pick, the first slot in sortOrder claimed nearly
 * the entire remaining budget, leaving near-zero for the rest). Falls back
 * to an equal split when every slot's effective weight is 0 (e.g. a batch
 * of newly-inserted slots that haven't been given a calorieShare).
 */
export function allocateSnackWeights(
  slots: { id: string; calorieShare: number }[],
  overrides: Map<string, SlotPortionOverride | undefined>,
): number[] {
  const rawWeights = slots.map((slot) => overrides.get(slot.id)?.calorieSharePercent ?? slot.calorieShare);
  const sum = rawWeights.reduce((total, w) => total + w, 0);
  if (sum <= 0) return slots.map(() => 1 / slots.length);
  return rawWeights.map((w) => w / sum);
}
