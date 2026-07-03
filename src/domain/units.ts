/** Standard US customary ↔ metric conversion table (brief: fixed table). */

export type UnitSystem = 'metric' | 'us';
export type BaseUnit = 'g' | 'ml' | 'piece';

const LBS_PER_KG = 2.2046226218;
const CM_PER_INCH = 2.54;
const OZ_PER_G = 0.03527396195;
const ML_PER_US_CUP = 236.588;

export function kgToLbs(kg: number): number {
  return kg * LBS_PER_KG;
}

export function lbsToKg(lbs: number): number {
  return lbs / LBS_PER_KG;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cm / CM_PER_INCH;
  const feet = Math.floor(totalInches / 12);
  return { feet, inches: totalInches - feet * 12 };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_INCH;
}

export function gramsToOunces(g: number): number {
  return g * OZ_PER_G;
}

export function ouncesToGrams(oz: number): number {
  return oz / OZ_PER_G;
}

export function mlToUsCups(ml: number): number {
  return ml / ML_PER_US_CUP;
}

export function usCupsToMl(cups: number): number {
  return cups * ML_PER_US_CUP;
}

/**
 * Render an ingredient amount in the household's unit system. Amounts are
 * always stored metric; the unit system only changes presentation.
 */
export function formatAmount(amount: number, baseUnit: BaseUnit, system: UnitSystem): string {
  if (baseUnit === 'piece') {
    return system === 'metric' ? `${round1(amount)} ks` : `${round1(amount)} pcs`;
  }
  if (system === 'metric') {
    return `${round1(amount)} ${baseUnit}`;
  }
  if (baseUnit === 'g') {
    return `${round1(gramsToOunces(amount))} oz`;
  }
  return `${round1(mlToUsCups(amount))} cup`;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Kitchen measuring-cup/spoon conventions (rounded for cooking, not the
 * precise US customary cup used by `usCupsToMl` for body-weight-style
 * unit-system formatting above).
 */
export type KitchenVolumeUnit = 'tsp' | 'tbsp' | 'cup' | 'cup_half' | 'cup_third' | 'cup_quarter';
export type KitchenWeightUnit = 'oz' | 'lb';
export type KitchenUnit = KitchenVolumeUnit | KitchenWeightUnit;

export const KITCHEN_VOLUME_ML: Record<KitchenVolumeUnit, number> = {
  tsp: 5,
  tbsp: 15,
  cup: 240,
  cup_half: 120,
  cup_third: 80,
  cup_quarter: 60,
};

export function kitchenVolumeToMl(amount: number, unit: KitchenVolumeUnit): number {
  return amount * KITCHEN_VOLUME_ML[unit];
}

export function poundsToGrams(lb: number): number {
  return lbsToKg(lb) * 1000;
}

export function kitchenWeightToGrams(amount: number, unit: KitchenWeightUnit): number {
  return unit === 'oz' ? ouncesToGrams(amount) : poundsToGrams(amount);
}

export function isKitchenVolumeUnit(unit: KitchenUnit): unit is KitchenVolumeUnit {
  return unit in KITCHEN_VOLUME_ML;
}

/**
 * Rounds a recipe ingredient amount to the nearest quarter-cup, for the
 * recipe-detail "kitchen equivalent" display. Returns null when there's
 * nothing sensible to show: 'piece' units, less than ~1/4 cup, or a 'g' food
 * with no known density (`gramsPerCup`).
 */
export function kitchenEquivalentQuarters(
  amountBase: number,
  baseUnit: BaseUnit,
  gramsPerCup: number | null | undefined,
): number | null {
  let ml: number;
  if (baseUnit === 'ml') {
    ml = amountBase;
  } else if (baseUnit === 'g' && gramsPerCup) {
    ml = (amountBase / gramsPerCup) * KITCHEN_VOLUME_ML.cup;
  } else {
    return null;
  }
  const quarters = Math.round(ml / (KITCHEN_VOLUME_ML.cup / 4));
  return quarters > 0 ? quarters : null;
}

/** Renders a quarter-cup count as a mixed fraction, e.g. 3 -> "3/4", 5 -> "1 1/4". */
export function formatCupQuarters(quarters: number): string {
  const whole = Math.floor(quarters / 4);
  const remainder = quarters % 4;
  const fractionLabel = remainder === 0 ? '' : remainder === 1 ? '1/4' : remainder === 2 ? '1/2' : '3/4';
  if (whole === 0) return fractionLabel;
  return fractionLabel ? `${whole} ${fractionLabel}` : String(whole);
}

/** Combines the two steps above into the label shown next to a recipe ingredient, or null to show nothing. */
export function kitchenEquivalentLabel(
  amountBase: number,
  baseUnit: BaseUnit,
  gramsPerCup: number | null | undefined,
): string | null {
  const quarters = kitchenEquivalentQuarters(amountBase, baseUnit, gramsPerCup);
  return quarters !== null ? formatCupQuarters(quarters) : null;
}
