export type Micronutrients = {
  ironMg?: number;
  vitaminDUg?: number;
  b12Ug?: number;
  calciumMg?: number;
  omega3G?: number;
};

export type FoodSeed = {
  key: string;
  nameCs: string;
  nameEn: string;
  category: string;
  baseUnit: 'g' | 'ml' | 'piece';
  gramsPerPiece?: number;
  /** Density reference for baseUnit 'g' foods (e.g. rolled oats ≈ 90 g/cup) – drives the recipe-detail kitchen equivalent. */
  gramsPerCup?: number;
  kcalPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  fiberPer100?: number;
  micronutrients?: Micronutrients;
  dietFlags?: string[];
  allergens?: string[];
  budget?: 'cheap' | 'average' | 'expensive';
  shelfLifeDays?: number;
  storage?: 'pantry' | 'fridge' | 'freezer';
  snackSuitable?: boolean;
  /** Data provenance, e.g. 'usda' or 'nutridatabaze'. */
  source?: string;
};

export type RecipeSeed = {
  key: string;
  nameCs: string;
  nameEn: string;
  category: 'breakfast' | 'lunch_dinner' | 'snack';
  isSide?: boolean;
  /** Free-form cuisine key (czech/mediterranean/italian/asian/mexican/american/other). */
  cuisine?: string;
  budget?: 'cheap' | 'average' | 'expensive';
  prepTimeMinutes?: number;
  instructionsCs?: string;
  instructionsEn?: string;
  tags?: string[];
  /** amount in the food's base unit per 1 reference portion */
  ingredients: { foodKey: string; amount: number }[];
};
