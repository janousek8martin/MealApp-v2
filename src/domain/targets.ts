import { estimateLbmKg } from './bodyFat';
import {
  FAT_SHARE_DEFAULT,
  FAT_SHARE_FLOOR,
  FIBER_G_DEFAULT,
  FIBER_G_FEMALE,
  FIBER_G_MALE,
  KCAL_PER_G,
  KCAL_PER_KG_FAT,
  PROTEIN_PER_KG_LBM,
  SURPLUS_KCAL_DEFAULT,
  SURPLUS_PCT_BY_EXPERIENCE,
  WEEKLY_LOSS_PCT_MAX,
  WEEKLY_LOSS_PCT_MIN,
  type ActivityLevel,
  type Sex,
} from './constants';
import { eerChildKcal, mifflinStJeorBmr, tdee } from './energy';

export type TargetsInput = {
  profileType: 'adult' | 'child';
  sex: Sex;
  ageYears: number;
  heightCm: number;
  weightKg: number;
  bodyFatPct?: number;
  activityLevel: ActivityLevel;
  goal: 'lose' | 'maintain' | 'gain';
  goalBodyFatPct?: number;
  /** Drives the muscle-gain surplus %, when `surplusKcal` isn't explicitly overridden. */
  fitnessExperience?: 'beginner' | 'intermediate' | 'advanced';
  /** User's manual ±kcal correction on top of the computed TDCI. */
  manualAdjustmentKcal?: number;
  /** Daily deficit in kcal; defaults to the 0.5 % BW/week equivalent, clamped to the safe band. */
  dailyDeficitKcal?: number;
  /** Surplus for muscle gain; defaults to SURPLUS_KCAL_DEFAULT. */
  surplusKcal?: number;
  /** Protein override in g/kg LBM; defaults to the ISSN midpoint for the phase. */
  proteinPerKgLbm?: number;
  /** Desired fat share of TDCI (0..1); clamped to the 20 % floor. */
  fatShareOfTdci?: number;
  fiberMode?: 'efsa_min' | 'gender_specific';
};

export type TargetsResult = {
  bmr: number;
  tdee: number;
  /** Computed target before the manual adjustment. */
  baseTdciKcal: number;
  /** What the user actually eats to: base + manual adjustment. */
  adjustedTdciKcal: number;
  mode: 'maintenance' | 'deficit' | 'surplus' | 'recomposition';
  /** True for children – their goal is always maintenance. */
  goalLocked: boolean;
  macros: { proteinG: number; fatG: number; carbsG: number };
  fiberG: number;
};

/** Daily deficit equivalent to losing `pctPerWeek` of body weight per week. */
function deficitForWeeklyPct(weightKg: number, pctPerWeek: number): number {
  return (weightKg * pctPerWeek * KCAL_PER_KG_FAT) / 7;
}

/** Conservative starting deficit: 0.5 % of body weight per week. */
export function defaultDailyDeficitKcal(weightKg: number): number {
  return deficitForWeeklyPct(weightKg, WEEKLY_LOSS_PCT_MIN);
}

/** Clamp a requested deficit into the safe 0.5–1 % BW/week band. */
export function clampDailyDeficitKcal(weightKg: number, requestedKcal: number): number {
  const min = deficitForWeeklyPct(weightKg, WEEKLY_LOSS_PCT_MIN);
  const max = deficitForWeeklyPct(weightKg, WEEKLY_LOSS_PCT_MAX);
  return Math.min(Math.max(requestedKcal, min), max);
}

/**
 * The single source of truth for calorie & macro targets. Pure function of
 * its inputs – never persisted, so it can never go stale (the old app's
 * recurring TDCI bug).
 */
export function computeTargets(input: TargetsInput): TargetsResult {
  const manualAdjustment = input.manualAdjustmentKcal ?? 0;

  // --- children: EER, goal locked to maintenance -------------------------
  if (input.profileType === 'child') {
    const eer = eerChildKcal(input);
    const adjusted = eer + manualAdjustment;
    return {
      bmr: eer,
      tdee: eer,
      baseTdciKcal: eer,
      adjustedTdciKcal: adjusted,
      mode: 'maintenance',
      goalLocked: true,
      macros: allocateMacros(input, adjusted, 'maintenance'),
      fiberG: fiberTarget(input),
    };
  }

  // --- adults: Mifflin-St Jeor → TDEE → goal-specific TDCI ----------------
  const bmr = mifflinStJeorBmr(input);
  const tdeeKcal = tdee(bmr, input.activityLevel);

  let mode: TargetsResult['mode'] = 'maintenance';
  let baseTdci = tdeeKcal;

  if (input.goal === 'lose') {
    mode = 'deficit';
    const deficit = clampDailyDeficitKcal(
      input.weightKg,
      input.dailyDeficitKcal ?? defaultDailyDeficitKcal(input.weightKg),
    );
    baseTdci = tdeeKcal - deficit;
  } else if (input.goal === 'gain') {
    const isRecomposition =
      input.goalBodyFatPct !== undefined &&
      input.bodyFatPct !== undefined &&
      input.goalBodyFatPct < input.bodyFatPct;
    if (isRecomposition) {
      // Build muscle while dropping fat → maintenance calories, not a surplus.
      mode = 'recomposition';
      baseTdci = tdeeKcal;
    } else {
      mode = 'surplus';
      const surplusKcal =
        input.surplusKcal ??
        (input.fitnessExperience
          ? tdeeKcal * SURPLUS_PCT_BY_EXPERIENCE[input.fitnessExperience]
          : SURPLUS_KCAL_DEFAULT);
      baseTdci = tdeeKcal + surplusKcal;
    }
  }

  const adjustedTdci = baseTdci + manualAdjustment;

  return {
    bmr,
    tdee: tdeeKcal,
    baseTdciKcal: baseTdci,
    adjustedTdciKcal: adjustedTdci,
    mode,
    goalLocked: false,
    macros: allocateMacros(input, adjustedTdci, mode),
    fiberG: fiberTarget(input),
  };
}

/**
 * Protein is fixed from LBM and never reduced by the deficit; the deficit
 * only shrinks carbs/fat. Fat is clamped to ≥ 20 % of calories.
 */
function allocateMacros(
  input: TargetsInput,
  tdciKcal: number,
  mode: TargetsResult['mode'],
): TargetsResult['macros'] {
  const lbm = estimateLbmKg(input.weightKg, input.bodyFatPct);
  const proteinPerKg =
    input.proteinPerKgLbm ??
    (mode === 'deficit' ? PROTEIN_PER_KG_LBM.deficitDefault : PROTEIN_PER_KG_LBM.normalDefault);
  const proteinG = proteinPerKg * lbm;
  const proteinKcal = proteinG * KCAL_PER_G.protein;

  const fatShare = Math.max(input.fatShareOfTdci ?? FAT_SHARE_DEFAULT, FAT_SHARE_FLOOR);
  let fatKcal = fatShare * tdciKcal;

  // Keep the energy balance solvable: carbs must not go negative.
  const maxFatKcal = Math.max(tdciKcal - proteinKcal, 0);
  fatKcal = Math.min(fatKcal, maxFatKcal);

  const carbsKcal = Math.max(tdciKcal - proteinKcal - fatKcal, 0);

  return {
    proteinG,
    fatG: fatKcal / KCAL_PER_G.fat,
    carbsG: carbsKcal / KCAL_PER_G.carbs,
  };
}

function fiberTarget(input: TargetsInput): number {
  if (input.fiberMode === 'gender_specific') {
    return input.sex === 'male' ? FIBER_G_MALE : FIBER_G_FEMALE;
  }
  return FIBER_G_DEFAULT;
}
