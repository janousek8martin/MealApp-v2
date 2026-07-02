/**
 * Recipe nutrition is always derived from ingredients – never stored – so an
 * ingredient edit propagates to every recipe and plan instantly.
 */

export type IngredientFoodFacts = {
  baseUnit: 'g' | 'ml' | 'piece';
  gramsPerPiece: number | null;
  kcalPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  /** null = unknown (never treated as 0). */
  fiberPer100: number | null;
};

export type IngredientWithFood = {
  /** Amount in the food's base unit, per `servingsBase` portions. */
  amount: number;
  food: IngredientFoodFacts;
};

export type RecipeNutrition = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** null when no ingredient carries fiber data (unknown ≠ 0). */
  fiberG: number | null;
};

/** Amount → multiplier of the per-100 nutrition values. */
function per100Multiplier(ingredient: IngredientWithFood): number {
  const { food, amount } = ingredient;
  if (food.baseUnit === 'piece') {
    if (!food.gramsPerPiece) return 0; // cannot weigh an unknown piece
    return (amount * food.gramsPerPiece) / 100;
  }
  return amount / 100;
}

export function computeRecipeNutrition(
  ingredients: IngredientWithFood[],
  servingsBase: number,
): RecipeNutrition {
  let kcal = 0;
  let proteinG = 0;
  let carbsG = 0;
  let fatG = 0;
  let fiberG: number | null = null;

  for (const ingredient of ingredients) {
    const factor = per100Multiplier(ingredient);
    kcal += factor * ingredient.food.kcalPer100;
    proteinG += factor * ingredient.food.proteinPer100;
    carbsG += factor * ingredient.food.carbsPer100;
    fatG += factor * ingredient.food.fatPer100;
    if (ingredient.food.fiberPer100 !== null) {
      fiberG = (fiberG ?? 0) + factor * ingredient.food.fiberPer100;
    }
  }

  const portions = servingsBase > 0 ? servingsBase : 1;
  return {
    kcal: kcal / portions,
    proteinG: proteinG / portions,
    carbsG: carbsG / portions,
    fatG: fatG / portions,
    fiberG: fiberG === null ? null : fiberG / portions,
  };
}
