/**
 * Pure "recipes I can make from what's in the pantry" matcher for the Pantry
 * screen's "Uvař z toho, co mám" cross-link into Library (Task 8). This is
 * deliberately simple and separate from the meal-generator's own pantry
 * scoring (src/domain/generator/scoring.ts) – that's a scoring bonus inside
 * weekly generation; this is a Library browse-time filter, new logic, not a
 * relocation of the generator's.
 *
 * Rule: a recipe qualifies if at least MIN_PANTRY_OVERLAP of its ingredients
 * are currently in stock; qualifying recipes are returned sorted by overlap
 * count descending (most pantry-matched first).
 */

const MIN_PANTRY_OVERLAP = 2;

export interface PantryMatchable {
  id: string;
  ingredientFoodIds: string[];
}

export function rankRecipesByPantryOverlap<T extends PantryMatchable>(
  recipes: T[],
  inStockFoodIds: Set<string>,
): T[] {
  return recipes
    .map((recipe) => ({
      recipe,
      overlap: recipe.ingredientFoodIds.filter((foodId) => inStockFoodIds.has(foodId)).length,
    }))
    .filter((entry) => entry.overlap >= MIN_PANTRY_OVERLAP)
    .sort((a, b) => b.overlap - a.overlap)
    .map((entry) => entry.recipe);
}
