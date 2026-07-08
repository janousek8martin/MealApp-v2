import { ACTIVITY_MULTIPLIERS, type ActivityLevel, type Sex } from './constants';

export type BmrInput = {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  ageYears: number;
};

/** Mifflin-St Jeor – the best clinically validated BMR equation (adults). */
export function mifflinStJeorBmr({ sex, weightKg, heightCm, ageYears }: BmrInput): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * ageYears;
  return sex === 'male' ? base + 5 : base - 161;
}

export function activityMultiplier(level: ActivityLevel): number {
  return ACTIVITY_MULTIPLIERS[level];
}

/**
 * `overrideMultiplier` is the profile's chosen point on the level's 3-dot
 * Low/Medium/High scale (see ACTIVITY_MULTIPLIER_DOTS); null/undefined falls
 * back to the level's own midpoint, i.e. the pre-existing behavior.
 */
export function tdee(bmrKcal: number, level: ActivityLevel, overrideMultiplier?: number | null): number {
  return bmrKcal * (overrideMultiplier ?? activityMultiplier(level));
}

export type EerChildInput = {
  sex: Sex;
  ageYears: number;
  weightKg: number;
  heightCm: number;
  activityLevel: ActivityLevel;
};

/**
 * IOM physical-activity coefficients for the EER equations. Our five-level
 * onboarding scale maps onto the IOM four levels: sedentary → sedentary,
 * light → low active, moderate → active, active/very_active → very active.
 */
const EER_PA: Record<Sex, Record<ActivityLevel, number>> = {
  male: { sedentary: 1.0, light: 1.13, moderate: 1.26, active: 1.42, very_active: 1.42 },
  female: { sedentary: 1.0, light: 1.16, moderate: 1.31, active: 1.56, very_active: 1.56 },
};

const EER_CHILD_MIN_AGE = 3;
const EER_CHILD_MAX_AGE = 18;

/**
 * Estimated Energy Requirement for children (IOM 2005), ages 3–18.
 * Children never get a deficit – the result is used directly as their target.
 * The equation is only validated within 3–18 y; ageYears is clamped to that
 * band before use so a profile briefly out of range (e.g. right at a
 * birthday, or a data-entry slip) doesn't extrapolate into a nonsense
 * result (the `-61.9 * age` / `-30.8 * age` terms turn negative outside it).
 */
export function eerChildKcal({ sex, ageYears, weightKg, heightCm, activityLevel }: EerChildInput): number {
  const clampedAge = Math.min(EER_CHILD_MAX_AGE, Math.max(EER_CHILD_MIN_AGE, ageYears));
  const heightM = heightCm / 100;
  const pa = EER_PA[sex][activityLevel];
  // Energy deposition for growth: 20 kcal (3–8 y), 25 kcal (9–18 y).
  const growthKcal = clampedAge < 9 ? 20 : 25;

  if (sex === 'male') {
    return 88.5 - 61.9 * clampedAge + pa * (26.7 * weightKg + 903 * heightM) + growthKcal;
  }
  return 135.3 - 30.8 * clampedAge + pa * (10 * weightKg + 934 * heightM) + growthKcal;
}
