import { and, eq, isNull } from 'drizzle-orm';

import type { MicronutrientKey } from '../../domain/micronutrients';
import { newId } from '../id';
import { foodRestrictions, foods, photos, profileItemRatings, recipeIngredients, recipes } from '../schema';
import { nowIso } from '../time';
import type { AppDb } from '../types';

// ---------------------------------------------------------------------------
// Foods
// ---------------------------------------------------------------------------

/** One entry per tracked micronutrient (see domain/micronutrients.ts); an omitted/null field stays unknown, never becomes 0. */
export type MicronutrientsInput = Partial<Record<MicronutrientKey, number | null>>;

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
  micronutrients?: MicronutrientsInput;
  budget: 'cheap' | 'average' | 'expensive';
  shelfLifeDays?: number | null;
  storage?: 'pantry' | 'fridge' | 'freezer' | null;
  snackSuitable: boolean;
  dietFlags: string[];
  allergens: string[];
  /** EAN scanned via the barcode scanner (item 10); null when entered manually. */
  barcode?: string | null;
  /** Can be eaten cold; defaults to false. */
  canServeCold?: boolean;
  /** Suitable for batch-cooked boxed meals; defaults to false. */
  mealPrepFriendly?: boolean;
  /** NOVA processing group (1-4), from an Open Food Facts lookup; null/omitted when unknown. */
  novaGroup?: number | null;
  nutriScoreGrade?: 'a' | 'b' | 'c' | 'd' | 'e' | null;
  ecoScoreGrade?: 'a' | 'b' | 'c' | 'd' | 'e' | null;
  /** True for a food whose allergen tags haven't been human-confirmed (e.g. straight off a barcode scan) - see src/domain/nutrientProvenance.ts. Only applied on creation; a later edit never silently resets it - see confirmFoodReviewed. */
  needsReview?: boolean;
  /** Data provenance, e.g. 'user' (default) or 'off_label' for a barcode-scanned product. Only applied on creation. */
  source?: string;
};

/** Serializes only the micronutrients the user actually filled in – an omitted field stays unknown, never becomes 0. */
function serializeMicronutrients(input?: MicronutrientsInput): string | null {
  if (!input) return null;
  const entries = Object.entries(input).filter(([, value]) => value !== null && value !== undefined);
  if (entries.length === 0) return null;
  return JSON.stringify(Object.fromEntries(entries));
}

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
    micronutrientsJson: serializeMicronutrients(input.micronutrients),
    budget: input.budget,
    shelfLifeDays: input.shelfLifeDays ?? null,
    storage: input.storage ?? null,
    snackSuitable: input.snackSuitable,
    dietFlagsJson: JSON.stringify(input.dietFlags),
    barcode: input.barcode ?? null,
    canServeCold: input.canServeCold ?? false,
    mealPrepFriendly: input.mealPrepFriendly ?? false,
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
    await db.insert(foods).values({
      id,
      createdAt: now,
      source: input.source ?? 'user',
      novaGroup: input.novaGroup ?? null,
      nutriScoreGrade: input.nutriScoreGrade ?? null,
      ecoScoreGrade: input.ecoScoreGrade ?? null,
      needsReview: input.needsReview ?? false,
      ...values,
    });
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
  cuisine?: string | null;
  tags?: string[];
  budget: 'cheap' | 'average' | 'expensive';
  servingsBase: number;
  prepTimeMinutes?: number | null;
  maxRepetitionsPerWeek?: number | null;
  allowConsecutiveDays?: boolean | null;
  ingredients: { foodId: string; amount: number }[];
  /** Can be served cold; defaults to false. */
  canServeCold?: boolean;
  /** Suitable for batch-cooked boxed meals; defaults to false. */
  mealPrepFriendly?: boolean;
  /** Sets which household cooking-experience ceiling this recipe is drawn under; defaults to 'medium'. */
  difficulty?: 'easy' | 'medium' | 'hard';
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
    cuisine: input.cuisine ?? null,
    tagsJson: input.tags && input.tags.length > 0 ? JSON.stringify(input.tags) : null,
    budget: input.budget,
    servingsBase: input.servingsBase,
    prepTimeMinutes: input.prepTimeMinutes ?? null,
    maxRepetitionsPerWeek: input.maxRepetitionsPerWeek ?? null,
    allowConsecutiveDays: input.allowConsecutiveDays ?? null,
    canServeCold: input.canServeCold ?? false,
    mealPrepFriendly: input.mealPrepFriendly ?? false,
    difficulty: input.difficulty ?? 'medium',
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
// Ratings (like/dislike) & photos
// ---------------------------------------------------------------------------

/** Sets a profile's like/dislike on a recipe or food; pass `null` to clear it. */
export async function setRating(
  db: AppDb,
  profileId: string,
  itemType: 'recipe' | 'food',
  itemId: string,
  rating: 'like' | 'dislike' | null,
): Promise<void> {
  const now = nowIso();
  const existing = await db
    .select()
    .from(profileItemRatings)
    .where(
      and(
        eq(profileItemRatings.profileId, profileId),
        eq(profileItemRatings.itemType, itemType),
        eq(profileItemRatings.itemId, itemId),
        isNull(profileItemRatings.deletedAt),
      ),
    );

  if (rating === null) {
    if (existing.length > 0) {
      await db
        .update(profileItemRatings)
        .set({ deletedAt: now, updatedAt: now })
        .where(eq(profileItemRatings.id, existing[0].id));
    }
    return;
  }

  if (existing.length > 0) {
    await db.update(profileItemRatings).set({ rating, updatedAt: now }).where(eq(profileItemRatings.id, existing[0].id));
  } else {
    await db.insert(profileItemRatings).values({
      id: newId(),
      createdAt: now,
      updatedAt: now,
      profileId,
      itemType,
      itemId,
      rating,
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
