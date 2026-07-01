import { newId } from '../id';
import { foodRestrictions, foods, recipeIngredients, recipes } from '../schema';
import { nowIso } from '../time';
import type { AppDb } from '../types';
import { sampleFoods, sampleRecipes, type FoodSeed, type RecipeSeed } from './sampleData';

/**
 * Populates the foods/recipes library on first launch. Idempotent: runs only
 * when the foods table is completely empty.
 */
export async function seedIfEmpty(
  db: AppDb,
  foodSeeds: FoodSeed[] = sampleFoods,
  recipeSeeds: RecipeSeed[] = sampleRecipes,
): Promise<boolean> {
  const existing = await db.select().from(foods).limit(1);
  if (existing.length > 0) {
    return false;
  }

  const now = nowIso();
  const foodIdsByKey = new Map<string, string>();

  for (const seed of foodSeeds) {
    const foodId = newId();
    foodIdsByKey.set(seed.key, foodId);

    await db.insert(foods).values({
      id: foodId,
      createdAt: now,
      updatedAt: now,
      nameCs: seed.nameCs,
      nameEn: seed.nameEn,
      category: seed.category,
      baseUnit: seed.baseUnit,
      gramsPerPiece: seed.gramsPerPiece,
      kcalPer100: seed.kcalPer100,
      proteinPer100: seed.proteinPer100,
      carbsPer100: seed.carbsPer100,
      fatPer100: seed.fatPer100,
      fiberPer100: seed.fiberPer100,
      dietFlagsJson: seed.dietFlags ? JSON.stringify(seed.dietFlags) : null,
      budget: seed.budget ?? 'average',
      shelfLifeDays: seed.shelfLifeDays,
      storage: seed.storage,
      snackSuitable: seed.snackSuitable ?? false,
      source: 'seed-draft',
    });

    if (seed.allergens?.length) {
      await db.insert(foodRestrictions).values(
        seed.allergens.map((allergen) => ({
          id: newId(),
          createdAt: now,
          updatedAt: now,
          foodId,
          allergen,
        })),
      );
    }
  }

  for (const seed of recipeSeeds) {
    const recipeId = newId();

    await db.insert(recipes).values({
      id: recipeId,
      createdAt: now,
      updatedAt: now,
      nameCs: seed.nameCs,
      nameEn: seed.nameEn,
      instructionsCs: seed.instructionsCs,
      instructionsEn: seed.instructionsEn,
      category: seed.category,
      isSide: seed.isSide ?? false,
      budget: seed.budget ?? 'average',
      prepTimeMinutes: seed.prepTimeMinutes,
      source: 'seed-draft',
    });

    await db.insert(recipeIngredients).values(
      seed.ingredients.map((ingredient) => {
        const foodId = foodIdsByKey.get(ingredient.foodKey);
        if (!foodId) {
          throw new Error(`Seed recipe '${seed.key}' references unknown food '${ingredient.foodKey}'`);
        }
        return {
          id: newId(),
          createdAt: now,
          updatedAt: now,
          recipeId,
          foodId,
          amount: ingredient.amount,
        };
      }),
    );
  }

  return true;
}
