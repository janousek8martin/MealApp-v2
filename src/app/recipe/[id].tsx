import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image as RNImage, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EditActions } from '@/components/EditActions';
import { HintedScrollView } from '@/components/HintedScrollView';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ALLERGEN_ICONS } from '@/constants/chipIcons';
import { db } from '@/db/client';
import { setRating, softDeleteRecipe } from '@/db/repositories/library';
import { detectRecipeRatingConflict, setRecipeResolution } from '@/db/repositories/ratings';
import { useActiveProfile, useHousehold } from '@/hooks/data';
import {
  recipeNutritionOf,
  useItemRating,
  usePhoto,
  usePhotoMap,
  useRecipe,
  useRecipeIngredients,
  useRecipeTagsMap,
} from '@/hooks/library';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';
import { localizedInstructions, localizedName } from '@/utils/localized';
import { printRecipe } from '@/utils/printRecipe';

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
  const rating = useItemRating(activeProfile?.id, 'recipe', recipe?.id);
  const recipeTagsMap = useRecipeTagsMap();
  const photoMap = usePhotoMap();

  if (!recipe) {
    return <SafeAreaView style={styles.safeArea} />;
  }

  const allergens = recipeTagsMap.get(recipe.id)?.allergens ?? [];
  const nutrition = recipeNutritionOf(ingredientRows, recipe.servingsBase);
  const instructions = localizedInstructions(recipe);

  const onPrint = async () => {
    try {
      await printRecipe({
        recipe,
        ingredientRows,
        nutrition,
        allergenLabels: allergens.map((allergen) => t(`allergens.${allergen}`)),
        photoUri: photo?.uri,
        t,
      });
    } catch {
      Alert.alert(t('recipeDetail.printFailed'));
    }
  };

  const rate = async (next: 'like' | 'dislike') => {
    if (!activeProfile) return;
    await setRating(db, activeProfile.id, 'recipe', recipe.id, rating === next ? null : next);
    if (!household) return;
    const conflict = await detectRecipeRatingConflict(db, household.id, recipe.id);
    if (!conflict) return;
    Alert.alert(t('recipeDetail.ratingConflictTitle'), t('recipeDetail.ratingConflictMessage'), [
      {
        text: t('recipeDetail.ratingConflictServeSeparately'),
        onPress: () => void setRecipeResolution(db, household.id, recipe.id, 'serve_separately'),
      },
      {
        text: t('recipeDetail.ratingConflictRare'),
        onPress: () => void setRecipeResolution(db, household.id, recipe.id, 'rare'),
      },
      {
        text: t('recipeDetail.ratingConflictNever'),
        style: 'destructive',
        onPress: () => void setRecipeResolution(db, household.id, recipe.id, 'never'),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <HintedScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          right={
            <View style={styles.headerActions}>
              <Pressable accessibilityRole="button" style={styles.printButton} onPress={onPrint}>
                <Ionicons name="print-outline" size={16} color={colors.primary} />
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
          }
        />

        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]} />
        )}

        <View style={styles.titleRow}>
          <Text style={styles.title}>{localizedName(recipe)}</Text>
          <View style={styles.ratingRow}>
            <Pressable accessibilityRole="button" onPress={() => rate('like')} hitSlop={8}>
              <Ionicons
                name={rating === 'like' ? 'thumbs-up' : 'thumbs-up-outline'}
                size={24}
                color={rating === 'like' ? colors.interactive : colors.textSecondary}
              />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => rate('dislike')} hitSlop={8}>
              <Ionicons
                name={rating === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'}
                size={24}
                color={rating === 'dislike' ? colors.attention : colors.textSecondary}
              />
            </Pressable>
          </View>
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
          const ingredientPhoto = photoMap.get(`food:${row.food.id}`);
          const gramsLabel = `${row.ingredient.amount} ${row.food.baseUnit === 'piece' ? t('units.pcs') : row.food.baseUnit}`;
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
                <Text style={styles.ingredientAmount}>{gramsLabel}</Text>
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
      </HintedScrollView>
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
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    printButton: {
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
      backgroundColor: colors.accentSoft,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
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
      backgroundColor: colors.accentSoft,
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
      backgroundColor: colors.accentSoft,
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
