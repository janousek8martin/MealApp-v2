/**
 * Pure pantry-item bucketing logic for the Pantry screen (Task 8). No React
 * or DB imports – takes plain data in, returns plain data out, so it can be
 * unit-tested without a live SQLite/expo-sqlite context.
 *
 * Bucketing signal priority:
 *  1. `foods.storage` ('pantry' | 'fridge' | 'freezer') when present – this
 *     is the purpose-built field for this exact grouping.
 *  2. A best-effort `foods.category` heuristic when `storage` is null (a
 *     large real-world fraction of foods, since the bulk USDA import never
 *     sets `storage`) – "fridge-ish" perishable categories map to `fresh`,
 *     "pantry-ish" shelf-stable categories map to `staples`. Anything left
 *     over (or an unrecognized category) falls into `other` rather than
 *     guessing further.
 *  3. `expiringSoon` is computed FIRST and takes priority over storage/
 *     category: any item within the forward window is pulled OUT of its
 *     normal bucket entirely and appears only in `expiringSoon`, never
 *     double-listed.
 */

export type PantryBucket = 'expiringSoon' | 'fresh' | 'freezer' | 'staples' | 'other';

/** Forward-looking window (in days, inclusive) for the pinned "Brzy spotřebovat" section. Includes already past-due items (window start is unbounded in the past). */
export const EXPIRING_SOON_WINDOW_DAYS = 3;

export type PantryStorage = 'pantry' | 'fridge' | 'freezer' | null;

export interface PantryGroupingItem {
  id: string;
  expiresAt: string | null;
  foodId: string;
}

export interface PantryGroupingFood {
  storage: PantryStorage;
  category: string;
}

/** Perishable-leaning categories (seed data's 15 known `foods.category` values) used as a fallback signal when `storage` is null. */
const FRIDGE_LIKE_CATEGORIES = new Set(['dairy', 'eggs', 'meat', 'fish', 'vegetables', 'fruit']);
/** Shelf-stable-leaning categories used as the same fallback. */
const PANTRY_LIKE_CATEGORIES = new Set([
  'grains',
  'legumes',
  'nuts',
  'seeds',
  'sweeteners',
  'sweets',
  'fats',
  'supplements',
  'bakery',
]);

/** Adds `days` (may be negative) to an ISO 'YYYY-MM-DD' date string, returning ISO. */
function addDaysIso(dateIso: string, days: number): string {
  const date = new Date(`${dateIso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function bucketForFood(food: PantryGroupingFood | undefined): Exclude<PantryBucket, 'expiringSoon'> {
  if (!food) return 'other';
  if (food.storage === 'fridge') return 'fresh';
  if (food.storage === 'freezer') return 'freezer';
  if (food.storage === 'pantry') return 'staples';
  // storage is null – fall back to the category heuristic.
  if (FRIDGE_LIKE_CATEGORIES.has(food.category)) return 'fresh';
  if (PANTRY_LIKE_CATEGORIES.has(food.category)) return 'staples';
  return 'other';
}

/**
 * Groups pantry items into sections. `today` is an ISO 'YYYY-MM-DD' date
 * (e.g. from `todayIsoDate()`). Generic over `T` so callers can pass their
 * full `PantryItemRow` (or any shape that satisfies `PantryGroupingItem`)
 * and get the same rows back, unmodified, just bucketed.
 */
export function groupPantryItems<T extends PantryGroupingItem>(
  items: T[],
  foodsById: Map<string, PantryGroupingFood>,
  today: string,
): Record<PantryBucket, T[]> {
  const result: Record<PantryBucket, T[]> = {
    expiringSoon: [],
    fresh: [],
    freezer: [],
    staples: [],
    other: [],
  };

  const cutoff = addDaysIso(today, EXPIRING_SOON_WINDOW_DAYS);

  for (const item of items) {
    if (item.expiresAt !== null && item.expiresAt <= cutoff) {
      result.expiringSoon.push(item);
      continue;
    }
    const bucket = bucketForFood(foodsById.get(item.foodId));
    result[bucket].push(item);
  }

  return result;
}
