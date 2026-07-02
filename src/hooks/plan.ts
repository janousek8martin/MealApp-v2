import { and, asc, eq, inArray, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import {
  foods,
  mealSlotSettings,
  plannedMealPortions,
  plannedMeals,
  recipeIngredients,
  recipes,
} from '@/db/schema';
import { computeRecipeNutrition, type RecipeNutrition } from '@/domain/recipeNutrition';
import { weekDates } from '@/domain/week';

export type SlotRow = typeof mealSlotSettings.$inferSelect;
export type MealRow = typeof plannedMeals.$inferSelect;
export type PortionRow = typeof plannedMealPortions.$inferSelect;

export function useMealSlots(householdId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(mealSlotSettings)
      .where(
        and(
          eq(mealSlotSettings.householdId, householdId ?? ''),
          eq(mealSlotSettings.enabled, true),
          isNull(mealSlotSettings.deletedAt),
        ),
      )
      .orderBy(asc(mealSlotSettings.sortOrder)),
    [householdId],
  );
  return data ?? [];
}

export function useMealsForDate(householdId: string | undefined, date: string) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(plannedMeals)
      .where(
        and(
          eq(plannedMeals.householdId, householdId ?? ''),
          eq(plannedMeals.date, date),
          isNull(plannedMeals.deletedAt),
        ),
      ),
    [householdId, date],
  );
  return data ?? [];
}

export function useMealsForWeek(householdId: string | undefined, mondayIso: string) {
  const dates = weekDates(mondayIso);
  const { data } = useLiveQuery(
    db
      .select()
      .from(plannedMeals)
      .where(
        and(
          eq(plannedMeals.householdId, householdId ?? ''),
          inArray(plannedMeals.date, dates),
          isNull(plannedMeals.deletedAt),
        ),
      ),
    [householdId, mondayIso],
  );
  return data ?? [];
}

export function usePortionsForMeal(mealId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(plannedMealPortions)
      .where(and(eq(plannedMealPortions.plannedMealId, mealId ?? ''), isNull(plannedMealPortions.deletedAt))),
    [mealId],
  );
  return data ?? [];
}

/** The meal that belongs to a given track: the shared row (profileId null) or one profile's own row. */
export function findMealForTrack(meals: MealRow[], slotKey: string, profileId: string | null): MealRow | undefined {
  return meals.find((m) => m.slotKey === slotKey && m.profileId === profileId);
}

/** Which meal (if any) is "mine" for this slot: snacks are always individual; main slots follow sharesMainMeals. */
export function findMealForProfileInSlot(
  meals: MealRow[],
  slot: SlotRow,
  profile: { id: string; sharesMainMeals: boolean },
): MealRow | undefined {
  if (slot.kind === 'snack') return findMealForTrack(meals, slot.slotKey, profile.id);
  return findMealForTrack(meals, slot.slotKey, profile.sharesMainMeals ? null : profile.id);
}

/** meal+portion pairs for every planned meal on a date – the basis for the daily fit indicator. */
export function usePortionsForDate(householdId: string | undefined, date: string) {
  const { data } = useLiveQuery(
    db
      .select({ meal: plannedMeals, portion: plannedMealPortions })
      .from(plannedMealPortions)
      .innerJoin(plannedMeals, eq(plannedMealPortions.plannedMealId, plannedMeals.id))
      .where(
        and(
          eq(plannedMeals.householdId, householdId ?? ''),
          eq(plannedMeals.date, date),
          isNull(plannedMeals.deletedAt),
          isNull(plannedMealPortions.deletedAt),
        ),
      ),
    [householdId, date],
  );
  return data ?? [];
}

/**
 * Every recipe's per-portion nutrition, keyed by recipe id – derived live
 * from its ingredients. Compute this once per screen and pass it down,
 * rather than re-querying per meal card.
 */
export function useRecipeNutritionMap(): Map<string, RecipeNutrition> {
  const { data: recipeRows } = useLiveQuery(db.select().from(recipes).where(isNull(recipes.deletedAt)));
  const { data: ingredientRows } = useLiveQuery(
    db.select().from(recipeIngredients).where(isNull(recipeIngredients.deletedAt)),
  );
  const { data: foodRows } = useLiveQuery(db.select().from(foods).where(isNull(foods.deletedAt)));

  const map = new Map<string, RecipeNutrition>();
  if (!recipeRows || !ingredientRows || !foodRows) return map;

  const foodById = new Map(foodRows.map((food) => [food.id, food]));
  const ingredientsByRecipe = new Map<string, typeof ingredientRows>();
  for (const ingredient of ingredientRows) {
    const list = ingredientsByRecipe.get(ingredient.recipeId) ?? [];
    list.push(ingredient);
    ingredientsByRecipe.set(ingredient.recipeId, list);
  }

  for (const recipe of recipeRows) {
    const ingredients = ingredientsByRecipe.get(recipe.id) ?? [];
    const nutrition = computeRecipeNutrition(
      ingredients.flatMap((ingredient) => {
        const food = foodById.get(ingredient.foodId);
        return food ? [{ amount: ingredient.amount, food }] : [];
      }),
      recipe.servingsBase,
    );
    map.set(recipe.id, nutrition);
  }
  return map;
}

export type FoodRow = typeof foods.$inferSelect;

/** Looks up a meal's per-portion nutrition: recipes via the precomputed map, standalone foods via their per-100 values. */
export function nutritionForMeal(
  meal: Pick<MealRow, 'itemType' | 'itemId'>,
  recipeNutritionMap: Map<string, RecipeNutrition>,
  foodById: Map<string, FoodRow>,
): RecipeNutrition | undefined {
  if (meal.itemType === 'recipe') return recipeNutritionMap.get(meal.itemId);
  const food = foodById.get(meal.itemId);
  if (!food) return undefined;
  return {
    kcal: food.kcalPer100,
    proteinG: food.proteinPer100,
    carbsG: food.carbsPer100,
    fatG: food.fatPer100,
    fiberG: food.fiberPer100,
  };
}
