import type { MicronutrientKey } from './micronutrients';

export type UsdaFoodRecord = {
  fdcId: string;
  descriptionEn: string;
  category: string;
  kcalPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  fiberPer100: number | null;
  micronutrients: Partial<Record<MicronutrientKey, number>>;
  sourceDataset: 'usda_foundation' | 'usda_sr_legacy';
};

export type UsdaCsvRow = {
  fdc_id: string;
  description: string;
  food_category: string;
  /** USDA nutrient ID -> amount per 100g, already numeric (pre-joined food_nutrient.csv rows). */
  nutrients: Record<number, number>;
};

const CORE_MACRO_IDS = { kcal: 1008, protein: 1003, carbs: 1005, fat: 1004, fiber: 1079 } as const;

/**
 * USDA nutrient ID -> this app's MicronutrientKey, for every single-ID
 * micronutrient the domain registry tracks. omega3G is handled separately
 * (see OMEGA_3_FATTY_ACID_IDS below) since USDA reports it as three
 * distinct fatty-acid IDs (ALA/EPA/DHA) rather than one combined figure.
 */
export const USDA_NUTRIENT_ID_MAP: Record<number, MicronutrientKey> = {
  1106: 'vitaminAUg', // "Vitamin A, RAE" (µg) - NOT 1104 "Vitamin A, IU", a different unit
  1162: 'vitaminCMg',
  1114: 'vitaminDUg',
  1109: 'vitaminEMg',
  1185: 'vitaminKUg',
  1165: 'b1Mg',
  1166: 'b2Mg',
  1167: 'b3Mg',
  1175: 'b6Mg',
  1178: 'b12Ug',
  1177: 'folateUg',
  1087: 'calciumMg',
  1089: 'ironMg',
  1090: 'magnesiumMg',
  1092: 'potassiumMg',
  1093: 'sodiumMg',
  1095: 'zincMg',
  1103: 'seleniumUg',
  1100: 'iodineUg',
};

/** ALA (18:3 n-3), EPA (20:5 n-3), DHA (22:6 n-3) - summed into omega3G, only over whichever IDs are actually present. */
const OMEGA_3_FATTY_ACID_IDS = [1404, 1278, 1272];

export function parseUsdaFoodRow(row: UsdaCsvRow, dataset: 'usda_foundation' | 'usda_sr_legacy'): UsdaFoodRecord | null {
  const kcal = row.nutrients[CORE_MACRO_IDS.kcal];
  const protein = row.nutrients[CORE_MACRO_IDS.protein];
  const carbs = row.nutrients[CORE_MACRO_IDS.carbs];
  const fat = row.nutrients[CORE_MACRO_IDS.fat];
  if (kcal === undefined || protein === undefined || carbs === undefined || fat === undefined) return null;

  const micronutrients: Partial<Record<MicronutrientKey, number>> = {};
  for (const [idStr, key] of Object.entries(USDA_NUTRIENT_ID_MAP)) {
    const value = row.nutrients[Number(idStr)];
    if (value !== undefined) micronutrients[key] = value;
  }

  const presentOmega3Values = OMEGA_3_FATTY_ACID_IDS.map((id) => row.nutrients[id]).filter((v): v is number => v !== undefined);
  if (presentOmega3Values.length > 0) {
    micronutrients.omega3G = presentOmega3Values.reduce((sum, v) => sum + v, 0);
  }

  return {
    fdcId: row.fdc_id,
    descriptionEn: row.description,
    category: row.food_category,
    kcalPer100: kcal,
    proteinPer100: protein,
    carbsPer100: carbs,
    fatPer100: fat,
    fiberPer100: row.nutrients[CORE_MACRO_IDS.fiber] ?? null,
    micronutrients,
    sourceDataset: dataset,
  };
}
