/**
 * Pure "days planned this week" counter for the Home screen's gentle
 * WeeklyRecapCard (Task 12). No React/DB imports - takes the household's
 * planned-meal rows for the week plus the week's 7 calendar dates, returns
 * how many of those dates have at least one (non-deleted) planned meal.
 *
 * "Planned" here deliberately means "has an entry in the plan", not "was
 * eaten" - this mirrors what `useMealsForWeek` already returns (soft-deleted
 * rows are filtered out at the query level, see `src/hooks/plan.ts`), so no
 * separate eaten/skipped distinction is needed for this soft recap metric.
 */

export interface PlannedMealDateRow {
  date: string;
}

/** Counts how many of `weekDates` have >=1 row in `meals`. */
export function countPlannedDays(meals: PlannedMealDateRow[], weekDates: string[]): number {
  const plannedDates = new Set(meals.map((meal) => meal.date));
  return weekDates.filter((date) => plannedDates.has(date)).length;
}
