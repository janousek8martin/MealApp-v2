import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { resolveChipSelectTap } from '@/components/ui/chipSelectLogic';
import { DIET_KEYS } from '@/constants/options';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  value: string | null;
  onChange: (value: string | null) => void;
  /** Diet key to badge as "Recommended" (e.g. 'mediterranean'). Omit for no recommendation. */
  recommendedKey?: string;
};

/** Single-select radio-style diet picker: one row per diet key, tap to select/deselect, tap "Details" to expand its description in place. Replaces the old multi-select ChipSelect usage for diet (a profile/household picks at most one primary diet here). */
export function DietRadioList({ value, onChange, recommendedKey }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  return (
    <View style={styles.list}>
      {DIET_KEYS.map((key) => {
        const selected = value === key;
        const expanded = expandedKey === key;
        return (
          <View key={key} style={[styles.row, selected && styles.rowSelected]}>
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              style={styles.rowMain}
              onPress={() => onChange(resolveChipSelectTap(value, key, true))}>
              <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                {selected ? <View style={styles.radioInner} /> : null}
              </View>
              <Text style={styles.rowLabel}>{t(`diets.${key}`)}</Text>
              {key === recommendedKey ? (
                <View style={styles.recommendedBadge}>
                  <Text style={styles.recommendedBadgeLabel}>{t('diets.recommended')}</Text>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.detailsButton}
              onPress={() => setExpandedKey(expanded ? null : key)}>
              <Text style={styles.detailsLabel}>{t('diets.details')}</Text>
              <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSecondary} />
            </Pressable>
            {expanded ? <Text style={styles.description}>{t(`dietDescriptions.${key}`)}</Text> : null}
          </View>
        );
      })}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    list: {
      gap: spacing.xs + 2,
    },
    row: {
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
    rowMain: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    radioOuter: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    radioOuterSelected: {
      borderColor: colors.primary,
    },
    radioInner: {
      width: 10,
      height: 10,
      borderRadius: 5,
      backgroundColor: colors.primary,
    },
    rowLabel: {
      flex: 1,
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    recommendedBadge: {
      backgroundColor: colors.primary,
      borderRadius: radius.chip,
      paddingVertical: 2,
      paddingHorizontal: spacing.xs + 2,
    },
    recommendedBadgeLabel: {
      color: colors.onPrimary,
      fontSize: 10,
      fontWeight: '700',
    },
    detailsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 2,
      alignSelf: 'flex-start',
      marginTop: spacing.xs,
      marginLeft: 28,
    },
    detailsLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '600',
    },
    description: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: spacing.xs,
      marginLeft: 28,
    },
  });
}
