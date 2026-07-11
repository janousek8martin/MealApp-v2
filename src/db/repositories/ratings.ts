import { and, eq, isNull } from 'drizzle-orm';

import type { RecipeResolution } from '@/domain/generator/types';

import { newId } from '../id';
import { householdRecipeOverrides, profileItemRatings, profiles } from '../schema';
import { nowIso } from '../time';
import type { AppDb } from '../types';

/**
 * Detects a like/dislike conflict on a recipe across a household's profiles –
 * non-null only when both a like and a dislike exist and no resolution has
 * been recorded yet (a resolved conflict never re-prompts).
 */
export async function detectRecipeRatingConflict(
  db: AppDb,
  householdId: string,
  recipeId: string,
): Promise<{ conflictingProfileIds: string[] } | null> {
  const [existingResolution] = await db
    .select()
    .from(householdRecipeOverrides)
    .where(
      and(
        eq(householdRecipeOverrides.householdId, householdId),
        eq(householdRecipeOverrides.recipeId, recipeId),
        isNull(householdRecipeOverrides.deletedAt),
      ),
    );
  if (existingResolution) return null;

  const householdProfiles = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.householdId, householdId), isNull(profiles.deletedAt)));
  const profileIds = new Set(householdProfiles.map((p) => p.id));

  const ratingRows = await db
    .select()
    .from(profileItemRatings)
    .where(
      and(
        eq(profileItemRatings.itemType, 'recipe'),
        eq(profileItemRatings.itemId, recipeId),
        isNull(profileItemRatings.deletedAt),
      ),
    );
  const householdRatings = ratingRows.filter((r) => profileIds.has(r.profileId));

  const hasLike = householdRatings.some((r) => r.rating === 'like');
  const hasDislike = householdRatings.some((r) => r.rating === 'dislike');
  if (!hasLike || !hasDislike) return null;

  return { conflictingProfileIds: householdRatings.map((r) => r.profileId) };
}

export async function setRecipeResolution(
  db: AppDb,
  householdId: string,
  recipeId: string,
  resolution: RecipeResolution,
): Promise<void> {
  const now = nowIso();
  const [existing] = await db
    .select()
    .from(householdRecipeOverrides)
    .where(
      and(
        eq(householdRecipeOverrides.householdId, householdId),
        eq(householdRecipeOverrides.recipeId, recipeId),
        isNull(householdRecipeOverrides.deletedAt),
      ),
    );

  if (existing) {
    await db
      .update(householdRecipeOverrides)
      .set({ resolution, updatedAt: now })
      .where(eq(householdRecipeOverrides.id, existing.id));
  } else {
    await db.insert(householdRecipeOverrides).values({
      id: newId(),
      createdAt: now,
      updatedAt: now,
      householdId,
      recipeId,
      resolution,
    });
  }
}

export async function getRecipeResolutions(db: AppDb, householdId: string): Promise<Map<string, RecipeResolution>> {
  const rows = await db
    .select()
    .from(householdRecipeOverrides)
    .where(and(eq(householdRecipeOverrides.householdId, householdId), isNull(householdRecipeOverrides.deletedAt)));
  return new Map(rows.map((row) => [row.recipeId, row.resolution]));
}
