import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';

import type * as schema from './schema';

/**
 * Repositories are written against this union so the same code runs on the
 * device (expo-sqlite) and in Jest (better-sqlite3).
 */
export type AppDb = ExpoSQLiteDatabase<typeof schema> | BetterSQLite3Database<typeof schema>;

export type NotificationSettings = {
  mealRemindersEnabled: boolean;
  shoppingReminderEnabled: boolean;
  /** Monday-morning weigh-in reminder. */
  weighInReminderEnabled: boolean;
  /** Sunday-evening "plan next week" reminder. */
  planningReminderEnabled: boolean;
  weighInTime: string;
  planningTime: string;
};

export const defaultNotificationSettings: NotificationSettings = {
  mealRemindersEnabled: true,
  shoppingReminderEnabled: true,
  weighInReminderEnabled: true,
  planningReminderEnabled: true,
  weighInTime: '07:30',
  planningTime: '18:00',
};
