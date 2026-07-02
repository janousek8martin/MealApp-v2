import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import {
  foodRestrictions,
  foods,
  photos,
  profileFavorites,
  recipeIngredients,
  recipes,
} from '@/db/schema';
import { computeRecipeNutrition, type RecipeNutrition } from '@/domain/recipeNutrition';

export function useFoods() {
  const { data } = useLiveQuery(db.select().from(foods).where(isNull(foods.deletedAt)));
  return data ?? [];
}

export function useFood(foodId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(foods)
      .where(and(eq(foods.id, foodId ?? ''), isNull(foods.deletedAt))),
    [foodId],
  );
  return data?.[0] ?? null;
}

export function useRecipes() {
  const { data } = useLiveQuery(db.select().from(recipes).where(isNull(recipes.deletedAt)));
  return data ?? [];
}

export function useRecipe(recipeId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(recipes)
      .where(and(eq(recipes.id, recipeId ?? ''), isNull(recipes.deletedAt))),
    [recipeId],
  );
  return data?.[0] ?? null;
}

export type IngredientRow = {
  ingredient: typeof recipeIngredients.$inferSelect;
  food: typeof foods.$inferSelect;
};

export function useRecipeIngredients(recipeId: string | undefined): IngredientRow[] {
  const { data } = useLiveQuery(
    db
      .select({ ingredient: recipeIngredients, food: foods })
      .from(recipeIngredients)
      .innerJoin(foods, eq(recipeIngredients.foodId, foods.id))
      .where(and(eq(recipeIngredients.recipeId, recipeId ?? ''), isNull(recipeIngredients.deletedAt))),
    [recipeId],
  );
  return (data as IngredientRow[] | undefined) ?? [];
}

/** Derived per-portion nutrition of a recipe – computed live, never stored. */
export function recipeNutritionOf(rows: IngredientRow[], servingsBase: number): RecipeNutrition {
  return computeRecipeNutrition(
    rows.map((row) => ({
      amount: row.ingredient.amount,
      food: {
        baseUnit: row.food.baseUnit,
        gramsPerPiece: row.food.gramsPerPiece,
        kcalPer100: row.food.kcalPer100,
        proteinPer100: row.food.proteinPer100,
        carbsPer100: row.food.carbsPer100,
        fatPer100: row.food.fatPer100,
        fiberPer100: row.food.fiberPer100,
      },
    })),
    servingsBase,
  );
}

export function useFoodAllergens(foodId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(foodRestrictions)
      .where(and(eq(foodRestrictions.foodId, foodId ?? ''), isNull(foodRestrictions.deletedAt))),
    [foodId],
  );
  return (data ?? []).map((row) => row.allergen);
}

export function usePhoto(ownerType: 'recipe' | 'food', ownerId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(photos)
      .where(
        and(
          eq(photos.ownerType, ownerType),
          eq(photos.ownerId, ownerId ?? ''),
          isNull(photos.deletedAt),
        ),
      ),
    [ownerType, ownerId],
  );
  return data?.[0] ?? null;
}

/** Map of `${ownerType}:${ownerId}` → photo uri for list rendering. */
export function usePhotoMap() {
  const { data } = useLiveQuery(db.select().from(photos).where(isNull(photos.deletedAt)));
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(`${row.ownerType}:${row.ownerId}`, row.uri);
  }
  return map;
}

export function useFavoriteRecipeIds(profileId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(profileFavorites)
      .where(and(eq(profileFavorites.profileId, profileId ?? ''), isNull(profileFavorites.deletedAt))),
    [profileId],
  );
  return new Set((data ?? []).map((row) => row.recipeId));
}
