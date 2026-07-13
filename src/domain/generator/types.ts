export type RecipeCategory = 'breakfast' | 'lunch_dinner' | 'snack';
export type Budget = 'cheap' | 'average' | 'expensive';
export type Difficulty = 'easy' | 'medium' | 'hard';
export type MealVarietyLevel = 'low' | 'medium' | 'high';

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
  /** Free-form cuisine key (e.g. 'czech', 'mediterranean'); null for standalone foods or untagged recipes. */
  cuisine?: string | null;
  nutritionPerPortion: RecipeNutritionPerPortion;
  ingredients: IngredientFoodTags[];
  /** Per-recipe override; null = use the household default. */
  maxRepetitionsPerWeek: number | null;
  /** Per-recipe override; null = use the household default. */
  allowConsecutiveDays: boolean | null;
  /** Can be eaten cold – eligible for the generator's cold-dinner day selection. */
  canServeCold: boolean;
  /** Undefined for standalone foods – difficulty is a recipe-only concept, so the cooking-experience filter always passes foods through. */
  difficulty?: Difficulty;
  /** Undefined/null for standalone foods or recipes without a set prep time – the cooking-time filter always passes those through. */
  prepTimeMinutes?: number | null;
};

/** Recipe tags derived from its ingredients – never stored, always computed. */
export type DerivedRecipeTags = {
  /** Union of every ingredient's allergens. */
  allergens: string[];
  /** Diets the recipe satisfies – only diets every ingredient supports. */
  dietFlags: string[];
};

/** How a household resolved a like/dislike conflict on a recipe (see householdRecipeOverrides). */
export type RecipeResolution = 'serve_separately' | 'never' | 'rare';

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
  /** Recipe/food ids this rating context's profile(s) like – a scoring bonus (also covers what used to be "favorites"). */
  likedItemIds: Set<string>;
  /** Household-preferred cuisine keys from the onboarding wizard – a soft scoring nudge, never a filter. */
  favoriteCuisines?: Set<string>;
  /** Food ids in the pantry that are close to expiring. */
  expiringFoodIds: Set<string>;
  /** Food ids currently in pantry stock (quantity > 0), regardless of expiry. */
  inStockFoodIds: Set<string>;
  /** Recipe ids resolved as "rare" after a like/dislike conflict – heavily discounted, not excluded. */
  rareRecipeIds?: Set<string>;
  /**
   * Household-wide meal-variety setting (replaces the old per-profile "wants
   * new foods" toggle) – recipes NOT in `recentRecipeIds` get a novelty bonus
   * whose size depends on `level` (see MEAL_VARIETY_BONUS in scoring.ts).
   * Always present since every household has a variety level (default 'medium').
   */
  mealVariety: { level: MealVarietyLevel; recentRecipeIds: Set<string> };
  /** Household toggle – when false, pantry expiry/stock scoring bonuses are zeroed out. */
  preferPantryItems: boolean;
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

/**
 * The three new hard-filter-with-fallback household preferences (cooking
 * experience, cooking time, budget) plus the same-lunch-dinner repeat rule –
 * bundled into one object since every `pickMealForSlot` call site needs all
 * four together, sourced straight from `household_settings`.
 */
export type HouseholdCandidateFilters = {
  cookingExperienceLevel: Difficulty;
  /** null = "Any time", no limit. */
  cookingTimeLimitMinutes: number | null;
  budgetLevel: 'low' | 'medium' | 'high';
  allowSameLunchDinner: boolean;
};

export type ScoredCandidate = { candidate: RecipeCandidate; score: number };
