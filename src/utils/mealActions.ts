import { Alert } from 'react-native';
import type { TFunction } from 'i18next';

import { db } from '@/db/client';
import { countOtherOccurrences, removeOtherOccurrences, removePlannedMeal } from '@/db/repositories/plan';
import type { MealRow } from '@/hooks/plan';

/**
 * Shared "remove this meal from the plan" flow for Today/Plan screens: if the
 * same recipe/food is planned again later, offers to remove just this one
 * occurrence or every future one at once.
 */
export async function confirmDeleteMeal(t: TFunction, householdId: string, meal: MealRow): Promise<void> {
  const others = await countOtherOccurrences(db, householdId, meal.itemType, meal.itemId, meal.id);

  if (others > 0) {
    Alert.alert(t('todayMeal.deleteTitle'), t('todayMeal.deleteOthersMessage', { count: others }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('todayMeal.deleteJustThis'), onPress: () => void removePlannedMeal(db, meal.id) },
      {
        text: t('todayMeal.deleteAllOccurrences', { count: others }),
        style: 'destructive',
        onPress: () => {
          void removeOtherOccurrences(db, householdId, meal.itemType, meal.itemId, meal.id).then(() =>
            removePlannedMeal(db, meal.id),
          );
        },
      },
    ]);
  } else {
    Alert.alert(t('todayMeal.deleteTitle'), t('todayMeal.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void removePlannedMeal(db, meal.id) },
    ]);
  }
}
