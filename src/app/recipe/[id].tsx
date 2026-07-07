import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as RNImage, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EditActions } from '@/components/EditActions';
import { ALLERGEN_ICONS } from '@/constants/chipIcons';
import { db } from '@/db/client';
import { softDeleteRecipe, toggleFavorite } from '@/db/repositories/library';
import { useActiveProfile, useHousehold } from '@/hooks/data';
import {
  recipeNutritionOf,
  useFavoriteRecipeIds,
  usePhoto,
  usePhotoMap,
  useRecipe,
  useRecipeIngredients,
  useRecipeTagsMap,
} from '@/hooks/library';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';
import { kitchenEquivalentLabel } from '@/domain/units';
import { localizedInstructions, localizedName } from '@/utils/localized';

export default function RecipeDetailScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useRecipe(id);
  const ingredientRows = useRecipeIngredients(id);
  const photo = usePhoto('recipe', id);
  const { household } = useHousehold();
  const activeProfile = useActiveProfile(household?.id);
  const favoriteIds = useFavoriteRecipeIds(activeProfile?.id);
  const recipeTagsMap = useRecipeTagsMap();
  const photoMap = usePhotoMap();

  if (!recipe) {
    return <SafeAreaView style={styles.safeArea} />;
  }

  const allergens = recipeTagsMap.get(recipe.id)?.allergens ?? [];
  const nutrition = recipeNutritionOf(ingredientRows, recipe.servingsBase);
  const instructions = localizedInstructions(recipe);
  const isFavorite = favoriteIds.has(recipe.id);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.topBar}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <EditActions
            onEdit={() => router.push({ pathname: '/recipe/edit', params: { id: recipe.id } })}
            onDelete={async () => {
              await softDeleteRecipe(db, recipe.id);
              router.back();
            }}
            deleteConfirmTitle={t('recipeDetail.deleteTitle')}
            deleteConfirmMessage={t('recipeDetail.deleteMessage')}
          />
        </View>

        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]} />
        )}

        <View style={styles.titleRow}>
          <Text style={styles.title}>{localizedName(recipe)}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => activeProfile && toggleFavorite(db, activeProfile.id, recipe.id)}>
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={26}
              color={isFavorite ? colors.success : colors.textSecondary}
            />
          </Pressable>
        </View>
        <Text style={styles.meta}>
          {t(`library.filter.${recipe.isSide ? 'side' : recipe.category}`)} · {t(`budget.${recipe.budget}`)}
          {recipe.prepTimeMinutes ? ` · ${recipe.prepTimeMinutes} min` : ''}
        </Text>

        <View style={styles.nutritionCard}>
          <Text style={styles.sectionTitle}>{t('recipeDetail.nutritionPerPortion')}</Text>
          <View style={styles.nutritionRow}>
            <NutritionItem label="kcal" value={Math.round(nutrition.kcal)} />
            <NutritionItem label={t('macros.protein')} value={`${Math.round(nutrition.proteinG)} g`} />
            <NutritionItem label={t('macros.carbs')} value={`${Math.round(nutrition.carbsG)} g`} />
            <NutritionItem label={t('macros.fat')} value={`${Math.round(nutrition.fatG)} g`} />
            <NutritionItem
              label={t('macros.fiber')}
              value={nutrition.fiberG === null ? '–' : `${Math.round(nutrition.fiberG)} g`}
            />
          </View>
        </View>

        <Text style={styles.sectionTitle}>{t('recipeDetail.ingredients')}</Text>
        {ingredientRows.map((row) => {
          const equivalent = kitchenEquivalentLabel(row.ingredient.amount, row.food.baseUnit, row.food.gramsPerCup);
          const ingredientPhoto = photoMap.get(`food:${row.food.id}`);
          return (
            <View key={row.ingredient.id} style={styles.ingredientRow}>
              {ingredientPhoto ? (
                <Image source={{ uri: ingredientPhoto }} style={styles.ingredientThumb} contentFit="cover" />
              ) : (
                <View style={[styles.ingredientThumb, styles.ingredientThumbPlaceholder]} />
              )}
              <Text style={styles.ingredientName} numberOfLines={1}>
                {localizedName(row.food)}
              </Text>
              <View style={styles.ingredientAmountCol}>
                <Text style={styles.ingredientAmount}>
                  {row.ingredient.amount} {row.food.baseUnit === 'piece' ? t('units.pcs') : row.food.baseUnit}
                </Text>
                {equivalent ? (
                  <Text style={styles.ingredientEquivalent}>
                    {t('recipeDetail.kitchenEquivalent', { fraction: equivalent })}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })}

        {allergens.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>{t('recipeDetail.allergens')}</Text>
            <View style={styles.chipRow}>
              {allergens.map((allergen) => (
                <View key={allergen} style={styles.allergenChip}>
                  {ALLERGEN_ICONS[allergen] ? (
                    <RNImage source={ALLERGEN_ICONS[allergen]} style={styles.allergenChipIcon} />
                  ) : null}
                  <Text style={styles.allergenChipLabel}>{t(`allergens.${allergen}`)}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {instructions ? (
          <>
            <Text style={styles.sectionTitle}>{t('recipeDetail.instructions')}</Text>
            <Text style={styles.instructions}>{instructions}</Text>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function NutritionItem({ label, value }: { label: string; value: string | number }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.nutritionItem}>
      <Text style={styles.nutritionValue}>{value}</Text>
      <Text style={styles.nutritionLabel}>{label}</Text>
    </View>
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
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    back: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    photo: {
      width: '100%',
      height: 200,
      borderRadius: radius.card,
    },
    photoPlaceholder: {
      backgroundColor: colors.lime,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    title: {
      color: colors.text,
      fontSize: typography.title,
      fontWeight: '800',
      flex: 1,
    },
    meta: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 2,
    },
    nutritionCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginTop: spacing.md,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '700',
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    nutritionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    nutritionItem: {
      alignItems: 'center',
      flex: 1,
    },
    nutritionValue: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
    },
    nutritionLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 2,
    },
    ingredientRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.input,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.xs + 2,
    },
    ingredientThumb: {
      width: 36,
      height: 36,
      borderRadius: radius.card - 12,
    },
    ingredientThumbPlaceholder: {
      backgroundColor: colors.mint,
    },
    ingredientName: {
      flex: 1,
      color: colors.text,
      fontSize: typography.body,
    },
    ingredientAmountCol: {
      alignItems: 'flex-end',
    },
    ingredientAmount: {
      color: colors.textSecondary,
      fontSize: typography.body,
    },
    ingredientEquivalent: {
      color: colors.textSecondary,
      fontSize: typography.small - 1,
      marginTop: 1,
    },
    instructions: {
      color: colors.text,
      fontSize: typography.body,
      lineHeight: 22,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    allergenChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.lime,
      borderRadius: radius.chip,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
    },
    allergenChipIcon: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
    },
    allergenChipLabel: {
      color: colors.text,
      fontSize: typography.small,
      fontWeight: '600',
    },
  });
}
