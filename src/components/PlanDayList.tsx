import { useMemo, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { MealSlotCard } from '@/components/MealSlotCard';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { db } from '@/db/client';
import { regenerateSlot, removeMealExtra, setPortionStatus } from '@/db/repositories/plan';
import { todayIsoDate } from '@/db/time';
import { isWithinDailyTolerance } from '@/domain/generator/tolerance';
import type { RecipeNutrition } from '@/domain/recipeNutrition';
import { useDailyProfileTargets } from '@/hooks/data';
import type { ProfileRow } from '@/hooks/dataMapping';
import { useFoods } from '@/hooks/library';
import {
  findMealForProfileInSlot,
  nutritionForMeal,
  targetProfileIdForSlot,
  useMealsForDate,
  usePortionsForDate,
  type MealRow,
  type SlotRow,
} from '@/hooks/plan';
import { confirmDeleteMeal } from '@/utils/mealActions';
import { slotDisplayLabel } from '@/utils/mealSlots';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

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
  onOpenMenu: (meal: MealRow, slot: SlotRow) => void;
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
  onOpenMenu,
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

  // Fit indicator: whether this day's *planned* totals (not eaten-so-far)
  // land within the tolerance system for the active profile – lets the user
  // spot a poorly-fitting generated day without opening every slot.
  const portionsForDate = usePortionsForDate(householdId, date);
  const dailyTargets = useDailyProfileTargets(activeProfile, date);
  const foodRows = useFoods();
  const foodById = useMemo(() => new Map(foodRows.map((food) => [food.id, food])), [foodRows]);
  const profilePortions = useMemo(
    () => portionsForDate.filter((row) => row.portion.profileId === activeProfile.id),
    [portionsForDate, activeProfile.id],
  );
  const plannedTotals = useMemo(
    () =>
      profilePortions.reduce(
        (acc, row) => {
          const nutrition = nutritionForMeal(row.meal, recipeNutritionMap, foodById);
          if (!nutrition) return acc;
          const multiplier = row.portion.multiplier;
          return {
            kcal: acc.kcal + nutrition.kcal * multiplier,
            proteinG: acc.proteinG + nutrition.proteinG * multiplier,
            carbsG: acc.carbsG + nutrition.carbsG * multiplier,
            fatG: acc.fatG + nutrition.fatG * multiplier,
          };
        },
        { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      ),
    [profilePortions, recipeNutritionMap, foodById],
  );
  const withinTolerance =
    dailyTargets && profilePortions.length > 0 ? isWithinDailyTolerance(plannedTotals, dailyTargets) : null;

  // Undefined/null enabledSlotKeysJson means "every household slot" (the
  // default) - a profile only restricts its own visible slots by explicitly
  // narrowing this list in the wizard's meals card.
  const enabledSlotKeys = activeProfile.enabledSlotKeysJson
    ? (JSON.parse(activeProfile.enabledSlotKeysJson) as string[])
    : null;
  const visibleSlots = enabledSlotKeys ? slots.filter((slot) => enabledSlotKeys.includes(slot.slotKey)) : slots;

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
      {withinTolerance !== null ? (
        <View style={[styles.fitBadge, withinTolerance ? styles.fitBadgeOk : styles.fitBadgeOff]}>
          <Text style={[styles.fitBadgeText, withinTolerance ? styles.fitBadgeTextOk : styles.fitBadgeTextOff]}>
            {withinTolerance ? t('planScreen.fitWithinTolerance') : t('planScreen.fitOutsideTolerance')}
          </Text>
          <InfoTooltip
            titleKey="tooltip.toleranceStatus.title"
            bodyKey="tooltip.toleranceStatus.body"
            color={withinTolerance ? colors.interactive : colors.attention}
          />
        </View>
      ) : null}

      {visibleSlots.map((slot) => {
        const meal = findMealForProfileInSlot(meals, slot, activeProfile);
        const trackProfileId = meal?.profileId ?? targetProfileIdForSlot(slot, activeProfile);
        return (
          <MealSlotCard
            key={slot.id}
            slotLabel={slotDisplayLabel(t, slot)}
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
            onOpenMenu={!isPast ? () => meal && onOpenMenu(meal, slot) : undefined}
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
    fitBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      alignSelf: 'flex-start',
      borderRadius: radius.chip,
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.sm + 2,
      marginBottom: spacing.md,
    },
    fitBadgeOk: {
      backgroundColor: colors.interactive + '22',
    },
    fitBadgeOff: {
      backgroundColor: colors.attention + '22',
    },
    fitBadgeText: {
      fontSize: typography.small,
      fontWeight: '600',
    },
    fitBadgeTextOk: {
      color: colors.interactive,
    },
    fitBadgeTextOff: {
      color: colors.attention,
    },
  });
}
