import { and, desc, eq, isNull } from 'drizzle-orm';
import { useLiveQuery } from 'drizzle-orm/expo-sqlite';

import { db } from '@/db/client';
import { bodyMetrics, householdSettings, households, profiles } from '@/db/schema';
import { targetsForProfile, type ProfileRow } from '@/hooks/dataMapping';
import { useAppStore } from '@/stores/appStore';

/** V1 is single-household; the first (only) active household row. */
export function useHousehold() {
  const { data } = useLiveQuery(db.select().from(households).where(isNull(households.deletedAt)));
  return { household: data?.[0] ?? null, loaded: data !== undefined };
}

export function useHouseholdSettings(householdId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(householdSettings)
      .where(
        and(
          eq(householdSettings.householdId, householdId ?? ''),
          isNull(householdSettings.deletedAt),
        ),
      ),
    [householdId],
  );
  return data?.[0] ?? null;
}

export function useProfiles(householdId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(profiles)
      .where(and(eq(profiles.householdId, householdId ?? ''), isNull(profiles.deletedAt))),
    [householdId],
  );
  return data ?? [];
}

/** Active profile = user selection, falling back to the first member. */
export function useActiveProfile(householdId: string | undefined) {
  const memberList = useProfiles(householdId);
  const activeProfileId = useAppStore((state) => state.activeProfileId);
  return memberList.find((p) => p.id === activeProfileId) ?? memberList[0] ?? null;
}

/** Latest weight/body-fat entry – the single source of truth for "current". */
export function useLatestBodyMetric(profileId: string | undefined) {
  const { data } = useLiveQuery(
    db
      .select()
      .from(bodyMetrics)
      .where(and(eq(bodyMetrics.profileId, profileId ?? ''), isNull(bodyMetrics.deletedAt)))
      .orderBy(desc(bodyMetrics.date), desc(bodyMetrics.createdAt))
      .limit(1),
    [profileId],
  );
  return data?.[0] ?? null;
}

/**
 * Live TDCI/macros for a profile. Because inputs come from live queries and
 * the computation is pure, any change (weight, activity, manual adjustment)
 * re-renders every consumer immediately – no stale values, no app restart.
 */
export function useProfileTargets(profile: ProfileRow | null) {
  const latestMetric = useLatestBodyMetric(profile?.id);
  const settings = useHouseholdSettings(profile?.householdId);
  if (!profile) return null;
  return targetsForProfile(profile, latestMetric, settings?.fiberMode ?? 'efsa_min');
}
