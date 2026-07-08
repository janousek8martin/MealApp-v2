import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';

import { createSeededRng, type Rng } from '@/domain/generator/rng';
import { deriveRecipeTags, findRestrictionConflicts, type RestrictionConflict } from '@/domain/generator/filters';
import { resolveSlotCalorieShare, resolveSnackTarget, scalingMultiplier, type SlotPortionOverride } from '@/domain/generator/portions';
import { computeRecipeNutrition, type RecipeNutrition } from '@/domain/recipeNutrition';
import {
  pickMealForSlot,
  pickSnackForSlot,
  recordPick,
  type GeneratorItem,
} from '@/domain/generator/select';
import type { DietRestrictions, DerivedRecipeTags, IngredientFoodTags, RecipeCandidate, RepetitionContext } from '@/domain/generator/types';
import { addDays, previousDay, startOfWeek, weekDates } from '@/domain/week';
import { applyWorkoutDayCycling } from '@/domain/workoutDays';
// Reused so the generator's daily target computation can never drift from
// what the UI shows (see the dailyTarget comment in loadGeneratorContext
// below) – this is the same pure mapping useProfileTargets calls.
import { targetsForProfile } from '@/hooks/dataMapping';

import { newId } from '../id';
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
  profileFavorites,
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

type SlotRow = typeof mealSlotSettings.$inferSelect;
type MacroTotal = { kcal: number; proteinG: number; carbsG: number; fatG: number };

type ProfileContext = {
  id: string;
  sharesMainMeals: boolean;
  snackSlotKeys: string[];
  restrictions: DietRestrictions;
  dailyTarget: MacroTotal | null;
  /** Per-slot portion overrides (P2-C), keyed by mealSlotSettings.id. */
  slotOverrides: Map<string, SlotPortionOverride>;
};

type GeneratorContext = {
  settings: { defaultMaxRepetitionsPerWeek: number; defaultAllowConsecutiveDays: boolean };
  slots: SlotRow[];
  profiles: ProfileContext[];
  mainItems: GeneratorItem[];
  snackItems: GeneratorItem[];
  /** Union of every candidate id → its per-portion nutrition, for locked-slot bookkeeping. */
  nutritionById: Map<string, RecipeNutrition>;
  favoriteRecipeIdsByProfile: Map<string, Set<string>>;
  expiringFoodIds: Set<string>;
};

// ---------------------------------------------------------------------------
// Loading the generator context
// ---------------------------------------------------------------------------

async function loadGeneratorContext(db: AppDb, householdId: string, date: string): Promise<GeneratorContext> {
  const [settingsRow] = await db
    .select()
    .from(householdSettings)
    .where(and(eq(householdSettings.householdId, householdId), isNull(householdSettings.deletedAt)));

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
    .where(and(eq(profiles.householdId, householdId), isNull(profiles.deletedAt)));

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
  const favoriteRecipeIdsByProfile = new Map<string, Set<string>>();

  for (const profile of profileRows) {
    const [restrictionRows, avoidRows, favoriteRows, slotPortionRows, [latestMetric]] = await Promise.all([
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
        .from(profileFavorites)
        .where(and(eq(profileFavorites.profileId, profile.id), isNull(profileFavorites.deletedAt))),
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

    favoriteRecipeIdsByProfile.set(profile.id, new Set(favoriteRows.map((r) => r.recipeId)));

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
          const targets = targetsForProfile(profile, latestMetric, settingsRow?.fiberMode ?? 'efsa_min')!;
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
      snackSlotKeys: profile.snackPositionsJson ? (JSON.parse(profile.snackPositionsJson) as string[]) : [],
      restrictions: {
        allergens: [...new Set([...householdAllergens, ...restrictionRows.filter((r) => r.kind === 'allergen').map((r) => r.value)])],
        diets: [...new Set([...householdDiets, ...restrictionRows.filter((r) => r.kind === 'diet').map((r) => r.value)])],
        avoidedRecipeIds: [
          ...new Set([...householdAvoidedRecipeIds, ...avoidRows.filter((r) => r.itemType === 'recipe').map((r) => r.itemId)]),
        ],
        avoidedFoodIds: [
          ...new Set([...householdAvoidedFoodIds, ...avoidRows.filter((r) => r.itemType === 'food').map((r) => r.itemId)]),
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
      ingredients: rows.map((row) => ({
        foodId: row.food.id,
        allergens: allergensByFood.get(row.food.id) ?? [],
        dietFlags: row.food.dietFlagsJson ? (JSON.parse(row.food.dietFlagsJson) as string[]) : [],
      })),
      maxRepetitionsPerWeek: recipe.maxRepetitionsPerWeek,
      allowConsecutiveDays: recipe.allowConsecutiveDays,
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

  return {
    settings: {
      defaultMaxRepetitionsPerWeek: settingsRow?.defaultMaxRepetitionsPerWeek ?? 2,
      defaultAllowConsecutiveDays: settingsRow?.defaultAllowConsecutiveDays ?? false,
    },
    slots,
    profiles: profileContexts,
    mainItems,
    snackItems,
    nutritionById,
    favoriteRecipeIdsByProfile,
    expiringFoodIds,
  };
}

function unionFavorites(subset: ProfileContext[], ctx: GeneratorContext): Set<string> {
  const result = new Set<string>();
  for (const profile of subset) {
    for (const id of ctx.favoriteRecipeIdsByProfile.get(profile.id) ?? []) result.add(id);
  }
  return result;
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
  const locked = new Set<string>();
  for (const meal of meals) {
    const portions = await db
      .select()
      .from(plannedMealPortions)
      .where(and(eq(plannedMealPortions.plannedMealId, meal.id), isNull(plannedMealPortions.deletedAt)));
    if (portions.some((p) => p.status === 'eaten')) {
      locked.add(slotTrackKey(meal.slotKey, meal.profileId));
    }
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

  for (const slot of ctx.slots.filter((s) => s.kind === 'main')) {
    const category = slot.slotKey === 'breakfast' ? 'breakfast' : 'lunch_dinner';
    const candidates = ctx.mainItems.filter((item) => item.candidate.category === category);

    if (slot.sharing === 'shared' && sharedProfiles.length > 0) {
      const key = slotTrackKey(slot.slotKey, null);
      if (lockedKeys.has(key)) {
        await accumulateLockedMeal(db, householdId, date, slot.slotKey, null, ctx, consumedSoFar);
      } else {
        const picked = pickMealForSlot(
          candidates,
          sharedProfiles.map((p) => p.restrictions),
          repetitionCtx,
          { favoriteRecipeIds: unionFavorites(sharedProfiles, ctx), expiringFoodIds: ctx.expiringFoodIds },
          rng,
        );
        if (picked) {
          const portions = sharedProfiles
            .filter((p) => p.dailyTarget !== null)
            .map((p) => ({
              profileId: p.id,
              multiplier: scalingMultiplier(
                p.dailyTarget!.kcal * resolveSlotCalorieShare(slot.calorieShare, p.slotOverrides.get(slot.id)),
                picked.candidate.nutritionPerPortion.kcal,
              ),
            }));
          await insertPlannedMeal(db, householdId, date, slot.slotKey, null, picked.itemType, picked.candidate.id, portions);
          repetitionCtx = recordPick(repetitionCtx, picked.candidate.id);
          for (const portion of portions) {
            addConsumed(consumedSoFar, portion.profileId, picked.candidate.nutritionPerPortion, portion.multiplier);
          }
        }
      }
    }

    for (const profile of independentProfiles) {
      if (!profile.dailyTarget) continue;
      const key = slotTrackKey(slot.slotKey, profile.id);
      if (lockedKeys.has(key)) {
        await accumulateLockedMeal(db, householdId, date, slot.slotKey, profile.id, ctx, consumedSoFar);
        continue;
      }
      const picked = pickMealForSlot(
        candidates,
        [profile.restrictions],
        repetitionCtx,
        { favoriteRecipeIds: ctx.favoriteRecipeIdsByProfile.get(profile.id) ?? new Set(), expiringFoodIds: ctx.expiringFoodIds },
        rng,
      );
      if (!picked) continue;
      const multiplier = scalingMultiplier(
        profile.dailyTarget.kcal * resolveSlotCalorieShare(slot.calorieShare, profile.slotOverrides.get(slot.id)),
        picked.candidate.nutritionPerPortion.kcal,
      );
      await insertPlannedMeal(db, householdId, date, slot.slotKey, profile.id, picked.itemType, picked.candidate.id, [
        { profileId: profile.id, multiplier },
      ]);
      repetitionCtx = recordPick(repetitionCtx, picked.candidate.id);
      addConsumed(consumedSoFar, profile.id, picked.candidate.nutritionPerPortion, multiplier);
    }
  }

  for (const slot of ctx.slots.filter((s) => s.kind === 'snack')) {
    for (const profile of ctx.profiles) {
      if (!profile.dailyTarget || !profile.snackSlotKeys.includes(slot.slotKey)) continue;
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
      const picked = pickSnackForSlot(ctx.snackItems, profile.restrictions, repetitionCtx, target);
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
      : ctx.profiles.filter((p) => p.sharesMainMeals);
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
    picked = pickSnackForSlot(pool, profile.restrictions, repetitionCtx, snackTarget);
  } else {
    const category = slot.slotKey === 'breakfast' ? 'breakfast' : 'lunch_dinner';
    const pool = ctx.mainItems.filter(
      (item) => item.candidate.category === category && item.candidate.id !== meal.itemId,
    );
    picked = pickMealForSlot(
      pool,
      relevantProfiles.map((p) => p.restrictions),
      repetitionCtx,
      {
        favoriteRecipeIds: unionFavorites(relevantProfiles, ctx),
        expiringFoodIds: ctx.expiringFoodIds,
      },
      createSeededRng(rngSeed ?? Date.now()),
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
      : ctx.profiles.filter((p) => p.sharesMainMeals);
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
  const totals = new Map<string, MacroTotal>();
  for (const meal of meals) {
    if (meal.id === excludeMealId) continue;
    const nutrition = ctx.nutritionById.get(meal.itemId);
    if (!nutrition) continue;
    const portions = await db
      .select()
      .from(plannedMealPortions)
      .where(
        and(
          eq(plannedMealPortions.plannedMealId, meal.id),
          eq(plannedMealPortions.profileId, profileId),
          isNull(plannedMealPortions.deletedAt),
        ),
      );
    for (const portion of portions) {
      addConsumed(totals, profileId, nutrition, portion.multiplier);
    }
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

  let count = 0;
  for (const row of rows) {
    if (row.id === excludeMealId || row.date < today) continue;
    const portions = await db
      .select()
      .from(plannedMealPortions)
      .where(and(eq(plannedMealPortions.plannedMealId, row.id), isNull(plannedMealPortions.deletedAt)));
    if (portions.some((p) => p.status === 'eaten')) continue;
    count += 1;
  }
  return count;
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
