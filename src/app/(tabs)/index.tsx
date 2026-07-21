import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HomeHeroCard } from '@/components/HomeHeroCard';
import { ScrollDownHintButton } from '@/components/ScrollDownHintButton';
import { StreakRow } from '@/components/StreakRow';
import { WaterCard } from '@/components/WaterCard';
import { Button } from '@/components/ui/Button';
import { todayIsoDate } from '@/db/time';
import { addDays } from '@/domain/week';
import {
  useActiveProfile,
  useDailyProfileTargets,
  useHousehold,
  useHouseholdSettings,
  useLatestBodyMetric,
  useProfileTargets,
} from '@/hooks/data';
import { useFoods } from '@/hooks/library';
import {
  findMealForProfileInSlot,
  nutritionForMeal,
  useMealSlots,
  useMealsForDate,
  useMealStreakDates,
  usePortionsForDate,
  useRecipeNutritionMap,
} from '@/hooks/plan';
import { useShoppingItems } from '@/hooks/shopping';
import { useScrollDownHint } from '@/hooks/useScrollDownHint';
import { useTabScrollRestore } from '@/hooks/useTabScrollRestore';
import { useWaterGoalDates } from '@/hooks/water';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';
import { slotDisplayLabel } from '@/utils/mealSlots';

function currentHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function TodayScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const scrollRef = useRef<ScrollView>(null);
  const { onScroll: onRestoreScroll, scrollEventThrottle } = useTabScrollRestore(scrollRef);
  const scrollHint = useScrollDownHint(scrollRef);
  const { household } = useHousehold();
  const settings = useHouseholdSettings(household?.id);
  const activeProfile = useActiveProfile(household?.id);
  const activeProfileId = useAppStore((s) => s.activeProfileId);
  const setActiveProfileId = useAppStore((s) => s.setActiveProfileId);
  const targets = useProfileTargets(activeProfile);
  const today = todayIsoDate();
  const dailyTargets = useDailyProfileTargets(activeProfile, today);
  const latestMetric = useLatestBodyMetric(activeProfile?.id);

  const slots = useMealSlots(household?.id);
  const meals = useMealsForDate(household?.id, today);
  const recipeNutritionMap = useRecipeNutritionMap();
  const foodRows = useFoods();
  const foodById = useMemo(() => new Map(foodRows.map((f) => [f.id, f])), [foodRows]);
  const portionsForDate = usePortionsForDate(household?.id, today);
  const shoppingItems = useShoppingItems(household?.id);
  const shoppingRemaining = shoppingItems.filter((item) => !item.checked).length;

  const streakSinceDate = useMemo(() => addDays(today, -180), [today]);
  const { anyEatenDates, allEatenDates } = useMealStreakDates(household?.id, activeProfile?.id, streakSinceDate);
  const waterGoalDates = useWaterGoalDates(
    activeProfile?.id,
    latestMetric?.weightKg,
    activeProfile?.sex,
    activeProfile?.waterGoalMl,
    streakSinceDate,
  );

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
  const todayMealTotal = profilePortionsToday.length;
  const todayMealCount = profilePortionsToday.filter((row) => row.portion.status === 'eaten').length;

  const nowHHMM = currentHHMM();
  const nextMealEntry = activeProfile
    ? [...slots]
        .filter((slot) => slot.time >= nowHHMM)
        .sort((a, b) => a.time.localeCompare(b.time))
        .map((slot) => ({ slot, meal: findMealForProfileInSlot(meals, slot, activeProfile) }))
        .find((entry) => entry.meal !== undefined)
    : undefined;

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
            selectedProfileId={activeProfileId ?? undefined}
            onSelectProfile={setActiveProfileId}
            targets={targets}
            eatenKcal={eaten?.kcal ?? 0}
            targetKcal={dailyTargets?.kcal ?? 0}
            onEditProfile={() => router.push({ pathname: '/profile/[id]', params: { id: activeProfile.id } })}
            nextMeal={
              nextMealEntry?.meal
                ? {
                    slotLabel: slotDisplayLabel(t, nextMealEntry.slot),
                    slotKey: nextMealEntry.slot.slotKey,
                    meal: nextMealEntry.meal,
                  }
                : undefined
            }
          />
        ) : null}

        <StreakRow
          profileId={activeProfile?.id}
          today={today}
          anyEatenDates={anyEatenDates}
          allEatenDates={allEatenDates}
          waterGoalDates={waterGoalDates}
          todayMealCount={todayMealCount}
          todayMealTotal={todayMealTotal}
        />

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
            onPress={() => router.push('/progress')}>
            <View style={styles.quickTopRow}>
              <Ionicons name="trending-up-outline" size={16} color={colors.primary} />
            </View>
            <Text style={styles.quickLabel}>{t('today.logWeight')}</Text>
          </Pressable>
        </View>

        {activeProfile?.trackWater && latestMetric && settings ? (
          <WaterCard
            profileId={activeProfile.id}
            sex={activeProfile.sex}
            weightKg={latestMetric.weightKg}
            trackWater={activeProfile.trackWater}
            waterGoalMl={activeProfile.waterGoalMl}
            waterGlassMl={activeProfile.waterGlassMl}
            unitSystem={settings.unitSystem}
          />
        ) : null}

        {!nextMealEntry?.meal ? (
          <Button
            label={t('today.viewMealPlan')}
            variant="secondary"
            onPress={() => router.push('/plan')}
            style={styles.viewPlanButton}
          />
        ) : null}
      </ScrollView>

      <ScrollDownHintButton
        visible={scrollHint.visible}
        onPressIn={scrollHint.onPressIn}
        onPressOut={scrollHint.onPressOut}
      />
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
    quickRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    quickCard: {
      flex: 1,
      minHeight: 56,
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.sm,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 1,
    },
    quickTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
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
      textAlign: 'center',
    },
    viewPlanButton: {
      marginTop: spacing.sm,
    },
  });
}
