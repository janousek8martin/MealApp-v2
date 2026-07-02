import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import { pantryItems, shoppingListItems } from '@/db/schema';

export type ShoppingItemRow = typeof shoppingListItems.$inferSelect;
export type PantryItemRow = typeof pantryItems.$inferSelect;

export function useShoppingItems(householdId: string | undefined): ShoppingItemRow[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(shoppingListItems)
      .where(and(eq(shoppingListItems.householdId, householdId ?? ''), isNull(shoppingListItems.deletedAt))),
    [householdId],
  );
  return data ?? [];
}

/** Sorted soonest-expiring first; items with no expiry date sort last (SQLite orders NULL first by default). */
export function usePantryItems(householdId: string | undefined): PantryItemRow[] {
  const { data } = useLiveQuery(
    db
      .select()
      .from(pantryItems)
      .where(and(eq(pantryItems.householdId, householdId ?? ''), isNull(pantryItems.deletedAt))),
    [householdId],
  );
  return [...(data ?? [])].sort((a, b) => {
    if (a.expiresAt === null) return b.expiresAt === null ? 0 : 1;
    if (b.expiresAt === null) return -1;
    return a.expiresAt.localeCompare(b.expiresAt);
  });
}
