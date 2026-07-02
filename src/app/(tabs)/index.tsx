import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MealPickerModal } from '@/components/MealPickerModal';
import { MealSlotCard } from '@/components/MealSlotCard';
import { ProfileSwitcher } from '@/components/ProfileSwitcher';
import { Button } from '@/components/ui/Button';
import { TdciCard } from '@/components/TdciCard';
import { db } from '@/db/client';
import { assignManualMeal, generateWeek, regenerateSlot, setPortionStatus } from '@/db/repositories/plan';
import { todayIsoDate } from '@/db/time';
import { startOfWeek } from '@/domain/week';
import {
  useActiveProfile,
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
import { colors, radius, spacing, typography } from '@/theme/tokens';

function targetProfileIdForSlot(slot: SlotRow, profile: { id: string; sharesMainMeals: boolean }): string | null {
  if (slot.kind === 'snack') return profile.id;
  return profile.sharesMainMeals ? null : profile.id;
}

export default function TodayScreen() {
  const { t } = useTranslation();
  const { household } = useHousehold();
  const activeProfile = useActiveProfile(household?.id);
  const targets = useProfileTargets(activeProfile);
  const today = todayIsoDate();

  const slots = useMealSlots(household?.id);
  const meals = useMealsForDate(household?.id, today);
  const recipeNutritionMap = useRecipeNutritionMap();
  const foodRows = useFoods();
  const foodById = new Map(foodRows.map((f) => [f.id, f]));
  const portionsForDate = usePortionsForDate(household?.id, today);

  const [pickerSlot, setPickerSlot] = useState<SlotRow | null>(null);
  const [generating, setGenerating] = useState(false);

  const hasAnyMeal = meals.length > 0;

  const consumed = activeProfile
    ? portionsForDate
        .filter((row) => row.portion.profileId === activeProfile.id)
        .reduce(
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
        )
    : null;

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
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>{t('today.title')}</Text>

        {household ? <ProfileSwitcher householdId={household.id} /> : null}

        {activeProfile && targets ? <TdciCard name={activeProfile.name} targets={targets} /> : null}

        {activeProfile && targets && consumed ? (
          <View style={styles.fitCard}>
            <Text style={styles.fitTitle}>{t('today.fitTitle')}</Text>
            <Text style={styles.fitLine}>
              {t('today.fitSummary', {
                consumed: Math.round(consumed.kcal),
                target: Math.round(targets.adjustedTdciKcal),
              })}
            </Text>
          </View>
        ) : null}

        {!hasAnyMeal ? (
          <View style={styles.emptyState}>
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
                  onSwap={() => {
                    if (!household) return;
                    void regenerateSlot(db, household.id, today, slot.slotKey, trackProfileId);
                  }}
                  onAddMeal={() => setPickerSlot(slot)}
                  onSetStatus={(portionId, status) => void setPortionStatus(db, portionId, status)}
                />
              );
            })
          : null}
      </ScrollView>

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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  fitCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  fitTitle: {
    color: colors.text,
    fontSize: typography.small,
    fontWeight: '700',
    marginBottom: 2,
  },
  fitLine: {
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
  },
  emptyTitle: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: typography.small,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  generateButton: {
    alignSelf: 'flex-start',
  },
  spinner: {
    marginTop: spacing.sm,
  },
});
