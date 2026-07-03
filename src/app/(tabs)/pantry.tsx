import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodPickerModal, type FoodRow } from '@/components/FoodPickerModal';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import { addPantryItem, removePantryItem } from '@/db/repositories/shopping';
import { todayIsoDate } from '@/db/time';
import { useHousehold } from '@/hooks/data';
import { useFood } from '@/hooks/library';
import { usePantryItems, type PantryItemRow } from '@/hooks/shopping';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';
import { localizedName } from '@/utils/localized';

function PantryRow({ item, onRemove }: { item: PantryItemRow; onRemove: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const food = useFood(item.foodId);
  const name = food ? localizedName(food) : '';
  const today = todayIsoDate();
  const expiringSoon = item.expiresAt !== null && item.expiresAt <= today;

  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.rowMeta, expiringSoon && styles.rowMetaWarning]}>
          {Math.round(item.quantity * 10) / 10} {food?.baseUnit === 'piece' ? t('units.pcs') : food?.baseUnit}
          {item.expiresAt ? ` · ${t('shopping.expiresOn', { date: item.expiresAt })}` : ''}
        </Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onRemove} hitSlop={8}>
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

export default function PantryScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { household } = useHousehold();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pendingFood, setPendingFood] = useState<FoodRow | null>(null);
  const [quantity, setQuantity] = useState('');

  const pantryItems = usePantryItems(household?.id);

  const closeAddFlow = () => {
    setPickerVisible(false);
    setPendingFood(null);
    setQuantity('');
  };

  const confirmAddItem = async () => {
    if (!household || !pendingFood) return;
    const qty = Number(quantity.replace(',', '.'));
    if (!Number.isFinite(qty) || qty <= 0) return;
    await addPantryItem(db, household.id, { foodId: pendingFood.id, quantity: qty });
    closeAddFlow();
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>{t('tabs.pantry')}</Text>
      </View>

      <View style={styles.actionsRow}>
        <Button label={t('shopping.addItem')} onPress={() => setPickerVisible(true)} style={styles.actionButton} />
      </View>

      <FlatList
        contentContainerStyle={styles.list}
        data={pantryItems}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <PantryRow item={item} onRemove={() => void removePantryItem(db, item.id)} />}
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Image
              source={require('../../assets/images/empty-states/pantry-empty.png')}
              style={styles.emptyImage}
              contentFit="contain"
            />
            <Text style={styles.emptyText}>{t('shopping.emptyPantry')}</Text>
          </View>
        }
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
    list: {
      padding: spacing.md,
      paddingBottom: spacing.xl,
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
    rowMeta: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 2,
    },
    rowMetaWarning: {
      color: colors.danger,
      fontWeight: '600',
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
