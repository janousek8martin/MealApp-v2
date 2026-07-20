import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Image } from 'expo-image';
import { useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FoodPickerModal, type FoodRow } from '@/components/FoodPickerModal';
import { ScrollDownHintButton } from '@/components/ScrollDownHintButton';
import { AccordionCard } from '@/components/ui/AccordionCard';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/TextField';
import { getFoodCategoryIcon } from '@/constants/pantryCategoryIcons';
import { db } from '@/db/client';
import { addPantryItem, prefillStaplesToShoppingList, removePantryItem } from '@/db/repositories/shopping';
import { todayIsoDate } from '@/db/time';
import { groupPantryItems, type PantryBucket } from '@/domain/pantryGrouping';
import { useHousehold } from '@/hooks/data';
import { useFood, useFoods } from '@/hooks/library';
import { usePantryItems, type PantryItemRow } from '@/hooks/shopping';
import { useScrollDownHint } from '@/hooks/useScrollDownHint';
import { useTabScrollRestore } from '@/hooks/useTabScrollRestore';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';
import { localizedName } from '@/utils/localized';

const SECTION_ORDER: PantryBucket[] = ['expiringSoon', 'fresh', 'freezer', 'staples', 'other'];
const SECTION_TITLE_KEYS: Record<PantryBucket, string> = {
  expiringSoon: 'shopping.sectionExpiringSoon',
  fresh: 'shopping.sectionFresh',
  freezer: 'shopping.sectionFreezer',
  staples: 'shopping.sectionStaples',
  other: 'shopping.sectionOther',
};

type PantrySection = { key: PantryBucket; items: PantryItemRow[] };

function PantryRow({
  item,
  attention,
  onRemove,
}: {
  item: PantryItemRow;
  attention?: boolean;
  onRemove: () => void;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const food = useFood(item.foodId);
  const name = food ? localizedName(food) : '';
  const icon = getFoodCategoryIcon(food?.category);

  return (
    <View style={styles.row}>
      <Image source={icon} style={styles.rowIcon} contentFit="contain" />
      <View style={styles.rowText}>
        <Text style={styles.rowName} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.rowMeta, attention && styles.rowMetaWarning]}>
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
  const listRef = useRef<FlatList>(null);
  const { onScroll: onRestoreScroll, scrollEventThrottle } = useTabScrollRestore(listRef);
  const scrollHint = useScrollDownHint(listRef);
  const { household } = useHousehold();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pendingFood, setPendingFood] = useState<FoodRow | null>(null);
  const [quantity, setQuantity] = useState('');

  const pantryItems = usePantryItems(household?.id);
  const foodRows = useFoods();

  const foodsById = useMemo(
    () => new Map(foodRows.map((food) => [food.id, { storage: food.storage, category: food.category }])),
    [foodRows],
  );
  const today = todayIsoDate();
  const grouped = useMemo(() => groupPantryItems(pantryItems, foodsById, today), [pantryItems, foodsById, today]);
  const sections = useMemo<PantrySection[]>(
    () =>
      SECTION_ORDER.map((key) => ({ key, items: grouped[key] })).filter((section) => section.items.length > 0),
    [grouped],
  );

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

  const prefillStaples = async () => {
    if (!household) return;
    const result = await prefillStaplesToShoppingList(db, household.id);
    Alert.alert('', t('shopping.prefillStapleResult', { added: result.added, skipped: result.skipped }));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.heading}>{t('tabs.pantry')}</Text>
      </View>

      <View style={styles.actionsRow}>
        <Button label={t('shopping.addItem')} onPress={() => setPickerVisible(true)} style={styles.actionButton} />
        <Button label={t('shopping.prefillStaples')} variant="secondary" onPress={prefillStaples} style={styles.actionButton} />
      </View>

      <Pressable
        accessibilityRole="button"
        style={styles.shoppingLink}
        onPress={() => router.push('/shopping')}>
        <Ionicons name="cart-outline" size={16} color={colors.primary} />
        <Text style={styles.shoppingLinkLabel}>{t('shopping.goToShoppingList')}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </Pressable>

      <Pressable
        accessibilityRole="button"
        style={styles.cookLink}
        onPress={() => router.push({ pathname: '/(tabs)/library', params: { pantryOnly: '1' } })}>
        <Ionicons name="restaurant-outline" size={16} color={colors.primary} />
        <Text style={styles.shoppingLinkLabel}>{t('shopping.cookWithPantry')}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.primary} />
      </Pressable>

      <FlatList
        ref={listRef}
        onScroll={(e) => {
          onRestoreScroll(e);
          scrollHint.onScroll(e);
        }}
        onContentSizeChange={scrollHint.onContentSizeChange}
        onLayout={scrollHint.onLayout}
        scrollEventThrottle={scrollEventThrottle}
        contentContainerStyle={styles.list}
        data={sections}
        keyExtractor={(section) => section.key}
        renderItem={({ item: section }: { item: PantrySection }) =>
          section.key === 'expiringSoon' ? (
            <View style={styles.pinnedSection}>
              <Text style={styles.pinnedTitle}>{t(SECTION_TITLE_KEYS.expiringSoon)}</Text>
              {section.items.map((row) => (
                <PantryRow key={row.id} item={row} attention onRemove={() => void removePantryItem(db, row.id)} />
              ))}
            </View>
          ) : (
            <AccordionCard title={t(SECTION_TITLE_KEYS[section.key])}>
              {section.items.map((row) => (
                <PantryRow key={row.id} item={row} onRemove={() => void removePantryItem(db, row.id)} />
              ))}
            </AccordionCard>
          )
        }
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
    shoppingLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      marginTop: spacing.sm,
    },
    cookLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      paddingHorizontal: spacing.md,
      marginTop: spacing.xs,
    },
    shoppingLinkLabel: {
      color: colors.primary,
      fontSize: typography.body,
      fontWeight: '600',
    },
    list: {
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },
    pinnedSection: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.attention,
      padding: spacing.md,
      marginBottom: spacing.sm,
    },
    pinnedTitle: {
      color: colors.attention,
      fontSize: typography.subtitle,
      fontWeight: '700',
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
    rowIcon: {
      width: 26,
      height: 26,
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
      color: colors.attention,
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
