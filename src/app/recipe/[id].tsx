import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EditActions } from '@/components/EditActions';
import { db } from '@/db/client';
import { softDeleteRecipe, toggleFavorite } from '@/db/repositories/library';
import { useActiveProfile, useHousehold } from '@/hooks/data';
import {
  recipeNutritionOf,
  useFavoriteRecipeIds,
  usePhoto,
  useRecipe,
  useRecipeIngredients,
} from '@/hooks/library';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { localizedInstructions, localizedName } from '@/utils/localized';

export default function RecipeDetailScreen() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const recipe = useRecipe(id);
  const ingredientRows = useRecipeIngredients(id);
  const photo = usePhoto('recipe', id);
  const { household } = useHousehold();
  const activeProfile = useActiveProfile(household?.id);
  const favoriteIds = useFavoriteRecipeIds(activeProfile?.id);

  if (!recipe) {
    return <SafeAreaView style={styles.safeArea} />;
  }

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
        {ingredientRows.map((row) => (
          <View key={row.ingredient.id} style={styles.ingredientRow}>
            <Text style={styles.ingredientName}>{localizedName(row.food)}</Text>
            <Text style={styles.ingredientAmount}>
              {row.ingredient.amount} {row.food.baseUnit === 'piece' ? t('units.pcs') : row.food.baseUnit}
            </Text>
          </View>
        ))}

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
  return (
    <View style={styles.nutritionItem}>
      <Text style={styles.nutritionValue}>{value}</Text>
      <Text style={styles.nutritionLabel}>{label}</Text>
    </View>
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
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs + 2,
  },
  ingredientName: {
    color: colors.text,
    fontSize: typography.body,
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
});
