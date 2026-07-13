import { and, asc, desc, eq, gte, inArray, isNull, lt } from 'drizzle-orm';

import { isColdDinnerDay } from '@/domain/generator/coldDinner';
import { createSeededRng, type Rng } from '@/domain/generator/rng';
import {
  deriveRecipeTags,
  findRestrictionConflicts,
  relaxAvoidedRecipesForResolutions,
  type RestrictionConflict,
} from '@/domain/generator/filters';
import {
  resolveMainSlotTarget,
  resolveSlotCalorieShare,
  resolveSnackTarget,
  scalingMultiplier,
  type SlotPortionOverride,
} from '@/domain/generator/portions';
import { computeRecipeNutrition, type RecipeNutrition } from '@/domain/recipeNutrition';
import {
  DEFAULT_SHORTLIST_SIZE,
  pickMealForSlot,
  pickSnackForSlot,
  recordPick,
  type GeneratorItem,
} from '@/domain/generator/select';
import type {
  DietRestrictions,
  DerivedRecipeTags,
  HouseholdCandidateFilters,
  IngredientFoodTags,
  MealVarietyLevel,
  RecipeCandidate,
  RecipeResolution,
  RepetitionContext,
} from '@/domain/generator/types';
import { addDays, previousDay, startOfWeek, weekDates } from '@/domain/week';
import { applyWorkoutDayCycling } from '@/domain/workoutDays';
// Reused so the generator's daily target computation can never drift from
// what the UI shows (see the dailyTarget comment in loadGeneratorContext
// below) – this is the same pure mapping useProfileTargets calls.
import { targetsForProfile } from '@/hooks/dataMapping';

import { newId } from '../id';
import { upsertRecipe } from './library';
import { getRecipeResolutions } from './ratings';
import { deductPantryForConsumption, mealIngredientNeeds, restockPantryForConsumption } from './shopping';
import {
  bodyMetrics,
  foodRestrictions,
  foods,
  householdAvoidedItems,
  householdRestrictions,
  householdSettings,
  households,
  mealSlotSettings,
  pantryItems,
  plannedMealExtras,
  plannedMealPortions,
  plannedMeals,
  profileAvoidedItems,
  profileItemRatings,
  profileRestrictions,
  profileSlotPortions,
  profiles,
  recipeIngredients,
  recipes,
} from '../schema';
import { nowIso, todayIsoDate } from '../time';
import type { AppDb } from '../types';

/** Pantry items expiring within this many days score a bonus for the recipes that use them. */
const PANTRY_EXPIRY_WINDOW_DAYS = 3;
/** How far back the meal-variety bonus looks to decide whether a recipe counts as recently served. */
const NOVELTY_LOOKBACK_DAYS = 21;

type SlotRow = typeof mealSlotSettings.$inferSelect;
type MacroTotal = { kcal: number; proteinG: number; carbsG: number; fatG: number };

type ProfileContext = {
  id: string;
  sharesMainMeals: boolean;
  /** meal_slot_settings.slotKey values this profile eats; null = every household slot (default). Supersedes the old snack-only snackPositionsJson. */
  enabledSlotKeys: string[] | null;
  restrictions: DietRestrictions;
  dailyTarget: MacroTotal | null;
  /** Per-slot portion overrides (P2-C), keyed by mealSlotSettings.id. */
  slotOverrides: Map<string, SlotPortionOverride>;
};

/** null enabledSlotKeys means every household slot is in play (the default). */
function isSlotEnabledForProfile(profile: ProfileContext, slotKey: string): boolean {
  return profile.enabledSlotKeys === null || profile.enabledSlotKeys.includes(slotKey);
}

type GeneratorContext = {
  settings: {
    defaultMaxRepetitionsPerWeek: number;
    defaultAllowConsecutiveDays: boolean;
    coldDinnerFrequencyPerWeek: number;
  };
  /** The three hard-filter-with-fallback ceilings + same-lunch-dinner rule, straight from household_settings. */
  candidateFilters: HouseholdCandidateFilters;
  /** Household toggle for the pantry expiry/stock scoring bonuses. */
  preferPantryItems: boolean;
  slots: SlotRow[];
  profiles: ProfileContext[];
  mainItems: GeneratorItem[];
  snackItems: GeneratorItem[];
  /** Union of every candidate id → its per-portion nutrition, for locked-slot bookkeeping. */
  nutritionById: Map<string, RecipeNutrition>;
  /** Liked recipe/food ids per profile – used as a scoring bonus (replaces the old recipe-only favorites). */
  likedItemIdsByProfile: Map<string, Set<string>>;
  favoriteCuisines: Set<string>;
  expiringFoodIds: Set<string>;
  inStockFoodIds: Set<string>;
  /** How the household resolved each recipe's like/dislike conflict, if any (see householdRecipeOverrides). */
  recipeResolutions: Map<string, RecipeResolution>;
  /** Household-wide meal-variety bonus context – recipes served to ANY profile within the lookback window, plus the household's chosen tier. */
  mealVariety: { level: MealVarietyLevel; recentRecipeIds: Set<string> };
};

// ---------------------------------------------------------------------------
// Loading the generator context
// ---------------------------------------------------------------------------

async function loadGeneratorContext(db: AppDb, householdId: string, date: string): Promise<GeneratorContext> {
  const [settingsRow] = await db
    .select()
    .from(householdSettings)
    .where(and(eq(householdSettings.householdId, householdId), isNull(householdSettings.deletedAt)));

  const recipeResolutions = await getRecipeResolutions(db, householdId);

  const slots = await db
    .select()
    .from(mealSlotSettings)
    .where(
      and(
        eq(mealSlotSettings.householdId, householdId),
        eq(mealSlotSettings.enabled, true),
        isNull(mealSlotSettings.deletedAt),
      ),
    )
    .orderBy(asc(mealSlotSettings.sortOrder));

  const profileRows = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.householdId, householdId), isNull(profiles.deletedAt)))
    .orderBy(asc(profiles.createdAt));

  // Household-wide restrictions (set in the setup wizard) apply to every
  // profile's shared meals in addition to whatever that profile adds itself.
  const [householdRestrictionRows, householdAvoidRows] = await Promise.all([
    db
      .select()
      .from(householdRestrictions)
      .where(and(eq(householdRestrictions.householdId, householdId), isNull(householdRestrictions.deletedAt))),
    db
      .select()
      .from(householdAvoidedItems)
      .where(and(eq(householdAvoidedItems.householdId, householdId), isNull(householdAvoidedItems.deletedAt))),
  ]);
  const householdAllergens = householdRestrictionRows.filter((r) => r.kind === 'allergen').map((r) => r.value);
  const householdDiets = householdRestrictionRows.filter((r) => r.kind === 'diet').map((r) => r.value);
  const householdAvoidedRecipeIds = householdAvoidRows.filter((r) => r.itemType === 'recipe').map((r) => r.itemId);
  const householdAvoidedFoodIds = householdAvoidRows.filter((r) => r.itemType === 'food').map((r) => r.itemId);

  const profileContexts: ProfileContext[] = [];
  const likedItemIdsByProfile = new Map<string, Set<string>>();

  for (const profile of profileRows) {
    const [restrictionRows, avoidRows, ratingRows, slotPortionRows, [latestMetric]] = await Promise.all([
      db
        .select()
        .from(profileRestrictions)
        .where(and(eq(profileRestrictions.profileId, profile.id), isNull(profileRestrictions.deletedAt))),
      db
        .select()
        .from(profileAvoidedItems)
        .where(and(eq(profileAvoidedItems.profileId, profile.id), isNull(profileAvoidedItems.deletedAt))),
      db
        .select()
        .from(profileItemRatings)
        .where(and(eq(profileItemRatings.profileId, profile.id), isNull(profileItemRatings.deletedAt))),
      db
        .select()
        .from(profileSlotPortions)
        .where(and(eq(profileSlotPortions.profileId, profile.id), isNull(profileSlotPortions.deletedAt))),
      db
        .select()
        .from(bodyMetrics)
        .where(and(eq(bodyMetrics.profileId, profile.id), isNull(bodyMetrics.deletedAt)))
        .orderBy(desc(bodyMetrics.date), desc(bodyMetrics.createdAt))
        .limit(1),
    ]);

    likedItemIdsByProfile.set(profile.id, new Set(ratingRows.filter((r) => r.rating === 'like').map((r) => r.itemId)));
    const dislikedRecipeIds = ratingRows.filter((r) => r.rating === 'dislike' && r.itemType === 'recipe').map((r) => r.itemId);
    const dislikedFoodIds = ratingRows.filter((r) => r.rating === 'dislike' && r.itemType === 'food').map((r) => r.itemId);

    const slotOverrides = new Map<string, SlotPortionOverride>();
    for (const row of slotPortionRows) {
      slotOverrides.set(row.slotId, {
        calorieSharePercent: row.calorieSharePercent,
        proteinTargetG: row.proteinTargetG,
        fatTargetG: row.fatTargetG,
      });
    }

    const dailyTarget: MacroTotal | null = latestMetric
      ? (() => {
          // Reuses the exact same mapping the UI reads TDCI/macros through
          // (useProfileTargets → targetsForProfile), so the generator's
          // target can never drift from what Home/Settings display –
          // activity multiplier and macro overrides included.
          const targets = targetsForProfile(profile, latestMetric, settingsRow?.fiberMode ?? 'efsa_min', date)!;
          const workoutDays: number[] = profile.workoutDaysJson ? JSON.parse(profile.workoutDaysJson) : [];
          return applyWorkoutDayCycling(
            {
              kcal: targets.adjustedTdciKcal,
              proteinG: targets.macros.proteinG,
              carbsG: targets.macros.carbsG,
              fatG: targets.macros.fatG,
            },
            workoutDays,
            date,
          );
        })()
      : null;

    profileContexts.push({
      id: profile.id,
      sharesMainMeals: profile.sharesMainMeals,
      enabledSlotKeys: profile.enabledSlotKeysJson ? (JSON.parse(profile.enabledSlotKeysJson) as string[]) : null,
      restrictions: {
        allergens: [...new Set([...householdAllergens, ...restrictionRows.filter((r) => r.kind === 'allergen').map((r) => r.value)])],
        diets: [...new Set([...householdDiets, ...restrictionRows.filter((r) => r.kind === 'diet').map((r) => r.value)])],
        avoidedRecipeIds: [
          ...new Set([
            ...householdAvoidedRecipeIds,
            ...avoidRows.filter((r) => r.itemType === 'recipe').map((r) => r.itemId),
            ...dislikedRecipeIds,
          ]),
        ],
        avoidedFoodIds: [
          ...new Set([
            ...householdAvoidedFoodIds,
            ...avoidRows.filter((r) => r.itemType === 'food').map((r) => r.itemId),
            ...dislikedFoodIds,
          ]),
        ],
      },
      dailyTarget,
      slotOverrides,
    });
  }

  // --- recipes → generator candidates ---------------------------------
  // Note: joined multi-table selects don't resolve cleanly against the
  // union AppDb type, so ingredients and foods are fetched separately and
  // joined in JS (as every other repository in this union-typed codebase does).
  const [recipeRows, allIngredientRows, allFoodRows, foodAllergenRows] = await Promise.all([
    db.select().from(recipes).where(isNull(recipes.deletedAt)),
    db.select().from(recipeIngredients).where(isNull(recipeIngredients.deletedAt)),
    db.select().from(foods).where(isNull(foods.deletedAt)),
    db.select().from(foodRestrictions).where(isNull(foodRestrictions.deletedAt)),
  ]);

  const allergensByFood = new Map<string, string[]>();
  for (const row of foodAllergenRows) {
    const list = allergensByFood.get(row.foodId) ?? [];
    list.push(row.allergen);
    allergensByFood.set(row.foodId, list);
  }

  const foodById = new Map(allFoodRows.map((food) => [food.id, food]));
  type IngredientRow = { ingredient: (typeof allIngredientRows)[number]; food: (typeof allFoodRows)[number] };
  const ingredientsByRecipe = new Map<string, IngredientRow[]>();
  for (const ingredient of allIngredientRows) {
    const food = foodById.get(ingredient.foodId);
    if (!food) continue; // ingredient pointing at a deleted/missing food – skip defensively
    const list = ingredientsByRecipe.get(ingredient.recipeId) ?? [];
    list.push({ ingredient, food });
    ingredientsByRecipe.set(ingredient.recipeId, list);
  }

  const mainItems: GeneratorItem[] = [];
  const snackItems: GeneratorItem[] = [];
  const nutritionById = new Map<string, RecipeNutrition>();

  for (const recipe of recipeRows) {
    // V1 scope: sides are a library tag only – the generator does not yet
    // auto-attach a side to a main dish (see the approved plan's algorithm note).
    if (recipe.isSide) continue;
    const rows = ingredientsByRecipe.get(recipe.id) ?? [];
    if (rows.length === 0) continue;

    const nutrition = computeRecipeNutrition(
      rows.map((row) => ({
        amount: row.ingredient.amount,
        food: {
          baseUnit: row.food.baseUnit,
          gramsPerPiece: row.food.gramsPerPiece,
          kcalPer100: row.food.kcalPer100,
          proteinPer100: row.food.proteinPer100,
          carbsPer100: row.food.carbsPer100,
          fatPer100: row.food.fatPer100,
          fiberPer100: row.food.fiberPer100,
        },
      })),
      recipe.servingsBase,
    );
    nutritionById.set(recipe.id, nutrition);

    const candidate: RecipeCandidate = {
      id: recipe.id,
      category: recipe.category,
      isSide: recipe.isSide,
      budget: recipe.budget,
      nutritionPerPortion: nutrition,
      cuisine: recipe.cuisine,
      ingredients: rows.map((row) => ({
        foodId: row.food.id,
        allergens: allergensByFood.get(row.food.id) ?? [],
        dietFlags: row.food.dietFlagsJson ? (JSON.parse(row.food.dietFlagsJson) as string[]) : [],
      })),
      maxRepetitionsPerWeek: recipe.maxRepetitionsPerWeek,
      allowConsecutiveDays: recipe.allowConsecutiveDays,
      canServeCold: recipe.canServeCold,
      difficulty: recipe.difficulty,
      prepTimeMinutes: recipe.prepTimeMinutes,
    };

    const item: GeneratorItem = { itemType: 'recipe', candidate };
    if (recipe.category === 'snack') snackItems.push(item);
    else mainItems.push(item);
  }

  // --- standalone snack-suitable foods ---------------------------------
  const snackFoodRows = await db
    .select()
    .from(foods)
    .where(and(eq(foods.snackSuitable, true), isNull(foods.deletedAt)));

  for (const food of snackFoodRows) {
    // Approximation: a food's per-100 values stand in for "one snack portion"
    // when it isn't wrapped in a recipe. Good enough for the closest-match
    // heuristic; a future phase could add explicit default serving sizes.
    const nutrition: RecipeNutrition = {
      kcal: food.kcalPer100,
      proteinG: food.proteinPer100,
      carbsG: food.carbsPer100,
      fatG: food.fatPer100,
      fiberG: food.fiberPer100,
    };
    nutritionById.set(food.id, nutrition);

    const candidate: RecipeCandidate = {
      id: food.id,
      category: 'snack',
      isSide: false,
      budget: food.budget,
      snackSuitable: true,
      nutritionPerPortion: nutrition,
      ingredients: [
        {
          foodId: food.id,
          allergens: allergensByFood.get(food.id) ?? [],
          dietFlags: food.dietFlagsJson ? (JSON.parse(food.dietFlagsJson) as string[]) : [],
        },
      ],
      maxRepetitionsPerWeek: null,
      allowConsecutiveDays: null,
      canServeCold: food.canServeCold,
    };
    snackItems.push({ itemType: 'food', candidate });
  }

  // --- pantry items expiring soon ---------------------------------------
  const pantryRows = await db
    .select()
    .from(pantryItems)
    .where(and(eq(pantryItems.householdId, householdId), isNull(pantryItems.deletedAt)));
  const soon = addDays(todayIsoDate(), PANTRY_EXPIRY_WINDOW_DAYS);
  const expiringFoodIds = new Set(
    pantryRows.filter((row) => row.expiresAt !== null && row.expiresAt <= soon).map((row) => row.foodId),
  );
  const inStockFoodIds = new Set(pantryRows.filter((row) => row.quantity > 0).map((row) => row.foodId));

  const favoriteCuisines = new Set<string>(
    settingsRow?.favoriteCuisinesJson ? (JSON.parse(settingsRow.favoriteCuisinesJson) as string[]) : [],
  );

  const mealVarietyLevel = settingsRow?.mealVarietyLevel ?? 'medium';
  const recentRecipeIds =
    mealVarietyLevel === 'low' ? new Set<string>() : await loadRecentRecipeIdsForHousehold(db, householdId, date);

  return {
    settings: {
      defaultMaxRepetitionsPerWeek: settingsRow?.defaultMaxRepetitionsPerWeek ?? 2,
      defaultAllowConsecutiveDays: settingsRow?.defaultAllowConsecutiveDays ?? false,
      coldDinnerFrequencyPerWeek: settingsRow?.coldDinnerFrequencyPerWeek ?? 0,
    },
    candidateFilters: {
      cookingExperienceLevel: settingsRow?.cookingExperienceLevel ?? 'hard',
      cookingTimeLimitMinutes: settingsRow?.cookingTimeLimitMinutes ?? null,
      budgetLevel: settingsRow?.budgetLevel ?? 'high',
      allowSameLunchDinner: settingsRow?.allowSameLunchDinner ?? false,
    },
    preferPantryItems: settingsRow?.preferPantryItems ?? true,
    slots,
    profiles: profileContexts,
    favoriteCuisines,
    mainItems,
    snackItems,
    nutritionById,
    likedItemIdsByProfile,
    expiringFoodIds,
    inStockFoodIds,
    recipeResolutions,
    mealVariety: { level: mealVarietyLevel, recentRecipeIds },
  };
}

function unionLiked(subset: ProfileContext[], ctx: GeneratorContext): Set<string> {
  const result = new Set<string>();
  for (const profile of subset) {
    for (const id of ctx.likedItemIdsByProfile.get(profile.id) ?? []) result.add(id);
  }
  return result;
}

function rareRecipeIds(ctx: GeneratorContext): Set<string> {
  const result = new Set<string>();
  for (const [recipeId, resolution] of ctx.recipeResolutions) {
    if (resolution === 'rare') result.add(recipeId);
  }
  return result;
}

/**
 * A shared main slot serves several profiles' individual targets with one
 * recipe pick, so there's no single "the" macro-fit target – this averages
 * each sharing profile's protein/fat density (g per kcal, not raw grams, so
 * profiles of different sizes weigh equally) into one synthetic target at
 * kcal=1, which `macroFitScore` reads as a ratio anyway.
 */
function averageMacroFitTarget(
  profiles: ProfileContext[],
  slot: SlotRow,
): { kcal: number; proteinG: number; fatG: number } | undefined {
  const targets = profiles
    .filter((p) => p.dailyTarget !== null)
    .map((p) => resolveMainSlotTarget(p.dailyTarget!, slot.calorieShare, p.slotOverrides.get(slot.id)));
  if (targets.length === 0) return undefined;

  const avgProteinRatio = targets.reduce((sum, t) => sum + (t.kcal > 0 ? t.proteinG / t.kcal : 0), 0) / targets.length;
  const avgFatRatio = targets.reduce((sum, t) => sum + (t.kcal > 0 ? t.fatG / t.kcal : 0), 0) / targets.length;
  return { kcal: 1, proteinG: avgProteinRatio, fatG: avgFatRatio };
}

function addConsumed(map: Map<string, MacroTotal>, profileId: string, nutrition: RecipeNutrition, multiplier: number) {
  const current = map.get(profileId) ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  map.set(profileId, {
    kcal: current.kcal + nutrition.kcal * multiplier,
    proteinG: current.proteinG + nutrition.proteinG * multiplier,
    carbsG: current.carbsG + nutrition.carbsG * multiplier,
    fatG: current.fatG + nutrition.fatG * multiplier,
  });
}

// ---------------------------------------------------------------------------
// Locking & history helpers
// ---------------------------------------------------------------------------

/** `${slotKey}::${profileId ?? 'shared'}` – identifies one slot's assignment for one track. */
function slotTrackKey(slotKey: string, profileId: string | null): string {
  return `${slotKey}::${profileId ?? 'shared'}`;
}

async function loadMealsForDate(db: AppDb, householdId: string, date: string) {
  return db
    .select()
    .from(plannedMeals)
    .where(and(eq(plannedMeals.householdId, householdId), eq(plannedMeals.date, date), isNull(plannedMeals.deletedAt)));
}

/** A slot/track is locked once any of its portions has been marked eaten – never touched by regeneration. */
async function loadLockedTrackKeys(db: AppDb, householdId: string, date: string): Promise<Set<string>> {
  const meals = await loadMealsForDate(db, householdId, date);
  if (meals.length === 0) return new Set();

  const portions = await db
    .select()
    .from(plannedMealPortions)
    .where(
      and(
        inArray(
          plannedMealPortions.plannedMealId,
          meals.map((m) => m.id),
        ),
        isNull(plannedMealPortions.deletedAt),
      ),
    );

  const eatenMealIds = new Set(portions.filter((p) => p.status === 'eaten').map((p) => p.plannedMealId));
  const locked = new Set<string>();
  for (const meal of meals) {
    if (eatenMealIds.has(meal.id)) locked.add(slotTrackKey(meal.slotKey, meal.profileId));
  }
  return locked;
}

async function clearUnlockedMealsForDate(
  db: AppDb,
  householdId: string,
  date: string,
  lockedKeys: Set<string>,
): Promise<void> {
  const now = nowIso();
  const meals = await loadMealsForDate(db, householdId, date);
  for (const meal of meals) {
    if (lockedKeys.has(slotTrackKey(meal.slotKey, meal.profileId))) continue;
    await db
      .update(plannedMealPortions)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(plannedMealPortions.plannedMealId, meal.id), isNull(plannedMealPortions.deletedAt)));
    await db.update(plannedMeals).set({ deletedAt: now, updatedAt: now }).where(eq(plannedMeals.id, meal.id));
  }
}

/** How many times each recipe already appears in the week (used by the repetition limit). */
async function loadWeekRecipeCounts(db: AppDb, householdId: string, mondayIso: string): Promise<Map<string, number>> {
  const dates = weekDates(mondayIso);
  const rows = await db
    .select()
    .from(plannedMeals)
    .where(
      and(
        eq(plannedMeals.householdId, householdId),
        inArray(plannedMeals.date, dates),
        eq(plannedMeals.itemType, 'recipe'),
        isNull(plannedMeals.deletedAt),
      ),
    );
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.itemId, (counts.get(row.itemId) ?? 0) + 1);
  return counts;
}

async function loadDayRecipeIds(db: AppDb, householdId: string, date: string): Promise<Set<string>> {
  const rows = await db
    .select()
    .from(plannedMeals)
    .where(
      and(
        eq(plannedMeals.householdId, householdId),
        eq(plannedMeals.date, date),
        eq(plannedMeals.itemType, 'recipe'),
        isNull(plannedMeals.deletedAt),
      ),
    );
  return new Set(rows.map((r) => r.itemId));
}

/** Skipped entirely when mealVarietyLevel is 'low' (bonus is 0 either way) – keeps the cost at zero for households not using variety scoring. */
async function loadRecentRecipeIdsForHousehold(
  db: AppDb,
  householdId: string,
  beforeDate: string,
): Promise<Set<string>> {
  const startDate = addDays(beforeDate, -NOVELTY_LOOKBACK_DAYS);
  const meals = await db
    .select()
    .from(plannedMeals)
    .where(
      and(
        eq(plannedMeals.householdId, householdId),
        eq(plannedMeals.itemType, 'recipe'),
        gte(plannedMeals.date, startDate),
        lt(plannedMeals.date, beforeDate),
        isNull(plannedMeals.deletedAt),
      ),
    );
  return new Set(meals.map((m) => m.itemId));
}

/** Adds an already-locked meal's nutrition contribution to the running daily totals (for snack remainder maths). */
async function accumulateLockedMeal(
  db: AppDb,
  householdId: string,
  date: string,
  slotKey: string,
  profileId: string | null,
  ctx: GeneratorContext,
  consumedSoFar: Map<string, MacroTotal>,
): Promise<void> {
  const meals = await loadMealsForDate(db, householdId, date);
  const meal = meals.find((m) => m.slotKey === slotKey && m.profileId === profileId);
  if (!meal) return;
  const nutrition = ctx.nutritionById.get(meal.itemId);
  if (!nutrition) return;
  const portions = await db
    .select()
    .from(plannedMealPortions)
    .where(and(eq(plannedMealPortions.plannedMealId, meal.id), isNull(plannedMealPortions.deletedAt)));
  for (const portion of portions) {
    addConsumed(consumedSoFar, portion.profileId, nutrition, portion.multiplier);
  }
}

async function insertPlannedMeal(
  db: AppDb,
  householdId: string,
  date: string,
  slotKey: string,
  profileId: string | null,
  itemType: 'recipe' | 'food',
  itemId: string,
  portions: { profileId: string; multiplier: number }[],
): Promise<void> {
  const now = nowIso();
  const mealId = newId();
  await db.insert(plannedMeals).values({
    id: mealId,
    createdAt: now,
    updatedAt: now,
    householdId,
    date,
    slotKey,
    profileId,
    itemType,
    itemId,
  });
  if (portions.length > 0) {
    await db.insert(plannedMealPortions).values(
      portions.map((p) => ({
        id: newId(),
        createdAt: now,
        updatedAt: now,
        plannedMealId: mealId,
        profileId: p.profileId,
        multiplier: p.multiplier,
        status: 'planned' as const,
      })),
    );
  }
}

// ---------------------------------------------------------------------------
// Day generation
// ---------------------------------------------------------------------------

/**
 * Picks and inserts one profile's own main-meal row for a slot (as opposed
 * to the shared branch's single row covering several profiles at once).
 * Used both for profiles with `sharesMainMeals: false` and, via `excludeIds`,
 * to carve a disliking profile out of a "serve_separately"-resolved shared
 * pick (see the shared branch in `generateDay`/`regenerateSlot`).
 */
async function generateIndividualMainMeal(
  db: AppDb,
  householdId: string,
  date: string,
  slot: SlotRow,
  profile: ProfileContext,
  candidates: GeneratorItem[],
  repetitionCtx: RepetitionContext,
  ctx: GeneratorContext,
  consumedSoFar: Map<string, MacroTotal>,
  rng: Rng,
  excludeIds: Set<string> = new Set(),
  requireColdEligible: boolean = false,
  /** Mutated in place with this profile's lunch/dinner pick, and read for the sibling slot's pick – see `generateDay`'s lunchDinnerRecipeIdsByTrack. */
  lunchDinnerIdsForProfile: Set<string> = new Set(),
): Promise<RepetitionContext> {
  if (!profile.dailyTarget) return repetitionCtx;
  const pool = excludeIds.size > 0 ? candidates.filter((item) => !excludeIds.has(item.candidate.id)) : candidates;
  const picked = pickMealForSlot(
    pool,
    [profile.restrictions],
    repetitionCtx,
    {
      likedItemIds: ctx.likedItemIdsByProfile.get(profile.id) ?? new Set(),
      favoriteCuisines: ctx.favoriteCuisines,
      expiringFoodIds: ctx.expiringFoodIds,
      inStockFoodIds: ctx.inStockFoodIds,
      rareRecipeIds: rareRecipeIds(ctx),
      mealVariety: ctx.mealVariety,
      preferPantryItems: ctx.preferPantryItems,
      macroFitTarget: averageMacroFitTarget([profile], slot),
    },
    rng,
    [profile.dailyTarget.kcal],
    DEFAULT_SHORTLIST_SIZE,
    requireColdEligible,
    ctx.candidateFilters,
    slot.slotKey,
    lunchDinnerIdsForProfile,
  );
  if (!picked) return repetitionCtx;
  const multiplier = scalingMultiplier(
    profile.dailyTarget.kcal * resolveSlotCalorieShare(slot.calorieShare, profile.slotOverrides.get(slot.id)),
    picked.candidate.nutritionPerPortion.kcal,
  );
  await insertPlannedMeal(db, householdId, date, slot.slotKey, profile.id, picked.itemType, picked.candidate.id, [
    { profileId: profile.id, multiplier },
  ]);
  addConsumed(consumedSoFar, profile.id, picked.candidate.nutritionPerPortion, multiplier);
  if (slot.slotKey === 'lunch' || slot.slotKey === 'dinner') lunchDinnerIdsForProfile.add(picked.candidate.id);
  return recordPick(repetitionCtx, picked.candidate.id);
}

async function generateDay(db: AppDb, householdId: string, date: string, rng: Rng): Promise<void> {
  if (date < todayIsoDate()) return; // past days are read-only, per the approved plan

  const ctx = await loadGeneratorContext(db, householdId, date);
  const lockedKeys = await loadLockedTrackKeys(db, householdId, date);
  await clearUnlockedMealsForDate(db, householdId, date, lockedKeys);

  const weekStart = startOfWeek(date);
  let repetitionCtx: RepetitionContext = {
    weekCounts: await loadWeekRecipeCounts(db, householdId, weekStart),
    previousDayRecipeIds: await loadDayRecipeIds(db, householdId, previousDay(date)),
    household: ctx.settings,
  };

  const consumedSoFar = new Map<string, MacroTotal>();
  const sharedProfiles = ctx.profiles.filter((p) => p.sharesMainMeals);
  const independentProfiles = ctx.profiles.filter((p) => !p.sharesMainMeals);
  // Recipe ids already used today in a lunch/dinner slot, per track ('shared'
  // or a profile id) – feeds the same-lunch-dinner rule. A track has exactly
  // one lunch and one dinner per day, so by the time the second of the pair
  // is generated this map holds only the first's pick, never the current slot's.
  const lunchDinnerRecipeIdsByTrack = new Map<string, Set<string>>();
  const getOrCreateTrackSet = (trackKey: string): Set<string> => {
    let set = lunchDinnerRecipeIdsByTrack.get(trackKey);
    if (!set) {
      set = new Set<string>();
      lunchDinnerRecipeIdsByTrack.set(trackKey, set);
    }
    return set;
  };
  const recordLunchDinnerPick = (trackKey: string, slotKey: string, recipeId: string) => {
    if (slotKey !== 'lunch' && slotKey !== 'dinner') return;
    getOrCreateTrackSet(trackKey).add(recipeId);
  };

  for (const slot of ctx.slots.filter((s) => s.kind === 'main')) {
    const category = slot.slotKey === 'breakfast' ? 'breakfast' : 'lunch_dinner';
    const candidates = ctx.mainItems.filter((item) => item.candidate.category === category);
    const sharedProfilesForSlot = sharedProfiles.filter((p) => isSlotEnabledForProfile(p, slot.slotKey));
    const coldToday =
      slot.slotKey === 'dinner' && isColdDinnerDay(date, householdId, ctx.settings.coldDinnerFrequencyPerWeek);

    if (slot.sharing === 'shared' && sharedProfilesForSlot.length > 0) {
      const key = slotTrackKey(slot.slotKey, null);
      if (lockedKeys.has(key)) {
        await accumulateLockedMeal(db, householdId, date, slot.slotKey, null, ctx, consumedSoFar);
      } else {
        const picked = pickMealForSlot(
          candidates,
          relaxAvoidedRecipesForResolutions(
            sharedProfilesForSlot.map((p) => p.restrictions),
            ctx.recipeResolutions,
          ),
          repetitionCtx,
          {
            likedItemIds: unionLiked(sharedProfilesForSlot, ctx),
            favoriteCuisines: ctx.favoriteCuisines,
            expiringFoodIds: ctx.expiringFoodIds,
            inStockFoodIds: ctx.inStockFoodIds,
            rareRecipeIds: rareRecipeIds(ctx),
            mealVariety: ctx.mealVariety,
            preferPantryItems: ctx.preferPantryItems,
            macroFitTarget: averageMacroFitTarget(sharedProfilesForSlot, slot),
          },
          rng,
          sharedProfilesForSlot.filter((p) => p.dailyTarget !== null).map((p) => p.dailyTarget!.kcal),
          DEFAULT_SHORTLIST_SIZE,
          coldToday,
          ctx.candidateFilters,
          slot.slotKey,
          lunchDinnerRecipeIdsByTrack.get('shared') ?? new Set(),
        );
        if (picked) {
          // A "serve_separately" resolution carves the profiles who dislike this
          // recipe out of the shared row into their own individual pick, so the
          // rest of the household still gets it while they get something else.
          const separatelyServed =
            ctx.recipeResolutions.get(picked.candidate.id) === 'serve_separately'
              ? sharedProfilesForSlot.filter(
                  (p) =>
                    p.restrictions.avoidedRecipeIds.includes(picked.candidate.id) &&
                    !lockedKeys.has(slotTrackKey(slot.slotKey, p.id)),
                )
              : [];
          const separatelyServedIds = new Set(separatelyServed.map((p) => p.id));

          const portions = sharedProfilesForSlot
            .filter((p) => p.dailyTarget !== null && !separatelyServedIds.has(p.id))
            .map((p) => ({
              profileId: p.id,
              multiplier: scalingMultiplier(
                p.dailyTarget!.kcal * resolveSlotCalorieShare(slot.calorieShare, p.slotOverrides.get(slot.id)),
                picked.candidate.nutritionPerPortion.kcal,
              ),
            }));
          if (portions.length > 0) {
            await insertPlannedMeal(db, householdId, date, slot.slotKey, null, picked.itemType, picked.candidate.id, portions);
            repetitionCtx = recordPick(repetitionCtx, picked.candidate.id);
            recordLunchDinnerPick('shared', slot.slotKey, picked.candidate.id);
            for (const portion of portions) {
              addConsumed(consumedSoFar, portion.profileId, picked.candidate.nutritionPerPortion, portion.multiplier);
            }
          }

          for (const profile of separatelyServed) {
            repetitionCtx = await generateIndividualMainMeal(
              db,
              householdId,
              date,
              slot,
              profile,
              candidates,
              repetitionCtx,
              ctx,
              consumedSoFar,
              rng,
              new Set([picked.candidate.id]),
              coldToday,
              getOrCreateTrackSet(profile.id),
            );
          }
        }
      }
    }

    for (const profile of independentProfiles) {
      if (!profile.dailyTarget || !isSlotEnabledForProfile(profile, slot.slotKey)) continue;
      const key = slotTrackKey(slot.slotKey, profile.id);
      if (lockedKeys.has(key)) {
        await accumulateLockedMeal(db, householdId, date, slot.slotKey, profile.id, ctx, consumedSoFar);
        continue;
      }
      repetitionCtx = await generateIndividualMainMeal(
        db,
        householdId,
        date,
        slot,
        profile,
        candidates,
        repetitionCtx,
        ctx,
        consumedSoFar,
        rng,
        new Set(),
        coldToday,
        getOrCreateTrackSet(profile.id),
      );
    }
  }

  for (const slot of ctx.slots.filter((s) => s.kind === 'snack')) {
    for (const profile of ctx.profiles) {
      if (!profile.dailyTarget || !isSlotEnabledForProfile(profile, slot.slotKey)) continue;
      const key = slotTrackKey(slot.slotKey, profile.id);
      if (lockedKeys.has(key)) {
        await accumulateLockedMeal(db, householdId, date, slot.slotKey, profile.id, ctx, consumedSoFar);
        continue;
      }
      const consumed = consumedSoFar.get(profile.id) ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
      const remaining = {
        kcal: profile.dailyTarget.kcal - consumed.kcal,
        proteinG: profile.dailyTarget.proteinG - consumed.proteinG,
        carbsG: profile.dailyTarget.carbsG - consumed.carbsG,
        fatG: profile.dailyTarget.fatG - consumed.fatG,
      };
      const target = resolveSnackTarget(remaining, profile.dailyTarget.kcal, profile.slotOverrides.get(slot.id));
      const picked = pickSnackForSlot(ctx.snackItems, profile.restrictions, repetitionCtx, target, ctx.candidateFilters);
      if (!picked) continue;
      // Scaled (not fixed at 1x) so the day's planned-vs-target accuracy holds
      // to within the approved ±100 kcal even when the closest DB match isn't exact.
      const multiplier = scalingMultiplier(target.kcal, picked.candidate.nutritionPerPortion.kcal);
      await insertPlannedMeal(db, householdId, date, slot.slotKey, profile.id, picked.itemType, picked.candidate.id, [
        { profileId: profile.id, multiplier },
      ]);
      repetitionCtx = recordPick(repetitionCtx, picked.candidate.id);
      addConsumed(consumedSoFar, profile.id, picked.candidate.nutritionPerPortion, multiplier);
    }
  }
}

/**
 * Generates (or regenerates) every date in the week containing `weekStartDate`.
 * Past days are structurally read-only and locked (eaten) slots are always
 * preserved, so this same entry point covers first-time weekly generation,
 * "regenerate the rest of the week", and a same-day re-run after marking a
 * meal eaten.
 */
export async function generateWeek(
  db: AppDb,
  householdId: string,
  weekStartDate: string,
  rngSeed?: number,
): Promise<void> {
  const rng = createSeededRng(rngSeed ?? Date.now());
  for (const date of weekDates(startOfWeek(weekStartDate))) {
    await generateDay(db, householdId, date, rng);
  }
}

export async function regenerateDay(
  db: AppDb,
  householdId: string,
  date: string,
  rngSeed?: number,
): Promise<void> {
  await generateDay(db, householdId, date, createSeededRng(rngSeed ?? Date.now()));
}

// ---------------------------------------------------------------------------
// Swap & portion status
// ---------------------------------------------------------------------------

/** Marking a portion eaten deducts its ingredients from pantry stock; un-marking it restocks them. */
export async function setPortionStatus(
  db: AppDb,
  portionId: string,
  status: 'planned' | 'eaten' | 'skipped',
): Promise<void> {
  const [portion] = await db.select().from(plannedMealPortions).where(eq(plannedMealPortions.id, portionId));
  if (!portion) return;
  const previousStatus = portion.status;

  await db
    .update(plannedMealPortions)
    .set({ status, updatedAt: nowIso() })
    .where(eq(plannedMealPortions.id, portionId));

  const becameEaten = status === 'eaten' && previousStatus !== 'eaten';
  const wasEaten = previousStatus === 'eaten' && status !== 'eaten';
  if (!becameEaten && !wasEaten) return;

  const [meal] = await db.select().from(plannedMeals).where(eq(plannedMeals.id, portion.plannedMealId));
  if (!meal) return;

  const needs = await mealIngredientNeeds(db, meal, portion.multiplier);
  if (becameEaten) {
    await deductPantryForConsumption(db, meal.householdId, needs);
  } else {
    await restockPantryForConsumption(db, meal.householdId, needs);
  }
}

/** Manually overrides one portion's scaling multiplier ("adjust servings"). Refuses once the portion is eaten, same guard as every other slot mutator. */
export async function updatePortionMultiplier(db: AppDb, portionId: string, multiplier: number): Promise<boolean> {
  const [portion] = await db.select().from(plannedMealPortions).where(eq(plannedMealPortions.id, portionId));
  if (!portion || portion.status === 'eaten') return false;
  await db
    .update(plannedMealPortions)
    .set({ multiplier, updatedAt: nowIso() })
    .where(eq(plannedMealPortions.id, portionId));
  return true;
}

/** Regenerates a single slot/track, excluding its current recipe from the candidate pool. Locked (eaten) slots are left untouched. */
export async function regenerateSlot(
  db: AppDb,
  householdId: string,
  date: string,
  slotKey: string,
  profileId: string | null,
  rngSeed?: number,
): Promise<void> {
  if (date < todayIsoDate()) return;

  const meals = await loadMealsForDate(db, householdId, date);
  const meal = meals.find((m) => m.slotKey === slotKey && m.profileId === profileId);
  if (!meal) return;

  const portions = await db
    .select()
    .from(plannedMealPortions)
    .where(and(eq(plannedMealPortions.plannedMealId, meal.id), isNull(plannedMealPortions.deletedAt)));
  if (portions.some((p) => p.status === 'eaten')) return;

  const ctx = await loadGeneratorContext(db, householdId, date);
  const slot = ctx.slots.find((s) => s.slotKey === slotKey);
  if (!slot) return;

  const weekStart = startOfWeek(date);
  const repetitionCtx: RepetitionContext = {
    weekCounts: await loadWeekRecipeCounts(db, householdId, weekStart),
    previousDayRecipeIds: await loadDayRecipeIds(db, householdId, previousDay(date)),
    household: ctx.settings,
  };

  const relevantProfiles =
    profileId !== null
      ? ctx.profiles.filter((p) => p.id === profileId)
      : ctx.profiles.filter((p) => p.sharesMainMeals && isSlotEnabledForProfile(p, slot.slotKey));
  if (relevantProfiles.length === 0) return;

  let picked: GeneratorItem | null;
  let snackTarget: MacroTotal | null = null;
  if (slot.kind === 'snack') {
    const profile = relevantProfiles[0];
    if (!profile.dailyTarget) return;
    const consumed = await computeConsumedExcluding(db, householdId, date, profile.id, meal.id, ctx);
    const remaining = {
      kcal: profile.dailyTarget.kcal - consumed.kcal,
      proteinG: profile.dailyTarget.proteinG - consumed.proteinG,
      carbsG: profile.dailyTarget.carbsG - consumed.carbsG,
      fatG: profile.dailyTarget.fatG - consumed.fatG,
    };
    snackTarget = resolveSnackTarget(remaining, profile.dailyTarget.kcal, profile.slotOverrides.get(slot.id));
    const pool = ctx.snackItems.filter((item) => item.candidate.id !== meal.itemId);
    picked = pickSnackForSlot(pool, profile.restrictions, repetitionCtx, snackTarget, ctx.candidateFilters);
  } else {
    const category = slot.slotKey === 'breakfast' ? 'breakfast' : 'lunch_dinner';
    const pool = ctx.mainItems.filter(
      (item) => item.candidate.category === category && item.candidate.id !== meal.itemId,
    );
    // The sibling lunch/dinner slot's already-planned recipe for this same
    // track/date (if any) – feeds the same-lunch-dinner rule the same way
    // generateDay's lunchDinnerRecipeIdsByTrack does, just read directly
    // since regenerateSlot only ever touches one slot at a time.
    const siblingSlotKey = slot.slotKey === 'lunch' ? 'dinner' : slot.slotKey === 'dinner' ? 'lunch' : null;
    const siblingMeal = siblingSlotKey
      ? meals.find((m) => m.slotKey === siblingSlotKey && m.profileId === profileId && m.itemType === 'recipe')
      : undefined;
    const usedLunchDinnerIdsToday = siblingMeal ? new Set([siblingMeal.itemId]) : new Set<string>();
    // Manual single-slot swap: unlike generateDay, this always keeps the
    // whole relevantProfiles group on one row, even for a "serve_separately"
    // pick – splitting a swap into two rows is out of scope for V1 (see the
    // approved plan's phase L notes).
    picked = pickMealForSlot(
      pool,
      relaxAvoidedRecipesForResolutions(relevantProfiles.map((p) => p.restrictions), ctx.recipeResolutions),
      repetitionCtx,
      {
        likedItemIds: unionLiked(relevantProfiles, ctx),
        favoriteCuisines: ctx.favoriteCuisines,
        expiringFoodIds: ctx.expiringFoodIds,
        inStockFoodIds: ctx.inStockFoodIds,
        rareRecipeIds: rareRecipeIds(ctx),
        mealVariety: ctx.mealVariety,
        preferPantryItems: ctx.preferPantryItems,
        macroFitTarget: averageMacroFitTarget(relevantProfiles, slot),
      },
      createSeededRng(rngSeed ?? Date.now()),
      relevantProfiles.filter((p) => p.dailyTarget !== null).map((p) => p.dailyTarget!.kcal),
      DEFAULT_SHORTLIST_SIZE,
      slot.slotKey === 'dinner' && isColdDinnerDay(date, householdId, ctx.settings.coldDinnerFrequencyPerWeek),
      ctx.candidateFilters,
      slot.slotKey,
      usedLunchDinnerIdsToday,
    );
  }
  if (!picked) return;

  const now = nowIso();
  await db
    .update(plannedMealPortions)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(plannedMealPortions.plannedMealId, meal.id), isNull(plannedMealPortions.deletedAt)));
  await db
    .update(plannedMeals)
    .set({ itemType: picked.itemType, itemId: picked.candidate.id, updatedAt: now })
    .where(eq(plannedMeals.id, meal.id));

  const newPortions =
    slot.kind === 'snack'
      ? [
          {
            profileId: relevantProfiles[0].id,
            multiplier: scalingMultiplier(snackTarget!.kcal, picked.candidate.nutritionPerPortion.kcal),
          },
        ]
      : relevantProfiles
          .filter((p) => p.dailyTarget !== null)
          .map((p) => ({
            profileId: p.id,
            multiplier: scalingMultiplier(
              p.dailyTarget!.kcal * resolveSlotCalorieShare(slot.calorieShare, p.slotOverrides.get(slot.id)),
              picked!.candidate.nutritionPerPortion.kcal,
            ),
          }));

  await db.insert(plannedMealPortions).values(
    newPortions.map((p) => ({
      id: newId(),
      createdAt: now,
      updatedAt: now,
      plannedMealId: meal.id,
      profileId: p.profileId,
      multiplier: p.multiplier,
      status: 'planned' as const,
    })),
  );
}

/**
 * Loads a recipe's or standalone food's allergens/diet-flags directly from
 * its own rows – independent of `loadGeneratorContext`'s candidate lists, so
 * it also covers foods that aren't `snackSuitable` (the "show everything"
 * filter in the manual pickers can surface those too).
 */
async function loadItemTags(db: AppDb, itemType: 'recipe' | 'food', itemId: string): Promise<DerivedRecipeTags> {
  if (itemType === 'food') {
    const [[food], restrictionRows] = await Promise.all([
      db.select().from(foods).where(eq(foods.id, itemId)),
      db.select().from(foodRestrictions).where(and(eq(foodRestrictions.foodId, itemId), isNull(foodRestrictions.deletedAt))),
    ]);
    return {
      allergens: [...new Set(restrictionRows.map((r) => r.allergen))],
      dietFlags: food?.dietFlagsJson ? (JSON.parse(food.dietFlagsJson) as string[]) : [],
    };
  }

  const ingredientRows = await db
    .select()
    .from(recipeIngredients)
    .where(and(eq(recipeIngredients.recipeId, itemId), isNull(recipeIngredients.deletedAt)));
  const foodIds = ingredientRows.map((row) => row.foodId);
  if (foodIds.length === 0) return { allergens: [], dietFlags: [] };

  const [foodRows, restrictionRows] = await Promise.all([
    db.select().from(foods).where(inArray(foods.id, foodIds)),
    db.select().from(foodRestrictions).where(and(inArray(foodRestrictions.foodId, foodIds), isNull(foodRestrictions.deletedAt))),
  ]);
  const allergensByFood = new Map<string, string[]>();
  for (const row of restrictionRows) {
    const list = allergensByFood.get(row.foodId) ?? [];
    list.push(row.allergen);
    allergensByFood.set(row.foodId, list);
  }
  const foodById = new Map(foodRows.map((food) => [food.id, food]));
  const ingredientTags: IngredientFoodTags[] = [];
  for (const row of ingredientRows) {
    const food = foodById.get(row.foodId);
    if (!food) continue;
    ingredientTags.push({
      foodId: food.id,
      allergens: allergensByFood.get(food.id) ?? [],
      dietFlags: food.dietFlagsJson ? (JSON.parse(food.dietFlagsJson) as string[]) : [],
    });
  }
  return deriveRecipeTags(ingredientTags);
}

/** Household-wide restrictions unioned with one profile's own – the same rule `loadGeneratorContext` applies per profile, but for a single profile without loading the whole recipe/food catalog. */
async function loadCombinedRestrictions(db: AppDb, householdId: string, profileId: string): Promise<DietRestrictions> {
  const [householdRestrictionRows, householdAvoidRows, restrictionRows, avoidRows] = await Promise.all([
    db
      .select()
      .from(householdRestrictions)
      .where(and(eq(householdRestrictions.householdId, householdId), isNull(householdRestrictions.deletedAt))),
    db
      .select()
      .from(householdAvoidedItems)
      .where(and(eq(householdAvoidedItems.householdId, householdId), isNull(householdAvoidedItems.deletedAt))),
    db
      .select()
      .from(profileRestrictions)
      .where(and(eq(profileRestrictions.profileId, profileId), isNull(profileRestrictions.deletedAt))),
    db
      .select()
      .from(profileAvoidedItems)
      .where(and(eq(profileAvoidedItems.profileId, profileId), isNull(profileAvoidedItems.deletedAt))),
  ]);

  return {
    allergens: [
      ...new Set([
        ...householdRestrictionRows.filter((r) => r.kind === 'allergen').map((r) => r.value),
        ...restrictionRows.filter((r) => r.kind === 'allergen').map((r) => r.value),
      ]),
    ],
    diets: [
      ...new Set([
        ...householdRestrictionRows.filter((r) => r.kind === 'diet').map((r) => r.value),
        ...restrictionRows.filter((r) => r.kind === 'diet').map((r) => r.value),
      ]),
    ],
    avoidedRecipeIds: [
      ...new Set([
        ...householdAvoidRows.filter((r) => r.itemType === 'recipe').map((r) => r.itemId),
        ...avoidRows.filter((r) => r.itemType === 'recipe').map((r) => r.itemId),
      ]),
    ],
    avoidedFoodIds: [
      ...new Set([
        ...householdAvoidRows.filter((r) => r.itemType === 'food').map((r) => r.itemId),
        ...avoidRows.filter((r) => r.itemType === 'food').map((r) => r.itemId),
      ]),
    ],
  };
}

/**
 * The "+ Add Meal" flow: manually assigns a specific recipe/food to a slot,
 * scaling it the same way the generator would. Replaces any existing
 * (unlocked) assignment for that slot/track; does nothing if it's eaten-locked
 * or the date is in the past.
 *
 * Guards against silently bypassing allergies/diets/avoid-lists: returns any
 * conflicts without writing anything unless `acknowledgeConflict` is set,
 * mirroring the confirmation the UI asks the user for.
 */
export async function assignManualMeal(
  db: AppDb,
  householdId: string,
  date: string,
  slotKey: string,
  profileId: string | null,
  itemType: 'recipe' | 'food',
  itemId: string,
  acknowledgeConflict = false,
): Promise<{ conflicts: RestrictionConflict[] }> {
  if (date < todayIsoDate()) return { conflicts: [] };

  const ctx = await loadGeneratorContext(db, householdId, date);
  const slot = ctx.slots.find((s) => s.slotKey === slotKey);
  if (!slot) return { conflicts: [] };

  const nutrition = ctx.nutritionById.get(itemId);
  if (!nutrition) return { conflicts: [] };

  const relevantProfiles =
    profileId !== null
      ? ctx.profiles.filter((p) => p.id === profileId)
      : ctx.profiles.filter((p) => p.sharesMainMeals && isSlotEnabledForProfile(p, slot.slotKey));
  if (relevantProfiles.length === 0) return { conflicts: [] };

  const tags = await loadItemTags(db, itemType, itemId);
  const conflicts = findRestrictionConflicts(
    { itemType, itemId, allergens: tags.allergens, dietFlags: tags.dietFlags },
    relevantProfiles.map((p) => p.restrictions),
  );
  if (conflicts.length > 0 && !acknowledgeConflict) return { conflicts };

  const portions =
    slot.kind === 'snack'
      ? [{ profileId: relevantProfiles[0].id, multiplier: 1 }]
      : relevantProfiles
          .filter((p) => p.dailyTarget !== null)
          .map((p) => ({
            profileId: p.id,
            multiplier: scalingMultiplier(
              p.dailyTarget!.kcal * resolveSlotCalorieShare(slot.calorieShare, p.slotOverrides.get(slot.id)),
              nutrition.kcal,
            ),
          }));

  const meals = await loadMealsForDate(db, householdId, date);
  const existing = meals.find((m) => m.slotKey === slotKey && m.profileId === profileId);

  if (existing) {
    const existingPortions = await db
      .select()
      .from(plannedMealPortions)
      .where(and(eq(plannedMealPortions.plannedMealId, existing.id), isNull(plannedMealPortions.deletedAt)));
    if (existingPortions.some((p) => p.status === 'eaten')) return { conflicts };

    const now = nowIso();
    await db
      .update(plannedMealPortions)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(plannedMealPortions.plannedMealId, existing.id), isNull(plannedMealPortions.deletedAt)));
    await db.update(plannedMeals).set({ itemType, itemId, updatedAt: now }).where(eq(plannedMeals.id, existing.id));
    await db.insert(plannedMealPortions).values(
      portions.map((p) => ({
        id: newId(),
        createdAt: now,
        updatedAt: now,
        plannedMealId: existing.id,
        profileId: p.profileId,
        multiplier: p.multiplier,
        status: 'planned' as const,
      })),
    );
  } else {
    await insertPlannedMeal(db, householdId, date, slotKey, profileId, itemType, itemId, portions);
  }

  return { conflicts };
}

/** Recomputes one profile's daily nutrition total from every meal that day except `excludeMealId`. */
async function computeConsumedExcluding(
  db: AppDb,
  householdId: string,
  date: string,
  profileId: string,
  excludeMealId: string,
  ctx: GeneratorContext,
): Promise<MacroTotal> {
  const meals = await loadMealsForDate(db, householdId, date);
  const relevantMeals = meals.filter((meal) => meal.id !== excludeMealId && ctx.nutritionById.has(meal.itemId));
  const totals = new Map<string, MacroTotal>();
  if (relevantMeals.length === 0) return totals.get(profileId) ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };

  const portions = await db
    .select()
    .from(plannedMealPortions)
    .where(
      and(
        inArray(
          plannedMealPortions.plannedMealId,
          relevantMeals.map((m) => m.id),
        ),
        eq(plannedMealPortions.profileId, profileId),
        isNull(plannedMealPortions.deletedAt),
      ),
    );
  const nutritionByMealId = new Map(relevantMeals.map((meal) => [meal.id, ctx.nutritionById.get(meal.itemId)!]));
  for (const portion of portions) {
    const nutrition = nutritionByMealId.get(portion.plannedMealId);
    if (!nutrition) continue;
    addConsumed(totals, profileId, nutrition, portion.multiplier);
  }
  return totals.get(profileId) ?? { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
}

// ---------------------------------------------------------------------------
// Extras – a food/recipe added on top of an already-planned meal
// ---------------------------------------------------------------------------

/**
 * Adds a food/recipe on top of an already-planned meal. Guards against
 * silently bypassing allergies/diets/avoid-lists for every profile the
 * underlying meal covers, same as `assignManualMeal`.
 */
export async function addMealExtra(
  db: AppDb,
  plannedMealId: string,
  itemType: 'recipe' | 'food',
  itemId: string,
  acknowledgeConflict = false,
): Promise<{ conflicts: RestrictionConflict[] }> {
  const [meal] = await db.select().from(plannedMeals).where(eq(plannedMeals.id, plannedMealId));
  if (!meal) return { conflicts: [] };

  const portionRows = await db
    .select()
    .from(plannedMealPortions)
    .where(and(eq(plannedMealPortions.plannedMealId, plannedMealId), isNull(plannedMealPortions.deletedAt)));
  const profileIds = [...new Set(portionRows.map((row) => row.profileId))];

  const [restrictions, tags] = await Promise.all([
    Promise.all(profileIds.map((profileId) => loadCombinedRestrictions(db, meal.householdId, profileId))),
    loadItemTags(db, itemType, itemId),
  ]);
  const conflicts = findRestrictionConflicts(
    { itemType, itemId, allergens: tags.allergens, dietFlags: tags.dietFlags },
    restrictions,
  );
  if (conflicts.length > 0 && !acknowledgeConflict) return { conflicts };

  const now = nowIso();
  await db.insert(plannedMealExtras).values({
    id: newId(),
    createdAt: now,
    updatedAt: now,
    plannedMealId,
    itemType,
    itemId,
  });
  return { conflicts };
}

export async function removeMealExtra(db: AppDb, extraId: string): Promise<void> {
  const now = nowIso();
  await db
    .update(plannedMealExtras)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(plannedMealExtras.id, extraId));
}

// ---------------------------------------------------------------------------
// Removing a meal from the plan
// ---------------------------------------------------------------------------

/** Soft-deletes a planned meal, its portions and any extras. Refuses if any portion is already eaten. */
export async function removePlannedMeal(db: AppDb, plannedMealId: string): Promise<boolean> {
  const portions = await db
    .select()
    .from(plannedMealPortions)
    .where(and(eq(plannedMealPortions.plannedMealId, plannedMealId), isNull(plannedMealPortions.deletedAt)));
  if (portions.some((p) => p.status === 'eaten')) return false;

  const now = nowIso();
  await db
    .update(plannedMealPortions)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(plannedMealPortions.plannedMealId, plannedMealId));
  await db
    .update(plannedMealExtras)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(plannedMealExtras.plannedMealId, plannedMealId));
  await db.update(plannedMeals).set({ deletedAt: now, updatedAt: now }).where(eq(plannedMeals.id, plannedMealId));
  return true;
}

/**
 * Counts other today-or-future, unlocked (not eaten) occurrences of the same
 * recipe/food in this household, excluding `excludeMealId` – used to offer
 * "remove other occurrences too?" when deleting a repeated meal.
 */
export async function countOtherOccurrences(
  db: AppDb,
  householdId: string,
  itemType: 'recipe' | 'food',
  itemId: string,
  excludeMealId: string,
): Promise<number> {
  const today = todayIsoDate();
  const rows = await db
    .select()
    .from(plannedMeals)
    .where(
      and(
        eq(plannedMeals.householdId, householdId),
        eq(plannedMeals.itemType, itemType),
        eq(plannedMeals.itemId, itemId),
        isNull(plannedMeals.deletedAt),
      ),
    );

  const candidates = rows.filter((row) => row.id !== excludeMealId && row.date >= today);
  if (candidates.length === 0) return 0;

  const portions = await db
    .select()
    .from(plannedMealPortions)
    .where(
      and(
        inArray(
          plannedMealPortions.plannedMealId,
          candidates.map((row) => row.id),
        ),
        isNull(plannedMealPortions.deletedAt),
      ),
    );
  const eatenMealIds = new Set(portions.filter((p) => p.status === 'eaten').map((p) => p.plannedMealId));
  return candidates.filter((row) => !eatenMealIds.has(row.id)).length;
}

/** Removes every other today-or-future, unlocked occurrence of the same item, excluding `excludeMealId`. */
export async function removeOtherOccurrences(
  db: AppDb,
  householdId: string,
  itemType: 'recipe' | 'food',
  itemId: string,
  excludeMealId: string,
): Promise<void> {
  const today = todayIsoDate();
  const rows = await db
    .select()
    .from(plannedMeals)
    .where(
      and(
        eq(plannedMeals.householdId, householdId),
        eq(plannedMeals.itemType, itemType),
        eq(plannedMeals.itemId, itemId),
        isNull(plannedMeals.deletedAt),
      ),
    );

  for (const row of rows) {
    if (row.id === excludeMealId || row.date < today) continue;
    await removePlannedMeal(db, row.id);
  }
}

// ---------------------------------------------------------------------------
// Saving a planned meal as a reusable recipe
// ---------------------------------------------------------------------------

/**
 * Clones one planned meal (scaled by `profileId`'s portion multiplier, plus
 * any extras) into a new recipe. Amounts for a food-backed base and for
 * every extra are approximations (this app has no per-extra amount, and a
 * bare food is treated as "one portion" the same way the generator already
 * does – see `loadGeneratorContext`'s snack-food candidate loop) – the
 * caller should route straight to the recipe edit screen afterward so the
 * user can correct them before the recipe is used for real.
 */
export async function saveMealAsRecipe(db: AppDb, plannedMealId: string, profileId: string): Promise<string> {
  const [meal] = await db.select().from(plannedMeals).where(eq(plannedMeals.id, plannedMealId));
  if (!meal) throw new Error(`saveMealAsRecipe: meal ${plannedMealId} not found`);

  const [portion] = await db
    .select()
    .from(plannedMealPortions)
    .where(
      and(
        eq(plannedMealPortions.plannedMealId, plannedMealId),
        eq(plannedMealPortions.profileId, profileId),
        isNull(plannedMealPortions.deletedAt),
      ),
    );
  const multiplier = portion?.multiplier ?? 1;

  const ingredients: { foodId: string; amount: number }[] = [];
  let nameCs: string;
  let nameEn: string;

  if (meal.itemType === 'recipe') {
    const [recipe] = await db.select().from(recipes).where(eq(recipes.id, meal.itemId));
    if (!recipe) throw new Error(`saveMealAsRecipe: recipe ${meal.itemId} not found`);
    const rows = await db
      .select()
      .from(recipeIngredients)
      .where(and(eq(recipeIngredients.recipeId, meal.itemId), isNull(recipeIngredients.deletedAt)));
    for (const row of rows) ingredients.push({ foodId: row.foodId, amount: row.amount * multiplier });
    nameCs = `${recipe.nameCs} (kopie)`;
    nameEn = `${recipe.nameEn} (copy)`;
  } else {
    const [food] = await db.select().from(foods).where(eq(foods.id, meal.itemId));
    if (!food) throw new Error(`saveMealAsRecipe: food ${meal.itemId} not found`);
    ingredients.push({ foodId: meal.itemId, amount: 100 * multiplier });
    nameCs = `${food.nameCs} (kopie)`;
    nameEn = `${food.nameEn} (copy)`;
  }

  const extraRows = await db
    .select()
    .from(plannedMealExtras)
    .where(and(eq(plannedMealExtras.plannedMealId, plannedMealId), isNull(plannedMealExtras.deletedAt)));
  for (const extra of extraRows) {
    if (extra.itemType === 'food') {
      ingredients.push({ foodId: extra.itemId, amount: 100 });
    } else {
      const [extraRecipe] = await db.select().from(recipes).where(eq(recipes.id, extra.itemId));
      const extraIngredientRows = await db
        .select()
        .from(recipeIngredients)
        .where(and(eq(recipeIngredients.recipeId, extra.itemId), isNull(recipeIngredients.deletedAt)));
      const scale = extraRecipe && extraRecipe.servingsBase > 0 ? 1 / extraRecipe.servingsBase : 1;
      for (const row of extraIngredientRows) ingredients.push({ foodId: row.foodId, amount: row.amount * scale });
    }
  }

  const [slot] = await db.select().from(mealSlotSettings).where(eq(mealSlotSettings.slotKey, meal.slotKey));
  const category: 'breakfast' | 'lunch_dinner' | 'snack' =
    slot?.kind === 'snack' ? 'snack' : meal.slotKey === 'breakfast' ? 'breakfast' : 'lunch_dinner';

  return upsertRecipe(db, {
    nameCs,
    nameEn,
    category,
    isSide: false,
    budget: 'average',
    servingsBase: 1,
    ingredients,
  });
}

// ---------------------------------------------------------------------------
// Copying a whole day's plan onto another day
// ---------------------------------------------------------------------------

/**
 * Copies every planned meal (and its extras) from `fromDate` onto `toDate`,
 * skipping any `toDate` slot/track that's already eaten-locked. Slots empty
 * on `fromDate` are left untouched on `toDate`. Reuses `assignManualMeal`'s
 * existing past-date/eaten-lock guards (`acknowledgeConflict: true` since the
 * combination was already accepted once, on `fromDate`) rather than
 * reimplementing them – this function is orchestration, not safety-checking.
 */
export async function copyDayMeals(
  db: AppDb,
  householdId: string,
  fromDate: string,
  toDate: string,
): Promise<{ copied: number; skipped: number }> {
  const [fromMeals, lockedToday] = await Promise.all([
    loadMealsForDate(db, householdId, fromDate),
    loadLockedTrackKeys(db, householdId, toDate),
  ]);

  let copied = 0;
  let skipped = 0;

  for (const meal of fromMeals) {
    if (lockedToday.has(slotTrackKey(meal.slotKey, meal.profileId))) {
      skipped++;
      continue;
    }

    await assignManualMeal(db, householdId, toDate, meal.slotKey, meal.profileId, meal.itemType, meal.itemId, true);
    copied++;

    const extraRows = await db
      .select()
      .from(plannedMealExtras)
      .where(and(eq(plannedMealExtras.plannedMealId, meal.id), isNull(plannedMealExtras.deletedAt)));
    if (extraRows.length === 0) continue;

    const todayMeals = await loadMealsForDate(db, householdId, toDate);
    const newMeal = todayMeals.find((m) => m.slotKey === meal.slotKey && m.profileId === meal.profileId);
    if (!newMeal) continue;
    for (const extra of extraRows) {
      await addMealExtra(db, newMeal.id, extra.itemType, extra.itemId, true);
    }
  }

  return { copied, skipped };
}
