import { newId } from '../id';
import { households, householdSettings, mealSlotSettings } from '../schema';
import { nowIso } from '../time';
import { defaultNotificationSettings, type AppDb } from '../types';

export type SlotSeed = {
  slotKey: string;
  kind: 'main' | 'snack';
  sharing: 'shared' | 'individual';
  time: string;
  calorieShare: number;
  sortOrder: number;
};

/**
 * Default day structure per the approved plan: 25/30/25/10/10 % of the daily
 * calorie target. Breakfast sharing follows households.breakfastMode; snacks
 * are always individual (they absorb per-profile nutritional differences).
 */
export const defaultSlots: SlotSeed[] = [
  { slotKey: 'breakfast', kind: 'main', sharing: 'shared', time: '07:30', calorieShare: 0.25, sortOrder: 1 },
  { slotKey: 'snack_morning', kind: 'snack', sharing: 'individual', time: '10:00', calorieShare: 0.1, sortOrder: 2 },
  { slotKey: 'lunch', kind: 'main', sharing: 'shared', time: '12:30', calorieShare: 0.3, sortOrder: 3 },
  { slotKey: 'snack_afternoon', kind: 'snack', sharing: 'individual', time: '15:30', calorieShare: 0.1, sortOrder: 4 },
  { slotKey: 'dinner', kind: 'main', sharing: 'shared', time: '18:30', calorieShare: 0.25, sortOrder: 5 },
];

export async function createHouseholdWithDefaults(db: AppDb, name: string): Promise<string> {
  const householdId = newId();
  const now = nowIso();

  await db.insert(households).values({
    id: householdId,
    createdAt: now,
    updatedAt: now,
    name,
  });

  await db.insert(householdSettings).values({
    id: newId(),
    createdAt: now,
    updatedAt: now,
    householdId,
    notificationsJson: JSON.stringify(defaultNotificationSettings),
  });

  await db.insert(mealSlotSettings).values(
    defaultSlots.map((slot) => ({
      id: newId(),
      createdAt: now,
      updatedAt: now,
      householdId,
      ...slot,
    })),
  );

  return householdId;
}
