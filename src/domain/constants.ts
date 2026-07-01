/**
 * Nutrition-science constants mandated by the project brief (CLAUDE.md).
 * These are fixed, evidence-based values – do not re-estimate them.
 */

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Sex = 'male' | 'female';

/** TDEE = BMR × coefficient; level answered subjectively during onboarding. */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/** ISSN ranges, g per kg of lean body mass per day. Defaults are the midpoints. */
export const PROTEIN_PER_KG_LBM = {
  normalRange: [1.4, 2.0] as const,
  deficitRange: [2.3, 3.1] as const,
  normalDefault: 1.8,
  deficitDefault: 2.4,
};

/** Fat must never drop below 20 % of total calories. */
export const FAT_SHARE_FLOOR = 0.2;
/** Default fat share of TDCI before the user tunes macros. */
export const FAT_SHARE_DEFAULT = 0.3;

export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

/** Safe weight-loss band: 0.5–1 % of body weight per week. */
export const WEEKLY_LOSS_PCT_MIN = 0.005;
export const WEEKLY_LOSS_PCT_MAX = 0.01;
/** Approximate energy content of 1 kg of body fat. */
export const KCAL_PER_KG_FAT = 7700;
/** The deficit is adjusted in steps of 100–250 kcal. */
export const DEFICIT_STEP_KCAL_MIN = 100;
export const DEFICIT_STEP_KCAL_MAX = 250;

/** Default surplus for muscle gain (not specified by the brief; user-editable). */
export const SURPLUS_KCAL_DEFAULT = 250;

/** EFSA minimum and the optional gender-specific defaults (g/day). */
export const FIBER_G_DEFAULT = 25;
export const FIBER_G_MALE = 32;
export const FIBER_G_FEMALE = 28;

/** Recommend switching to maintenance after this body-fat drop (percentage points). */
export const DIET_CYCLE_BF_DROP_MALE = 5;
export const DIET_CYCLE_BF_DROP_FEMALE = 7;
