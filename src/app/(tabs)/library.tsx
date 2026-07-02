import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LibraryCard } from '@/components/LibraryCard';
import { useActiveProfile, useHousehold } from '@/hooks/data';
import { useFavoriteRecipeIds, useFoods, usePhotoMap, useRecipes } from '@/hooks/library';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { localizedName } from '@/utils/localized';

type Segment = 'recipes' | 'foods';
type RecipeFilter = 'all' | 'breakfast' | 'lunch_dinner' | 'snack' | 'side';

const ACCENTS = [colors.olive, colors.sand, colors.earth];

export default function LibraryScreen() {
  const { t } = useTranslation();
  const [segment, setSegment] = useState<Segment>('recipes');
  const [search, setSearch] = useState('');
  const [recipeFilter, setRecipeFilter] = useState<RecipeFilter>('all');

  const { household } = useHousehold();
  const activeProfile = useActiveProfile(household?.id);
  const recipeRows = useRecipes();
  const foodRows = useFoods();
  const photoMap = usePhotoMap();
  const favoriteIds = useFavoriteRecipeIds(activeProfile?.id);

  const normalizedSearch = search.trim().toLowerCase();

  const filteredRecipes = useMemo(
    () =>
      recipeRows
        .filter((recipe) => {
          if (recipeFilter === 'side') return recipe.isSide;
          if (recipeFilter !== 'all' && recipe.category !== recipeFilter) return false;
          if (recipeFilter !== 'side' && recipe.isSide && recipeFilter === 'all') return true;
          return true;
        })
        .filter(
          (recipe) =>
            !normalizedSearch ||
            recipe.nameCs.toLowerCase().includes(normalizedSearch) ||
            recipe.nameEn.toLowerCase().includes(normalizedSearch),
        )
        .sort((a, b) => localizedName(a).localeCompare(localizedName(b), 'cs')),
    [recipeRows, recipeFilter, normalizedSearch],
  );

  const filteredFoods = useMemo(
    () =>
      foodRows
        .filter(
          (food) =>
            !normalizedSearch ||
            food.nameCs.toLowerCase().includes(normalizedSearch) ||
            food.nameEn.toLowerCase().includes(normalizedSearch),
        )
        .sort((a, b) => localizedName(a).localeCompare(localizedName(b), 'cs')),
    [foodRows, normalizedSearch],
  );

  const recipeFilters: RecipeFilter[] = ['all', 'breakfast', 'lunch_dinner', 'snack', 'side'];

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

      <TextInput
        style={styles.search}
        value={search}
        onChangeText={setSearch}
        placeholder={t('library.search')}
        placeholderTextColor={colors.textSecondary}
      />

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
          renderItem={({ item, index }) => (
            <LibraryCard
              title={localizedName(item)}
              subtitle={t(`library.filter.${item.isSide ? 'side' : item.category}`)}
              photoUri={photoMap.get(`recipe:${item.id}`)}
              accent={ACCENTS[index % ACCENTS.length]}
              badge={t(`budget.${item.budget}`)}
              favorite={favoriteIds.has(item.id)}
              onPress={() => router.push({ pathname: '/recipe/[id]', params: { id: item.id } })}
            />
          )}
        />
      ) : (
        <FlatList
          data={filteredFoods}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item, index }) => (
            <LibraryCard
              title={localizedName(item)}
              subtitle={`${Math.round(item.kcalPer100)} kcal / 100 ${item.baseUnit === 'piece' ? 'g' : item.baseUnit}`}
              photoUri={photoMap.get(`food:${item.id}`)}
              accent={ACCENTS[index % ACCENTS.length]}
              badge={t(`budget.${item.budget}`)}
              onPress={() => router.push({ pathname: '/food/[id]', params: { id: item.id } })}
            />
          )}
        />
      )}
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
  search: {
    backgroundColor: colors.surface,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    color: colors.text,
    marginTop: spacing.sm,
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
