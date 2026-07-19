import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useFood, useItemRating, usePhoto, useRecipe } from '@/hooks/library';
import { type MealRow, useMealExtras, usePortionsForMeal } from '@/hooks/plan';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';
import type { RecipeNutrition } from '@/domain/recipeNutrition';
import { localizedName } from '@/utils/localized';

type ExtraRowData = { id: string; itemType: 'recipe' | 'food'; itemId: string };

type Props = {
  slotLabel: string;
  meal: MealRow | undefined;
  activeProfileId: string;
  recipeNutritionMap: Map<string, RecipeNutrition>;
  expanded: boolean;
  onToggleExpand: () => void;
  onSetStatus: (portionId: string, status: 'planned' | 'eaten' | 'skipped') => void;
  /**
   * 'full' (Plan screen): view/swap/add-extra/delete + eaten/not-eaten.
   * 'compact' (Home screen): view/edit (jumps to Plan) + eaten/not-eaten only
   * – swap, add-extra and delete all live on the Plan screen instead.
   */
  variant?: 'full' | 'compact';
  onSwap?: () => void;
  onAddMeal?: () => void;
  onDeleteMeal?: () => void;
  onAddExtra?: () => void;
  onRemoveExtra?: (extraId: string) => void;
  /** Compact variant only: jumps to the Plan screen for this slot. */
  onEdit?: () => void;
  /** Full variant only: opens the copy/paste/clear/adjust-servings/save-as-recipe menu. */
  onOpenMenu?: () => void;
  /** Disables regeneration (swap/add) for past dates; eaten/not-eaten can still be set retroactively. */
  disabled?: boolean;
};

function ExtraRow({ extra, onRemove }: { extra: ExtraRowData; onRemove: () => void }) {
  const recipe = useRecipe(extra.itemType === 'recipe' ? extra.itemId : undefined);
  const food = useFood(extra.itemType === 'food' ? extra.itemId : undefined);
  const name = recipe ? localizedName(recipe) : food ? localizedName(food) : '';
  const kcal = food ? Math.round(food.kcalPer100) : undefined;
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.extraRow}>
      <Text style={styles.extraName} numberOfLines={1}>
        {name}
      </Text>
      {kcal !== undefined ? <Text style={styles.extraKcal}>{kcal} kcal</Text> : null}
      <Pressable accessibilityRole="button" onPress={onRemove} hitSlop={8}>
        <Ionicons name="close" size={16} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

export function MealSlotCard({
  slotLabel,
  meal,
  activeProfileId,
  recipeNutritionMap,
  expanded,
  onToggleExpand,
  variant = 'full',
  onSwap,
  onAddMeal,
  onDeleteMeal,
  onAddExtra,
  onRemoveExtra,
  onEdit,
  onOpenMenu,
  onSetStatus,
  disabled,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isCompact = variant === 'compact';

  const recipe = useRecipe(meal?.itemType === 'recipe' ? meal.itemId : undefined);
  const food = useFood(meal?.itemType === 'food' ? meal.itemId : undefined);
  const photo = usePhoto(meal?.itemType ?? 'recipe', meal?.itemId);
  const portions = usePortionsForMeal(meal?.id);
  const extras = useMealExtras(meal?.id);
  const myPortion = portions.find((p) => p.profileId === activeProfileId);
  const rating = useItemRating(activeProfileId, meal?.itemType ?? 'recipe', meal?.itemId);

  if (!meal) {
    return (
      <View style={[styles.card, styles.emptyCard]}>
        <Text style={styles.slotLabel}>{slotLabel}</Text>
        {disabled ? (
          <Text style={styles.emptyText}>{t('todayMeal.noMeal')}</Text>
        ) : isCompact ? (
          <Pressable accessibilityRole="button" style={styles.addButton} onPress={onEdit}>
            <Ionicons name="create-outline" size={18} color={colors.primary} />
            <Text style={styles.addButtonLabel}>{t('todayMeal.edit')}</Text>
          </Pressable>
        ) : (
          <Pressable accessibilityRole="button" style={styles.addButton} onPress={onAddMeal}>
            <Text style={styles.addButtonLabel}>{t('todayMeal.addMeal')}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  const name = recipe ? localizedName(recipe) : food ? localizedName(food) : '';
  const baseNutrition = meal.itemType === 'recipe' ? recipeNutritionMap.get(meal.itemId) : food
    ? { kcal: food.kcalPer100, proteinG: food.proteinPer100, carbsG: food.carbsPer100, fatG: food.fatPer100, fiberG: food.fiberPer100 }
    : undefined;
  const multiplier = myPortion?.multiplier ?? 1;
  const scaled = baseNutrition
    ? {
        kcal: Math.round(baseNutrition.kcal * multiplier),
        proteinG: Math.round(baseNutrition.proteinG * multiplier),
        carbsG: Math.round(baseNutrition.carbsG * multiplier),
        fatG: Math.round(baseNutrition.fatG * multiplier),
      }
    : null;

  const isEaten = myPortion?.status === 'eaten';
  const isSkipped = myPortion?.status === 'skipped';

  const openDetail = () => {
    if (meal.itemType === 'recipe') router.push({ pathname: '/recipe/[id]', params: { id: meal.itemId } });
    else router.push({ pathname: '/food/[id]', params: { id: meal.itemId } });
  };

  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        style={styles.header}
        onPress={onToggleExpand}>
        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]} />
        )}
        <View style={styles.headerText}>
          <Text style={styles.slotLabel}>{slotLabel}</Text>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {name}
            </Text>
            {rating === 'like' ? <Ionicons name="thumbs-up" size={13} color={colors.interactive} /> : null}
            {rating === 'dislike' ? <Ionicons name="thumbs-down" size={13} color={colors.attention} /> : null}
          </View>
          {scaled ? (
            <Text style={styles.kcal}>
              {scaled.kcal} kcal · <Text style={styles.macroInitial}>{t('macros.proteinInitial')}</Text>
              {' '}{scaled.proteinG} / <Text style={styles.macroInitial}>{t('macros.carbsInitial')}</Text>
              {' '}{scaled.carbsG} / <Text style={styles.macroInitial}>{t('macros.fatInitial')}</Text>
              {' '}{scaled.fatG} g
            </Text>
          ) : null}
        </View>
        {!isCompact && onOpenMenu ? (
          <Pressable
            accessibilityRole="button"
            style={styles.menuButton}
            hitSlop={8}
            onPress={onOpenMenu}>
            <Ionicons name="ellipsis-vertical" size={18} color={colors.textSecondary} />
          </Pressable>
        ) : null}
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={colors.textSecondary}
        />
      </Pressable>

      {expanded ? (
        <View style={styles.expandedArea}>
          {scaled ? (
            <View style={styles.macroRow}>
              <MacroBadge label={t('macros.protein')} value={scaled.proteinG} />
              <MacroBadge label={t('macros.carbs')} value={scaled.carbsG} />
              <MacroBadge label={t('macros.fat')} value={scaled.fatG} />
            </View>
          ) : null}

          {!isCompact && extras.length > 0 ? (
            <View style={styles.extrasList}>
              {extras.map((extra) => (
                <ExtraRow key={extra.id} extra={extra} onRemove={() => onRemoveExtra?.(extra.id)} />
              ))}
            </View>
          ) : null}

          <View style={styles.actionsRow}>
            <Pressable accessibilityRole="button" style={styles.actionButton} onPress={openDetail}>
              <Ionicons name="restaurant-outline" size={16} color={colors.primary} />
              <Text style={styles.actionLabel}>{t('todayMeal.viewRecipe')}</Text>
            </Pressable>
            {isCompact ? (
              <Pressable accessibilityRole="button" style={styles.actionButton} onPress={onEdit}>
                <Ionicons name="create-outline" size={16} color={colors.primary} />
                <Text style={styles.actionLabel}>{t('todayMeal.edit')}</Text>
              </Pressable>
            ) : !disabled ? (
              <>
                <Pressable accessibilityRole="button" style={styles.actionButton} onPress={onSwap}>
                  <Ionicons name="shuffle-outline" size={16} color={colors.primary} />
                  <Text style={styles.actionLabel}>{t('todayMeal.swap')}</Text>
                </Pressable>
                <Pressable accessibilityRole="button" style={styles.actionButton} onPress={onAddExtra}>
                  <Ionicons name="add" size={16} color={colors.primary} />
                  <Text style={styles.actionLabel}>{t('todayMeal.addExtra')}</Text>
                </Pressable>
              </>
            ) : null}
          </View>

          {myPortion ? (
            <View style={styles.statusRow}>
              <Pressable
                accessibilityRole="button"
                style={[styles.statusButton, isEaten && styles.statusButtonActiveEaten]}
                onPress={() => onSetStatus(myPortion.id, isEaten ? 'planned' : 'eaten')}>
                <Ionicons name="checkmark" size={16} color={isEaten ? colors.onPrimary : colors.interactive} />
                <Text style={[styles.statusLabel, isEaten && styles.statusLabelActive]}>
                  {t('todayMeal.eaten')}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                style={[styles.statusButton, isSkipped && styles.statusButtonActiveSkipped]}
                onPress={() => onSetStatus(myPortion.id, isSkipped ? 'planned' : 'skipped')}>
                <Ionicons name="close" size={16} color={isSkipped ? colors.onPrimary : colors.attention} />
                <Text style={[styles.statusLabel, isSkipped && styles.statusLabelActive]}>
                  {t('todayMeal.notEaten')}
                </Text>
              </Pressable>
              {!isCompact && !disabled ? (
                <Pressable accessibilityRole="button" style={styles.deleteButton} onPress={onDeleteMeal} hitSlop={8}>
                  <Ionicons name="trash-outline" size={16} color={colors.danger} />
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function MacroBadge({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.macroBadge}>
      <Text style={styles.macroValue}>{value} g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderLeftWidth: 4,
      borderLeftColor: colors.primary,
      marginBottom: spacing.sm,
      overflow: 'hidden',
    },
    emptyCard: {
      padding: spacing.md,
      borderStyle: 'dashed',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.sm,
      gap: spacing.sm,
    },
    thumb: {
      width: 52,
      height: 52,
      borderRadius: radius.card - 8,
    },
    thumbPlaceholder: {
      backgroundColor: colors.accentSoft,
    },
    headerText: {
      flex: 1,
    },
    menuButton: {
      padding: spacing.xs,
    },
    slotLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '600',
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: 2,
    },
    name: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
      flexShrink: 1,
    },
    kcal: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 2,
    },
    macroInitial: {
      color: colors.textSecondary,
      fontWeight: '700',
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: spacing.xs,
    },
    addButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginTop: spacing.sm,
      alignSelf: 'flex-start',
    },
    addButtonLabel: {
      color: colors.primary,
      fontSize: typography.body,
      fontWeight: '600',
    },
    expandedArea: {
      paddingHorizontal: spacing.md,
      paddingBottom: spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      paddingTop: spacing.sm,
    },
    macroRow: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      marginBottom: spacing.sm,
    },
    macroBadge: {
      alignItems: 'center',
    },
    macroValue: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
    },
    macroLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
    },
    extrasList: {
      marginBottom: spacing.sm,
      gap: spacing.xs,
    },
    extraRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.background,
      borderRadius: radius.input,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.sm + 2,
    },
    extraName: {
      flex: 1,
      color: colors.text,
      fontSize: typography.small,
      fontWeight: '600',
    },
    extraKcal: {
      color: colors.textSecondary,
      fontSize: typography.small,
    },
    actionsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
      marginBottom: spacing.sm,
    },
    actionButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.chip,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.sm + 2,
    },
    actionLabel: {
      color: colors.primary,
      fontSize: typography.small,
      fontWeight: '600',
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    statusButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.chip,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.sm + 2,
    },
    statusButtonActiveEaten: {
      backgroundColor: colors.interactive,
      borderColor: colors.interactive,
    },
    statusButtonActiveSkipped: {
      backgroundColor: colors.attention,
      borderColor: colors.attention,
    },
    statusLabel: {
      color: colors.text,
      fontSize: typography.small,
      fontWeight: '600',
    },
    statusLabelActive: {
      color: colors.onPrimary,
    },
    deleteButton: {
      marginLeft: 'auto',
      padding: spacing.xs,
    },
  });
}
