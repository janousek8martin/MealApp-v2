import type {
  DerivedRecipeTags,
  DietRestrictions,
  IngredientFoodTags,
  RecipeCandidate,
  RepetitionContext,
} from './types';

/**
 * Recipe-level tags are derived from ingredients, never stored: allergens are
 * the union across ingredients (any one triggers it), diet compatibility is
 * the intersection (every ingredient must support the diet).
 */
export function deriveRecipeTags(ingredients: IngredientFoodTags[]): DerivedRecipeTags {
  const allergens = new Set<string>();
  let diets: string[] | null = null;

  for (const ingredient of ingredients) {
    for (const allergen of ingredient.allergens) allergens.add(allergen);
    diets = diets === null ? ingredient.dietFlags : diets.filter((d) => ingredient.dietFlags.includes(d));
  }

  return { allergens: [...allergens], dietFlags: diets ?? [] };
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

  return profiles.every((profile) => {
    if (tags.allergens.some((a) => profile.allergens.includes(a))) return false;
    if (profile.diets.some((d) => !tags.dietFlags.includes(d))) return false;
    if (profile.avoidedRecipeIds.includes(candidate.id)) return false;
    if (ingredientFoodIds.some((id) => profile.avoidedFoodIds.includes(id))) return false;
    return true;
  });
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
