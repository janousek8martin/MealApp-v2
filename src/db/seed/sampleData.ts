/**
 * Phase-2 starter seed: a handful of foods and recipes proving the pipeline.
 * Phase 5 replaces this with the full curated database (~60–80 foods,
 * ~30–40 recipes) with per-row audit references (usda:fdc/…, nutridatabaze:…).
 * Until then rows carry source 'seed-draft'.
 */

export type FoodSeed = {
  key: string;
  nameCs: string;
  nameEn: string;
  category: string;
  baseUnit: 'g' | 'ml' | 'piece';
  gramsPerPiece?: number;
  kcalPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  fiberPer100?: number;
  dietFlags?: string[];
  allergens?: string[];
  budget?: 'cheap' | 'average' | 'expensive';
  shelfLifeDays?: number;
  storage?: 'pantry' | 'fridge' | 'freezer';
  snackSuitable?: boolean;
};

export type RecipeSeed = {
  key: string;
  nameCs: string;
  nameEn: string;
  category: 'breakfast' | 'lunch_dinner' | 'snack';
  isSide?: boolean;
  budget?: 'cheap' | 'average' | 'expensive';
  prepTimeMinutes?: number;
  instructionsCs?: string;
  instructionsEn?: string;
  /** amount in the food's base unit per 1 reference portion */
  ingredients: { foodKey: string; amount: number }[];
};

export const sampleFoods: FoodSeed[] = [
  {
    key: 'chicken_breast',
    nameCs: 'Kuřecí prsa (syrová)',
    nameEn: 'Chicken breast (raw)',
    category: 'meat',
    baseUnit: 'g',
    kcalPer100: 120,
    proteinPer100: 22.5,
    carbsPer100: 0,
    fatPer100: 2.6,
    fiberPer100: 0,
    budget: 'average',
    shelfLifeDays: 3,
    storage: 'fridge',
  },
  {
    key: 'rice_white_dry',
    nameCs: 'Rýže bílá (suchá)',
    nameEn: 'White rice (dry)',
    category: 'grains',
    baseUnit: 'g',
    kcalPer100: 356,
    proteinPer100: 6.7,
    carbsPer100: 79,
    fatPer100: 0.6,
    fiberPer100: 1.3,
    dietFlags: ['vegetarian', 'vegan'],
    budget: 'cheap',
    shelfLifeDays: 365,
    storage: 'pantry',
  },
  {
    key: 'olive_oil',
    nameCs: 'Olivový olej',
    nameEn: 'Olive oil',
    category: 'fats',
    baseUnit: 'ml',
    kcalPer100: 884,
    proteinPer100: 0,
    carbsPer100: 0,
    fatPer100: 100,
    fiberPer100: 0,
    dietFlags: ['vegetarian', 'vegan'],
    budget: 'average',
    shelfLifeDays: 540,
    storage: 'pantry',
  },
  {
    key: 'oats',
    nameCs: 'Ovesné vločky',
    nameEn: 'Rolled oats',
    category: 'grains',
    baseUnit: 'g',
    kcalPer100: 379,
    proteinPer100: 13.2,
    carbsPer100: 67.7,
    fatPer100: 6.5,
    fiberPer100: 10.1,
    dietFlags: ['vegetarian', 'vegan'],
    allergens: ['gluten'],
    budget: 'cheap',
    shelfLifeDays: 365,
    storage: 'pantry',
  },
  {
    key: 'milk_semi',
    nameCs: 'Mléko polotučné',
    nameEn: 'Semi-skimmed milk',
    category: 'dairy',
    baseUnit: 'ml',
    kcalPer100: 46,
    proteinPer100: 3.4,
    carbsPer100: 4.8,
    fatPer100: 1.5,
    fiberPer100: 0,
    dietFlags: ['vegetarian'],
    allergens: ['lactose'],
    budget: 'cheap',
    shelfLifeDays: 7,
    storage: 'fridge',
  },
  {
    key: 'apple',
    nameCs: 'Jablko',
    nameEn: 'Apple',
    category: 'fruit',
    baseUnit: 'piece',
    gramsPerPiece: 180,
    kcalPer100: 52,
    proteinPer100: 0.3,
    carbsPer100: 13.8,
    fatPer100: 0.2,
    fiberPer100: 2.4,
    dietFlags: ['vegetarian', 'vegan'],
    budget: 'cheap',
    shelfLifeDays: 21,
    storage: 'fridge',
    snackSuitable: true,
  },
  {
    key: 'almonds',
    nameCs: 'Mandle',
    nameEn: 'Almonds',
    category: 'nuts',
    baseUnit: 'g',
    kcalPer100: 579,
    proteinPer100: 21.2,
    carbsPer100: 21.6,
    fatPer100: 49.9,
    fiberPer100: 12.5,
    dietFlags: ['vegetarian', 'vegan'],
    allergens: ['nuts'],
    budget: 'expensive',
    shelfLifeDays: 180,
    storage: 'pantry',
    snackSuitable: true,
  },
  {
    key: 'greek_yogurt',
    nameCs: 'Řecký jogurt bílý',
    nameEn: 'Greek yogurt, plain',
    category: 'dairy',
    baseUnit: 'g',
    kcalPer100: 97,
    proteinPer100: 9,
    carbsPer100: 3.9,
    fatPer100: 5,
    fiberPer100: 0,
    dietFlags: ['vegetarian'],
    allergens: ['lactose'],
    budget: 'average',
    shelfLifeDays: 14,
    storage: 'fridge',
    snackSuitable: true,
  },
];

export const sampleRecipes: RecipeSeed[] = [
  {
    key: 'oatmeal_apple_almonds',
    nameCs: 'Ovesná kaše s jablkem a mandlemi',
    nameEn: 'Oatmeal with apple and almonds',
    category: 'breakfast',
    budget: 'cheap',
    prepTimeMinutes: 10,
    instructionsCs: 'Vločky povařte v mléce, ozdobte nakrájeným jablkem a mandlemi.',
    instructionsEn: 'Simmer the oats in milk, top with sliced apple and almonds.',
    ingredients: [
      { foodKey: 'oats', amount: 60 },
      { foodKey: 'milk_semi', amount: 250 },
      { foodKey: 'apple', amount: 1 },
      { foodKey: 'almonds', amount: 15 },
    ],
  },
  {
    key: 'chicken_rice',
    nameCs: 'Kuřecí prsa s rýží',
    nameEn: 'Chicken breast with rice',
    category: 'lunch_dinner',
    budget: 'average',
    prepTimeMinutes: 30,
    instructionsCs: 'Kuře opečte na olivovém oleji, podávejte s vařenou rýží.',
    instructionsEn: 'Pan-sear the chicken in olive oil, serve with boiled rice.',
    ingredients: [
      { foodKey: 'chicken_breast', amount: 150 },
      { foodKey: 'rice_white_dry', amount: 80 },
      { foodKey: 'olive_oil', amount: 10 },
    ],
  },
];
