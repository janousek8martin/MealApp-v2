import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LibraryCard } from '@/components/LibraryCard';
import { LibraryFilterModal, type FilterSection } from '@/components/LibraryFilterModal';
import { db } from '@/db/client';
import { softDeleteFood, softDeleteRecipe } from '@/db/repositories/library';
import type { foods, recipes } from '@/db/schema';
import { useActiveProfile, useHousehold } from '@/hooks/data';
import {
  useFavoriteRecipeIds,
  useFoodAllergensMap,
  useFoods,
  usePhotoMap,
  useRecipes,
  useRecipeTagsMap,
} from '@/hooks/library';
import { useRecipeNutritionMap } from '@/hooks/plan';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { localizedName } from '@/utils/localized';

type Segment = 'recipes' | 'foods';
type RecipeFilter = 'all' | 'breakfast' | 'lunch_dinner' | 'snack' | 'side';

const ACCENTS = [colors.mint, colors.lime, colors.tealTint];
const DIET_KEYS = ['vegetarian', 'vegan', 'pescatarian'];
const ALLERGEN_KEYS = ['gluten', 'lactose', 'eggs', 'nuts', 'peanuts', 'fish', 'shellfish', 'soy'];
const BUDGET_KEYS = ['cheap', 'average', 'expensive'] as const;

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function LibraryScreen() {
  const { t } = useTranslation();
  const [segment, setSegment] = useState<Segment>('recipes');
  const [search, setSearch] = useState('');
  const [recipeFilter, setRecipeFilter] = useState<RecipeFilter>('all');
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const [recipeCuisines, setRecipeCuisines] = useState<string[]>([]);
  const [recipeTags, setRecipeTags] = useState<string[]>([]);
  const [recipeDiets, setRecipeDiets] = useState<string[]>([]);
  const [recipeExcludeAllergens, setRecipeExcludeAllergens] = useState<string[]>([]);
  const [recipeBudgets, setRecipeBudgets] = useState<string[]>([]);

  const [foodCategories, setFoodCategories] = useState<string[]>([]);
  const [foodDiets, setFoodDiets] = useState<string[]>([]);
  const [foodExcludeAllergens, setFoodExcludeAllergens] = useState<string[]>([]);
  const [foodBudgets, setFoodBudgets] = useState<string[]>([]);

  const { household } = useHousehold();
  const activeProfile = useActiveProfile(household?.id);
  const recipeRows = useRecipes();
  const foodRows = useFoods();
  const photoMap = usePhotoMap();
  const favoriteIds = useFavoriteRecipeIds(activeProfile?.id);
  const recipeTagsMap = useRecipeTagsMap();
  const foodAllergensMap = useFoodAllergensMap();
  const recipeNutritionMap = useRecipeNutritionMap();

  const normalizedSearch = search.trim().toLowerCase();

  const cuisineOptions = useMemo(() => {
    const set = new Set(recipeRows.map((recipe) => recipe.cuisine).filter((c): c is string => !!c));
    return [...set].sort().map((key) => ({ value: key, label: t(`cuisines.${key}`) }));
  }, [recipeRows, t]);

  const tagOptions = useMemo(() => {
    const set = new Set<string>();
    for (const recipe of recipeRows) {
      if (recipe.tagsJson) for (const tag of JSON.parse(recipe.tagsJson) as string[]) set.add(tag);
    }
    return [...set].sort().map((key) => ({ value: key, label: t(`recipeTags.${key}`) }));
  }, [recipeRows, t]);

  const dietOptions = useMemo(
    () => DIET_KEYS.map((key) => ({ value: key, label: t(`diets.${key}`) })),
    [t],
  );
  const allergenOptions = useMemo(
    () => ALLERGEN_KEYS.map((key) => ({ value: key, label: t(`allergens.${key}`) })),
    [t],
  );
  const budgetOptions = useMemo(
    () => BUDGET_KEYS.map((key) => ({ value: key, label: t(`budget.${key}`) })),
    [t],
  );
  const foodCategoryOptions = useMemo(() => {
    const set = new Set(foodRows.map((food) => food.category));
    return [...set].sort().map((key) => ({ value: key, label: t(`foodCategory.${key}`) }));
  }, [foodRows, t]);

  const filteredRecipes = useMemo(
    () =>
      recipeRows
        .filter((recipe) => {
          if (recipeFilter === 'all') return true;
          if (recipeFilter === 'side') return recipe.isSide;
          return recipe.category === recipeFilter;
        })
        .filter((recipe) => recipeCuisines.length === 0 || (!!recipe.cuisine && recipeCuisines.includes(recipe.cuisine)))
        .filter((recipe) => recipeBudgets.length === 0 || recipeBudgets.includes(recipe.budget))
        .filter((recipe) => {
          if (recipeTags.length === 0) return true;
          const tags: string[] = recipe.tagsJson ? JSON.parse(recipe.tagsJson) : [];
          return recipeTags.some((tag) => tags.includes(tag));
        })
        .filter((recipe) => {
          if (recipeDiets.length === 0) return true;
          const derived = recipeTagsMap.get(recipe.id);
          return recipeDiets.every((diet) => derived?.dietFlags.includes(diet));
        })
        .filter((recipe) => {
          if (recipeExcludeAllergens.length === 0) return true;
          const derived = recipeTagsMap.get(recipe.id);
          return !derived?.allergens.some((allergen) => recipeExcludeAllergens.includes(allergen));
        })
        .filter(
          (recipe) =>
            !normalizedSearch ||
            recipe.nameCs.toLowerCase().includes(normalizedSearch) ||
            recipe.nameEn.toLowerCase().includes(normalizedSearch),
        )
        .sort((a, b) => localizedName(a).localeCompare(localizedName(b), 'cs')),
    [
      recipeRows,
      recipeFilter,
      normalizedSearch,
      recipeCuisines,
      recipeBudgets,
      recipeTags,
      recipeDiets,
      recipeExcludeAllergens,
      recipeTagsMap,
    ],
  );

  const filteredFoods = useMemo(
    () =>
      foodRows
        .filter((food) => foodCategories.length === 0 || foodCategories.includes(food.category))
        .filter((food) => foodBudgets.length === 0 || foodBudgets.includes(food.budget))
        .filter((food) => {
          if (foodDiets.length === 0) return true;
          const flags: string[] = food.dietFlagsJson ? JSON.parse(food.dietFlagsJson) : [];
          return foodDiets.every((diet) => flags.includes(diet));
        })
        .filter((food) => {
          if (foodExcludeAllergens.length === 0) return true;
          const allergens = foodAllergensMap.get(food.id) ?? [];
          return !allergens.some((allergen) => foodExcludeAllergens.includes(allergen));
        })
        .filter(
          (food) =>
            !normalizedSearch ||
            food.nameCs.toLowerCase().includes(normalizedSearch) ||
            food.nameEn.toLowerCase().includes(normalizedSearch),
        )
        .sort((a, b) => localizedName(a).localeCompare(localizedName(b), 'cs')),
    [foodRows, normalizedSearch, foodCategories, foodBudgets, foodDiets, foodExcludeAllergens, foodAllergensMap],
  );

  const recipeFilters: RecipeFilter[] = ['all', 'breakfast', 'lunch_dinner', 'snack', 'side'];

  const activeFilterCount =
    segment === 'recipes'
      ? recipeCuisines.length + recipeTags.length + recipeDiets.length + recipeExcludeAllergens.length + recipeBudgets.length
      : foodCategories.length + foodDiets.length + foodExcludeAllergens.length + foodBudgets.length;

  const filterSections: FilterSection[] =
    segment === 'recipes'
      ? [
          {
            key: 'cuisine',
            label: t('library.filterModal.cuisine'),
            options: cuisineOptions,
            selected: recipeCuisines,
            onToggle: (value) => setRecipeCuisines((prev) => toggleValue(prev, value)),
          },
          {
            key: 'tags',
            label: t('library.filterModal.tags'),
            options: tagOptions,
            selected: recipeTags,
            onToggle: (value) => setRecipeTags((prev) => toggleValue(prev, value)),
          },
          {
            key: 'diet',
            label: t('library.filterModal.diet'),
            options: dietOptions,
            selected: recipeDiets,
            onToggle: (value) => setRecipeDiets((prev) => toggleValue(prev, value)),
          },
          {
            key: 'allergens',
            label: t('library.filterModal.excludeAllergens'),
            options: allergenOptions,
            selected: recipeExcludeAllergens,
            onToggle: (value) => setRecipeExcludeAllergens((prev) => toggleValue(prev, value)),
          },
          {
            key: 'budget',
            label: t('library.filterModal.budget'),
            options: budgetOptions,
            selected: recipeBudgets,
            onToggle: (value) => setRecipeBudgets((prev) => toggleValue(prev, value)),
          },
        ]
      : [
          {
            key: 'category',
            label: t('library.filterModal.category'),
            options: foodCategoryOptions,
            selected: foodCategories,
            onToggle: (value) => setFoodCategories((prev) => toggleValue(prev, value)),
          },
          {
            key: 'diet',
            label: t('library.filterModal.diet'),
            options: dietOptions,
            selected: foodDiets,
            onToggle: (value) => setFoodDiets((prev) => toggleValue(prev, value)),
          },
          {
            key: 'allergens',
            label: t('library.filterModal.excludeAllergens'),
            options: allergenOptions,
            selected: foodExcludeAllergens,
            onToggle: (value) => setFoodExcludeAllergens((prev) => toggleValue(prev, value)),
          },
          {
            key: 'budget',
            label: t('library.filterModal.budget'),
            options: budgetOptions,
            selected: foodBudgets,
            onToggle: (value) => setFoodBudgets((prev) => toggleValue(prev, value)),
          },
        ];

  const resetFilters = () => {
    if (segment === 'recipes') {
      setRecipeCuisines([]);
      setRecipeTags([]);
      setRecipeDiets([]);
      setRecipeExcludeAllergens([]);
      setRecipeBudgets([]);
    } else {
      setFoodCategories([]);
      setFoodDiets([]);
      setFoodExcludeAllergens([]);
      setFoodBudgets([]);
    }
  };

  const confirmDeleteRecipe = (recipe: typeof recipes.$inferSelect) => {
    Alert.alert(t('recipeDetail.deleteTitle'), t('recipeDetail.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void softDeleteRecipe(db, recipe.id) },
    ]);
  };

  const confirmDeleteFood = (food: typeof foods.$inferSelect) => {
    Alert.alert(t('foodDetail.deleteTitle'), t('foodDetail.deleteMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => void softDeleteFood(db, food.id) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>{t('tabs.library')}</Text>
        <Pressable
          accessibilityRole="button"
          style={styles.addButton}
          onPress={() =>
            router.push(segment === 'recipes' ? '/recipe/edit' : '/food/edit')
          }>
          <Ionicons name="add" size={22} color={colors.onPrimary} />
        </Pressable>
      </View>

      <View style={styles.segmentRow}>
        {(['recipes', 'foods'] as Segment[]).map((value) => (
          <Pressable
            key={value}
            accessibilityRole="button"
            onPress={() => setSegment(value)}
            style={[styles.segment, segment === value && styles.segmentActive]}>
            <Text style={[styles.segmentLabel, segment === value && styles.segmentLabelActive]}>
              {t(`library.${value}`)}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.searchRow}>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder={t('library.search')}
          placeholderTextColor={colors.textSecondary}
        />
        <Pressable
          accessibilityRole="button"
          style={styles.filterButton}
          onPress={() => setFilterModalVisible(true)}>
          <Ionicons name="options-outline" size={20} color={colors.primary} />
          {activeFilterCount > 0 ? (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeLabel}>{activeFilterCount}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {segment === 'recipes' ? (
        <View style={styles.filterRow}>
          {recipeFilters.map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              onPress={() => setRecipeFilter(value)}
              style={[styles.filterChip, recipeFilter === value && styles.filterChipActive]}>
              <Text
                style={[
                  styles.filterLabel,
                  recipeFilter === value && styles.filterLabelActive,
                ]}>
                {t(`library.filter.${value}`)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {segment === 'recipes' ? (
        <FlatList
          data={filteredRecipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => {
            const nutrition = recipeNutritionMap.get(item.id);
            const categoryLabel = t(`library.filter.${item.isSide ? 'side' : item.category}`);
            const tags: string[] = item.tagsJson ? JSON.parse(item.tagsJson) : [];
            return (
              <LibraryCard
                title={localizedName(item)}
                subtitle={nutrition ? `${categoryLabel} · ${Math.round(nutrition.kcal)} kcal` : categoryLabel}
                photoUri={photoMap.get(`recipe:${item.id}`)}
                accent={ACCENTS[index % ACCENTS.length]}
                badge={t(`budget.${item.budget}`)}
                favorite={favoriteIds.has(item.id)}
                tags={tags.map((tag) => t(`recipeTags.${tag}`))}
                onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: item.id } })}
                onDelete={() => confirmDeleteRecipe(item)}
              />
            );
          }}
        />
      ) : (
        <FlatList
          data={filteredFoods}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => {
            const dietFlags: string[] = item.dietFlagsJson ? JSON.parse(item.dietFlagsJson) : [];
            return (
              <LibraryCard
                title={localizedName(item)}
                subtitle={`${Math.round(item.kcalPer100)} kcal / 100 ${item.baseUnit === 'piece' ? 'g' : item.baseUnit}`}
                photoUri={photoMap.get(`food:${item.id}`)}
                accent={ACCENTS[index % ACCENTS.length]}
                badge={t(`budget.${item.budget}`)}
                tags={dietFlags.map((flag) => t(`diets.${flag}`))}
                onPress={() => router.push({ pathname: '/food/[id]', params: { id: item.id } })}
                onDelete={() => confirmDeleteFood(item)}
              />
            );
          }}
        />
      )}

      <LibraryFilterModal
        visible={filterModalVisible}
        onClose={() => setFilterModalVisible(false)}
        onReset={resetFilters}
        sections={filterSections}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  heading: {
    color: colors.text,
    fontSize: typography.title,
    fontWeight: '800',
  },
  addButton: {
    backgroundColor: colors.primary,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    marginTop: spacing.md,
  },
  segment: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.input - 4,
    alignItems: 'center',
  },
  segmentActive: {
    backgroundColor: colors.primary,
  },
  segmentLabel: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: typography.small,
  },
  segmentLabelActive: {
    color: colors.onPrimary,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  search: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  filterBadgeLabel: {
    color: colors.onPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs + 2,
    marginTop: spacing.sm,
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
    backgroundColor: colors.primaryLight,
    borderColor: colors.primaryLight,
  },
  filterLabel: {
    color: colors.text,
    fontSize: typography.small,
  },
  filterLabelActive: {
    color: colors.onPrimary,
    fontWeight: '600',
  },
  list: {
    paddingVertical: spacing.md,
    paddingBottom: spacing.xl,
  },
});
