import type { Sex } from './constants';

export type NavyInput = {
  sex: Sex;
  heightCm: number;
  waistCm: number;
  neckCm: number;
  /** Required for women. */
  hipCm?: number;
};

/**
 * U.S. Navy tape method (~±3–4 % error) – the app's default body-fat
 * estimator; users may override with DEXA/caliper values.
 */
export function navyBodyFatPct({ sex, heightCm, waistCm, neckCm, hipCm }: NavyInput): number {
  if (sex === 'male') {
    const density =
      1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm);
    return 495 / density - 450;
  }

  if (hipCm === undefined) {
    throw new Error('Hip circumference is required for the female Navy formula');
  }
  const density =
    1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm);
  return 495 / density - 450;
}

/**
 * Lean body mass; protein targets are computed from LBM, not total weight.
 * Falls back to total weight when body fat is unknown (per the brief).
 */
export function estimateLbmKg(weightKg: number, bodyFatPct: number | undefined): number {
  if (bodyFatPct === undefined) {
    return weightKg;
  }
  return weightKg * (1 - bodyFatPct / 100);
}
