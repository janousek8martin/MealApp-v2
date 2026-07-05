import { Ionicons } from '@expo/vector-icons';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Animated,
  PanResponder,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodPickerModal } from '@/components/FoodPickerModal';
import { MealPickerModal } from '@/components/MealPickerModal';
import { MealSlotCard } from '@/components/MealSlotCard';
import { ProfileSwitcher } from '@/components/ProfileSwitcher';
import { ScrollDownHintButton } from '@/components/ScrollDownHintButton';
import { Button } from '@/components/ui/Button';
import { db } from '@/db/client';
import {
  addMealExtra,
  assignManualMeal,
  generateWeek,
  regenerateDay,
  regenerateSlot,
  removeMealExtra,
  setPortionStatus,
} from '@/db/repositories/plan';
import { todayIsoDate } from '@/db/time';
import { addDays, startOfWeek, weekDates } from '@/domain/week';
import { useActiveProfile, useHousehold } from '@/hooks/data';
import {
  findMealForProfileInSlot,
  useMealSlots,
  useMealsForDate,
  useRecipeNutritionMap,
  type SlotRow,
} from '@/hooks/plan';
import { useScrollDownHint } from '@/hooks/useScrollDownHint';
import { useTabScrollRestore } from '@/hooks/useTabScrollRestore';
import { confirmDeleteMeal } from '@/utils/mealActions';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

function targetProfileIdForSlot(slot: SlotRow, profile: { id: string; sharesMainMeals: boolean }): string | null {
  if (slot.kind === 'snack') return profile.id;
  return profile.sharesMainMeals ? null : profile.id;
}

function weekdayShort(dateIso: string, language: string): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(language === 'cs' ? 'cs-CZ' : 'en-US', { weekday: 'short' }).format(date);
}

function monthTitle(dateIso: string, language: string): string {
  const [y, m, d] = dateIso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const formatted = new Intl.DateTimeFormat(language === 'cs' ? 'cs-CZ' : 'en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

const SWIPE_THRESHOLD = 60;

export default function PlanScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { household } = useHousehold();
  const activeProfile = useActiveProfile(household?.id);
  const today = todayIsoDate();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const { onScroll: onRestoreScroll, scrollEventThrottle } = useTabScrollRestore(scrollRef);
  const scrollHint = useScrollDownHint(scrollRef);

  const [viewedMonday, setViewedMonday] = useState(() => startOfWeek(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [pickerSlot, setPickerSlot] = useState<SlotRow | null>(null);
  const [extraMealId, setExtraMealId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<'week' | 'day' | null>(null);

  const slideAnim = useRef(new Animated.Value(0)).current;

  const dates = useMemo(() => weekDates(viewedMonday), [viewedMonday]);

  const slots = useMealSlots(household?.id);
  const meals = useMealsForDate(household?.id, selectedDate);
  const recipeNutritionMap = useRecipeNutritionMap();

  const isPast = selectedDate < today;

  const goToWeek = (mondayIso: string) => {
    setViewedMonday(mondayIso);
    setSelectedDate(mondayIso);
  };

  const changeDay = (delta: 1 | -1) => {
    Animated.timing(slideAnim, {
      toValue: delta === 1 ? -width : width,
      duration: 180,
      useNativeDriver: false,
    }).start(() => {
      slideAnim.setValue(0);
      const nextDate = addDays(selectedDate, delta);
      setSelectedDate(nextDate);
      const nextMonday = startOfWeek(nextDate);
      if (nextMonday !== viewedMonday) setViewedMonday(nextMonday);
    });
  };

  // Recreated whenever selectedDate/viewedMonday/width change so its
  // onPanResponderRelease closure never reads stale values – a bare useRef
  // here would freeze `changeDay` (and the state it captures) at mount time.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Capture (not bubble) so this claims clearly-horizontal gestures
        // before the child ScrollView's own touch handling can swallow them.
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          Math.abs(gesture.dx) > 15 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderMove: Animated.event([null, { dx: slideAnim }], { useNativeDriver: false }),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx <= -SWIPE_THRESHOLD) {
            changeDay(1);
          } else if (gesture.dx >= SWIPE_THRESHOLD) {
            changeDay(-1);
          } else {
            Animated.spring(slideAnim, { toValue: 0, useNativeDriver: false }).start();
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDate, viewedMonday, width],
  );

  const jumpToToday = () => {
    setSelectedDate(today);
    setViewedMonday(startOfWeek(today));
  };

  const generateWeekAction = async () => {
    if (!household) return;
    setGenerating('week');
    try {
      await generateWeek(db, household.id, viewedMonday);
    } finally {
      setGenerating(null);
    }
  };

  const generateDayAction = async () => {
    if (!household) return;
    setGenerating('day');
    try {
      await regenerateDay(db, household.id, selectedDate);
    } finally {
      setGenerating(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          style={styles.weekNavButton}
          onPress={() => goToWeek(addDays(viewedMonday, -7))}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
        </Pressable>
        <Text style={styles.monthTitle}>{monthTitle(viewedMonday, i18n.language)}</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.weekNavButton}
          onPress={() => goToWeek(addDays(viewedMonday, 7))}>
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        </Pressable>
      </View>

      <View style={styles.weekStrip}>
        {dates.map((date) => {
          const day = Number(date.split('-')[2]);
          const isToday = date === today;
          const isSelected = date === selectedDate;
          return (
            <Pressable
              key={date}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
              onPress={() => setSelectedDate(date)}
              style={[styles.dayChip, isSelected && styles.dayChipSelected, isToday && !isSelected && styles.dayChipToday]}>
              <Text style={[styles.dayWeekday, isSelected && styles.dayTextSelected]}>
                {weekdayShort(date, i18n.language)}
              </Text>
              <Text style={[styles.dayNumber, isSelected && styles.dayTextSelected]}>{day}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.subHeaderRow}>
        {household ? (
          <View style={styles.profileSwitcherRow}>
            <ProfileSwitcher householdId={household.id} />
          </View>
        ) : (
          <View />
        )}
        {selectedDate !== today ? (
          <Pressable accessibilityRole="button" style={styles.todayButton} onPress={jumpToToday}>
            <Text style={styles.todayButtonLabel}>{t('planScreen.jumpToToday')}</Text>
          </Pressable>
        ) : null}
      </View>

      <Animated.View
        style={[styles.swipeArea, { transform: [{ translateX: slideAnim }] }]}
        {...panResponder.panHandlers}>
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.content}
          onScroll={(e) => {
            onRestoreScroll(e);
            scrollHint.onScroll(e);
          }}
          onContentSizeChange={scrollHint.onContentSizeChange}
          onLayout={scrollHint.onLayout}
          scrollEventThrottle={scrollEventThrottle}>
          {isPast ? <Text style={styles.pastNotice}>{t('planScreen.pastNotice')}</Text> : null}

          {activeProfile
            ? slots.map((slot) => {
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
                    onSwap={() => {
                      if (!household) return;
                      void regenerateSlot(db, household.id, selectedDate, slot.slotKey, trackProfileId);
                    }}
                    onAddMeal={() => setPickerSlot(slot)}
                    onDeleteMeal={() => {
                      if (!household || !meal) return;
                      void confirmDeleteMeal(t, household.id, meal);
                    }}
                    onAddExtra={() => meal && setExtraMealId(meal.id)}
                    onRemoveExtra={(extraId) => void removeMealExtra(db, extraId)}
                    onSetStatus={(portionId, status) => void setPortionStatus(db, portionId, status)}
                  />
                );
              })
            : null}
        </ScrollView>
      </Animated.View>

      <ScrollDownHintButton
        visible={scrollHint.visible}
        onPressIn={scrollHint.onPressIn}
        onPressOut={scrollHint.onPressOut}
        bottomOffset={90}
      />

      <View style={styles.footer}>
        {generating ? <ActivityIndicator style={styles.spinner} color={colors.primary} /> : null}
        <View style={styles.actionsRow}>
          <Button
            label={generating === 'week' ? t('today.generating') : t('planScreen.generateWeek')}
            variant="secondary"
            onPress={generateWeekAction}
            disabled={generating !== null}
            style={styles.actionButton}
          />
          {!isPast ? (
            <Button
              label={generating === 'day' ? t('today.generating') : t('planScreen.generateDay')}
              onPress={generateDayAction}
              disabled={generating !== null}
              style={styles.actionButton}
            />
          ) : null}
        </View>
      </View>

      {pickerSlot && household && activeProfile ? (
        <MealPickerModal
          visible
          category={pickerSlot.slotKey === 'breakfast' ? 'breakfast' : pickerSlot.kind === 'snack' ? 'snack' : 'lunch_dinner'}
          onClose={() => setPickerSlot(null)}
          onPick={({ itemType, itemId }) => {
            const trackProfileId = targetProfileIdForSlot(pickerSlot, activeProfile);
            void assignManualMeal(db, household.id, selectedDate, pickerSlot.slotKey, trackProfileId, itemType, itemId);
            setPickerSlot(null);
          }}
        />
      ) : null}

      {extraMealId ? (
        <FoodPickerModal
          visible
          onClose={() => setExtraMealId(null)}
          onPick={(food) => {
            void addMealExtra(db, extraMealId, 'food', food.id);
            setExtraMealId(null);
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      marginTop: spacing.sm,
    },
    weekNavButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    monthTitle: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '700',
    },
    weekStrip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
      marginTop: spacing.sm,
      gap: spacing.xs,
    },
    subHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.md,
    },
    profileSwitcherRow: {
      flex: 1,
    },
    todayButton: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: radius.chip,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.sm + 2,
    },
    todayButtonLabel: {
      color: colors.primary,
      fontSize: typography.small,
      fontWeight: '700',
    },
    dayChip: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: radius.input,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    dayChipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    dayChipToday: {
      borderColor: colors.primary,
    },
    dayWeekday: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '600',
      textTransform: 'capitalize',
    },
    dayNumber: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
      marginTop: 2,
    },
    dayTextSelected: {
      color: colors.onPrimary,
    },
    swipeArea: {
      flex: 1,
    },
    content: {
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },
    footer: {
      padding: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      backgroundColor: colors.background,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    actionButton: {
      flex: 1,
    },
    spinner: {
      marginBottom: spacing.sm,
    },
    pastNotice: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginBottom: spacing.md,
    },
  });
}
