/**
 * Aggregates a week's planned meals into the food quantities a household
 * needs to buy, split into a weekly (fresh) and monthly (batch/long-life)
 * horizon, netted against what's already in the pantry.
 */

/** Foods with a shelf life at or above this are suggested as a monthly batch buy. */
export const MONTHLY_SHELF_LIFE_THRESHOLD_DAYS = 21;
/** How many weeks of recurring use a monthly batch purchase should cover. */
const MONTHLY_BATCH_WEEKS = 4;

export type PlannedMealIngredientNeed = {
  foodId: string;
  /** Amount in the food's base unit, already scaled by the portion multiplier. */
  amount: number;
};

export type FoodShelfInfo = {
  id: string;
  shelfLifeDays: number | null;
  baseUnit: string;
};

export type ShoppingNeed = {
  foodId: string;
  horizon: 'weekly' | 'monthly';
  /** Quantity still needed to buy, in the food's base unit (never negative; 0 = fully covered by pantry). */
  quantity: number;
  unit: string;
};

function horizonFor(food: FoodShelfInfo): 'weekly' | 'monthly' {
  return food.shelfLifeDays !== null && food.shelfLifeDays >= MONTHLY_SHELF_LIFE_THRESHOLD_DAYS
    ? 'monthly'
    : 'weekly';
}

/**
 * Sums raw per-week ingredient needs into one quantity per food. Callers
 * assemble `needs` from every planned recipe's ingredients (amount ×
 * portion multiplier) and every standalone-food meal (100 × multiplier, the
 * same "one portion ≈ 100 base units" approximation the generator uses).
 */
export function sumWeeklyNeeds(needs: PlannedMealIngredientNeed[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const need of needs) {
    totals.set(need.foodId, (totals.get(need.foodId) ?? 0) + need.amount);
  }
  return totals;
}

/**
 * Nets weekly needs against pantry stock and projects long-shelf-life items
 * to a monthly batch quantity. Foods that are fully covered by pantry stock
 * are omitted (nothing left to buy).
 */
export function computeShoppingNeeds(
  weeklyNeeds: Map<string, number>,
  foodsById: Map<string, FoodShelfInfo>,
  pantryQuantityByFood: Map<string, number>,
): ShoppingNeed[] {
  const result: ShoppingNeed[] = [];
  for (const [foodId, weeklyQty] of weeklyNeeds) {
    const food = foodsById.get(foodId);
    if (!food) continue;
    const horizon = horizonFor(food);
    const targetQty = horizon === 'monthly' ? weeklyQty * MONTHLY_BATCH_WEEKS : weeklyQty;
    const pantryQty = pantryQuantityByFood.get(foodId) ?? 0;
    const quantity = Math.max(targetQty - pantryQty, 0);
    if (quantity <= 0) continue;
    result.push({ foodId, horizon, quantity, unit: food.baseUnit });
  }
  return result;
}

/** Round-up step (g/ml) used to suggest a realistic purchased quantity - nobody buys exactly 1697 ml of milk, they buy the next 250 ml pack up. */
const PURCHASE_ROUND_STEP = 250;

/**
 * Suggests a realistic "how much did you actually buy" default for the
 * purchased-quantity prompt: the needed amount rounded UP to the next whole
 * pack-sized step (250 g/ml) for weight/volume foods, or the next whole unit
 * for piece-counted foods. Never suggests less than what was needed.
 */
export function suggestPurchaseQuantity(neededQuantity: number, baseUnit: string): number {
  if (neededQuantity <= 0) return 0;
  if (baseUnit === 'piece') return Math.ceil(neededQuantity);
  return Math.ceil(neededQuantity / PURCHASE_ROUND_STEP) * PURCHASE_ROUND_STEP;
}

export type PantryBatch = { id: string; quantity: number; expiresAt: string | null };

/**
 * FIFO-deducts `needed` units of one food from its pantry batches, soonest-
 * expiring first (batches with no expiry date are used last, same ordering
 * pantry screens display). Running out of stock simply stops early – eating
 * more than what's in the pantry isn't an error, it just deducts what's there.
 */
export function deductFromPantryBatches(batches: PantryBatch[], needed: number): { id: string; quantity: number }[] {
  const sorted = [...batches].sort((a, b) => {
    if (a.expiresAt === null) return b.expiresAt === null ? 0 : 1;
    if (b.expiresAt === null) return -1;
    return a.expiresAt.localeCompare(b.expiresAt);
  });
  const updates: { id: string; quantity: number }[] = [];
  let remaining = needed;
  for (const batch of sorted) {
    if (remaining <= 0) break;
    const take = Math.min(batch.quantity, remaining);
    if (take <= 0) continue;
    updates.push({ id: batch.id, quantity: batch.quantity - take });
    remaining -= take;
  }
  return updates;
}
