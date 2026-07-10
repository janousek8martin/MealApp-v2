import type {
  DerivedRecipeTags,
  DietRestrictions,
  IngredientFoodTags,
  RecipeCandidate,
  RecipeNutritionPerPortion,
  RepetitionContext,
} from './types';

const GLUTEN_FREE = 'gluten_free';
const DAIRY_FREE = 'dairy_free';
/** Diet key handled separately below since it's derived from the recipe's aggregate nutrition, not an ingredient flag intersection. */
const LOW_CARB = 'low_carb';

/** gluten_free/dairy_free aren't curated per-food like vegetarian/vegan – they're always derivable from the allergens a food already carries. */
function effectiveIngredientDietFlags(ingredient: IngredientFoodTags): string[] {
  const flags = new Set(ingredient.dietFlags);
  if (!ingredient.allergens.includes('gluten')) flags.add(GLUTEN_FREE);
  if (!ingredient.allergens.includes('lactose')) flags.add(DAIRY_FREE);
  return [...flags];
}

function computeRecipeTags(ingredients: IngredientFoodTags[]): DerivedRecipeTags {
  const allergens = new Set<string>();
  let diets: string[] | null = null;

  for (const ingredient of ingredients) {
    for (const allergen of ingredient.allergens) allergens.add(allergen);
    const ingredientDiets = effectiveIngredientDietFlags(ingredient);
    diets = diets === null ? ingredientDiets : diets.filter((d) => ingredientDiets.includes(d));
  }

  return { allergens: [...allergens], dietFlags: diets ?? [] };
}

/**
 * Cached by ingredients-array identity: a candidate's ingredients array is
 * built once per generator run (see loadGeneratorContext) and reused across
 * every day/slot pick that run, so recomputing this per pick was pure waste
 * (O4 in the 2026-07 audit).
 */
const recipeTagsCache = new WeakMap<IngredientFoodTags[], DerivedRecipeTags>();

/**
 * Recipe-level tags are derived from ingredients, never stored: allergens are
 * the union across ingredients (any one triggers it), diet compatibility is
 * the intersection (every ingredient must support the diet).
 */
export function deriveRecipeTags(ingredients: IngredientFoodTags[]): DerivedRecipeTags {
  const cached = recipeTagsCache.get(ingredients);
  if (cached) return cached;
  const tags = computeRecipeTags(ingredients);
  recipeTagsCache.set(ingredients, tags);
  return tags;
}

/**
 * A recipe counts as "low carb" when carbs supply under ~26% of its calories
 * (looser than keto, in line with common low-carb-diet guidance) rather than
 * a fixed gram threshold, so the check still makes sense after the generator
 * scales the portion up or down for a profile's calorie target.
 */
const LOW_CARB_MAX_CARB_KCAL_SHARE = 0.26;

/** Exported so the library screen's diet filter (UI, not the generator) can apply the identical rule. */
export function isLowCarbRecipe(nutrition: RecipeNutritionPerPortion): boolean {
  if (nutrition.kcal <= 0) return true;
  return (nutrition.carbsG * 4) / nutrition.kcal <= LOW_CARB_MAX_CARB_KCAL_SHARE;
}

/**
 * Hard filter: a recipe is only a candidate if it satisfies every profile
 * sharing this meal track (allergies, required diets, and both avoid lists).
 */
export function isRecipeAllowedForProfiles(
  candidate: RecipeCandidate,
  profiles: DietRestrictions[],
): boolean {
  const tags = deriveRecipeTags(candidate.ingredients);
  const ingredientFoodIds = candidate.ingredients.map((i) => i.foodId);
  const lowCarb = isLowCarbRecipe(candidate.nutritionPerPortion);

  return profiles.every((profile) => {
    if (tags.allergens.some((a) => profile.allergens.includes(a))) return false;
    for (const diet of profile.diets) {
      if (diet === LOW_CARB) {
        if (!lowCarb) return false;
        continue;
      }
      if (!tags.dietFlags.includes(diet)) return false;
    }
    if (profile.avoidedRecipeIds.includes(candidate.id)) return false;
    if (ingredientFoodIds.some((id) => profile.avoidedFoodIds.includes(id))) return false;
    return true;
  });
}

/**
 * A recipe/food this much larger than a profile's whole daily calorie budget
 * is a poor main-meal candidate even after portion scaling (scaling it down
 * to fit would distort the portion beyond what's sensible to cook/serve).
 * Snacks are exempt – a snack's whole point is a small slice of the day.
 */
const MAX_CANDIDATE_KCAL_SHARE_OF_DAILY_TARGET = 0.6;

export function exceedsCandidateCalorieCap(candidateKcal: number, dailyTargetKcal: number): boolean {
  return dailyTargetKcal > 0 && candidateKcal > MAX_CANDIDATE_KCAL_SHARE_OF_DAILY_TARGET * dailyTargetKcal;
}

export type RestrictionConflict = { kind: 'allergen' | 'diet' | 'avoided'; value?: string };

/**
 * Manual-assignment safety guard: unlike `isRecipeAllowedForProfiles` (a hard
 * filter that silently excludes candidates from the generator), this reports
 * every conflict for an item a user explicitly picked, so the caller can ask
 * for confirmation instead of allowing a silent allergy/diet/avoid-list bypass.
 * `low_carb` is skipped as a diet conflict here – it's a computed nutritional
 * property, not an ingredient-tag mismatch, and would false-positive on every
 * item that hasn't been explicitly tagged with it.
 */
export function findRestrictionConflicts(
  item: { itemType: 'recipe' | 'food'; itemId: string; allergens: string[]; dietFlags: string[] },
  profiles: DietRestrictions[],
): RestrictionConflict[] {
  const conflicts: RestrictionConflict[] = [];
  const seenAllergens = new Set<string>();
  const seenDiets = new Set<string>();
  let avoided = false;

  for (const profile of profiles) {
    for (const allergen of profile.allergens) {
      if (!seenAllergens.has(allergen) && item.allergens.includes(allergen)) {
        seenAllergens.add(allergen);
        conflicts.push({ kind: 'allergen', value: allergen });
      }
    }
    for (const diet of profile.diets) {
      if (diet === LOW_CARB || seenDiets.has(diet)) continue;
      if (!item.dietFlags.includes(diet)) {
        seenDiets.add(diet);
        conflicts.push({ kind: 'diet', value: diet });
      }
    }
    if (!avoided) {
      const isAvoided =
        (item.itemType === 'recipe' && profile.avoidedRecipeIds.includes(item.itemId)) ||
        (item.itemType === 'food' && profile.avoidedFoodIds.includes(item.itemId));
      if (isAvoided) {
        avoided = true;
        conflicts.push({ kind: 'avoided' });
      }
    }
  }

  return conflicts;
}

function effectiveMaxRepetitions(candidate: RecipeCandidate, ctx: RepetitionContext): number {
  return candidate.maxRepetitionsPerWeek ?? ctx.household.defaultMaxRepetitionsPerWeek;
}

function effectiveAllowConsecutiveDays(candidate: RecipeCandidate, ctx: RepetitionContext): boolean {
  return candidate.allowConsecutiveDays ?? ctx.household.defaultAllowConsecutiveDays;
}

/**
 * Hard filter: excludes a recipe once it has hit its effective weekly limit,
 * or if it ran yesterday and consecutive-day repetition isn't allowed for it.
 * Favorites do not bypass this – per the spec, favorites only get a scoring
 * bonus, never override the limit.
 */
export function passesRepetitionRules(candidate: RecipeCandidate, ctx: RepetitionContext): boolean {
  const used = ctx.weekCounts.get(candidate.id) ?? 0;
  if (used >= effectiveMaxRepetitions(candidate, ctx)) return false;
  if (!effectiveAllowConsecutiveDays(candidate, ctx) && ctx.previousDayRecipeIds.has(candidate.id)) {
    return false;
  }
  return true;
}

export { effectiveAllowConsecutiveDays, effectiveMaxRepetitions };
