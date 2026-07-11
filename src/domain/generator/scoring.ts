import type { Rng } from './rng';
import { effectiveMaxRepetitions } from './filters';
import type { RecipeCandidate, ScoredCandidate, ScoringContext } from './types';

const BASE_SCORE = 100;
const REPETITION_PENALTY_WEIGHT = 40;
const FAVORITE_BONUS = 20;
const BUDGET_SCORE: Record<RecipeCandidate['budget'], number> = {
  cheap: 10,
  average: 4,
  expensive: 0,
};
/** Reward fibre-rich recipes a little – a soft nutritional-quality nudge. */
const FIBER_SCORE_PER_GRAM = 0.6;
const FIBER_SCORE_CAP = 8;
const PANTRY_EXPIRY_BONUS_PER_INGREDIENT = 6;
/** Smaller than the expiry bonus – "use it before it spoils" should always outrank "it's just in stock". */
const PANTRY_STOCK_BONUS_PER_INGREDIENT = 3;
/** Soft nudge for a recipe matching one of the household's preferred cuisines. */
const FAVORITE_CUISINE_BONUS = 8;
/** Max bonus for a recipe whose protein/fat density (per kcal) exactly matches the slot's macro-fit target. */
const MACRO_FIT_BONUS_MAX = 15;
/** Converts a per-kcal-gram ratio difference into score points (calibrated so a ~0.05 g/kcal miss costs the whole bonus). */
const MACRO_FIT_DISTANCE_SCALE = 300;

/**
 * Soft bonus for a recipe whose protein/fat density already matches the
 * slot's macro-fit target (see `resolveMainSlotTarget`) – compares ratios
 * (g per kcal), not raw grams, since the recipe will be scaled to hit the
 * slot's kcal target regardless of its base serving size; if the ratio
 * already matches, scaling to kcal automatically hits protein/fat too.
 */
function macroFitScore(candidate: RecipeCandidate, target: ScoringContext['macroFitTarget']): number {
  if (!target || target.kcal <= 0 || candidate.nutritionPerPortion.kcal <= 0) return 0;
  const targetProteinRatio = target.proteinG / target.kcal;
  const targetFatRatio = target.fatG / target.kcal;
  const candidateProteinRatio = candidate.nutritionPerPortion.proteinG / candidate.nutritionPerPortion.kcal;
  const candidateFatRatio = candidate.nutritionPerPortion.fatG / candidate.nutritionPerPortion.kcal;
  const distance = Math.abs(candidateProteinRatio - targetProteinRatio) + Math.abs(candidateFatRatio - targetFatRatio);
  return Math.max(0, MACRO_FIT_BONUS_MAX - distance * MACRO_FIT_DISTANCE_SCALE);
}

/**
 * Higher is better. Combines: repetition penalty (relative to the recipe's
 * effective weekly limit), a favorite bonus, a budget/quality nudge, bonuses
 * for using pantry ingredients close to expiring or already in stock, and a
 * macro-fit nudge.
 */
export function scoreCandidate(candidate: RecipeCandidate, ctx: ScoringContext): number {
  const used = ctx.weekCounts.get(candidate.id) ?? 0;
  const limit = effectiveMaxRepetitions(candidate, ctx);
  const repetitionPenalty = limit > 0 ? (used / limit) * REPETITION_PENALTY_WEIGHT : 0;

  const favoriteBonus = ctx.favoriteRecipeIds.has(candidate.id) ? FAVORITE_BONUS : 0;
  const budgetScore = BUDGET_SCORE[candidate.budget];
  const fiberScore = Math.min(
    (candidate.nutritionPerPortion.fiberG ?? 0) * FIBER_SCORE_PER_GRAM,
    FIBER_SCORE_CAP,
  );
  const expiringCount = candidate.ingredients.filter((i) => ctx.expiringFoodIds.has(i.foodId)).length;
  const pantryBonus = expiringCount * PANTRY_EXPIRY_BONUS_PER_INGREDIENT;
  const stockCount = candidate.ingredients.filter((i) => ctx.inStockFoodIds.has(i.foodId)).length;
  const stockBonus = stockCount * PANTRY_STOCK_BONUS_PER_INGREDIENT;
  const macroBonus = macroFitScore(candidate, ctx.macroFitTarget);
  const cuisineBonus = candidate.cuisine && ctx.favoriteCuisines?.has(candidate.cuisine) ? FAVORITE_CUISINE_BONUS : 0;

  return (
    BASE_SCORE -
    repetitionPenalty +
    favoriteBonus +
    budgetScore +
    fiberScore +
    pantryBonus +
    stockBonus +
    macroBonus +
    cuisineBonus
  );
}

export function scoreCandidates(candidates: RecipeCandidate[], ctx: ScoringContext): ScoredCandidate[] {
  return candidates.map((candidate) => ({ candidate, score: scoreCandidate(candidate, ctx) }));
}

/**
 * Weighted random pick among the top `topN` scored candidates – variety
 * without abandoning quality. Scores are shifted so the lowest-ranked of the
 * shortlist still has a small, non-zero chance of being picked.
 */
export function pickWeightedRandom(
  scored: ScoredCandidate[],
  topN: number,
  rng: Rng,
): RecipeCandidate {
  if (scored.length === 0) {
    throw new Error('pickWeightedRandom: no candidates to choose from');
  }
  const shortlist = [...scored].sort((a, b) => b.score - a.score).slice(0, topN);
  const minScore = Math.min(...shortlist.map((s) => s.score));
  const weights = shortlist.map((s) => s.score - minScore + 1); // +1 keeps every weight positive
  const total = weights.reduce((sum, w) => sum + w, 0);

  let roll = rng() * total;
  for (let i = 0; i < shortlist.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return shortlist[i].candidate;
  }
  return shortlist[shortlist.length - 1].candidate;
}
