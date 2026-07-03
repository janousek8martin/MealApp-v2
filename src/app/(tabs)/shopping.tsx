import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodPickerModal, type FoodRow } from '@/components/FoodPickerModal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import {
  addManualShoppingItem,
  generateShoppingList,
  removeShoppingItem,
  setShoppingItemChecked,
} from '@/db/repositories/shopping';
import { useHousehold } from '@/hooks/data';
import { useFood } from '@/hooks/library';
import { useShoppingItems, type ShoppingItemRow } from '@/hooks/shopping';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';
import { localizedName } from '@/utils/localized';

function ShoppingRow({ item, onToggle, onRemove }: { item: ShoppingItemRow; onToggle: () => void; onRemove: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const food = useFood(item.foodId ?? undefined);
  const name = food ? localizedName(food) : (item.customName ?? '');

  return (
    <Pressable accessibilityRole="button" style={styles.row} onPress={onToggle}>
      <Ionicons
        name={item.checked ? 'checkbox' : 'square-outline'}
        size={22}
        color={item.checked ? colors.success : colors.textSecondary}
      />
      <View style={styles.rowText}>
        <Text style={[styles.rowName, item.checked && styles.rowNameChecked]} numberOfLines={1}>
          {name}
        </Text>
        {item.quantity !== null ? (
          <Text style={styles.rowMeta}>
            {Math.round(item.quantity * 10) / 10} {item.unit}
          </Text>
        ) : null}
      </View>
      <Pressable accessibilityRole="button" onPress={onRemove} hitSlop={8}>
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </Pressable>
    </Pressable>
  );
}

export default function ShoppingScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { household } = useHousehold();
  const [generating, setGenerating] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pendingFood, setPendingFood] = useState<FoodRow | null>(null);
  const [quantity, setQuantity] = useState('');

  const shoppingItems = useShoppingItems(household?.id);

  const weeklyItems = useMemo(
    () => shoppingItems.filter((i) => i.horizon === 'weekly').sort((a, b) => Number(a.checked) - Number(b.checked)),
    [shoppingItems],
  );
  const monthlyItems = useMemo(
    () => shoppingItems.filter((i) => i.horizon === 'monthly').sort((a, b) => Number(a.checked) - Number(b.checked)),
    [shoppingItems],
  );

  const generateList = async () => {
    if (!household) return;
    setGenerating(true);
    try {
      await generateShoppingList(db, household.id);
    } finally {
      setGenerating(false);
    }
  };

  const closeAddFlow = () => {
    setPickerVisible(false);
    setPendingFood(null);
    setQuantity('');
  };

  const confirmAddItem = async () => {
    if (!household || !pendingFood) return;
    const qty = Number(quantity.replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) return;
    await addManualShoppingItem(db, household.id, {
      foodId: pendingFood.id,
      quantity: qty,
      unit: pendingFood.baseUnit === 'piece' ? undefined : pendingFood.baseUnit,
      horizon: 'weekly',
    });
    closeAddFlow();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>{t('tabs.shopping')}</Text>
      </View>

      <View style={styles.actionsRow}>
        <Button
          label={generating ? t('today.generating') : t('shopping.generateList')}
          variant="secondary"
          onPress={generateList}
          disabled={generating || !household}
          style={styles.actionButton}
        />
        <Button label={t('shopping.addItem')} onPress={() => setPickerVisible(true)} style={styles.actionButton} />
      </View>
      {generating ? <ActivityIndicator color={colors.primary} style={styles.spinner} /> : null}

      <FlatList
        contentContainerStyle={styles.list}
        data={[
          { key: 'weekly', title: t('shopping.weekly'), items: weeklyItems },
          { key: 'monthly', title: t('shopping.monthly'), items: monthlyItems },
        ]}
        keyExtractor={(section) => section.key}
        renderItem={({ item: section }) =>
          section.items.length > 0 ? (
            <View>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {section.items.map((item) => (
                <ShoppingRow
                  key={item.id}
                  item={item}
                  onToggle={() => void setShoppingItemChecked(db, item.id, !item.checked)}
                  onRemove={() => void removeShoppingItem(db, item.id)}
                />
              ))}
            </View>
          ) : null
        }
        ListEmptyComponent={<Text style={styles.emptyText}>{t('shopping.emptyList')}</Text>}
      />

      <FoodPickerModal
        visible={pickerVisible && !pendingFood}
        onClose={closeAddFlow}
        onPick={(food) => setPendingFood(food)}
      />

      {pendingFood ? (
        <View style={styles.quantityOverlay}>
          <View style={styles.quantityCard}>
            <Text style={styles.quantityTitle}>{localizedName(pendingFood)}</Text>
            <TextField
              label={t('shopping.quantity', {
                unit: pendingFood.baseUnit === 'piece' ? t('units.pcs') : pendingFood.baseUnit,
              })}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="decimal-pad"
            />
            <View style={styles.quantityActions}>
              <Button label={t('common.cancel')} variant="secondary" onPress={closeAddFlow} style={styles.actionButton} />
              <Button
                label={t('common.save')}
                onPress={confirmAddItem}
                disabled={!Number.isFinite(Number(quantity.replace(',', '.'))) || Number(quantity) <= 0}
                style={styles.actionButton}
              />
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: spacing.md,
      marginTop: spacing.sm,
    },
    heading: {
      color: colors.text,
      fontSize: typography.title,
      fontWeight: '800',
    },
    actionsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.md,
      marginTop: spacing.md,
    },
    actionButton: {
      flex: 1,
    },
    spinner: {
      marginTop: spacing.sm,
    },
    list: {
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '700',
      marginTop: spacing.md,
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
    rowText: {
      flex: 1,
    },
    rowName: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    rowNameChecked: {
      color: colors.textSecondary,
      textDecorationLine: 'line-through',
    },
    rowMeta: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 2,
    },
    emptyText: {
      color: colors.textSecondary,
      fontSize: typography.small,
      textAlign: 'center',
      marginTop: spacing.xl,
    },
    quantityOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(36, 54, 32, 0.4)',
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    quantityCard: {
      backgroundColor: colors.background,
      borderRadius: radius.card,
      padding: spacing.lg,
      width: '100%',
    },
    quantityTitle: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '700',
      marginBottom: spacing.md,
    },
    quantityActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
  });
}
