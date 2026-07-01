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
