import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
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

import { AdjustServingsModal } from '@/components/AdjustServingsModal';
import { FoodPickerModal } from '@/components/FoodPickerModal';
import { GenerateModal, type GeneratePeriod } from '@/components/GenerateModal';
import { MealActionsMenu } from '@/components/MealActionsMenu';
import { MealPickerModal } from '@/components/MealPickerModal';
import { PlanDayList } from '@/components/PlanDayList';
import { PlanMonthPickerModal } from '@/components/PlanMonthPickerModal';
import { ProfileChip } from '@/components/ProfileChip';
import { ScrollDownHintButton } from '@/components/ScrollDownHintButton';
import { Button } from '@/components/ui/Button';
import { db } from '@/db/client';
import {
  addMealExtra,
  assignManualMeal,
  copyDayMeals,
  generateMonth,
  generateWeek,
  regenerateDay,
  saveMealAsRecipe,
  updatePortionMultiplier,
} from '@/db/repositories/plan';
import { todayIsoDate } from '@/db/time';
import type { RestrictionConflict } from '@/domain/generator/filters';
import { jumpDirection, paneDates, weekJumpTarget, type PagerTransition } from '@/domain/planPager';
import { addDays, previousDay, startOfWeek, weekDates } from '@/domain/week';
import { useActiveProfile, useHousehold, useHouseholdRestrictions, useProfiles, useProfilesAllergens } from '@/hooks/data';
import {
  targetProfileIdForSlot,
  useMealSlots,
  usePortionsForMeal,
  useRecipeNutritionMap,
  type MealRow,
  type SlotRow,
} from '@/hooks/plan';
import { useScrollDownHint } from '@/hooks/useScrollDownHint';
import { useTabScrollRestore } from '@/hooks/useTabScrollRestore';
import { useAppStore } from '@/stores/appStore';
import { confirmDeleteMeal } from '@/utils/mealActions';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

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

/** Turns the domain guard's conflict list into the confirmation dialog's body text. */
function describeConflicts(conflicts: RestrictionConflict[], t: (key: string, opts?: Record<string, unknown>) => string): string {
  const lines = conflicts.map((conflict) => {
    if (conflict.kind === 'allergen') return t('planScreen.conflictAllergen', { allergen: t(`allergens.${conflict.value}`) });
    if (conflict.kind === 'diet') return t('planScreen.conflictDiet', { diet: t(`diets.${conflict.value}`) });
    return t('planScreen.conflictAvoided');
  });
  return lines.join('\n');
}

const SWIPE_THRESHOLD = 60;
const DAY_STRIP_GAP = spacing.xs;

export default function PlanScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { household } = useHousehold();
  const activeProfile = useActiveProfile(household?.id);
  const profiles = useProfiles(household?.id);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const setActiveProfileId = useAppStore((s) => s.setActiveProfileId);
  const householdRestrictions = useHouseholdRestrictions(household?.id);
  const today = todayIsoDate();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const { onScroll: onRestoreScroll, scrollEventThrottle } = useTabScrollRestore(scrollRef);
  const scrollHint = useScrollDownHint(scrollRef);

  const [viewedMonday, setViewedMonday] = useState(() => startOfWeek(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [transition, setTransition] = useState<PagerTransition | null>(null);
  const [monthPickerVisible, setMonthPickerVisible] = useState(false);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [pickerSlot, setPickerSlot] = useState<SlotRow | null>(null);
  const [extraMealId, setExtraMealId] = useState<string | null>(null);
  const [generating, setGenerating] = useState<GeneratePeriod | null>(null);
  const [copyingYesterday, setCopyingYesterday] = useState(false);
  const [expandedSlots, setExpandedSlots] = useState<Record<string, boolean>>({});
  const [clipboard, setClipboard] = useState<{ itemType: 'recipe' | 'food'; itemId: string } | null>(null);
  // Target outlives the menu's visibility: the adjust-servings modal opened
  // from the menu still needs to know which meal it's editing.
  const [menuTarget, setMenuTarget] = useState<{ meal: MealRow; slot: SlotRow } | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [adjustServingsVisible, setAdjustServingsVisible] = useState(false);
  const menuPortions = usePortionsForMeal(menuTarget?.meal.id);

  // Which profiles a manual-assignment pick would apply to, for allergen
  // flagging in the pickers – mirrors assignManualMeal's own relevantProfiles
  // logic (a null track targets every sharesMainMeals profile).
  const pickerProfileIds = useMemo(() => {
    if (!pickerSlot || !activeProfile) return [];
    const trackProfileId = targetProfileIdForSlot(pickerSlot, activeProfile);
    return trackProfileId !== null ? [trackProfileId] : profiles.filter((p) => p.sharesMainMeals).map((p) => p.id);
  }, [pickerSlot, activeProfile, profiles]);
  const pickerAllergens = useProfilesAllergens(pickerProfileIds);
  const mealPickerRestrictedAllergens = useMemo(
    () => [...new Set([...householdRestrictions.allergens, ...pickerAllergens])],
    [householdRestrictions.allergens, pickerAllergens],
  );

  const extraPortions = usePortionsForMeal(extraMealId ?? undefined);
  const extraProfileIds = useMemo(
    () => [...new Set(extraPortions.map((p) => p.profileId))],
    [extraPortions],
  );
  const extraAllergens = useProfilesAllergens(extraProfileIds);
  const foodPickerRestrictedAllergens = useMemo(
    () => [...new Set([...householdRestrictions.allergens, ...extraAllergens])],
    [householdRestrictions.allergens, extraAllergens],
  );

  const slide = useRef(new Animated.Value(0)).current;
  const isAnimating = useRef(false);

  // Jumping in from Home's "Upravit" forces today's date and opens that
  // slot's card, even if this tab was left on a different day/collapsed
  // state from a previous visit (tab screens stay mounted across switches).
  const params = useLocalSearchParams<{ date?: string; expandSlot?: string }>();
  useEffect(() => {
    if (params.date) {
      setTransition(null);
      slide.setValue(0);
      isAnimating.current = false;
      setSelectedDate(params.date);
      setViewedMonday(startOfWeek(params.date));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.date]);

  const dates = useMemo(() => weekDates(viewedMonday), [viewedMonday]);

  const slots = useMealSlots(household?.id);
  const recipeNutritionMap = useRecipeNutritionMap();

  useEffect(() => {
    if (!params.expandSlot) return;
    const slot = slots.find((s) => s.slotKey === params.expandSlot);
    if (slot) setExpandedSlots((prev) => ({ ...prev, [slot.id]: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.expandSlot, slots]);

  // The date the UI should already highlight: mid-transition that's the
  // incoming day, so the pill/today-button/chip colors move in parallel with
  // the sliding content instead of waiting for the commit.
  const visualDate = transition?.date ?? selectedDate;

  // Reset the pager offset only *after* the commit render is on screen –
  // resetting inside the animation callback would show the old middle pane
  // for one frame before React re-keys the panes.
  useLayoutEffect(() => {
    slide.setValue(0);
    isAnimating.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const commit = (target: string) => {
    setSelectedDate(target);
    const targetMonday = startOfWeek(target);
    setViewedMonday((prev) => (prev === targetMonday ? prev : targetMonday));
    setTransition(null);
  };

  const animateTo = (target: string) => {
    if (isAnimating.current) return;
    const dir = jumpDirection(selectedDate, target);
    if (dir === 0) return;
    isAnimating.current = true;
    const targetMonday = startOfWeek(target);
    if (targetMonday !== viewedMonday) setViewedMonday(targetMonday);
    setTransition({ date: target, dir });
    // One frame's grace so a freshly mounted incoming pane can run its
    // SQLite query before it starts sliding into view.
    requestAnimationFrame(() => {
      Animated.timing(slide, {
        toValue: dir === 1 ? -width : width,
        duration: 220,
        useNativeDriver: false,
      }).start(() => commit(target));
    });
  };

  // Recreated whenever selectedDate/viewedMonday/width change so its
  // onPanResponderRelease closure never reads stale values – a bare useRef
  // here would freeze `animateTo` (and the state it captures) at mount time.
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        // Capture (not bubble) so this claims clearly-horizontal gestures
        // before the child ScrollView's own touch handling can swallow them.
        onMoveShouldSetPanResponderCapture: (_, gesture) =>
          !isAnimating.current &&
          Math.abs(gesture.dx) > 15 &&
          Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderMove: Animated.event([null, { dx: slide }], { useNativeDriver: false }),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx <= -SWIPE_THRESHOLD) {
            animateTo(addDays(selectedDate, 1));
          } else if (gesture.dx >= SWIPE_THRESHOLD) {
            animateTo(addDays(selectedDate, -1));
          } else {
            Animated.spring(slide, { toValue: 0, useNativeDriver: false }).start();
          }
        },
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDate, viewedMonday, width],
  );

  // --- Animated selected-day pill -----------------------------------------
  const [stripWidth, setStripWidth] = useState(0);
  const chipWidth = stripWidth > 0 ? (stripWidth - 6 * DAY_STRIP_GAP) / 7 : 0;
  const visualIndex = dates.indexOf(visualDate);
  const pillX = useRef(new Animated.Value(0)).current;
  const pillPlaced = useRef(false);
  useEffect(() => {
    if (visualIndex < 0 || chipWidth <= 0) return;
    const target = visualIndex * (chipWidth + DAY_STRIP_GAP);
    if (!pillPlaced.current) {
      pillX.setValue(target);
      pillPlaced.current = true;
    } else {
      Animated.spring(pillX, { toValue: target, friction: 9, tension: 80, useNativeDriver: true }).start();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visualIndex, chipWidth]);

  // --- Animated "jump to today" row ----------------------------------------
  const showToday = visualDate !== today;
  const todayAnim = useRef(new Animated.Value(showToday ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(todayAnim, {
      toValue: showToday ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showToday]);

  const generateAction = async (period: GeneratePeriod) => {
    if (!household) return;
    setGenerating(period);
    try {
      if (period === 'day') {
        await regenerateDay(db, household.id, selectedDate);
      } else if (period === 'week') {
        await generateWeek(db, household.id, viewedMonday);
      } else {
        await generateMonth(db, household.id, selectedDate);
      }
    } finally {
      setGenerating(null);
      setGenerateModalVisible(false);
    }
  };

  const copyYesterdayAction = () => {
    if (!household) return;
    Alert.alert(t('planScreen.copyYesterdayConfirmTitle'), t('planScreen.copyYesterdayConfirmMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('planScreen.copyYesterday'),
        onPress: () => {
          void (async () => {
            setCopyingYesterday(true);
            try {
              const result = await copyDayMeals(db, household.id, previousDay(selectedDate), selectedDate);
              Alert.alert(
                t('planScreen.copyYesterday'),
                t('planScreen.copyYesterdayResult', { copied: result.copied, skipped: result.skipped }),
              );
            } finally {
              setCopyingYesterday(false);
            }
          })();
        },
      },
    ]);
  };

  const closeMenu = () => setMenuVisible(false);

  const handleCopy = () => {
    if (!menuTarget) return;
    setClipboard({ itemType: menuTarget.meal.itemType, itemId: menuTarget.meal.itemId });
  };

  const handlePaste = () => {
    if (!menuTarget || !household || !clipboard) return;
    const { slot, meal } = menuTarget;
    const assign = (acknowledgeConflict: boolean) =>
      assignManualMeal(db, household.id, selectedDate, slot.slotKey, meal.profileId, clipboard.itemType, clipboard.itemId, acknowledgeConflict);
    void (async () => {
      const { conflicts } = await assign(false);
      if (conflicts.length > 0) {
        Alert.alert(t('planScreen.conflictTitle'), describeConflicts(conflicts, t), [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('planScreen.addAnyway'), style: 'destructive', onPress: () => void assign(true) },
        ]);
      }
    })();
  };

  const handleClear = () => {
    if (!menuTarget || !household) return;
    void confirmDeleteMeal(t, household.id, menuTarget.meal);
  };

  const handleSaveAsRecipe = () => {
    if (!menuTarget || !activeProfile) return;
    void saveMealAsRecipe(db, menuTarget.meal.id, activeProfile.id).then((newRecipeId) => {
      router.push({ pathname: '/recipe/edit', params: { id: newRecipeId } });
    });
  };

  const panes = paneDates(selectedDate, transition ?? undefined);
  const isPast = selectedDate < today;
  // Rendering slid one pane to the left keeps the middle (selected) pane in
  // view; the clamp stops a long manual drag from pulling past the side panes.
  const clampedSlide = slide.interpolate({
    inputRange: [-width, width],
    outputRange: [-width, width],
    extrapolate: 'clamp',
  });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {household ? (
        <View style={styles.profileRow}>
          <ProfileChip
            householdId={household.id}
            selectedProfileId={activeProfileId ?? undefined}
            onSelect={setActiveProfileId}
          />
        </View>
      ) : null}

      <View style={styles.header}>
        {/*
          Equal-width flex:1 side columns (instead of a bare weekNavButton on
          the left vs. a wider today-pill+button group on the right) so the
          middle month title is centered on the actual screen, not just
          centered within its own box next to an asymmetric right side - the
          today pill always reserves its layout width even while hidden
          (opacity/pointerEvents only), so the old layout was permanently
          off-center, not just while the pill was visible.
        */}
        <View style={styles.headerSide}>
          <Pressable
            accessibilityRole="button"
            style={styles.weekNavButton}
            onPress={() => animateTo(weekJumpTarget(selectedDate, -1))}>
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          style={styles.monthTitleButton}
          onPress={() => setMonthPickerVisible(true)}>
          <Text style={styles.monthTitle} numberOfLines={1}>
            {monthTitle(viewedMonday, i18n.language)}
          </Text>
          <Ionicons name="chevron-down" size={16} color={colors.text} />
        </Pressable>
        <View style={[styles.headerSide, styles.headerRightGroup]}>
          <Animated.View style={{ opacity: todayAnim, transform: [{ scale: todayAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }] }}>
            <Pressable
              accessibilityRole="button"
              style={styles.todayPill}
              onPress={() => animateTo(today)}
              pointerEvents={showToday ? 'auto' : 'none'}>
              <Text style={styles.todayPillLabel}>{t('planScreen.jumpToToday')}</Text>
            </Pressable>
          </Animated.View>
          <Pressable
            accessibilityRole="button"
            style={styles.weekNavButton}
            onPress={() => animateTo(weekJumpTarget(selectedDate, 1))}>
            <Ionicons name="chevron-forward" size={20} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.weekStripWrap}>
        <View
          style={styles.weekStrip}
          onLayout={(event) => setStripWidth(event.nativeEvent.layout.width)}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.dayPill,
              {
                width: chipWidth,
                opacity: visualIndex >= 0 && chipWidth > 0 ? 1 : 0,
                transform: [{ translateX: pillX }],
              },
            ]}
          />
          {dates.map((date) => {
            const day = Number(date.split('-')[2]);
            const isToday = date === today;
            const isSelected = date === visualDate;
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                onPress={() => animateTo(date)}
                style={[styles.dayChip, isToday && !isSelected && styles.dayChipToday]}>
                <Text style={[styles.dayWeekday, isSelected && styles.dayTextSelected]}>
                  {weekdayShort(date, i18n.language)}
                </Text>
                <Text style={[styles.dayNumber, isSelected && styles.dayTextSelected]}>{day}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.pagerClip}>
        {household && activeProfile ? (
          <Animated.View
            style={[
              styles.pagerRow,
              { width: width * 3, marginLeft: -width, transform: [{ translateX: clampedSlide }] },
            ]}
            {...panResponder.panHandlers}>
            {panes.map((paneDate) => (
              <PlanDayList
                key={paneDate}
                date={paneDate}
                isActive={paneDate === selectedDate}
                width={width}
                householdId={household.id}
                activeProfile={activeProfile}
                slots={slots}
                recipeNutritionMap={recipeNutritionMap}
                expandedSlots={expandedSlots}
                onToggleExpand={(slotId) =>
                  setExpandedSlots((prev) => ({ ...prev, [slotId]: !prev[slotId] }))
                }
                onPickMeal={setPickerSlot}
                onAddExtra={setExtraMealId}
                onOpenMenu={(meal, slot) => {
                  setMenuTarget({ meal, slot });
                  setMenuVisible(true);
                }}
                scrollRef={scrollRef}
                onScroll={(e) => {
                  onRestoreScroll(e);
                  scrollHint.onScroll(e);
                }}
                onContentSizeChange={scrollHint.onContentSizeChange}
                onLayout={scrollHint.onLayout}
                scrollEventThrottle={scrollEventThrottle}
              />
            ))}
          </Animated.View>
        ) : null}
      </View>

      <ScrollDownHintButton
        visible={scrollHint.visible}
        onPressIn={scrollHint.onPressIn}
        onPressOut={scrollHint.onPressOut}
        bottomOffset={90}
      />

      <View style={styles.footer}>
        {generating || copyingYesterday ? <ActivityIndicator style={styles.spinner} color={colors.primary} /> : null}
        <View style={styles.actionsRow}>
          <Button
            label={generating ? t('today.generating') : t('planScreen.generate')}
            size="compact"
            onPress={() => setGenerateModalVisible(true)}
            disabled={generating !== null || copyingYesterday}
            style={styles.actionButton}
          />
        </View>
        {!isPast ? (
          <View style={[styles.actionsRow, styles.secondActionsRow]}>
            <Button
              label={t('planScreen.copyYesterday')}
              variant="secondary"
              size="compact"
              onPress={copyYesterdayAction}
              disabled={generating !== null || copyingYesterday}
              style={styles.actionButton}
            />
          </View>
        ) : null}
      </View>

      <PlanMonthPickerModal
        visible={monthPickerVisible}
        initialDate={viewedMonday}
        today={today}
        selectedDate={visualDate}
        onSelectDate={(date) => animateTo(date)}
        onClose={() => setMonthPickerVisible(false)}
      />

      {household ? (
        <GenerateModal
          visible={generateModalVisible}
          householdId={household.id}
          generating={generating !== null}
          allowDay={!isPast}
          onClose={() => setGenerateModalVisible(false)}
          onGenerate={(period) => void generateAction(period)}
        />
      ) : null}

      {pickerSlot && household && activeProfile ? (
        <MealPickerModal
          visible
          category={pickerSlot.slotKey === 'breakfast' ? 'breakfast' : pickerSlot.kind === 'snack' ? 'snack' : 'lunch_dinner'}
          restrictedAllergens={mealPickerRestrictedAllergens}
          onClose={() => setPickerSlot(null)}
          onPick={({ itemType, itemId }) => {
            const trackProfileId = targetProfileIdForSlot(pickerSlot, activeProfile);
            const assign = (acknowledgeConflict: boolean) =>
              assignManualMeal(db, household.id, selectedDate, pickerSlot.slotKey, trackProfileId, itemType, itemId, acknowledgeConflict);
            void (async () => {
              const { conflicts } = await assign(false);
              if (conflicts.length > 0) {
                Alert.alert(t('planScreen.conflictTitle'), describeConflicts(conflicts, t), [
                  { text: t('common.cancel'), style: 'cancel' },
                  { text: t('planScreen.addAnyway'), style: 'destructive', onPress: () => void assign(true) },
                ]);
              }
            })();
            setPickerSlot(null);
          }}
        />
      ) : null}

      {extraMealId ? (
        <FoodPickerModal
          visible
          restrictedAllergens={foodPickerRestrictedAllergens}
          onClose={() => setExtraMealId(null)}
          onPick={(food) => {
            const add = (acknowledgeConflict: boolean) => addMealExtra(db, extraMealId, 'food', food.id, acknowledgeConflict);
            void (async () => {
              const { conflicts } = await add(false);
              if (conflicts.length > 0) {
                Alert.alert(t('planScreen.conflictTitle'), describeConflicts(conflicts, t), [
                  { text: t('common.cancel'), style: 'cancel' },
                  { text: t('planScreen.addAnyway'), style: 'destructive', onPress: () => void add(true) },
                ]);
              }
            })();
            setExtraMealId(null);
          }}
        />
      ) : null}

      {menuTarget && menuVisible ? (
        <MealActionsMenu
          visible
          onClose={closeMenu}
          hasClipboard={clipboard !== null}
          onCopy={handleCopy}
          onPaste={handlePaste}
          onClear={handleClear}
          onAdjustServings={() => setAdjustServingsVisible(true)}
          onSaveAsRecipe={handleSaveAsRecipe}
        />
      ) : null}

      {adjustServingsVisible && menuTarget && activeProfile ? (
        <AdjustServingsModal
          visible
          initialMultiplier={menuPortions.find((p) => p.profileId === activeProfile.id)?.multiplier ?? 1}
          onClose={() => {
            setAdjustServingsVisible(false);
            setMenuTarget(null);
          }}
          onConfirm={(multiplier) => {
            const portion = menuPortions.find((p) => p.profileId === activeProfile.id);
            if (portion) void updatePortionMultiplier(db, portion.id, multiplier);
            setAdjustServingsVisible(false);
            setMenuTarget(null);
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
    profileRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      paddingHorizontal: spacing.md,
      marginTop: spacing.sm,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.md,
      marginTop: spacing.sm,
    },
    headerSide: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
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
    // flex weight 2 vs. the side columns' flex:1 each - centering only needs
    // the two side columns to match each other, not the middle, so the title
    // can claim more room without losing center alignment.
    monthTitleButton: {
      flex: 2,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    },
    monthTitle: {
      textAlign: 'center',
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '700',
    },
    headerRightGroup: {
      justifyContent: 'flex-end',
      gap: spacing.xs,
    },
    weekStripWrap: {
      paddingHorizontal: spacing.md,
      marginTop: spacing.sm,
    },
    weekStrip: {
      flexDirection: 'row',
      gap: DAY_STRIP_GAP,
    },
    dayPill: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      borderRadius: radius.input,
      backgroundColor: colors.primary,
    },
    todayPill: {
      height: 30,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.sm + 2,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: radius.chip,
    },
    todayPillLabel: {
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
      backgroundColor: 'transparent',
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
    pagerClip: {
      flex: 1,
      overflow: 'hidden',
      marginTop: spacing.xs,
    },
    pagerRow: {
      flex: 1,
      flexDirection: 'row',
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
    secondActionsRow: {
      marginTop: spacing.sm,
    },
    actionButton: {
      flex: 1,
    },
    spinner: {
      marginBottom: spacing.sm,
    },
  });
}
