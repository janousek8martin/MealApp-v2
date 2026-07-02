import * as Notifications from 'expo-notifications';
import { and, eq, isNull } from 'drizzle-orm';

import { db } from '@/db/client';
import { householdSettings, mealSlotSettings } from '@/db/schema';
import type { AppDb } from '@/db/types';
import { defaultNotificationSettings, type NotificationSettings } from '@/db/types';
import { buildNotificationPlan, type NotificationSpec, type Weekday } from '@/domain/notifications';
import i18n from '@/i18n';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function requestNotificationPermissions(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

/** expo-notifications' WEEKLY trigger counts weekdays from Sunday=1; our domain uses ISO (Monday=1). */
function toExpoWeekday(isoWeekday: Weekday): number {
  return (isoWeekday % 7) + 1;
}

function triggerFor(spec: NotificationSpec): Notifications.SchedulableNotificationTriggerInput {
  if (spec.weekday === null) {
    return { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: spec.hour, minute: spec.minute };
  }
  return {
    type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
    weekday: toExpoWeekday(spec.weekday),
    hour: spec.hour,
    minute: spec.minute,
  };
}

/**
 * Cancels every reminder this app previously scheduled and re-schedules the
 * current set from household settings + meal slots. Safe to call whenever
 * settings change – re-syncing never accumulates duplicates.
 */
export async function syncNotifications(database: AppDb, householdId: string): Promise<void> {
  const granted = await requestNotificationPermissions();
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!granted) return;

  const [settingsRow] = await database
    .select()
    .from(householdSettings)
    .where(and(eq(householdSettings.householdId, householdId), isNull(householdSettings.deletedAt)));
  const toggles: NotificationSettings = settingsRow?.notificationsJson
    ? (JSON.parse(settingsRow.notificationsJson) as NotificationSettings)
    : defaultNotificationSettings;

  const slotRows = await database
    .select()
    .from(mealSlotSettings)
    .where(and(eq(mealSlotSettings.householdId, householdId), isNull(mealSlotSettings.deletedAt)));
  const slots = slotRows.map((row) => ({ slotKey: row.slotKey, time: row.time, enabled: row.enabled }));

  const plan = buildNotificationPlan(toggles, slots);
  for (const spec of plan) {
    await Notifications.scheduleNotificationAsync({
      identifier: spec.id,
      content: {
        title: i18n.t(spec.titleKey),
        body: i18n.t(spec.bodyKey),
      },
      trigger: triggerFor(spec),
    });
  }
}

/** Convenience wrapper using the app's live database connection. */
export function syncHouseholdNotifications(householdId: string): Promise<void> {
  return syncNotifications(db, householdId);
}
