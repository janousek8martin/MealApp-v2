import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useFoods, useRecipes } from '@/hooks/library';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { localizedName } from '@/utils/localized';

type PickResult = { itemType: 'recipe' | 'food'; itemId: string };

type Props = {
  visible: boolean;
  category: 'breakfast' | 'lunch_dinner' | 'snack';
  onClose: () => void;
  onPick: (result: PickResult) => void;
};

/** Lets the user manually fill a meal slot ("+ Add Meal"), independent of the generator. */
export function MealPickerModal({ visible, category, onClose, onPick }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const recipeRows = useRecipes();
  const foodRows = useFoods();

  const items = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = (name: string) => !query || name.toLowerCase().includes(query);

    const recipeItems = recipeRows
      .filter((r) => !r.isSide && r.category === category)
      .map((r) => ({ itemType: 'recipe' as const, itemId: r.id, name: localizedName(r) }));

    const foodItems =
      category === 'snack'
        ? foodRows.filter((f) => f.snackSuitable).map((f) => ({ itemType: 'food' as const, itemId: f.id, name: localizedName(f) }))
        : [];

    return [...recipeItems, ...foodItems]
      .filter((item) => matches(item.name))
      .sort((a, b) => a.name.localeCompare(b.name, 'cs'));
  }, [recipeRows, foodRows, category, search]);

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
        <FlatList
          data={items}
          keyExtractor={(item) => `${item.itemType}:${item.itemId}`}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              style={styles.row}
              onPress={() => {
                onPick({ itemType: item.itemType, itemId: item.itemId });
                setSearch('');
              }}>
              <Text style={styles.rowName}>{item.name}</Text>
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

const styles = StyleSheet.create({
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
    backgroundColor: colors.surface,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xs + 2,
  },
  rowName: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
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
