import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodPickerModal } from '@/components/FoodPickerModal';
import { MealPickerModal } from '@/components/MealPickerModal';
import { MealSlotCard } from '@/components/MealSlotCard';
import { ProfileSwitcher } from '@/components/ProfileSwitcher';
import { Button } from '@/components/ui/Button';
import { TdciCard } from '@/components/TdciCard';
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
import { useShoppingItems } from '@/hooks/shopping';
import { confirmDeleteMeal } from '@/utils/mealActions';
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
  const dailyTargets = useDailyProfileTargets(activeProfile, today);

  const slots = useMealSlots(household?.id);
  const meals = useMealsForDate(household?.id, today);
  const recipeNutritionMap = useRecipeNutritionMap();
  const foodRows = useFoods();
  const foodById = new Map(foodRows.map((f) => [f.id, f]));
  const portionsForDate = usePortionsForDate(household?.id, today);
  const shoppingItems = useShoppingItems(household?.id);
  const shoppingRemaining = shoppingItems.filter((item) => !item.checked).length;

  const [pickerSlot, setPickerSlot] = useState<SlotRow | null>(null);
  const [extraMealId, setExtraMealId] = useState<string | null>(null);
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

        {activeProfile && targets ? (
          <View>
            <TdciCard name={activeProfile.name} targets={targets} />
            <Pressable
              accessibilityRole="button"
              style={styles.profileLink}
              onPress={() => router.push({ pathname: '/profile/[id]', params: { id: activeProfile.id } })}>
              <Ionicons name="settings-outline" size={14} color={colors.primary} />
              <Text style={styles.profileLinkLabel}>{t('today.editProfile')}</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.quickRow}>
          <Pressable
            accessibilityRole="button"
            style={styles.quickCard}
            onPress={() => router.push('/shopping')}>
            <Ionicons name="cart-outline" size={20} color={colors.primary} />
            <Text style={styles.quickValue}>{shoppingRemaining}</Text>
            <Text style={styles.quickLabel}>{t('today.shoppingRemaining')}</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            style={styles.quickCard}
            onPress={() => router.push('/progress')}>
            <Ionicons name="trending-up-outline" size={20} color={colors.primary} />
            <Text style={styles.quickValueSmall}>{t('today.logWeight')}</Text>
          </Pressable>
        </View>

        {activeProfile && dailyTargets && consumed ? (
          <View style={styles.fitCard}>
            <Text style={styles.fitTitle}>{t('today.fitTitle')}</Text>
            <Text style={styles.fitLine}>
              {t('today.fitSummary', {
                consumed: Math.round(consumed.kcal),
                target: Math.round(dailyTargets.kcal),
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
  profileLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  profileLinkLabel: {
    color: colors.primary,
    fontSize: typography.small,
    fontWeight: '600',
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
    padding: spacing.md,
    alignItems: 'flex-start',
    gap: 2,
  },
  quickValue: {
    color: colors.text,
    fontSize: typography.subtitle,
    fontWeight: '800',
  },
  quickValueSmall: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '700',
    marginTop: spacing.xs,
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
