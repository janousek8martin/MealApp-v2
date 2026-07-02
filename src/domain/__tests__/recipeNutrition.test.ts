import { computeRecipeNutrition, type IngredientWithFood } from '../recipeNutrition';

const oats: IngredientWithFood = {
  amount: 60,
  food: {
    baseUnit: 'g',
    gramsPerPiece: null,
    kcalPer100: 379,
    proteinPer100: 13.2,
    carbsPer100: 67.7,
    fatPer100: 6.5,
    fiberPer100: 10.1,
  },
};

const milk: IngredientWithFood = {
  amount: 250,
  food: {
    baseUnit: 'ml',
    gramsPerPiece: null,
    kcalPer100: 46,
    proteinPer100: 3.4,
    carbsPer100: 4.8,
    fatPer100: 1.5,
    fiberPer100: 0,
  },
};

const apple: IngredientWithFood = {
  amount: 1,
  food: {
    baseUnit: 'piece',
    gramsPerPiece: 180,
    kcalPer100: 52,
    proteinPer100: 0.3,
    carbsPer100: 13.8,
    fatPer100: 0.2,
    fiberPer100: 2.4,
  },
};

describe('computeRecipeNutrition', () => {
  it('sums grams/ml/pieces correctly for one portion', () => {
    const result = computeRecipeNutrition([oats, milk, apple], 1);
    // oats: 227.4 kcal, milk: 115 kcal, apple: 1.8×52 = 93.6 kcal → 436 kcal
    expect(result.kcal).toBeCloseTo(0.6 * 379 + 2.5 * 46 + 1.8 * 52, 3);
    expect(result.proteinG).toBeCloseTo(0.6 * 13.2 + 2.5 * 3.4 + 1.8 * 0.3, 3);
    expect(result.fiberG).toBeCloseTo(0.6 * 10.1 + 0 + 1.8 * 2.4, 3);
  });

  it('divides by servingsBase for multi-portion recipes', () => {
    const fourPortions = computeRecipeNutrition([oats, milk, apple], 4);
    const onePortion = computeRecipeNutrition([oats, milk, apple], 1);
    expect(fourPortions.kcal).toBeCloseTo(onePortion.kcal / 4, 6);
  });

  it('treats missing fiber as unknown, not zero, when no ingredient has data', () => {
    const noFiberData = computeRecipeNutrition(
      [{ amount: 100, food: { ...oats.food, fiberPer100: null } }],
      1,
    );
    expect(noFiberData.fiberG).toBeNull();
  });

  it('ignores a missing gramsPerPiece by skipping the ingredient weight', () => {
    const broken: IngredientWithFood = {
      amount: 2,
      food: { ...apple.food, gramsPerPiece: null },
    };
    // Piece without weight cannot contribute – kcal must not be NaN.
    const result = computeRecipeNutrition([broken], 1);
    expect(result.kcal).toBe(0);
  });
});
