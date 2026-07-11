import { and, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import { waterLogs } from '@/db/schema';

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
