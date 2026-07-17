import { Image as ExpoImage } from 'expo-image';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ALLERGEN_ICONS } from '@/constants/chipIcons';
import type { foods } from '@/db/schema';
import { useFoodAllergensMap, useFoods, usePhotoMap } from '@/hooks/library';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';
import { localizedName } from '@/utils/localized';

export type FoodRow = typeof foods.$inferSelect;

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (food: FoodRow) => void;
  /** Allergens a profile this pick applies to must avoid – flags conflicting rows with an allergen icon. Omit when there's no restriction context (e.g. picking a recipe ingredient). */
  restrictedAllergens?: string[];
};

/** Searchable food list used when composing recipe ingredients. */
export function FoodPickerModal({ visible, onClose, onPick, restrictedAllergens = [] }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [search, setSearch] = useState('');
  const foodRows = useFoods();
  const foodAllergensMap = useFoodAllergensMap();
  const photoMap = usePhotoMap();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return foodRows
      .filter(
        (food) =>
          !query ||
          food.nameCs.toLowerCase().includes(query) ||
          food.nameEn.toLowerCase().includes(query),
      )
      .map((food) => ({
        food,
        conflicts: (foodAllergensMap.get(food.id) ?? []).filter((a) => restrictedAllergens.includes(a)),
      }))
      .sort((a, b) => localizedName(a.food).localeCompare(localizedName(b.food), 'cs'));
  }, [foodRows, search, foodAllergensMap, restrictedAllergens]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>{t('recipeEdit.pickFood')}</Text>
        <TextInput
          style={styles.search}
          value={search}
          onChangeText={setSearch}
          placeholder={t('library.search')}
          placeholderTextColor={colors.textSecondary}
          autoFocus
        />
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.food.id}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              style={styles.row}
              onPress={() => {
                onPick(item.food);
                setSearch('');
              }}>
              {photoMap.get(`food:${item.food.id}`) ? (
                <ExpoImage source={{ uri: photoMap.get(`food:${item.food.id}`) }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, styles.thumbPlaceholder]} />
              )}
              <View style={styles.rowTextCol}>
                <View style={styles.rowTitleRow}>
                  <Text style={styles.rowName}>{localizedName(item.food)}</Text>
                  {item.conflicts.map((allergen) => (
                    <Image
                      key={allergen}
                      source={ALLERGEN_ICONS[allergen]}
                      style={styles.allergenIcon}
                      accessibilityLabel={t(`allergens.${allergen}`)}
                    />
                  ))}
                </View>
                <Text style={styles.rowMeta}>
                  {Math.round(item.food.kcalPer100)} kcal / 100 {item.food.baseUnit === 'piece' ? 'g' : item.food.baseUnit}
                </Text>
              </View>
            </Pressable>
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
    row: {
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
    thumb: {
      width: 44,
      height: 44,
      borderRadius: radius.input - 4,
    },
    thumbPlaceholder: {
      backgroundColor: colors.border,
    },
    rowTextCol: {
      flex: 1,
    },
    rowTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    rowName: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    allergenIcon: {
      width: 16,
      height: 16,
    },
    rowMeta: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 2,
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
