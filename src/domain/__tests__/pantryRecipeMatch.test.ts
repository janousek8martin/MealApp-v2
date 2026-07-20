import { rankRecipesByPantryOverlap } from '../pantryRecipeMatch';

describe('rankRecipesByPantryOverlap', () => {
  const inStock = new Set(['a', 'b', 'c']);

  it('excludes recipes with fewer than 2 in-stock ingredients', () => {
    const recipes = [
      { id: 'r1', ingredientFoodIds: ['a', 'x', 'y'] }, // 1 match
      { id: 'r2', ingredientFoodIds: ['x', 'y', 'z'] }, // 0 matches
    ];
    expect(rankRecipesByPantryOverlap(recipes, inStock)).toEqual([]);
  });

  it('includes recipes with 2+ in-stock ingredients, sorted by overlap descending', () => {
    const recipes = [
      { id: 'low', ingredientFoodIds: ['a', 'b', 'x'] }, // 2 matches
      { id: 'high', ingredientFoodIds: ['a', 'b', 'c'] }, // 3 matches
      { id: 'none', ingredientFoodIds: ['x', 'y'] }, // 0 matches
    ];
    expect(rankRecipesByPantryOverlap(recipes, inStock).map((r) => r.id)).toEqual(['high', 'low']);
  });

  it('returns an empty array when nothing is in stock', () => {
    const recipes = [{ id: 'r1', ingredientFoodIds: ['a', 'b'] }];
    expect(rankRecipesByPantryOverlap(recipes, new Set())).toEqual([]);
  });
});
