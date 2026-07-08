import type { Sex } from './constants';

export type NavyInput = {
  sex: Sex;
  heightCm: number;
  waistCm: number;
  neckCm: number;
  /** Required for women. */
  hipCm?: number;
};

const MIN_BODY_FAT_PCT = 3;
const MAX_BODY_FAT_PCT = 70;

/** Clamps to a plausible body-fat percentage – guards macro allocation against a bad measurement or manual entry. */
export function clampBodyFatPct(pct: number): number {
  return Math.min(MAX_BODY_FAT_PCT, Math.max(MIN_BODY_FAT_PCT, pct));
}

/**
 * U.S. Navy tape method (~±3–4 % error) – the app's default body-fat
 * estimator; users may override with DEXA/caliper values.
 *
 * The formula takes log10 of (waist - neck) [male] or (waist + hip - neck)
 * [female]; a non-positive value there is undefined (log of zero/negative)
 * and would otherwise surface as a silent NaN propagating into TDCI/macros.
 * Measurement mix-ups (e.g. neck and waist swapped) are the realistic cause,
 * so this throws a clear, specific error instead.
 */
export function navyBodyFatPct({ sex, heightCm, waistCm, neckCm, hipCm }: NavyInput): number {
  if (sex === 'male') {
    if (waistCm <= neckCm) {
      throw new Error('Waist circumference must be greater than neck circumference');
    }
    const density =
      1.0324 - 0.19077 * Math.log10(waistCm - neckCm) + 0.15456 * Math.log10(heightCm);
    return clampBodyFatPct(495 / density - 450);
  }

  if (hipCm === undefined) {
    throw new Error('Hip circumference is required for the female Navy formula');
  }
  if (waistCm + hipCm <= neckCm) {
    throw new Error('Waist + hip circumference must be greater than neck circumference');
  }
  const density =
    1.29579 - 0.35004 * Math.log10(waistCm + hipCm - neckCm) + 0.221 * Math.log10(heightCm);
  return clampBodyFatPct(495 / density - 450);
}

/**
 * Lean body mass; protein targets are computed from LBM, not total weight.
 * Falls back to total weight when body fat is unknown (per the brief).
 */
export function estimateLbmKg(weightKg: number, bodyFatPct: number | undefined): number {
  if (bodyFatPct === undefined) {
    return weightKg;
  }
  return weightKg * (1 - clampBodyFatPct(bodyFatPct) / 100);
}
