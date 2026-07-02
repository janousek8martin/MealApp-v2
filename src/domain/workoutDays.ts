import { FAT_SHARE_FLOOR, KCAL_PER_G, WORKOUT_DAY_KCAL_BONUS_PCT } from './constants';
import { isoWeekday } from './week';

export type DayMacros = { kcal: number; proteinG: number; carbsG: number; fatG: number };

/** `workoutDays` is a list of ISO weekdays (1 = Monday .. 7 = Sunday). */
export function isTrainingDay(workoutDays: number[], dateIso: string): boolean {
  return workoutDays.includes(isoWeekday(dateIso));
}

/**
 * Workout-day carb cycling (approved design): training days get a +12 % kcal
 * bonus added entirely to carbs; rest days are reduced so the weekly average
 * still equals the base target. Protein never changes; fat is only trimmed
 * down to its 20 % floor, carbs absorb the rest of the reduction.
 */
export function applyWorkoutDayCycling(
  base: { kcal: number; proteinG: number; carbsG: number; fatG: number },
  workoutDays: number[],
  dateIso: string,
): DayMacros {
  const trainingCount = workoutDays.length;
  const restCount = 7 - trainingCount;

  // No cycling possible without at least one training day and one rest day.
  if (trainingCount === 0 || restCount === 0) {
    return { kcal: base.kcal, proteinG: base.proteinG, carbsG: base.carbsG, fatG: base.fatG };
  }

  const trainingKcal = base.kcal * (1 + WORKOUT_DAY_KCAL_BONUS_PCT);
  const restKcal = (base.kcal * 7 - trainingKcal * trainingCount) / restCount;

  if (isTrainingDay(workoutDays, dateIso)) {
    const bonusKcal = trainingKcal - base.kcal;
    return {
      kcal: trainingKcal,
      proteinG: base.proteinG,
      carbsG: base.carbsG + bonusKcal / KCAL_PER_G.carbs,
      fatG: base.fatG,
    };
  }

  // Rest day: pull the deficit from carbs first, then fat down to the floor.
  const deficitKcal = base.kcal - restKcal;
  const carbsKcalAvailable = base.carbsG * KCAL_PER_G.carbs;
  const takenFromCarbsKcal = Math.min(deficitKcal, carbsKcalAvailable);
  const carbsG = base.carbsG - takenFromCarbsKcal / KCAL_PER_G.carbs;

  const remainingDeficitKcal = deficitKcal - takenFromCarbsKcal;
  const fatKcalAvailable = base.fatG * KCAL_PER_G.fat;
  const minFatKcal = FAT_SHARE_FLOOR * restKcal;
  const takenFromFatKcal = Math.min(remainingDeficitKcal, Math.max(fatKcalAvailable - minFatKcal, 0));
  const fatG = base.fatG - takenFromFatKcal / KCAL_PER_G.fat;

  return { kcal: restKcal, proteinG: base.proteinG, carbsG, fatG };
}
