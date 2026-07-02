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

/**
 * Higher is better. Combines: repetition penalty (relative to the recipe's
 * effective weekly limit), a favorite bonus, a budget/quality nudge, and a
 * bonus for using pantry ingredients close to expiring.
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

  return BASE_SCORE - repetitionPenalty + favoriteBonus + budgetScore + fiberScore + pantryBonus;
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
