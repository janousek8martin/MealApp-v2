import type { Sex } from './constants';

/**
 * Recommended daily intakes for the micros the app tracks as "commonly
 * deficient" (see the project brief) — EFSA/NIH reference values, not a
 * medical prescription. Soft/informational targets only, per the brief:
 * these never block generation or report an "error" for missing data.
 */
export type MicronutrientRda = {
  ironMg: number;
  vitaminDUg: number;
  b12Ug: number;
  calciumMg: number;
  omega3G: number;
};

/** EFSA/NIH adult reference intakes, split where sex/age materially changes the recommendation. */
export function micronutrientRda(sex: Sex, ageYears: number): MicronutrientRda {
  const ironMg = sex === 'female' ? (ageYears >= 51 ? 8 : 18) : 8;
  const vitaminDUg = ageYears >= 71 ? 20 : 15;
  const calciumMg = (sex === 'female' && ageYears >= 51) || (sex === 'male' && ageYears >= 71) ? 1200 : 1000;
  const omega3G = sex === 'male' ? 1.6 : 1.1;
  return {
    ironMg,
    vitaminDUg,
    b12Ug: 2.4,
    calciumMg,
    omega3G,
  };
}
