import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useMealSlots } from '@/hooks/plan';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  householdId: string | undefined;
  /** Whether this profile is on the household's shared main-meal track - purely informational here (shows a "shared" tag), every slot is freely toggleable regardless. */
  sharesMainMeals: boolean;
  /** null = every currently-available household slot (the default, matching profiles.enabledSlotKeysJson semantics). */
  value: string[] | null;
  onChange: (slotKeys: string[] | null) => void;
};

/**
 * "Which meals do you want per day?" (up to 6, household-defined) - every
 * slot is freely toggleable, including the core main meals (a profile can
 * skip breakfast entirely, for instance). Main slots a shared-meals profile
 * keeps checked show a "shared" tag as a hint that they'll eat the same
 * recipe as everyone else on that slot.
 */
export function MealSlotsPicker({ householdId, sharesMainMeals, value, onChange }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const slots = useMealSlots(householdId);

  const toggle = (slotKey: string) => {
    // Materialize the "everything" default into an explicit list on first
    // touch, then toggle membership on that list.
    const baseline = value ?? slots.map((s) => s.slotKey);
    const next = baseline.includes(slotKey) ? baseline.filter((key) => key !== slotKey) : [...baseline, slotKey];
    onChange(next);
  };

  return (
    <View>
      <Text style={styles.title}>{t('mealSlots.title')}</Text>
      <Text style={styles.hint}>{t('mealSlots.hint')}</Text>
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
              <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>
                {slot.label ? slot.label : t(`mealSlots.slot.${slot.slotKey}`, { defaultValue: slot.time })}
              </Text>
              {showSharedTag ? <Text style={styles.sharedTag}>{t('mealSlots.shared')}</Text> : null}
            </Pressable>
          );
        })}
      </View>
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
  });
}
