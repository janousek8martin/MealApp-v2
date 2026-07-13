import { and, eq, gte, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { waterLogs } from '@/db/schema';
import { defaultWaterGoalMl } from '@/domain/water';

/** Live-updating sum of a profile's logged water amounts for one date. */
export function useWaterTotal(profileId: string | undefined, date: string): number {
  const { data } = useLiveQuery(
    db
      .select()
      .from(waterLogs)
      .where(and(eq(waterLogs.profileId, profileId ?? ''), eq(waterLogs.date, date), isNull(waterLogs.deletedAt))),
    [profileId, date],
  );
  return (data ?? []).reduce((sum, row) => sum + row.amountMl, 0);
}

/**
 * Dates (>= `sinceDateIso`) where the profile's logged water met the goal.
 * Reuses today's current weight/goal for every historical day (a documented
 * simplification, same as `WaterCard`'s own "today" computation – not
 * reconstructing past body-metric-derived goals). Used for the "water"
 * streak on the home hero card.
 */
export function useWaterGoalDates(
  profileId: string | undefined,
  weightKg: number | undefined,
  sex: 'male' | 'female' | undefined,
  waterGoalMl: number | null | undefined,
  sinceDateIso: string,
): Set<string> {
  const { data: rows } = useLiveQuery(
    db
      .select()
      .from(waterLogs)
      .where(and(eq(waterLogs.profileId, profileId ?? ''), isNull(waterLogs.deletedAt), gte(waterLogs.date, sinceDateIso))),
    [profileId, sinceDateIso],
  );

  return useMemo(() => {
    if (weightKg === undefined || sex === undefined) return new Set<string>();
    const goal = waterGoalMl ?? defaultWaterGoalMl(weightKg, sex);
    const totals = new Map<string, number>();
    for (const row of rows ?? []) totals.set(row.date, (totals.get(row.date) ?? 0) + row.amountMl);
    const result = new Set<string>();
    for (const [date, total] of totals) if (total >= goal) result.add(date);
    return result;
  }, [rows, weightKg, sex, waterGoalMl]);
}
