import {
  applyHardFilterWithFallback,
  exceedsCandidateCalorieCap,
  isRecipeAllowedForProfiles,
  passesBudgetFilter,
  passesCookingExperienceFilter,
  passesCookingTimeFilter,
  passesMealPrepFilter,
  passesRepetitionRules,
  passesSameDayRepeatRule,
} from './filters';
import { type MacroTarget, pickClosestSnack } from './portions';
import type { Rng } from './rng';
import { pickWeightedRandom, scoreCandidates } from './scoring';
import type {
  DietRestrictions,
  HouseholdCandidateFilters,
  RecipeCandidate,
  RepetitionContext,
  ScoringContext,
} from './types';

/** Wraps a recipe or a standalone snack-suitable food behind one uniform shape for the generator. */
export type GeneratorItem = {
  itemType: 'recipe' | 'food';
  candidate: RecipeCandidate;
};

export const DEFAULT_SHORTLIST_SIZE = 5;

/**
 * One slot's worth of the algorithm: hard-filter by diet/allergy/repetition
 * rules (plus the oversized-candidate calorie cap for every relevant
 * profile), score the survivors, then weighted-random pick among the top N.
 * Returns null when nothing passes even the safety-critical filters (diet/
 * allergy/repetition) – the caller leaves the slot empty for manual
 * assignment in that case. The calorie cap alone is never allowed to empty a
 * slot: it's a quality preference, not a safety rule, so if it would leave
 * zero candidates the pool is retried without it (an oversized recipe,
 * scaled down, beats an empty slot that guarantees the day misses target).
 */
export function pickMealForSlot(
  candidates: GeneratorItem[],
  restrictions: DietRestrictions[],
  repetitionCtx: RepetitionContext,
  scoringExtras: Pick<
    ScoringContext,
    | 'likedItemIds'
    | 'expiringFoodIds'
    | 'inStockFoodIds'
    | 'macroFitTarget'
    | 'favoriteCuisines'
    | 'rareRecipeIds'
    | 'mealVariety'
    | 'preferPantryItems'
  >,
  rng: Rng,
  dailyTargetsKcal: number[] = [],
  shortlistSize: number = DEFAULT_SHORTLIST_SIZE,
  /** On a cold-dinner day, restrict to cold-eligible candidates when at least one exists – never allowed to empty the slot on its own. */
  requireColdEligible: boolean = false,
  /** Cooking-experience/time/budget ceilings + same-lunch-dinner rule – each applied as a hard-filter-with-fallback, same tolerance as requireColdEligible. */
  householdFilters?: HouseholdCandidateFilters,
  /** slotKey of the slot being filled – needed only for the same-lunch-dinner check. */
  slotKey?: string,
  /** The sibling lunch/dinner slot's already-picked recipe id for this track today, if any. */
  usedLunchDinnerIdsToday: ReadonlySet<string> = new Set(),
): GeneratorItem | null {
  const passesSafetyFilters = (item: GeneratorItem) =>
    isRecipeAllowedForProfiles(item.candidate, restrictions) && passesRepetitionRules(item.candidate, repetitionCtx);
  const withinCalorieCap = (item: GeneratorItem) =>
    !dailyTargetsKcal.some((target) => exceedsCandidateCalorieCap(item.candidate.nutritionPerPortion.kcal, target));

  let allowed = candidates.filter((item) => passesSafetyFilters(item) && withinCalorieCap(item));
  if (requireColdEligible) {
    const coldOnly = allowed.filter((item) => item.candidate.canServeCold);
    if (coldOnly.length > 0) allowed = coldOnly;
  }
  if (householdFilters) {
    allowed = applyHardFilterWithFallback(allowed, (item) =>
      passesCookingExperienceFilter(item.candidate, householdFilters.cookingExperienceLevel),
    );
    allowed = applyHardFilterWithFallback(allowed, (item) =>
      passesCookingTimeFilter(item.candidate, householdFilters.cookingTimeLimitMinutes),
    );
    allowed = applyHardFilterWithFallback(allowed, (item) =>
      passesBudgetFilter(item.candidate, householdFilters.budgetLevel),
    );
    allowed = applyHardFilterWithFallback(allowed, (item) =>
      passesMealPrepFilter(item.candidate, householdFilters.mealPrepMode),
    );
    if (slotKey) {
      allowed = applyHardFilterWithFallback(allowed, (item) =>
        passesSameDayRepeatRule(item.candidate, slotKey, usedLunchDinnerIdsToday, householdFilters.allowSameLunchDinner),
      );
    }
  }
  if (allowed.length === 0) allowed = candidates.filter(passesSafetyFilters);
  if (allowed.length === 0) return null;

  const scored = scoreCandidates(
    allowed.map((item) => item.candidate),
    { ...repetitionCtx, ...scoringExtras },
  );
  const chosen = pickWeightedRandom(scored, shortlistSize, rng);
  return allowed.find((item) => item.candidate.id === chosen.id) ?? null;
}

/**
 * Snack selection per the spec (step 6): unlike main meals, snacks are not
 * scored/weighted-randomized – the candidate closest to what's left of the
 * profile's daily target wins outright, after the same hard filters.
 */
export function pickSnackForSlot(
  candidates: GeneratorItem[],
  restrictions: DietRestrictions,
  repetitionCtx: RepetitionContext,
  remainingTarget: MacroTarget,
  /** Cooking-experience/time/budget ceilings – same-lunch-dinner doesn't apply to snacks. */
  householdFilters?: HouseholdCandidateFilters,
): GeneratorItem | null {
  let allowed = candidates.filter(
    (item) =>
      isRecipeAllowedForProfiles(item.candidate, [restrictions]) &&
      passesRepetitionRules(item.candidate, repetitionCtx),
  );
  if (householdFilters) {
    allowed = applyHardFilterWithFallback(allowed, (item) =>
      passesCookingExperienceFilter(item.candidate, householdFilters.cookingExperienceLevel),
    );
    allowed = applyHardFilterWithFallback(allowed, (item) =>
      passesCookingTimeFilter(item.candidate, householdFilters.cookingTimeLimitMinutes),
    );
    allowed = applyHardFilterWithFallback(allowed, (item) =>
      passesBudgetFilter(item.candidate, householdFilters.budgetLevel),
    );
  }
  if (allowed.length === 0) return null;

  const closest = pickClosestSnack(
    remainingTarget,
    allowed.map((item) => ({ item, nutrition: item.candidate.nutritionPerPortion })),
  );
  return closest?.item ?? null;
}

/** Returns a new context with `recipeId` counted once more for this week – used between slot picks. */
export function recordPick(ctx: RepetitionContext, recipeId: string): RepetitionContext {
  const weekCounts = new Map(ctx.weekCounts);
  weekCounts.set(recipeId, (weekCounts.get(recipeId) ?? 0) + 1);
  return { ...ctx, weekCounts };
}
