import { and, eq, isNull } from 'drizzle-orm';

import { newId } from '../id';
import { foodRestrictions, foods, photos, profileFavorites, recipeIngredients, recipes } from '../schema';
import { nowIso } from '../time';
import type { AppDb } from '../types';

// ---------------------------------------------------------------------------
// Foods
// ---------------------------------------------------------------------------

export type FoodInput = {
  nameCs: string;
  nameEn: string;
  category: string;
  baseUnit: 'g' | 'ml' | 'piece';
  gramsPerPiece?: number | null;
  gramsPerCup?: number | null;
  kcalPer100: number;
  proteinPer100: number;
  carbsPer100: number;
  fatPer100: number;
  fiberPer100?: number | null;
  budget: 'cheap' | 'average' | 'expensive';
  shelfLifeDays?: number | null;
  storage?: 'pantry' | 'fridge' | 'freezer' | null;
  snackSuitable: boolean;
  dietFlags: string[];
  allergens: string[];
};

export async function upsertFood(db: AppDb, input: FoodInput, foodId?: string): Promise<string> {
  const now = nowIso();
  const id = foodId ?? newId();
  const values = {
    nameCs: input.nameCs,
    nameEn: input.nameEn,
    category: input.category,
    baseUnit: input.baseUnit,
    gramsPerPiece: input.gramsPerPiece ?? null,
    gramsPerCup: input.gramsPerCup ?? null,
    kcalPer100: input.kcalPer100,
    proteinPer100: input.proteinPer100,
    carbsPer100: input.carbsPer100,
    fatPer100: input.fatPer100,
    fiberPer100: input.fiberPer100 ?? null,
    budget: input.budget,
    shelfLifeDays: input.shelfLifeDays ?? null,
    storage: input.storage ?? null,
    snackSuitable: input.snackSuitable,
    dietFlagsJson: JSON.stringify(input.dietFlags),
    updatedAt: now,
  };

  if (foodId) {
    await db.update(foods).set(values).where(eq(foods.id, foodId));
    // Replace allergen rows (soft-delete + insert keeps sync history).
    await db
      .update(foodRestrictions)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(foodRestrictions.foodId, foodId), isNull(foodRestrictions.deletedAt)));
  } else {
    await db.insert(foods).values({ id, createdAt: now, source: 'user', ...values });
  }

  if (input.allergens.length > 0) {
    await db.insert(foodRestrictions).values(
      input.allergens.map((allergen) => ({
        id: newId(),
        createdAt: now,
        updatedAt: now,
        foodId: id,
        allergen,
      })),
    );
  }
  return id;
}

export async function softDeleteFood(db: AppDb, foodId: string): Promise<void> {
  const now = nowIso();
  await db.update(foods).set({ deletedAt: now, updatedAt: now }).where(eq(foods.id, foodId));
}

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

export type RecipeInput = {
  nameCs: string;
  nameEn: string;
  instructionsCs?: string | null;
  instructionsEn?: string | null;
  category: 'breakfast' | 'lunch_dinner' | 'snack';
  isSide: boolean;
  budget: 'cheap' | 'average' | 'expensive';
  servingsBase: number;
  prepTimeMinutes?: number | null;
  maxRepetitionsPerWeek?: number | null;
  allowConsecutiveDays?: boolean | null;
  ingredients: { foodId: string; amount: number }[];
};

export async function upsertRecipe(db: AppDb, input: RecipeInput, recipeId?: string): Promise<string> {
  const now = nowIso();
  const id = recipeId ?? newId();
  const values = {
    nameCs: input.nameCs,
    nameEn: input.nameEn,
    instructionsCs: input.instructionsCs ?? null,
    instructionsEn: input.instructionsEn ?? null,
    category: input.category,
    isSide: input.isSide,
    budget: input.budget,
    servingsBase: input.servingsBase,
    prepTimeMinutes: input.prepTimeMinutes ?? null,
    maxRepetitionsPerWeek: input.maxRepetitionsPerWeek ?? null,
    allowConsecutiveDays: input.allowConsecutiveDays ?? null,
    updatedAt: now,
  };

  if (recipeId) {
    await db.update(recipes).set(values).where(eq(recipes.id, recipeId));
    await db
      .update(recipeIngredients)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(recipeIngredients.recipeId, recipeId), isNull(recipeIngredients.deletedAt)));
  } else {
    await db.insert(recipes).values({ id, createdAt: now, source: 'user', ...values });
  }

  if (input.ingredients.length > 0) {
    await db.insert(recipeIngredients).values(
      input.ingredients.map((ingredient) => ({
        id: newId(),
        createdAt: now,
        updatedAt: now,
        recipeId: id,
        foodId: ingredient.foodId,
        amount: ingredient.amount,
      })),
    );
  }
  return id;
}

export async function softDeleteRecipe(db: AppDb, recipeId: string): Promise<void> {
  const now = nowIso();
  await db.update(recipes).set({ deletedAt: now, updatedAt: now }).where(eq(recipes.id, recipeId));
}

// ---------------------------------------------------------------------------
// Favorites & photos
// ---------------------------------------------------------------------------

export async function toggleFavorite(db: AppDb, profileId: string, recipeId: string): Promise<void> {
  const now = nowIso();
  const existing = await db
    .select()
    .from(profileFavorites)
    .where(
      and(
        eq(profileFavorites.profileId, profileId),
        eq(profileFavorites.recipeId, recipeId),
        isNull(profileFavorites.deletedAt),
      ),
    );

  if (existing.length > 0) {
    await db
      .update(profileFavorites)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(profileFavorites.id, existing[0].id));
  } else {
    await db.insert(profileFavorites).values({
      id: newId(),
      createdAt: now,
      updatedAt: now,
      profileId,
      recipeId,
    });
  }
}

/** Attach a photo, replacing any previous one for the same owner. */
export async function setPhoto(
  db: AppDb,
  ownerType: 'recipe' | 'food',
  ownerId: string,
  uri: string,
): Promise<void> {
  const now = nowIso();
  await db
    .update(photos)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(photos.ownerType, ownerType), eq(photos.ownerId, ownerId), isNull(photos.deletedAt)));
  await db.insert(photos).values({
    id: newId(),
    createdAt: now,
    updatedAt: now,
    ownerType,
    ownerId,
    uri,
    takenAt: now,
  });
}
