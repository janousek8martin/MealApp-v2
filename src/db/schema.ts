import { index, integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Sync-ready conventions (phase 2 / Supabase):
 * - every table has a UUID `id` generated in the app (no autoincrements),
 * - `created_at` / `updated_at` are ISO 8601 UTC strings,
 * - rows are soft-deleted via `deleted_at` so deletions can propagate on sync,
 * - the schema maps 1:1 to Postgres.
 *
 * Derived values (recipe nutrition, TDCI, remaining daily targets) are never
 * stored – they are always computed from current rows.
 */

const meta = {
  id: text('id').primaryKey(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  deletedAt: text('deleted_at'),
};

// ---------------------------------------------------------------------------
// Household & profiles
// ---------------------------------------------------------------------------

export const households = sqliteTable('households', {
  ...meta,
  name: text('name').notNull(),
  /** Whether breakfast is planned as one shared meal or per profile. */
  breakfastMode: text('breakfast_mode', { enum: ['shared', 'individual'] })
    .notNull()
    .default('shared'),
});

export const householdSettings = sqliteTable('household_settings', {
  ...meta,
  householdId: text('household_id')
    .notNull()
    .references(() => households.id),
  unitSystem: text('unit_system', { enum: ['metric', 'us'] }).notNull().default('metric'),
  language: text('language', { enum: ['cs', 'en'] }).notNull().default('cs'),
  /** Household default; recipes may override per-recipe (recipes.maxRepetitionsPerWeek). */
  defaultMaxRepetitionsPerWeek: integer('default_max_repetitions_per_week').notNull().default(2),
  /** Household default for batch cooking; recipes may override. */
  defaultAllowConsecutiveDays: integer('default_allow_consecutive_days', { mode: 'boolean' })
    .notNull()
    .default(false),
  fiberMode: text('fiber_mode', { enum: ['efsa_min', 'gender_specific'] })
    .notNull()
    .default('efsa_min'),
  /** JSON: per-notification enabled flags and times, see NotificationSettings. */
  notificationsJson: text('notifications_json'),
  /** JSON array of cuisine keys the household prefers – a soft bonus in generator scoring. */
  favoriteCuisinesJson: text('favorite_cuisines_json'),
  /**
   * How recipe-detail ingredient amounts are displayed: 'grams' shows only
   * the canonical baseUnit amount; 'hybrid' also shows the kitchen-measure
   * equivalent (e.g. "200 g (≈ 3/4 cup)"), the pre-existing behavior;
   * 'kitchen' shows only the kitchen-measure equivalent, falling back to
   * grams when no equivalent exists (e.g. piece-based ingredients). Purely
   * presentational – nutrition math always uses the canonical amount.
   */
  kitchenUnitDisplayMode: text('kitchen_unit_display_mode', { enum: ['grams', 'hybrid', 'kitchen'] })
    .notNull()
    .default('hybrid'),
});

/**
 * User-defined kitchen units (e.g. a specific mug or scoop), merged with the
 * built-in conversion table (`KITCHEN_VOLUME_ML`/`KITCHEN_WEIGHT_G` in
 * `src/domain/units.ts`) for the Settings kitchen-units table/calculator.
 */
export const householdCustomUnits = sqliteTable(
  'household_custom_units',
  {
    ...meta,
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    name: text('name').notNull(),
    unitType: text('unit_type', { enum: ['volume', 'weight'] }).notNull(),
    /** Amount in the reference unit (ml for volume, g for weight) that one of this unit equals. */
    conversionValue: real('conversion_value').notNull(),
    /** JSON array of alternate names/spellings (Czech aliases) this unit is also known by. */
    aliasesJson: text('aliases_json'),
  },
  (table) => [index('household_custom_units_household_idx').on(table.householdId)],
);

/**
 * Household-wide allergies/diet rules, set during the setup wizard. The
 * generator combines these with each profile's own restrictions (union) –
 * a household-level "gluten-free" applies to every shared meal, while a
 * profile can still add its own on top.
 */
export const householdRestrictions = sqliteTable(
  'household_restrictions',
  {
    ...meta,
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    kind: text('kind', { enum: ['allergen', 'diet'] }).notNull(),
    value: text('value').notNull(),
  },
  (table) => [index('household_restrictions_household_idx').on(table.householdId)],
);

/** Household-wide "nobody wants this" exclusions – same union-with-profile approach. */
export const householdAvoidedItems = sqliteTable(
  'household_avoided_items',
  {
    ...meta,
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    itemType: text('item_type', { enum: ['food', 'recipe'] }).notNull(),
    itemId: text('item_id').notNull(),
  },
  (table) => [index('household_avoided_household_idx').on(table.householdId)],
);

export const mealSlotSettings = sqliteTable(
  'meal_slot_settings',
  {
    ...meta,
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    /** Stable key referenced by planned meals, e.g. 'breakfast', 'lunch', 'snack_morning'. */
    slotKey: text('slot_key').notNull(),
    kind: text('kind', { enum: ['main', 'snack'] }).notNull(),
    /** Shared = one recipe for the whole household; individual = per profile. */
    sharing: text('sharing', { enum: ['shared', 'individual'] }).notNull(),
    /** 'HH:MM', used for meal reminders. */
    time: text('time').notNull(),
    /** Fraction of the daily calorie target assigned to this slot (0..1). */
    calorieShare: real('calorie_share').notNull(),
    sortOrder: integer('sort_order').notNull(),
    enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  },
  (table) => [index('meal_slot_household_idx').on(table.householdId)],
);

/**
 * Per-profile override of a household meal slot – lets each household member
 * dial in their own share of daily calories (and, for snack slots, an
 * explicit protein/fat target) instead of the household default. Absent row
 * = fall back to `mealSlotSettings.calorieShare` / the remaining-target
 * computation.
 */
export const profileSlotPortions = sqliteTable(
  'profile_slot_portions',
  {
    ...meta,
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id),
    slotId: text('slot_id')
      .notNull()
      .references(() => mealSlotSettings.id),
    /** Fraction of the profile's daily calorie target assigned to this slot (0..1). */
    calorieSharePercent: real('calorie_share_percent'),
    /** Snack slots only: explicit grams target: carbs is then computed from the remaining kcal. */
    proteinTargetG: real('protein_target_g'),
    fatTargetG: real('fat_target_g'),
  },
  (table) => [index('profile_slot_portions_profile_idx').on(table.profileId)],
);

export const profiles = sqliteTable(
  'profiles',
  {
    ...meta,
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    name: text('name').notNull(),
    /** Accent color used for the profile avatar chip. */
    color: text('color'),
    profileType: text('profile_type', { enum: ['adult', 'child'] }).notNull().default('adult'),
    sex: text('sex', { enum: ['male', 'female'] }).notNull(),
    birthDate: text('birth_date').notNull(),
    heightCm: real('height_cm').notNull(),
    activityLevel: text('activity_level', {
      enum: ['sedentary', 'light', 'moderate', 'active', 'very_active'],
    }).notNull(),
    /** Chosen fine-grained multiplier within the activityLevel's 3-dot range; null = use the level's middle value. */
    activityMultiplier: real('activity_multiplier'),
    goal: text('goal', { enum: ['lose', 'maintain', 'gain'] }).notNull().default('maintain'),
    goalWeightKg: real('goal_weight_kg'),
    goalBodyFatPct: real('goal_body_fat_pct'),
    fitnessExperience: text('fitness_experience', {
      enum: ['beginner', 'intermediate', 'advanced'],
    }),
    /** False = independent diet: this profile gets its own generated plan. */
    sharesMainMeals: integer('shares_main_meals', { mode: 'boolean' }).notNull().default(true),
    /** JSON array of ISO weekday numbers (1 = Monday .. 7 = Sunday). */
    workoutDaysJson: text('workout_days_json'),
    /** JSON array of snack slot keys this profile uses. */
    snackPositionsJson: text('snack_positions_json'),
    /** User's manual ±kcal correction applied on top of the computed TDCI. */
    tdciManualAdjustmentKcal: real('tdci_manual_adjustment_kcal').notNull().default(0),
    /** JSON: optional overrides (proteinPerKgLbm, surplusKcal, carbFatSplit...). */
    macroOverridesJson: text('macro_overrides_json'),
  },
  (table) => [index('profiles_household_idx').on(table.householdId)],
);

/** Allergies and diet rules – hard filters for the generator. */
export const profileRestrictions = sqliteTable(
  'profile_restrictions',
  {
    ...meta,
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id),
    kind: text('kind', { enum: ['allergen', 'diet'] }).notNull(),
    /** Allergen key ('gluten', 'lactose', ...) or diet key ('vegetarian', ...). */
    value: text('value').notNull(),
  },
  (table) => [index('profile_restrictions_profile_idx').on(table.profileId)],
);

/** "I just don't like it" exclusions – also a hard filter for the generator. */
export const profileAvoidedItems = sqliteTable(
  'profile_avoided_items',
  {
    ...meta,
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id),
    itemType: text('item_type', { enum: ['food', 'recipe'] }).notNull(),
    itemId: text('item_id').notNull(),
  },
  (table) => [index('profile_avoided_profile_idx').on(table.profileId)],
);

export const profileFavorites = sqliteTable(
  'profile_favorites',
  {
    ...meta,
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id),
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id),
  },
  (table) => [index('profile_favorites_profile_idx').on(table.profileId)],
);

/**
 * Weight / body-composition log. The profile's current weight and body fat
 * are always the most recent row here – they are not duplicated on profiles.
 */
export const bodyMetrics = sqliteTable(
  'body_metrics',
  {
    ...meta,
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id),
    /** 'YYYY-MM-DD' */
    date: text('date').notNull(),
    weightKg: real('weight_kg').notNull(),
    bodyFatPct: real('body_fat_pct'),
    method: text('method', { enum: ['navy', 'manual', 'bia', 'dexa'] }),
    neckCm: real('neck_cm'),
    waistCm: real('waist_cm'),
    hipCm: real('hip_cm'),
    note: text('note'),
  },
  (table) => [index('body_metrics_profile_date_idx').on(table.profileId, table.date)],
);

// ---------------------------------------------------------------------------
// Foods & recipes
// ---------------------------------------------------------------------------

export const foods = sqliteTable('foods', {
  ...meta,
  nameCs: text('name_cs').notNull(),
  nameEn: text('name_en').notNull(),
  category: text('category').notNull(),
  baseUnit: text('base_unit', { enum: ['g', 'ml', 'piece'] }).notNull().default('g'),
  /** Weight of one piece when baseUnit is 'piece' (e.g. one egg ≈ 55 g). */
  gramsPerPiece: real('grams_per_piece'),
  /** Density reference for baseUnit 'g' foods (e.g. rolled oats ≈ 90 g/cup) – drives the recipe-detail kitchen equivalent, null = not shown. */
  gramsPerCup: real('grams_per_cup'),
  // Nutrition per 100 g / 100 ml / 100 g-equivalent of pieces.
  kcalPer100: real('kcal_per_100').notNull(),
  proteinPer100: real('protein_per_100').notNull(),
  carbsPer100: real('carbs_per_100').notNull(),
  fatPer100: real('fat_per_100').notNull(),
  fiberPer100: real('fiber_per_100'),
  /** JSON: { ironMg, vitaminDUg, b12Ug, calciumMg, omega3G } – null field = unknown, never 0. */
  micronutrientsJson: text('micronutrients_json'),
  /** JSON array of diet keys this food is compatible with, e.g. ["vegetarian","vegan"]. */
  dietFlagsJson: text('diet_flags_json'),
  budget: text('budget', { enum: ['cheap', 'average', 'expensive'] })
    .notNull()
    .default('average'),
  /** Drives pantry expiry estimates and monthly batch shopping. */
  shelfLifeDays: integer('shelf_life_days'),
  storage: text('storage', { enum: ['pantry', 'fridge', 'freezer'] }),
  snackSuitable: integer('snack_suitable', { mode: 'boolean' }).notNull().default(false),
  /** EAN – reserved for the V1.x barcode scanner. */
  barcode: text('barcode'),
  /** Audit reference: 'usda:fdc/171287', 'nutridatabaze:123', 'user'. */
  source: text('source').notNull().default('user'),
  /** Stable key from the seed data (e.g. 'mushrooms') – lets "avoid this food" preferences and curated avoid-lists reference a food across reinstalls, since the runtime id is a random UUID; null for user-added foods. */
  seedKey: text('seed_key'),
});

export const foodRestrictions = sqliteTable(
  'food_restrictions',
  {
    ...meta,
    foodId: text('food_id')
      .notNull()
      .references(() => foods.id),
    allergen: text('allergen').notNull(),
  },
  (table) => [index('food_restrictions_food_idx').on(table.foodId)],
);

export const recipes = sqliteTable('recipes', {
  ...meta,
  nameCs: text('name_cs').notNull(),
  nameEn: text('name_en').notNull(),
  instructionsCs: text('instructions_cs'),
  instructionsEn: text('instructions_en'),
  category: text('category', { enum: ['breakfast', 'lunch_dinner', 'snack'] }).notNull(),
  isSide: integer('is_side', { mode: 'boolean' }).notNull().default(false),
  /** Free-form cuisine key (czech/mediterranean/italian/asian/mexican/american/other...). */
  cuisine: text('cuisine'),
  budget: text('budget', { enum: ['cheap', 'average', 'expensive'] })
    .notNull()
    .default('average'),
  /** Ingredient amounts describe this many reference portions (usually 1). */
  servingsBase: real('servings_base').notNull().default(1),
  prepTimeMinutes: integer('prep_time_minutes'),
  /** JSON array of free-form tags. */
  tagsJson: text('tags_json'),
  /** Per-recipe override of the weekly repetition limit; null = household default. */
  maxRepetitionsPerWeek: integer('max_repetitions_per_week'),
  /** Per-recipe override for batch cooking on consecutive days; null = household default. */
  allowConsecutiveDays: integer('allow_consecutive_days', { mode: 'boolean' }),
  source: text('source').notNull().default('user'),
});

export const recipeIngredients = sqliteTable(
  'recipe_ingredients',
  {
    ...meta,
    recipeId: text('recipe_id')
      .notNull()
      .references(() => recipes.id),
    foodId: text('food_id')
      .notNull()
      .references(() => foods.id),
    /** Amount per `servingsBase` portions, in the food's base unit. */
    amount: real('amount').notNull(),
    note: text('note'),
  },
  (table) => [index('recipe_ingredients_recipe_idx').on(table.recipeId)],
);

// ---------------------------------------------------------------------------
// Meal plan, shopping list, pantry, photos
// ---------------------------------------------------------------------------

export const plannedMeals = sqliteTable(
  'planned_meals',
  {
    ...meta,
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    /** 'YYYY-MM-DD'; weeks always start on Monday. */
    date: text('date').notNull(),
    slotKey: text('slot_key').notNull(),
    /** Null = shared meal for the whole household; set = individual track. */
    profileId: text('profile_id').references(() => profiles.id),
    itemType: text('item_type', { enum: ['recipe', 'food'] }).notNull(),
    itemId: text('item_id').notNull(),
  },
  (table) => [index('planned_meals_household_date_idx').on(table.householdId, table.date)],
);

export const plannedMealPortions = sqliteTable(
  'planned_meal_portions',
  {
    ...meta,
    plannedMealId: text('planned_meal_id')
      .notNull()
      .references(() => plannedMeals.id),
    profileId: text('profile_id')
      .notNull()
      .references(() => profiles.id),
    /** Single multiplier applied to the whole recipe (keeps its macro ratio). */
    multiplier: real('multiplier').notNull(),
    /** An 'eaten' portion locks its meal against regeneration. */
    status: text('status', { enum: ['planned', 'eaten', 'skipped'] })
      .notNull()
      .default('planned'),
  },
  (table) => [index('planned_meal_portions_meal_idx').on(table.plannedMealId)],
);

/**
 * A simple food/recipe added on top of a planned meal (e.g. a drink, an
 * extra side) – a flat 1x addition, not part of the generator's slot logic
 * or per-profile portion scaling. Contributes to the meal's displayed
 * nutrition and the shopping list.
 */
export const plannedMealExtras = sqliteTable(
  'planned_meal_extras',
  {
    ...meta,
    plannedMealId: text('planned_meal_id')
      .notNull()
      .references(() => plannedMeals.id),
    itemType: text('item_type', { enum: ['recipe', 'food'] }).notNull(),
    itemId: text('item_id').notNull(),
  },
  (table) => [index('planned_meal_extras_meal_idx').on(table.plannedMealId)],
);

export const pantryItems = sqliteTable(
  'pantry_items',
  {
    ...meta,
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    foodId: text('food_id')
      .notNull()
      .references(() => foods.id),
    /** In the food's base unit. */
    quantity: real('quantity').notNull(),
    purchasedAt: text('purchased_at'),
    /** Estimated from foods.shelfLifeDays on purchase; user-editable. */
    expiresAt: text('expires_at'),
  },
  (table) => [index('pantry_items_household_idx').on(table.householdId)],
);

export const shoppingListItems = sqliteTable(
  'shopping_list_items',
  {
    ...meta,
    householdId: text('household_id')
      .notNull()
      .references(() => households.id),
    /** Null for free-text items added by hand. */
    foodId: text('food_id').references(() => foods.id),
    customName: text('custom_name'),
    quantity: real('quantity'),
    unit: text('unit'),
    /** Weekly = fresh ingredients; monthly = long-shelf-life batch purchases. */
    horizon: text('horizon', { enum: ['weekly', 'monthly'] }).notNull().default('weekly'),
    checked: integer('checked', { mode: 'boolean' }).notNull().default(false),
    autoGenerated: integer('auto_generated', { mode: 'boolean' }).notNull().default(true),
    note: text('note'),
  },
  (table) => [index('shopping_list_household_idx').on(table.householdId)],
);

export const photos = sqliteTable(
  'photos',
  {
    ...meta,
    ownerType: text('owner_type', { enum: ['recipe', 'food'] }).notNull(),
    ownerId: text('owner_id').notNull(),
    /** Local file URI inside the app's document directory. */
    uri: text('uri').notNull(),
    takenAt: text('taken_at'),
    /** Reserved for future AI-derived metadata (food recognition). */
    aiMetadataJson: text('ai_metadata_json'),
  },
  (table) => [index('photos_owner_idx').on(table.ownerType, table.ownerId)],
);
