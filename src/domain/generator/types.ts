export type RecipeCategory = 'breakfast' | 'lunch_dinner' | 'snack';
export type Budget = 'cheap' | 'average' | 'expensive';

export type RecipeNutritionPerPortion = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
};

/** A food used inside a recipe – just enough to derive recipe-level tags. */
export type IngredientFoodTags = {
  foodId: string;
  allergens: string[];
  /** Diet keys this single food is compatible with, e.g. ['vegetarian','vegan']. */
  dietFlags: string[];
};

/** A candidate recipe as assembled by the repository layer for the generator. */
export type RecipeCandidate = {
  id: string;
  category: RecipeCategory;
  isSide: boolean;
  budget: Budget;
  snackSuitable?: boolean;
  nutritionPerPortion: RecipeNutritionPerPortion;
  ingredients: IngredientFoodTags[];
  /** Per-recipe override; null = use the household default. */
  maxRepetitionsPerWeek: number | null;
  /** Per-recipe override; null = use the household default. */
  allowConsecutiveDays: boolean | null;
};

/** Recipe tags derived from its ingredients – never stored, always computed. */
export type DerivedRecipeTags = {
  /** Union of every ingredient's allergens. */
  allergens: string[];
  /** Diets the recipe satisfies – only diets every ingredient supports. */
  dietFlags: string[];
};

export type DietRestrictions = {
  /** Allergens this profile must avoid. */
  allergens: string[];
  /** Diets this profile requires (e.g. 'vegetarian'). */
  diets: string[];
  /** Explicitly excluded recipes ("I don't like it"), independent of allergies. */
  avoidedRecipeIds: string[];
  /** Explicitly excluded foods – a recipe containing one is excluded too. */
  avoidedFoodIds: string[];
};

export type HouseholdRepetitionDefaults = {
  defaultMaxRepetitionsPerWeek: number;
  defaultAllowConsecutiveDays: boolean;
};

export type RepetitionContext = {
  /** How many times each recipe has already been placed in the week being generated. */
  weekCounts: Map<string, number>;
  /** Recipe ids already placed on the immediately preceding calendar day. */
  previousDayRecipeIds: Set<string>;
  household: HouseholdRepetitionDefaults;
};

export type ScoringContext = RepetitionContext & {
  favoriteRecipeIds: Set<string>;
  /** Food ids in the pantry that are close to expiring. */
  expiringFoodIds: Set<string>;
  /**
   * Per-kcal protein/fat density the slot is aiming for (see
   * `resolveMainSlotTarget`/`portions.ts`) – a soft scoring nudge toward
   * recipes whose macro ratio already matches a profile's slot target, since
   * the generator's single whole-recipe scaling multiplier can't otherwise
   * correct a mismatched ratio. Absent when there's no meaningful target
   * (e.g. no profile has a body-metric-derived daily target yet).
   */
  macroFitTarget?: { kcal: number; proteinG: number; fatG: number };
};

export type ScoredCandidate = { candidate: RecipeCandidate; score: number };
