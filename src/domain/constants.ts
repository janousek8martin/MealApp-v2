/**
 * Nutrition-science constants mandated by the project brief (CLAUDE.md).
 * These are fixed, evidence-based values – do not re-estimate them.
 */

export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Sex = 'male' | 'female';

/**
 * TDEE = BMR × coefficient. Unlike the classic combined 1.2-1.9 scale (which
 * blends everyday movement with structured exercise into one number), these
 * are NEAT-only: they describe daily movement outside of training, while
 * training itself is added separately via WORKOUT_DAY_KCAL_BONUS_PCT on
 * workout days. Sourced from FAO/WHO/UNU PAL bands, refined with
 * doubly-labelled-water anchor points (rešerše-a, 2026); see LifestylePicker
 * for the matching "how is your lifestyle" (not "how hard do you train")
 * framing.
 */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.45,
  light: 1.55,
  moderate: 1.7,
  active: 1.82,
  very_active: 2.05,
};

/**
 * Fine-grained Low/Medium/High sub-multipliers within each activity level
 * (±0.05 around that level's ACTIVITY_MULTIPLIERS midpoint), so a profile can
 * pick a specific point on the scale instead of just the level. The middle
 * value of each tuple always equals ACTIVITY_MULTIPLIERS[level].
 */
export const ACTIVITY_MULTIPLIER_DOTS: Record<ActivityLevel, readonly [number, number, number]> = {
  sedentary: [1.4, 1.45, 1.5],
  light: [1.5, 1.55, 1.6],
  moderate: [1.65, 1.7, 1.75],
  active: [1.77, 1.82, 1.87],
  very_active: [2.0, 2.05, 2.1],
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

/** Default surplus for muscle gain (not specified by the brief; user-editable). */
export const SURPLUS_KCAL_DEFAULT = 250;

/**
 * Muscle-gain surplus as a % of TDEE, tied to fitness experience. Beginner
 * nudged from 10% to 13% (rešerše-b, 2026): at typical TDEEs, 10% only
 * reached the low end of the literature's 300-500 kcal/day beginner range;
 * beginners have the most room to convert surplus into muscle rather than
 * fat, so under-feeding them was the most conservative part of the old
 * scheme. Intermediate/advanced were already well-calibrated.
 */
export const SURPLUS_PCT_BY_EXPERIENCE: Record<'beginner' | 'intermediate' | 'advanced', number> = {
  beginner: 0.13,
  intermediate: 0.07,
  advanced: 0.05,
};

/**
 * Surpluses beyond this don't increase muscle gain, only fat gain (Iraki et
 * al., rešerše-b, 2026) - a hard ceiling applied regardless of source
 * (experience-based default, explicit override, or rate/speed-derived).
 */
export const MAX_SURPLUS_KCAL = 500;

/** Training-day kcal bonus for workout-day carb cycling; added entirely to carbs. */
export const WORKOUT_DAY_KCAL_BONUS_PCT = 0.12;

/** EFSA minimum and the optional gender-specific defaults (g/day). */
export const FIBER_G_DEFAULT = 25;
export const FIBER_G_MALE = 32;
export const FIBER_G_FEMALE = 28;

/** Recommend switching to maintenance after this body-fat drop (percentage points). */
export const DIET_CYCLE_BF_DROP_MALE = 5;
export const DIET_CYCLE_BF_DROP_FEMALE = 7;

/**
 * Speed presets for weight loss, as a fraction of body weight per week
 * (converted to kg/week using the profile's own weight, e.g. by the Tempo
 * setup card) - fine-tunable afterwards in 0.1 kg steps. Deliberately sits
 * inside the existing WEEKLY_LOSS_PCT_MIN-MAX safe band (rešerše-b, 2026):
 * "slow" at the floor, "fast" biased toward the top rather than the middle,
 * since Garthe et al. (2011) found the controlled data point above 1%/week
 * (1.4%/week) cost lean mass. clampDailyDeficitKcal still enforces the band
 * regardless of which preset (or custom rate) is chosen.
 */
export const SPEED_PRESETS_LOSE_PCT_BW: Record<'slow' | 'recommended' | 'fast', number> = {
  slow: 0.005,
  recommended: 0.007,
  fast: 0.0095,
};

/**
 * Speed presets for muscle gain, as a flat daily kcal surplus - independent
 * of fitness experience (SURPLUS_PCT_BY_EXPERIENCE already covers that axis;
 * this is a separate, user-facing override). Values span the population
 * range from Iraki et al. (beginner 300-500, intermediate 200-300, advanced
 * 100-200 kcal/day), rešerše-b 2026, clamped overall by MAX_SURPLUS_KCAL.
 */
export const SPEED_PRESETS_GAIN: Record<'slow' | 'recommended' | 'fast', number> = {
  slow: 200,
  recommended: 300,
  fast: 450,
};

/**
 * Planned deficit/maintenance cycle length for the weight projection graph
 * (weeks), applied only to weight-loss phases - muscle gain has no evidence
 * base for scheduled breaks (rešerše-c, 2026: overfeeding's NEAT response is
 * self-correcting, the opposite problem from a deficit's adaptive
 * thermogenesis) and projects as a straight line instead. 3 weeks deficit /
 * 1 week maintenance sits inside both MATADOR's (2-on/2-off) and ICECAP's
 * (3-on/1-off) studied schedules.
 */
export const MAINTENANCE_PHASE = {
  deficitWeeks: 3,
  maintenanceWeeks: 1,
};

/**
 * Estimated fraction of weight lost during a deficit that is fat mass (vs.
 * lean mass), used only to project the DIET_CYCLE_BF_DROP_* trigger onto the
 * weight-projection graph when a starting body-fat% is known. This app's
 * deficit-phase protein tier (2.3-3.1 g/kg LBM) is specifically chosen to
 * maximize fat-mass loss and minimize lean loss (Helms et al., 2014), so a
 * high fraction is a reasonable population-level approximation - not a
 * precise per-user figure (individual composition-of-loss varies with
 * training status, protein intake, and deficit size).
 */
export const FAT_MASS_LOSS_FRACTION = 0.85;

/**
 * Expected shortfall of real-world weight loss vs. a naive linear projection
 * (adaptive thermogenesis) - applied only to deficit weeks, not maintenance
 * or gain weeks. Rešerše-c (2026) is explicit this is a practical
 * convention (commercial-tool common practice), not a value traceable to a
 * controlled trial isolating pure metabolic adaptation - a simplified stand-
 * in for Hall et al.'s full dynamic energy-balance model.
 */
export const ADAPTIVE_THERMOGENESIS_FACTOR = 0.8;

/**
 * Default daily drinking-water goal, ml per kg body weight, clamped to a
 * sane absolute range. Calibrated (rešerše-d, 2026) to reproduce EFSA's
 * drinking-water-only reference figures (~2.0 L men / 1.6 L women at
 * reference body weights) across the normal adult weight range, rather than
 * a flat sex-based number. Max clamp matches EFSA's own reported P95 total-
 * water intake for men.
 */
export const WATER_ML_PER_KG = 32.5;
export const WATER_GOAL_MIN_ML = 1500;
export const WATER_GOAL_MAX_ML = 4000;
/** Added on top of the daily goal per logged training session (ACSM sweat-replacement range midpoint), rešerše-d 2026. */
export const WATER_TRAINING_DAY_BONUS_ML = 500;
