import { eq } from 'drizzle-orm';

import { newId } from '../id';
import { foodRestrictions, foods, recipeIngredients, recipes } from '../schema';
import { nowIso } from '../time';
import type { AppDb } from '../types';
import { seedFoods } from './foods';
import { seedRecipes } from './recipes';
import type { FoodSeed, RecipeSeed } from './types';
import { usdaSeedFoods } from './usdaFoods.generated';

/** Splits an array into chunks of at most `size` - keeps bulk inserts under SQLite's per-statement parameter limit. */
function chunk<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
  return result;
}

/** Batch-inserts a set of food seeds (and their allergen rows) in small chunks. Returns the seed key -> generated id map. */
async function insertFoodSeeds(db: AppDb, foodSeeds: FoodSeed[], now: string): Promise<Map<string, string>> {
  const foodIdsByKey = new Map<string, string>();

  const foodRows = foodSeeds.map((seed) => {
    const foodId = newId();
    foodIdsByKey.set(seed.key, foodId);
    return {
      id: foodId,
      createdAt: now,
      updatedAt: now,
      nameCs: seed.nameCs,
      nameEn: seed.nameEn,
      category: seed.category,
      baseUnit: seed.baseUnit,
      gramsPerPiece: seed.gramsPerPiece,
      gramsPerCup: seed.gramsPerCup,
      kcalPer100: seed.kcalPer100,
      proteinPer100: seed.proteinPer100,
      carbsPer100: seed.carbsPer100,
      fatPer100: seed.fatPer100,
      fiberPer100: seed.fiberPer100,
      micronutrientsJson: seed.micronutrients ? JSON.stringify(seed.micronutrients) : null,
      dietFlagsJson: seed.dietFlags ? JSON.stringify(seed.dietFlags) : null,
      budget: seed.budget ?? 'average',
      shelfLifeDays: seed.shelfLifeDays,
      storage: seed.storage,
      snackSuitable: seed.snackSuitable ?? false,
      source: seed.source ?? 'seed-draft',
      seedKey: seed.key,
      needsReview: seed.needsReview ?? false,
    };
  });

  for (const batch of chunk(foodRows, 25)) {
    await db.insert(foods).values(batch);
  }

  const restrictionRows = foodSeeds.flatMap((seed) => {
    if (!seed.allergens?.length) return [];
    const foodId = foodIdsByKey.get(seed.key)!;
    return seed.allergens.map((allergen) => ({
      id: newId(),
      createdAt: now,
      updatedAt: now,
      foodId,
      allergen,
    }));
  });

  for (const batch of chunk(restrictionRows, 100)) {
    await db.insert(foodRestrictions).values(batch);
  }

  return foodIdsByKey;
}

/**
 * Populates the curated foods/recipes library on first launch. Idempotent:
 * runs only when the foods table is completely empty. Deliberately does NOT
 * include the bulk USDA library (see seedUsdaFoodsIfEmpty below) - this
 * gates the splash screen, so it stays small and fast; USDA's ~8000 rows
 * seed separately, in the background, after the UI is already usable.
 */
export async function seedIfEmpty(
  db: AppDb,
  foodSeeds: FoodSeed[] = seedFoods,
  recipeSeeds: RecipeSeed[] = seedRecipes,
): Promise<boolean> {
  const existing = await db.select().from(foods).limit(1);
  if (existing.length > 0) {
    return false;
  }

  const now = nowIso();
  const foodIdsByKey = await insertFoodSeeds(db, foodSeeds, now);

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
      cuisine: seed.cuisine ?? null,
      budget: seed.budget ?? 'average',
      prepTimeMinutes: seed.prepTimeMinutes,
      tagsJson: seed.tags ? JSON.stringify(seed.tags) : null,
      mealPrepFriendly: seed.mealPrepFriendly ?? false,
      source: 'seed',
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

/**
 * Seeds the bulk USDA Foundation+SR Legacy food library (needsReview=true,
 * no recipes reference these). Idempotent: skips if any USDA food is
 * already present (checked by seedKey, since `source` on a curated food can
 * also be 'usda' - the generated seed's keys are always 'usda_<fdcId>').
 * Meant to run in the background after seedIfEmpty/the splash screen, not
 * block first launch on ~8000 rows.
 */
export async function seedUsdaFoodsIfEmpty(db: AppDb, foodSeeds: FoodSeed[] = usdaSeedFoods): Promise<boolean> {
  if (foodSeeds.length === 0) return false;
  const existing = await db.select().from(foods).where(eq(foods.seedKey, foodSeeds[0].key)).limit(1);
  if (existing.length > 0) {
    return false;
  }

  await insertFoodSeeds(db, foodSeeds, nowIso());
  return true;
}
