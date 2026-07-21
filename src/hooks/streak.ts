import { and, eq, gte, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';
import { useMemo } from 'react';

import { db } from '@/db/client';
import { monthStartIso } from '@/db/repositories/streakFreezes';
import { streakFreezes } from '@/db/schema';

/**
 * Dates this profile has manually frozen for the given streak kind, within
 * the calendar month `todayIso` falls in - the monthly freeze allowance
 * resets implicitly by only ever counting the current month's rows (see
 * `monthStartIso`), rather than a stored counter that needs resetting.
 */
export function useStreakFreezeDates(
  profileId: string | undefined,
  kind: 'meal' | 'water',
  todayIso: string,
): Set<string> {
  const monthStart = monthStartIso(todayIso);
  const { data: rows } = useLiveQuery(
    db
      .select({ date: streakFreezes.date })
      .from(streakFreezes)
      .where(
        and(
          eq(streakFreezes.profileId, profileId ?? ''),
          eq(streakFreezes.kind, kind),
          isNull(streakFreezes.deletedAt),
          gte(streakFreezes.date, monthStart),
        ),
      ),
    [profileId, kind, monthStart],
  );

  return useMemo(() => new Set((rows ?? []).map((row) => row.date)), [rows]);
}
