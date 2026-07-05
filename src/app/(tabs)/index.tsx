import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodPickerModal } from '@/components/FoodPickerModal';
import { HomeHeroCard } from '@/components/HomeHeroCard';
import { MealPickerModal } from '@/components/MealPickerModal';
import { MealSlotCard } from '@/components/MealSlotCard';
import { NextMealCard } from '@/components/NextMealCard';
import { ScrollDownHintButton } from '@/components/ScrollDownHintButton';
import { Button } from '@/components/ui/Button';
import { db } from '@/db/client';
import {
  addMealExtra,
  assignManualMeal,
  generateWeek,
  regenerateSlot,
  removeMealExtra,
  setPortionStatus,
} from '@/db/repositories/plan';
import { todayIsoDate } from '@/db/time';
import { startOfWeek } from '@/domain/week';
import {
  useActiveProfile,
  useDailyProfileTargets,
  useHousehold,
  useProfileTargets,
} from '@/hooks/data';
import { useFoods } from '@/hooks/library';
import {
  findMealForProfileInSlot,
  nutritionForMeal,
  useMealSlots,
  useMealsForDate,
  usePortionsForDate,
  useRecipeNutritionMap,
  type SlotRow,
} from '@/hooks/plan';
import { usePantryItems, useShoppingItems } from '@/hooks/shopping';
import { useScrollDownHint } from '@/hooks/useScrollDownHint';
import { useTabScrollRestore } from '@/hooks/useTabScrollRestore';
import { confirmDeleteMeal } from '@/utils/mealActions';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

function currentHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function targetProfileIdForSlot(slot: SlotRow, profile: { id: string; sharesMainMeals: boolean }): string | null {
  if (slot.kind === 'snack') return profile.id;
  return profile.sharesMainMeals ? null : profile.id;
}

export default function TodayScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const { onScroll: onRestoreScroll, scrollEventThrottle } = useTabScrollRestore(scrollRef);
  const scrollHint = useScrollDownHint(scrollRef);
  const { household } = useHousehold();
  const activeProfile = useActiveProfile(household?.id);
  const targets = useProfileTargets(activeProfile);
  const today = todayIsoDate();
  const dailyTargets = useDailyProfileTargets(activeProfile, today);

  const slots = useMealSlots(household?.id);
  const meals = useMealsForDate(household?.id, today);
  const recipeNutritionMap = useRecipeNutritionMap();
  const foodRows = useFoods();
  const foodById = new Map(foodRows.map((f) => [f.id, f]));
  const portionsForDate = usePortionsForDate(household?.id, today);
  const shoppingItems = useShoppingItems(household?.id);
  const shoppingRemaining = shoppingItems.filter((item) => !item.checked).length;
  const pantryItems = usePantryItems(household?.id);
  const pantryExpiringSoon = pantryItems.filter((item) => item.expiresAt !== null && item.expiresAt <= today).length;

  const [pickerSlot, setPickerSlot] = useState<SlotRow | null>(null);
  const [extraMealId, setExtraMealId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const hasAnyMeal = meals.length > 0;

  const sumNutrition = (rows: typeof portionsForDate) =>
    rows.reduce(
      (acc, row) => {
        const nutrition = nutritionForMeal(row.meal, recipeNutritionMap, foodById);
        if (!nutrition) return acc;
        const m = row.portion.multiplier;
        return {
          kcal: acc.kcal + nutrition.kcal * m,
          proteinG: acc.proteinG + nutrition.proteinG * m,
          carbsG: acc.carbsG + nutrition.carbsG * m,
          fatG: acc.fatG + nutrition.fatG * m,
        };
      },
      { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 },
    );

  const profilePortionsToday = activeProfile
    ? portionsForDate.filter((row) => row.portion.profileId === activeProfile.id)
    : [];
  const eaten = activeProfile
    ? sumNutrition(profilePortionsToday.filter((row) => row.portion.status === 'eaten'))
    : null;

  const nowHHMM = currentHHMM();
  const nextMealEntry = activeProfile
    ? [...slots]
        .filter((slot) => slot.time >= nowHHMM)
        .sort((a, b) => a.time.localeCompare(b.time))
        .map((slot) => ({ slot, meal: findMealForProfileInSlot(meals, slot, activeProfile) }))
        .find((entry) => entry.meal !== undefined)
    : undefined;

  const generateThisWeek = async () => {
    if (!household) return;
    setGenerating(true);
    try {
      await generateWeek(db, household.id, startOfWeek(today));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
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
        <Text style={styles.heading}>{t('today.title')}</Text>

        {household && activeProfile && targets ? (
          <HomeHeroCard
            householdId={household.id}
            targets={targets}
            eatenKcal={eaten?.kcal ?? 0}
            targetKcal={dailyTargets?.kcal ?? 0}
            onEditProfile={() => router.push({ pathname: '/profile/[id]', params: { id: activeProfile.id } })}
          />
        ) : null}

        <View style={styles.quickRow}>
          <Pressable
            accessibilityRole="button"
            style={styles.quickCard}
            onPress={() => router.push('/shopping')}>
            <View style={styles.quickTopRow}>
              <Ionicons name="cart-outline" size={16} color={colors.primary} />
              <Text style={styles.quickValue}>{shoppingRemaining}</Text>
            </View>
            <Text style={styles.quickLabel}>{t('today.shoppingRemaining')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={styles.quickCard}
            onPress={() => router.push('/pantry')}>
            <View style={styles.quickTopRow}>
              <Ionicons name="file-tray-stacked-outline" size={16} color={colors.primary} />
              <Text style={styles.quickValue}>{pantryExpiringSoon}</Text>
            </View>
            <Text style={styles.quickLabel}>{t('today.pantryExpiring')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={styles.quickCard}
            onPress={() => router.push('/progress')}>
            <View style={styles.quickTopRow}>
              <Ionicons name="trending-up-outline" size={16} color={colors.primary} />
            </View>
            <Text style={styles.quickLabel}>{t('today.logWeight')}</Text>
          </Pressable>
        </View>

        {nextMealEntry?.meal ? (
          <NextMealCard slotLabel={t(`slots.${nextMealEntry.slot.slotKey}`)} meal={nextMealEntry.meal} />
        ) : null}

        {!hasAnyMeal ? (
          <View style={styles.emptyState}>
            <Image
              source={require('../../assets/images/empty-states/mealplan-empty.png')}
              style={styles.emptyImage}
              contentFit="contain"
            />
            <Text style={styles.emptyTitle}>{t('today.mealsComingTitle')}</Text>
            <Text style={styles.emptyText}>{t('today.mealsComingText')}</Text>
            <Button
              label={generating ? t('today.generating') : t('today.generateWeek')}
              onPress={generateThisWeek}
              disabled={generating || !household}
              style={styles.generateButton}
            />
            {generating ? <ActivityIndicator style={styles.spinner} color={colors.primary} /> : null}
          </View>
        ) : null}

        {activeProfile ? (
          <View style={styles.mealList}>
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
                  onSwap={() => {
                    if (!household) return;
                    void regenerateSlot(db, household.id, today, slot.slotKey, trackProfileId);
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
            })}
          </View>
        ) : null}
      </ScrollView>

      <ScrollDownHintButton
        visible={scrollHint.visible}
        onPressIn={scrollHint.onPressIn}
        onPressOut={scrollHint.onPressOut}
      />

      {pickerSlot && household && activeProfile ? (
        <MealPickerModal
          visible
          category={pickerSlot.slotKey === 'breakfast' ? 'breakfast' : pickerSlot.kind === 'snack' ? 'snack' : 'lunch_dinner'}
          onClose={() => setPickerSlot(null)}
          onPick={({ itemType, itemId }) => {
            const trackProfileId = targetProfileIdForSlot(pickerSlot, activeProfile);
            void assignManualMeal(db, household.id, today, pickerSlot.slotKey, trackProfileId, itemType, itemId);
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
    content: {
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },
    heading: {
      color: colors.text,
      fontSize: typography.title,
      fontWeight: '800',
      marginBottom: spacing.sm,
    },
    mealList: {
      marginTop: spacing.md,
    },
    quickRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    quickCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.sm,
      alignItems: 'flex-start',
      gap: 2,
    },
    quickTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    quickValue: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '800',
    },
    quickLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
    },
    emptyState: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.md,
      alignItems: 'center',
    },
    emptyImage: {
      width: '100%',
      height: 140,
      marginBottom: spacing.sm,
    },
    emptyTitle: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '700',
      marginTop: spacing.sm,
      marginBottom: spacing.xs,
      textAlign: 'center',
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: typography.small,
      lineHeight: 20,
      marginBottom: spacing.md,
      textAlign: 'center',
    },
    generateButton: {},
    spinner: {
      marginTop: spacing.sm,
    },
  });
}
