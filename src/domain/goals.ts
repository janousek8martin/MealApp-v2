import { DIET_CYCLE_BF_DROP_FEMALE, DIET_CYCLE_BF_DROP_MALE, type Sex } from './constants';

export type GoalValidationInput = {
  currentWeightKg: number;
  currentBodyFatPct?: number;
  goalWeightKg?: number;
  goalBodyFatPct?: number;
};

export type GoalValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * Brief rule: if the target body-fat percentage is lower than the current
 * one, the goal weight cannot be higher than the current weight.
 */
export function validateGoals(input: GoalValidationInput): GoalValidationResult {
  const errors: string[] = [];

  const targetsLowerBodyFat =
    input.goalBodyFatPct !== undefined &&
    input.currentBodyFatPct !== undefined &&
    input.goalBodyFatPct < input.currentBodyFatPct;

  if (
    targetsLowerBodyFat &&
    input.goalWeightKg !== undefined &&
    input.goalWeightKg > input.currentWeightKg
  ) {
    errors.push('goal_weight_must_not_exceed_current');
  }

  return { valid: errors.length === 0, errors };
}

export type DietCycleInput = {
  sex: Sex;
  /** Body fat at the start of the current deficit phase. */
  startBodyFatPct: number;
  currentBodyFatPct: number;
};

/**
 * Diet cycling: after ~5 body-fat percentage points lost (men) / 7 (women),
 * recommend switching to maintenance for a while. Advisory banner only –
 * the app never silently changes the target.
 */
export function shouldRecommendMaintenance({ sex, startBodyFatPct, currentBodyFatPct }: DietCycleInput): boolean {
  const drop = startBodyFatPct - currentBodyFatPct;
  const threshold = sex === 'male' ? DIET_CYCLE_BF_DROP_MALE : DIET_CYCLE_BF_DROP_FEMALE;
  return drop >= threshold;
}
