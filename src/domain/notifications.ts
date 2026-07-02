/** ISO weekday: 1 = Monday .. 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export const MONDAY: Weekday = 1;
export const SATURDAY: Weekday = 6;
export const SUNDAY: Weekday = 7;

export function parseTimeOfDay(hhmm: string): { hour: number; minute: number } {
  const [hour, minute] = hhmm.split(':').map(Number);
  return { hour, minute };
}

/** A schedulable reminder, independent of the notification API that ends up firing it. */
export type NotificationSpec = {
  /** Stable id so re-syncing can cancel-and-replace rather than accumulate duplicates. */
  id: string;
  titleKey: string;
  bodyKey: string;
  /** null = fires every day at this time (used for meal reminders). */
  weekday: Weekday | null;
  hour: number;
  minute: number;
};

export type NotificationToggles = {
  mealRemindersEnabled: boolean;
  shoppingReminderEnabled: boolean;
  weighInReminderEnabled: boolean;
  planningReminderEnabled: boolean;
  weighInTime: string;
  planningTime: string;
};

export type MealSlotForNotification = {
  slotKey: string;
  time: string;
  enabled: boolean;
};

/**
 * Builds the full set of reminders the household currently wants, from its
 * settings and meal slots. Pure – the caller is responsible for actually
 * scheduling (or cancelling) these with the platform notification API.
 */
export function buildNotificationPlan(
  toggles: NotificationToggles,
  slots: MealSlotForNotification[],
): NotificationSpec[] {
  const specs: NotificationSpec[] = [];

  if (toggles.mealRemindersEnabled) {
    for (const slot of slots) {
      if (!slot.enabled) continue;
      const { hour, minute } = parseTimeOfDay(slot.time);
      specs.push({
        id: `meal-${slot.slotKey}`,
        titleKey: 'notifications.mealTitle',
        bodyKey: `slots.${slot.slotKey}`,
        weekday: null,
        hour,
        minute,
      });
    }
  }

  if (toggles.weighInReminderEnabled) {
    const { hour, minute } = parseTimeOfDay(toggles.weighInTime);
    specs.push({
      id: 'weigh-in',
      titleKey: 'notifications.weighInTitle',
      bodyKey: 'notifications.weighInBody',
      weekday: MONDAY,
      hour,
      minute,
    });
  }

  if (toggles.planningReminderEnabled) {
    const { hour, minute } = parseTimeOfDay(toggles.planningTime);
    specs.push({
      id: 'planning',
      titleKey: 'notifications.planningTitle',
      bodyKey: 'notifications.planningBody',
      weekday: SUNDAY,
      hour,
      minute,
    });
  }

  if (toggles.shoppingReminderEnabled) {
    // Not specified by the brief which day; Saturday morning is a common shopping-trip default.
    specs.push({
      id: 'shopping',
      titleKey: 'notifications.shoppingTitle',
      bodyKey: 'notifications.shoppingBody',
      weekday: SATURDAY,
      hour: 9,
      minute: 0,
    });
  }

  return specs;
}
