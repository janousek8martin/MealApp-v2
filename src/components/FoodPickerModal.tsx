import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { foods } from '@/db/schema';
import { useFoods } from '@/hooks/library';
import { colors, radius, spacing, typography } from '@/theme/tokens';
import { localizedName } from '@/utils/localized';

export type FoodRow = typeof foods.$inferSelect;

type Props = {
  visible: boolean;
  onClose: () => void;
  onPick: (food: FoodRow) => void;
};

/** Searchable food list used when composing recipe ingredients. */
export function FoodPickerModal({ visible, onClose, onPick }: Props) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const foodRows = useFoods();

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return foodRows
      .filter(
        (food) =>
          !query ||
          food.nameCs.toLowerCase().includes(query) ||
          food.nameEn.toLowerCase().includes(query),
      )
      .sort((a, b) => localizedName(a).localeCompare(localizedName(b), 'cs'));
  }, [foodRows, search]);

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
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="button"
              style={styles.row}
              onPress={() => {
                onPick(item);
                setSearch('');
              }}>
              <Text style={styles.rowName}>{localizedName(item)}</Text>
              <Text style={styles.rowMeta}>
                {Math.round(item.kcalPer100)} kcal / 100 {item.baseUnit === 'piece' ? 'g' : item.baseUnit}
              </Text>
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
