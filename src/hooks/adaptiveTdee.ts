import { and, eq, gte, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { foods, plannedMealExtras, plannedMealPortions, plannedMeals } from '@/db/schema';
import type { LoggedDailyKcal } from '@/domain/adaptiveTdee';
import { nutritionForMeal, useRecipeNutritionMap } from '@/hooks/plan';

/**
 * One entry per day the profile has at least one eaten portion – a day with
 * nothing logged is simply absent (never a 0 kcal entry), matching
 * `estimateAdaptiveTdee`'s "silent skip" input contract.
 */
export function useLoggedDailyKcal(profileId: string | undefined, sinceDateIso: string): LoggedDailyKcal[] {
  const { data: portionRows } = useLiveQuery(
    db
      .select({ meal: plannedMeals, portion: plannedMealPortions })
      .from(plannedMealPortions)
      .innerJoin(plannedMeals, eq(plannedMealPortions.plannedMealId, plannedMeals.id))
      .where(
        and(
          eq(plannedMealPortions.profileId, profileId ?? ''),
          eq(plannedMealPortions.status, 'eaten'),
          isNull(plannedMealPortions.deletedAt),
          gte(plannedMeals.date, sinceDateIso),
          isNull(plannedMeals.deletedAt),
        ),
      ),
    [profileId, sinceDateIso],
  );

  const { data: extraRows } = useLiveQuery(
    db
      .select({ meal: plannedMeals, extra: plannedMealExtras })
      .from(plannedMealExtras)
      .innerJoin(plannedMeals, eq(plannedMealExtras.plannedMealId, plannedMeals.id))
      .where(and(isNull(plannedMealExtras.deletedAt), gte(plannedMeals.date, sinceDateIso), isNull(plannedMeals.deletedAt))),
    [sinceDateIso],
  );

  const recipeNutritionMap = useRecipeNutritionMap();
  const { data: foodRows } = useLiveQuery(db.select().from(foods).where(isNull(foods.deletedAt)));
  const foodById = useMemo(() => new Map((foodRows ?? []).map((food) => [food.id, food])), [foodRows]);

  return useMemo(() => {
    const totals = new Map<string, number>();
    for (const row of portionRows ?? []) {
      const nutrition = nutritionForMeal(row.meal, recipeNutritionMap, foodById);
      if (!nutrition) continue;
      totals.set(row.meal.date, (totals.get(row.meal.date) ?? 0) + nutrition.kcal * row.portion.multiplier);
    }

    // Extras aren't per-profile – only count one attached to a meal this profile actually ate.
    const eatenMealIds = new Set((portionRows ?? []).map((row) => row.meal.id));
    for (const row of extraRows ?? []) {
      if (!eatenMealIds.has(row.meal.id)) continue;
      const nutrition = nutritionForMeal(row.extra, recipeNutritionMap, foodById);
      if (!nutrition) continue;
      totals.set(row.meal.date, (totals.get(row.meal.date) ?? 0) + nutrition.kcal);
    }

    return [...totals.entries()]
      .map(([date, kcal]) => ({ date, kcal }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [portionRows, extraRows, recipeNutritionMap, foodById]);
}
