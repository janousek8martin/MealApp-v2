import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AddMealSlotModal } from '@/components/AddMealSlotModal';
import { db } from '@/db/client';
import { deleteMealSlot, enableRecommendedSnackSlots, RECOMMENDED_SNACK_SLOT_KEYS } from '@/db/repositories/households';
import { useMealSlots } from '@/hooks/plan';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';
import { slotDisplayLabel } from '@/utils/mealSlots';

type Props = {
  householdId: string | undefined;
  /** Whether this profile is on the household's shared main-meal track - purely informational here (shows a "shared" tag), every slot is freely toggleable regardless. */
  sharesMainMeals: boolean;
  /** null = every currently-available household slot (the default, matching profiles.enabledSlotKeysJson semantics). */
  value: string[] | null;
  onChange: (slotKeys: string[] | null) => void;
};

/**
 * "Which meals do you want per day?" (household-defined, extendable via "+
 * Add meal") - every slot is freely toggleable, including the core main
 * meals (a profile can skip breakfast entirely, for instance). Main slots a
 * shared-meals profile keeps checked show a "shared" tag as a hint that
 * they'll eat the same recipe as everyone else on that slot.
 */
export function MealSlotsPicker({ householdId, sharesMainMeals, value, onChange }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const slots = useMealSlots(householdId);
  const [addVisible, setAddVisible] = useState(false);

  const toggle = (slotKey: string) => {
    // Materialize the "everything" default into an explicit list on first
    // touch, then toggle membership on that list.
    const baseline = value ?? slots.map((s) => s.slotKey);
    const next = baseline.includes(slotKey) ? baseline.filter((key) => key !== slotKey) : [...baseline, slotKey];
    onChange(next);
  };

  const enable = (slotKey: string) => {
    const baseline = value ?? slots.map((s) => s.slotKey);
    if (baseline.includes(slotKey)) return;
    onChange([...baseline, slotKey]);
  };

  const remove = (slot: (typeof slots)[number]) => {
    Alert.alert(
      t('mealSlots.deleteConfirmTitle'),
      t('mealSlots.deleteConfirmMessage', { name: slotDisplayLabel(t, slot) }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => void deleteMealSlot(db, slot.id) },
      ],
    );
  };

  const enabledCount = (value ?? slots.map((s) => s.slotKey)).length;
  const householdSlotKeys = new Set(slots.map((s) => s.slotKey));
  const showRecommendedButton =
    !!householdId && RECOMMENDED_SNACK_SLOT_KEYS.every((key) => !householdSlotKeys.has(key));

  return (
    <View>
      <Text style={styles.title}>{t('mealSlots.title')}</Text>
      <Text style={styles.hint}>{t('mealSlots.hint')}</Text>
      <Text style={styles.hint}>{t('mealSlots.recommendHint')}</Text>
      <View style={styles.list}>
        {slots.map((slot) => {
          const selected = value === null || value.includes(slot.slotKey);
          const showSharedTag = sharesMainMeals && slot.kind === 'main' && selected;
          return (
            <Pressable
              key={slot.id}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => toggle(slot.slotKey)}
              style={[styles.row, selected && styles.rowSelected]}>
              <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
                {selected ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
              </View>
              <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{slotDisplayLabel(t, slot)}</Text>
              {showSharedTag ? <Text style={styles.sharedTag}>{t('mealSlots.shared')}</Text> : null}
              {slot.label ? (
                <Pressable accessibilityRole="button" onPress={() => remove(slot)} hitSlop={8}>
                  <Ionicons name="close-circle-outline" size={18} color={colors.textSecondary} />
                </Pressable>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {enabledCount < 3 ? <Text style={styles.countHint}>{t('addMeal.countLow')}</Text> : null}
      {enabledCount > 6 ? <Text style={styles.countHint}>{t('addMeal.countHigh')}</Text> : null}

      {showRecommendedButton ? (
        <Pressable
          style={styles.addRow}
          onPress={() => void enableRecommendedSnackSlots(db, householdId as string)}>
          <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
          <Text style={styles.addLabel}>{t('mealSlots.useRecommended')}</Text>
        </Pressable>
      ) : null}

      {householdId ? (
        <Pressable style={styles.addRow} onPress={() => setAddVisible(true)}>
          <Ionicons name="add" size={18} color={colors.primary} />
          <Text style={styles.addLabel}>{t('mealSlots.addButton')}</Text>
        </Pressable>
      ) : null}

      {householdId ? (
        <AddMealSlotModal visible={addVisible} householdId={householdId} onClose={() => setAddVisible(false)} onAdded={enable} />
      ) : null}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    title: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
      marginBottom: 2,
    },
    hint: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginBottom: spacing.sm,
    },
    list: {
      gap: spacing.xs + 2,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.card - 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
    },
    rowSelected: {
      borderColor: colors.primary,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    rowLabel: {
      flex: 1,
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    rowLabelSelected: {
      color: colors.text,
    },
    sharedTag: {
      color: colors.textSecondary,
      fontSize: typography.small,
    },
    countHint: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: spacing.xs,
      marginBottom: spacing.sm,
    },
    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
    },
    addLabel: {
      color: colors.primary,
      fontSize: typography.body,
      fontWeight: '600',
    },
  });
}
