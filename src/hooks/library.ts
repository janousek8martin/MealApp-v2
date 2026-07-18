import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import {
  foodRestrictions,
  foods,
  photos,
  profileItemRatings,
  recipeIngredients,
  recipes,
} from '@/db/schema';
import { deriveRecipeTags } from '@/domain/generator/filters';
import type { DerivedRecipeTags, IngredientFoodTags } from '@/domain/generator/types';
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

/**
 * Every recipe's derived allergens/diet compatibility, keyed by recipe id –
 * for library filtering. Memoized on the 3 live-query result arrays: this
 * join+derive walks every ingredient/food/restriction row in the database,
 * so without memoization it silently re-ran on every render of the caller
 * (e.g. every keystroke while typing in the Library search box).
 */
export function useRecipeTagsMap(): Map<string, DerivedRecipeTags> {
  const { data: ingredientRows } = useLiveQuery(
    db.select().from(recipeIngredients).where(isNull(recipeIngredients.deletedAt)),
  );
  const { data: foodRows } = useLiveQuery(db.select().from(foods).where(isNull(foods.deletedAt)));
  const { data: restrictionRows } = useLiveQuery(
    db.select().from(foodRestrictions).where(isNull(foodRestrictions.deletedAt)),
  );

  return useMemo(() => {
    const map = new Map<string, DerivedRecipeTags>();
    if (!ingredientRows || !foodRows || !restrictionRows) return map;

    const foodById = new Map(foodRows.map((food) => [food.id, food]));
    const allergensByFood = new Map<string, string[]>();
    for (const row of restrictionRows) {
      const list = allergensByFood.get(row.foodId) ?? [];
      list.push(row.allergen);
      allergensByFood.set(row.foodId, list);
    }

    const ingredientsByRecipe = new Map<string, IngredientFoodTags[]>();
    for (const ingredient of ingredientRows) {
      const food = foodById.get(ingredient.foodId);
      if (!food) continue;
      const list = ingredientsByRecipe.get(ingredient.recipeId) ?? [];
      list.push({
        foodId: food.id,
        allergens: allergensByFood.get(food.id) ?? [],
        dietFlags: food.dietFlagsJson ? (JSON.parse(food.dietFlagsJson) as string[]) : [],
        needsReview: food.needsReview,
      });
      ingredientsByRecipe.set(ingredient.recipeId, list);
    }

    for (const [recipeId, ingredients] of ingredientsByRecipe) {
      map.set(recipeId, deriveRecipeTags(ingredients));
    }
    return map;
  }, [ingredientRows, foodRows, restrictionRows]);
}

/** Every food's allergen list, keyed by food id – for library filtering. */
export function useFoodAllergensMap(): Map<string, string[]> {
  const { data } = useLiveQuery(db.select().from(foodRestrictions).where(isNull(foodRestrictions.deletedAt)));
  return useMemo(() => {
    const map = new Map<string, string[]>();
    for (const row of data ?? []) {
      const list = map.get(row.foodId) ?? [];
      list.push(row.allergen);
      map.set(row.foodId, list);
    }
    return map;
  }, [data]);
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
  return useMemo(() => {
    const map = new Map<string, string>();
    for (const row of data ?? []) {
      map.set(`${row.ownerType}:${row.ownerId}`, row.uri);
    }
    return map;
  }, [data]);
}

/** Map of itemId -> this profile's rating, for one item type (recipe or food). */
export function useRatingsMap(
  profileId: string | undefined,
  itemType: 'recipe' | 'food',
): Map<string, 'like' | 'dislike'> {
  const { data } = useLiveQuery(
    db
      .select()
      .from(profileItemRatings)
      .where(
        and(
          eq(profileItemRatings.profileId, profileId ?? ''),
          eq(profileItemRatings.itemType, itemType),
          isNull(profileItemRatings.deletedAt),
        ),
      ),
    [profileId, itemType],
  );
  return useMemo(() => new Map((data ?? []).map((row) => [row.itemId, row.rating])), [data]);
}

/** A single item's rating for one profile; null when unrated. */
export function useItemRating(
  profileId: string | undefined,
  itemType: 'recipe' | 'food',
  itemId: string | undefined,
): 'like' | 'dislike' | null {
  const { data } = useLiveQuery(
    db
      .select()
      .from(profileItemRatings)
      .where(
        and(
          eq(profileItemRatings.profileId, profileId ?? ''),
          eq(profileItemRatings.itemType, itemType),
          eq(profileItemRatings.itemId, itemId ?? ''),
          isNull(profileItemRatings.deletedAt),
        ),
      ),
    [profileId, itemType, itemId],
  );
  return data?.[0]?.rating ?? null;
}
