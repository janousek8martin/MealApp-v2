import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ALLERGEN_ICONS } from '@/constants/chipIcons';
import { LibraryCard } from '@/components/LibraryCard';
import { useRecipeNutritionMap } from '@/hooks/plan';
import { useFoodAllergensMap, useFoods, usePhotoMap, useRecipes, useRecipeTagsMap } from '@/hooks/library';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';
import { localizedName } from '@/utils/localized';

type PickResult = { itemType: 'recipe' | 'food'; itemId: string };
type CategoryFilter = 'slot' | 'all';

type Props = {
  visible: boolean;
  category: 'breakfast' | 'lunch_dinner' | 'snack';
  onClose: () => void;
  onPick: (result: PickResult) => void;
  /** Allergens a profile this pick applies to must avoid – flags conflicting items with an allergen icon. */
  restrictedAllergens?: string[];
};

/**
 * Lets the user manually fill a meal slot ("+ Add Meal"), independent of the
 * generator. Styled like the library list (photo, name, category, kcal) and
 * pre-filtered to the slot's category, with a toggle to see everything.
 */
export function MealPickerModal({ visible, category, onClose, onPick, restrictedAllergens = [] }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const ACCENTS = useMemo(() => [colors.accentSoft], [colors]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<CategoryFilter>('slot');
  const recipeRows = useRecipes();
  const foodRows = useFoods();
  const nutritionByRecipe = useRecipeNutritionMap();
  const photoMap = usePhotoMap();
  const recipeTagsMap = useRecipeTagsMap();
  const foodAllergensMap = useFoodAllergensMap();

  const conflictingAllergens = (allergens: string[]) => allergens.filter((a) => restrictedAllergens.includes(a));

  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = (name: string) => !query || name.toLowerCase().includes(query);

    const recipeItems = recipeRows
      .filter((r) => !r.isSide)
      .filter((r) => filter === 'all' || r.category === category)
      .map((r) => ({
        itemType: 'recipe' as const,
        itemId: r.id,
        name: localizedName(r),
        subtitle: t(`library.filter.${r.category}`),
        kcal: nutritionByRecipe.get(r.id)?.kcal,
        photoUri: photoMap.get(`recipe:${r.id}`),
        conflicts: conflictingAllergens(recipeTagsMap.get(r.id)?.allergens ?? []),
      }));

    const foodItems =
      category === 'snack' || filter === 'all'
        ? foodRows
            .filter((f) => filter === 'all' || f.snackSuitable)
            .map((f) => ({
              itemType: 'food' as const,
              itemId: f.id,
              name: localizedName(f),
              subtitle: t(`foodCategory.${f.category}`),
              kcal: f.kcalPer100,
              photoUri: photoMap.get(`food:${f.id}`),
              conflicts: conflictingAllergens(foodAllergensMap.get(f.id) ?? []),
            }))
        : [];

    return [...recipeItems, ...foodItems]
      .filter((item) => matches(item.name))
      .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  }, [recipeRows, foodRows, category, filter, search, nutritionByRecipe, photoMap, recipeTagsMap, foodAllergensMap, restrictedAllergens, t]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>{t('todayMeal.pickMeal')}</Text>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder={t('library.search')}
          placeholderTextColor={colors.textSecondary}
          autoFocus
        />

        <View style={styles.filterRow}>
          {(['slot', 'all'] as CategoryFilter[]).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              onPress={() => setFilter(value)}
              style={[styles.filterChip, filter === value && styles.filterChipActive]}>
              <Text style={[styles.filterLabel, filter === value && styles.filterLabelActive]}>
                {value === 'slot' ? t(`library.filter.${category}`) : t('library.filter.all')}
              </Text>
            </Pressable>
          ))}
        </View>

        <FlatList
          data={items}
          keyExtractor={(item) => `${item.itemType}:${item.itemId}`}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <LibraryCard
              title={item.name}
              subtitle={item.kcal !== undefined ? `${item.subtitle} · ${Math.round(item.kcal)} kcal` : item.subtitle}
              photoUri={item.photoUri}
              accent={ACCENTS[index % ACCENTS.length]}
              allergenTags={item.conflicts.map((allergen) => ({
                label: t(`allergens.${allergen}`),
                icon: ALLERGEN_ICONS[allergen],
              }))}
              onPress={() => {
                onPick({ itemType: item.itemType, itemId: item.itemId });
                setSearch('');
              }}
            />
          )}
        />
        <Pressable accessibilityRole="button" style={styles.close} onPress={onClose}>
          <Text style={styles.closeLabel}>{t('common.cancel')}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: spacing.md,
      paddingTop: spacing.xl,
    },
    title: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '700',
      marginBottom: spacing.sm,
    },
    search: {
      backgroundColor: colors.surface,
      borderRadius: radius.input,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm + 2,
      color: colors.text,
      marginBottom: spacing.sm,
    },
    filterRow: {
      flexDirection: 'row',
      gap: spacing.xs + 2,
      marginBottom: spacing.sm,
    },
    filterChip: {
      borderRadius: radius.chip,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.sm + 2,
    },
    filterChipActive: {
      backgroundColor: colors.interactive,
      borderColor: colors.interactive,
    },
    filterLabel: {
      color: colors.text,
      fontSize: typography.small,
    },
    filterLabelActive: {
      color: colors.onInteractive,
      fontWeight: '600',
    },
    list: {
      paddingBottom: spacing.md,
    },
    close: {
      paddingVertical: spacing.md,
      alignItems: 'center',
    },
    closeLabel: {
      color: colors.primary,
      fontSize: typography.body,
      fontWeight: '600',
    },
  });
}
