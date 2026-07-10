import { WATER_GOAL_MAX_ML, WATER_GOAL_MIN_ML, WATER_ML_PER_KG, type Sex } from './constants';

/**
 * Default daily drinking-water goal in ml, for profiles that haven't set an
 * explicit `waterGoalMl` override. Placeholder ml/kg formula - see
 * TODO(research-d) on WATER_ML_PER_KG. `sex` is accepted now (stable public
 * signature) but not yet used - EFSA's sex-specific adequate intakes may
 * replace the flat ml/kg formula once rešerše (d) comes back.
 */
export function defaultWaterGoalMl(weightKg: number, _sex: Sex): number {
  const raw = weightKg * WATER_ML_PER_KG;
  return Math.min(Math.max(raw, WATER_GOAL_MIN_ML), WATER_GOAL_MAX_ML);
}
