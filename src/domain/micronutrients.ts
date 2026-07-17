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

// ---------------------------------------------------------------------------
// Extended nutrient registry (advanced food/recipe editor, item 14)
// ---------------------------------------------------------------------------

export type MicronutrientGroup = 'vitamins' | 'minerals' | 'lipids';

export type MicronutrientKey =
  | 'vitaminAUg'
  | 'vitaminCMg'
  | 'vitaminDUg'
  | 'vitaminEMg'
  | 'vitaminKUg'
  | 'b1Mg'
  | 'b2Mg'
  | 'b3Mg'
  | 'b6Mg'
  | 'b12Ug'
  | 'folateUg'
  | 'calciumMg'
  | 'ironMg'
  | 'magnesiumMg'
  | 'potassiumMg'
  | 'sodiumMg'
  | 'zincMg'
  | 'seleniumUg'
  | 'iodineUg'
  | 'omega3G';

/**
 * General-adult PLACEHOLDER reference values (not sex/age-personalized —
 * that's what `micronutrientRda` does for the 5-key soft-target set above).
 * This registry exists so the advanced food/recipe editor can show a
 * "target" figure per nutrient without inventing numbers per-screen; the
 * exact personalized calculation is a later phase (see project plan).
 * `driMax` is the tolerable upper intake level where one is defined.
 */
export const MICRONUTRIENTS: Record<MicronutrientKey, { group: MicronutrientGroup; unit: string; dri: number; driMax?: number }> = {
  vitaminAUg: { group: 'vitamins', unit: 'µg', dri: 900, driMax: 3000 },
  vitaminCMg: { group: 'vitamins', unit: 'mg', dri: 90, driMax: 2000 },
  vitaminDUg: { group: 'vitamins', unit: 'µg', dri: 15, driMax: 100 },
  vitaminEMg: { group: 'vitamins', unit: 'mg', dri: 15, driMax: 1000 },
  vitaminKUg: { group: 'vitamins', unit: 'µg', dri: 120 },
  b1Mg: { group: 'vitamins', unit: 'mg', dri: 1.2 },
  b2Mg: { group: 'vitamins', unit: 'mg', dri: 1.3 },
  b3Mg: { group: 'vitamins', unit: 'mg', dri: 16, driMax: 35 },
  b6Mg: { group: 'vitamins', unit: 'mg', dri: 1.3, driMax: 100 },
  b12Ug: { group: 'vitamins', unit: 'µg', dri: 2.4 },
  folateUg: { group: 'vitamins', unit: 'µg', dri: 400, driMax: 1000 },
  calciumMg: { group: 'minerals', unit: 'mg', dri: 1000, driMax: 2500 },
  ironMg: { group: 'minerals', unit: 'mg', dri: 8, driMax: 45 },
  magnesiumMg: { group: 'minerals', unit: 'mg', dri: 400 },
  potassiumMg: { group: 'minerals', unit: 'mg', dri: 3400 },
  sodiumMg: { group: 'minerals', unit: 'mg', dri: 1500, driMax: 2300 },
  zincMg: { group: 'minerals', unit: 'mg', dri: 11, driMax: 40 },
  seleniumUg: { group: 'minerals', unit: 'µg', dri: 55, driMax: 400 },
  iodineUg: { group: 'minerals', unit: 'µg', dri: 150, driMax: 1100 },
  omega3G: { group: 'lipids', unit: 'g', dri: 1.6 },
};

export const MICRONUTRIENT_KEYS = Object.keys(MICRONUTRIENTS) as MicronutrientKey[];
