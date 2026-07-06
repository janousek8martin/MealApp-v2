import { useMemo, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  StyleSheet,
  Text,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { MealSlotCard } from '@/components/MealSlotCard';
import { db } from '@/db/client';
import { regenerateSlot, removeMealExtra, setPortionStatus } from '@/db/repositories/plan';
import { todayIsoDate } from '@/db/time';
import type { RecipeNutrition } from '@/domain/recipeNutrition';
import type { ProfileRow } from '@/hooks/dataMapping';
import {
  findMealForProfileInSlot,
  targetProfileIdForSlot,
  useMealsForDate,
  type SlotRow,
} from '@/hooks/plan';
import { confirmDeleteMeal } from '@/utils/mealActions';
import { useTheme } from '@/theme/ThemeContext';
import { spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  date: string;
  isActive: boolean;
  width: number;
  householdId: string;
  activeProfile: ProfileRow;
  slots: SlotRow[];
  recipeNutritionMap: Map<string, RecipeNutrition>;
  expandedSlots: Record<string, boolean>;
  onToggleExpand: (slotId: string) => void;
  onPickMeal: (slot: SlotRow) => void;
  onAddExtra: (mealId: string) => void;
  /** Wired only on the active pane – preview panes scroll with the pager, not vertically. */
  scrollRef: RefObject<ScrollView | null>;
  onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onContentSizeChange: (w: number, h: number) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  scrollEventThrottle: number;
};

/**
 * One day's meal list – a pane of the Plan screen's horizontal pager. Each
 * pane owns its date's live query, so adjacent/incoming days render real
 * content while they slide in instead of blank space or stale data.
 */
export function PlanDayList({
  date,
  isActive,
  width,
  householdId,
  activeProfile,
  slots,
  recipeNutritionMap,
  expandedSlots,
  onToggleExpand,
  onPickMeal,
  onAddExtra,
  scrollRef,
  onScroll,
  onContentSizeChange,
  onLayout,
  scrollEventThrottle,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const meals = useMealsForDate(householdId, date);
  const isPast = date < todayIsoDate();

  return (
    <ScrollView
      ref={isActive ? scrollRef : undefined}
      style={{ width }}
      scrollEnabled={isActive}
      contentContainerStyle={styles.content}
      onScroll={isActive ? onScroll : undefined}
      onContentSizeChange={isActive ? onContentSizeChange : undefined}
      onLayout={isActive ? onLayout : undefined}
      scrollEventThrottle={scrollEventThrottle}>
      {isPast ? <Text style={styles.pastNotice}>{t('planScreen.pastNotice')}</Text> : null}

      {slots.map((slot) => {
        const meal = findMealForProfileInSlot(meals, slot, activeProfile);
        const trackProfileId = meal?.profileId ?? targetProfileIdForSlot(slot, activeProfile);
        return (
          <MealSlotCard
            key={slot.id}
            slotLabel={t(`slots.${slot.slotKey}`)}
            meal={meal}
            activeProfileId={activeProfile.id}
            recipeNutritionMap={recipeNutritionMap}
            disabled={isPast}
            expanded={!!expandedSlots[slot.id]}
            onToggleExpand={() => onToggleExpand(slot.id)}
            onSwap={() => void regenerateSlot(db, householdId, date, slot.slotKey, trackProfileId)}
            onAddMeal={() => onPickMeal(slot)}
            onDeleteMeal={() => {
              if (!meal) return;
              void confirmDeleteMeal(t, householdId, meal);
            }}
            onAddExtra={() => meal && onAddExtra(meal.id)}
            onRemoveExtra={(extraId) => void removeMealExtra(db, extraId)}
            onSetStatus={(portionId, status) => void setPortionStatus(db, portionId, status)}
          />
        );
      })}
    </ScrollView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    content: {
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },
    pastNotice: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginBottom: spacing.md,
    },
  });
}
