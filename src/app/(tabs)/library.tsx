import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LibraryCard } from '@/components/LibraryCard';
import { ScrollDownHintButton } from '@/components/ScrollDownHintButton';
import { LibraryFilterModal, type FilterSection } from '@/components/LibraryFilterModal';
import { ALLERGEN_ICONS, DIET_ICONS } from '@/constants/chipIcons';
import { ALLERGEN_KEYS, DIET_KEYS } from '@/constants/options';
import { db } from '@/db/client';
import { softDeleteFood, softDeleteRecipe } from '@/db/repositories/library';
import type { foods, recipes } from '@/db/schema';
import { isLowCarbRecipe } from '@/domain/generator/filters';
import { rankRecipesByPantryOverlap } from '@/domain/pantryRecipeMatch';
import { useActiveProfile, useHousehold } from '@/hooks/data';
import {
  useFoodAllergensMap,
  useFoods,
  usePhotoMap,
  useRatingsMap,
  useRecipeIngredientFoodIdsMap,
  useRecipes,
  useRecipeTagsMap,
} from '@/hooks/library';
import { useRecipeNutritionMap } from '@/hooks/plan';
import { usePantryItems } from '@/hooks/shopping';
import { useScrollDownHint } from '@/hooks/useScrollDownHint';
import { useTabScrollRestore } from '@/hooks/useTabScrollRestore';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';
import { localizedName } from '@/utils/localized';
import { displayRecipeTag } from '@/utils/recipeTags';

type Segment = 'recipes' | 'foods';
type RecipeFilter = 'all' | 'breakfast' | 'lunch_dinner' | 'snack' | 'side';

const BUDGET_KEYS = ['cheap', 'average', 'expensive'] as const;
/** Same 26%-of-calories-from-carbs rule as the generator (src/domain/generator/filters.ts), applied per 100g since that's scale-invariant anyway. */
function isLowCarbFood(food: { kcalPer100: number; carbsPer100: number }): boolean {
  if (food.kcalPer100 <= 0) return true;
  return (food.carbsPer100 * 4) / food.kcalPer100 <= 0.26;
}

function toggleValue(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

export default function LibraryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const ACCENTS = useMemo(() => [colors.accentSoft], [colors]);
  const listRef = useRef<FlatList>(null);
  const { onScroll: onRestoreScroll, scrollEventThrottle } = useTabScrollRestore(listRef);
  const scrollHint = useScrollDownHint(listRef);
  const params = useLocalSearchParams<{ pantryOnly?: string }>();
  const [segment, setSegment] = useState<Segment>('recipes');
  const [search, setSearch] = useState('');
  const [recipeFilter, setRecipeFilter] = useState<RecipeFilter>('all');
  const [filterModalVisible, setFilterModalVisible] = useState(false);
  const [pantryFilterActive, setPantryFilterActive] = useState(false);

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
  const recipeRatings = useRatingsMap(activeProfile?.id, 'recipe');
  const foodRatings = useRatingsMap(activeProfile?.id, 'food');
  const recipeTagsMap = useRecipeTagsMap();
  const foodAllergensMap = useFoodAllergensMap();
  const recipeNutritionMap = useRecipeNutritionMap();
  const recipeIngredientFoodIdsMap = useRecipeIngredientFoodIdsMap();
  const pantryItems = usePantryItems(household?.id);

  useEffect(() => {
    if (params.pantryOnly === '1') {
      setPantryFilterActive(true);
      setSegment('recipes');
    }
  }, [params.pantryOnly]);

  const inStockFoodIds = useMemo(() => new Set(pantryItems.map((item) => item.foodId)), [pantryItems]);

  /** Recipe ids qualifying for the "Uvař z toho, co mám" cross-link filter (see src/domain/pantryRecipeMatch.ts) – null when the filter isn't active. */
  const pantryMatchIds = useMemo(() => {
    if (!pantryFilterActive) return null;
    const candidates = recipeRows.map((recipe) => ({
      id: recipe.id,
      ingredientFoodIds: recipeIngredientFoodIdsMap.get(recipe.id) ?? [],
    }));
    return new Set(rankRecipesByPantryOverlap(candidates, inStockFoodIds).map((c) => c.id));
  }, [pantryFilterActive, recipeRows, recipeIngredientFoodIdsMap, inStockFoodIds]);

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
    return [...set].sort().map((key) => ({ value: key, label: displayRecipeTag(t, key) }));
  }, [recipeRows, t]);

  const dietOptions = useMemo(
    () => DIET_KEYS.map((key) => ({ value: key, label: t(`diets.${key}`), icon: DIET_ICONS[key] })),
    [t],
  );
  const allergenOptions = useMemo(
    () => ALLERGEN_KEYS.map((key) => ({ value: key, label: t(`allergens.${key}`), icon: ALLERGEN_ICONS[key] })),
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

  // Parsed once per data change instead of on every renderItem call (O3).
  const recipeTagsById = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const recipe of recipeRows) {
      map.set(recipe.id, recipe.tagsJson ? (JSON.parse(recipe.tagsJson) as string[]) : []);
    }
    return map;
  }, [recipeRows]);
  const foodDietFlagsById = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const food of foodRows) {
      map.set(food.id, food.dietFlagsJson ? (JSON.parse(food.dietFlagsJson) as string[]) : []);
    }
    return map;
  }, [foodRows]);

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
          const tags = recipeTagsById.get(recipe.id) ?? [];
          return recipeTags.some((tag) => tags.includes(tag));
        })
        .filter((recipe) => {
          if (recipeDiets.length === 0) return true;
          const derived = recipeTagsMap.get(recipe.id);
          return recipeDiets.every((diet) => {
            if (diet === 'low_carb') {
              const nutrition = recipeNutritionMap.get(recipe.id);
              return !!nutrition && isLowCarbRecipe(nutrition);
            }
            return derived?.dietFlags.includes(diet);
          });
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
        .filter((recipe) => !pantryMatchIds || pantryMatchIds.has(recipe.id))
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
      recipeNutritionMap,
      recipeTagsById,
      pantryMatchIds,
    ],
  );

  const filteredFoods = useMemo(
    () =>
      foodRows
        .filter((food) => foodCategories.length === 0 || foodCategories.includes(food.category))
        .filter((food) => foodBudgets.length === 0 || foodBudgets.includes(food.budget))
        .filter((food) => {
          if (foodDiets.length === 0) return true;
          const flags = foodDietFlagsById.get(food.id) ?? [];
          const allergens = foodAllergensMap.get(food.id) ?? [];
          return foodDiets.every((diet) => {
            if (diet === 'gluten_free') return !allergens.includes('gluten');
            if (diet === 'dairy_free') return !allergens.includes('lactose');
            if (diet === 'low_carb') return isLowCarbFood(food);
            return flags.includes(diet);
          });
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
    [foodRows, normalizedSearch, foodCategories, foodBudgets, foodDiets, foodExcludeAllergens, foodAllergensMap, foodDietFlagsById],
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
        <View style={styles.headerButtons}>
          {segment === 'recipes' ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('recipeImport.title')}
              style={styles.importButton}
              onPress={() => router.push('/recipe/import')}>
              <Ionicons name="download-outline" size={20} color={colors.primary} />
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            style={styles.addButton}
            onPress={() =>
              router.push(segment === 'recipes' ? '/recipe/edit' : '/food/edit')
            }>
            <Ionicons name="add" size={22} color={colors.onPrimary} />
          </Pressable>
        </View>
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

      {segment === 'recipes' && pantryFilterActive ? (
        <View style={styles.pantryFilterRow}>
          <View style={styles.pantryFilterChip}>
            <Ionicons name="basket-outline" size={14} color={colors.onInteractive} />
            <Text style={styles.pantryFilterLabel}>{t('library.pantryOnlyFilter')}</Text>
            <Pressable accessibilityRole="button" onPress={() => setPantryFilterActive(false)} hitSlop={8}>
              <Ionicons name="close" size={14} color={colors.onInteractive} />
            </Pressable>
          </View>
        </View>
      ) : null}

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
          ref={listRef}
          onScroll={(e) => {
            onRestoreScroll(e);
            scrollHint.onScroll(e);
          }}
          onContentSizeChange={scrollHint.onContentSizeChange}
          onLayout={scrollHint.onLayout}
          scrollEventThrottle={scrollEventThrottle}
          data={filteredRecipes}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Image
                source={require('../../assets/images/empty-states/library-no-results.png')}
                style={styles.emptyImage}
                contentFit="contain"
              />
              <Text style={styles.emptyText}>{t('library.noResults')}</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const nutrition = recipeNutritionMap.get(item.id);
            const categoryLabel = t(`library.filter.${item.isSide ? 'side' : item.category}`);
            const tags = recipeTagsById.get(item.id) ?? [];
            const allergens = recipeTagsMap.get(item.id)?.allergens ?? [];
            return (
              <LibraryCard
                title={localizedName(item)}
                subtitle={nutrition ? `${categoryLabel} · ${Math.round(nutrition.kcal)} kcal` : categoryLabel}
                photoUri={photoMap.get(`recipe:${item.id}`)}
                accent={ACCENTS[index % ACCENTS.length]}
                rating={recipeRatings.get(item.id) ?? null}
                tags={[
                  { label: t(`budget.${item.budget}`) },
                  ...tags.map((tag) => ({ label: displayRecipeTag(t, tag) })),
                ]}
                allergenTags={allergens.map((allergen) => ({
                  label: t(`allergens.${allergen}`),
                  icon: ALLERGEN_ICONS[allergen],
                }))}
                onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: item.id } })}
                onDelete={() => confirmDeleteRecipe(item)}
              />
            );
          }}
        />
      ) : (
        <FlatList
          ref={listRef}
          onScroll={(e) => {
            onRestoreScroll(e);
            scrollHint.onScroll(e);
          }}
          onContentSizeChange={scrollHint.onContentSizeChange}
          onLayout={scrollHint.onLayout}
          scrollEventThrottle={scrollEventThrottle}
          data={filteredFoods}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Image
                source={require('../../assets/images/empty-states/library-no-results.png')}
                style={styles.emptyImage}
                contentFit="contain"
              />
              <Text style={styles.emptyText}>{t('library.noResults')}</Text>
            </View>
          }
          renderItem={({ item, index }) => {
            const dietFlags = foodDietFlagsById.get(item.id) ?? [];
            const allergens = foodAllergensMap.get(item.id) ?? [];
            return (
              <LibraryCard
                title={localizedName(item)}
                subtitle={`${Math.round(item.kcalPer100)} kcal / 100 ${item.baseUnit === 'piece' ? 'g' : item.baseUnit}`}
                photoUri={photoMap.get(`food:${item.id}`)}
                accent={ACCENTS[index % ACCENTS.length]}
                rating={foodRatings.get(item.id) ?? null}
                tags={[
                  { label: t(`budget.${item.budget}`) },
                  ...dietFlags.map((flag) => ({ label: t(`diets.${flag}`), icon: DIET_ICONS[flag] })),
                ]}
                allergenTags={allergens.map((allergen) => ({
                  label: t(`allergens.${allergen}`),
                  icon: ALLERGEN_ICONS[allergen],
                }))}
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
    headerButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    importButton: {
      width: 38,
      height: 38,
      borderRadius: 19,
      borderWidth: 1,
      borderColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
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
    pantryFilterRow: {
      flexDirection: 'row',
      marginTop: spacing.sm,
    },
    pantryFilterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.interactive,
      borderRadius: radius.chip,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.sm + 2,
    },
    pantryFilterLabel: {
      color: colors.onInteractive,
      fontSize: typography.small,
      fontWeight: '600',
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
      paddingVertical: spacing.md,
      paddingBottom: spacing.xl,
    },
    emptyWrap: {
      alignItems: 'center',
      marginTop: spacing.xl,
    },
    emptyImage: {
      width: 220,
      height: 160,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: typography.small,
      textAlign: 'center',
      marginTop: spacing.sm,
      maxWidth: 280,
    },
  });
}
