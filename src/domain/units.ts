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
export type KitchenVolumeUnit =
  | 'tsp'
  | 'tbsp'
  | 'cup'
  | 'cup_half'
  | 'cup_third'
  | 'cup_quarter'
  | 'cup_eighth'
  | 'cup_two_thirds'
  | 'fl_oz'
  | 'pint'
  | 'quart'
  | 'gallon';
export type KitchenWeightUnit = 'oz' | 'lb';
export type KitchenUnit = KitchenVolumeUnit | KitchenWeightUnit;

export const KITCHEN_VOLUME_ML: Record<KitchenVolumeUnit, number> = {
  tsp: 5,
  tbsp: 15,
  cup: 240,
  cup_half: 120,
  cup_third: 80,
  cup_quarter: 60,
  cup_eighth: 30,
  cup_two_thirds: 160,
  fl_oz: 29.5735,
  pint: 473.176,
  quart: 946.353,
  gallon: 3785.41,
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

/** Renders a quarter-cup count as a mixed fraction, e.g. 3 -> "3/4", 5 -> "1 1/4". */
export function formatCupQuarters(quarters: number): string {
  const whole = Math.floor(quarters / 4);
  const remainder = quarters % 4;
  const fractionLabel = remainder === 0 ? '' : remainder === 1 ? '1/4' : remainder === 2 ? '1/2' : '3/4';
  if (whole === 0) return fractionLabel;
  return fractionLabel ? `${whole} ${fractionLabel}` : String(whole);
}

export type KitchenEquivalent =
  | { unit: 'cup'; quarters: number }
  | { unit: 'tbsp'; amount: number }
  | { unit: 'tsp'; amount: number };

/**
 * Picks the most natural kitchen measure for a recipe ingredient amount, for
 * the recipe-detail "kitchen equivalent" display: quarter-cup fractions down
 * to 1/4 cup, then tbsp, then tsp for anything smaller (a spice or oil
 * measure would otherwise round to "0 cup" and show nothing at all). Returns
 * null when there's nothing sensible to show: 'piece' units, an amount too
 * small even for a level teaspoon, or a 'g' food with no known density
 * (`gramsPerCup`).
 */
/** A household-defined kitchen unit (e.g. a specific mug/scoop), merged with the built-in table below. */
export type CustomKitchenUnit = {
  id: string;
  name: string;
  unitType: 'volume' | 'weight';
  /** Amount in the reference unit (ml for volume, g for weight) that one of this unit equals. */
  conversionValue: number;
  aliases: string[];
};

/** One row of the merged built-in + custom kitchen-units table shown in Settings. */
export type KitchenUnitRow = {
  /** Built-in unit key, or the custom unit's db id. */
  id: string;
  name: string;
  unitType: 'volume' | 'weight';
  conversionValue: number;
  aliases: string[];
  isCustom: boolean;
};

const BUILT_IN_ALIASES: Partial<Record<KitchenUnit, string[]>> = {
  tsp: ['lžička', 'čajová lžička'],
  tbsp: ['lžíce', 'polévková lžíce'],
  cup: ['hrnek', 'šálek'],
  oz: ['unce'],
  lb: ['libra'],
};

/** Converts amount → ml (volume) or g (weight) for a custom unit. */
export function customUnitToReference(amount: number, unit: CustomKitchenUnit): number {
  return amount * unit.conversionValue;
}

/**
 * Merges the app's built-in kitchen-unit table with a household's custom
 * units, for the Settings screen's editable table/calculator. Built-ins
 * come first (in their natural smallest-to-largest order), customs appended
 * after – customs are the only rows the UI offers to edit/delete.
 */
export function mergedKitchenUnitRows(
  builtInLabel: (unit: KitchenUnit) => string,
  customUnits: CustomKitchenUnit[],
): KitchenUnitRow[] {
  const builtInVolume: KitchenVolumeUnit[] = [
    'tsp',
    'tbsp',
    'cup_eighth',
    'cup_quarter',
    'cup_third',
    'cup_half',
    'cup_two_thirds',
    'cup',
    'fl_oz',
    'pint',
    'quart',
    'gallon',
  ];
  const builtInWeight: KitchenWeightUnit[] = ['oz', 'lb'];

  const builtInRows: KitchenUnitRow[] = [
    ...builtInVolume.map((unit) => ({
      id: unit,
      name: builtInLabel(unit),
      unitType: 'volume' as const,
      conversionValue: KITCHEN_VOLUME_ML[unit],
      aliases: BUILT_IN_ALIASES[unit] ?? [],
      isCustom: false,
    })),
    ...builtInWeight.map((unit) => ({
      id: unit,
      name: builtInLabel(unit),
      unitType: 'weight' as const,
      conversionValue: unit === 'oz' ? ouncesToGrams(1) : poundsToGrams(1),
      aliases: BUILT_IN_ALIASES[unit] ?? [],
      isCustom: false,
    })),
  ];

  const customRows: KitchenUnitRow[] = customUnits.map((unit) => ({
    id: unit.id,
    name: unit.name,
    unitType: unit.unitType,
    conversionValue: unit.conversionValue,
    aliases: unit.aliases,
    isCustom: true,
  }));

  return [...builtInRows, ...customRows];
}

export function kitchenEquivalent(
  amountBase: number,
  baseUnit: BaseUnit,
  gramsPerCup: number | null | undefined,
): KitchenEquivalent | null {
  let ml: number;
  if (baseUnit === 'ml') {
    ml = amountBase;
  } else if (baseUnit === 'g' && gramsPerCup) {
    ml = (amountBase / gramsPerCup) * KITCHEN_VOLUME_ML.cup;
  } else {
    return null;
  }

  const quarters = Math.round(ml / (KITCHEN_VOLUME_ML.cup / 4));
  if (quarters > 0) return { unit: 'cup', quarters };

  const tbsp = Math.round(ml / KITCHEN_VOLUME_ML.tbsp);
  if (tbsp > 0) return { unit: 'tbsp', amount: tbsp };

  const tsp = Math.round(ml / KITCHEN_VOLUME_ML.tsp);
  if (tsp > 0) return { unit: 'tsp', amount: tsp };

  return null;
}
