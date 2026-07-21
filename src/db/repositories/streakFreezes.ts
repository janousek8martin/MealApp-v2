import { and, eq, gte, isNull } from 'drizzle-orm';

import { newId } from '../id';
import { streakFreezes } from '../schema';
import { nowIso, todayIsoDate } from '../time';
import type { AppDb } from '../types';

export const MAX_STREAK_FREEZES_PER_MONTH = 3;

/** Protects `date` (defaults to today) from breaking the given streak - see StreakDetailModal's Freeze button. */
export async function addStreakFreeze(
  db: AppDb,
  profileId: string,
  kind: 'meal' | 'water',
  date: string = todayIsoDate(),
): Promise<void> {
  const now = nowIso();
  await db.insert(streakFreezes).values({
    id: newId(),
    createdAt: now,
    updatedAt: now,
    profileId,
    kind,
    date,
  });
}

/** First day ('YYYY-MM-01') of the month `dateIso` falls in - the window a freeze allowance resets over. */
export function monthStartIso(dateIso: string): string {
  return `${dateIso.slice(0, 7)}-01`;
}
