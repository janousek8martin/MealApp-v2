import { and, eq, isNull } from 'drizzle-orm';

import { newId } from '../id';
import { waterLogs } from '../schema';
import { nowIso, todayIsoDate } from '../time';
import type { AppDb } from '../types';

/**
 * Logs a +/- amount toward a profile's daily water total (e.g. +250 for a
 * glass, -250 to undo one) - one row per action rather than an upsert, so
 * the log stays a simple append-only history; a day's total is just the sum.
 */
export async function logWater(db: AppDb, profileId: string, deltaMl: number, date: string = todayIsoDate()): Promise<void> {
  const now = nowIso();
  await db.insert(waterLogs).values({
    id: newId(),
    createdAt: now,
    updatedAt: now,
    profileId,
    date,
    amountMl: deltaMl,
  });
}

export async function getWaterTotalForDate(db: AppDb, profileId: string, date: string): Promise<number> {
  const rows = await db
    .select()
    .from(waterLogs)
    .where(and(eq(waterLogs.profileId, profileId), eq(waterLogs.date, date), isNull(waterLogs.deletedAt)));
  return rows.reduce((sum, row) => sum + row.amountMl, 0);
}
