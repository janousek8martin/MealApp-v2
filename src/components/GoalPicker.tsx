import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

export type GoalValue = 'lose' | 'maintain' | 'gain';

const GOALS: { value: GoalValue; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'lose', icon: 'flame-outline' },
  { value: 'maintain', icon: 'infinite-outline' },
  { value: 'gain', icon: 'barbell-outline' },
];

type Props = {
  value: GoalValue;
  onChange: (value: GoalValue) => void;
};

/** Vertical stacked goal list (lose fat / maintain / build muscle) - selected row fills with the primary color. */
export function GoalPicker({ value, onChange }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.list}>
      {GOALS.map((goal) => {
        const selected = value === goal.value;
        return (
          <Pressable
            key={goal.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            style={[styles.row, selected && styles.rowSelected]}
            onPress={() => onChange(goal.value)}>
            <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
              <Ionicons name={goal.icon} size={20} color={selected ? colors.onPrimary : colors.primary} />
            </View>
            <View style={styles.textWrap}>
              <Text style={[styles.rowLabel, selected && styles.rowLabelSelected]}>{t(`goal.${goal.value}`)}</Text>
              <Text style={[styles.rowDescription, selected && styles.rowDescriptionSelected]}>
                {t(`goalDescriptions.${goal.value}`)}
              </Text>
            </View>
          </Pressable>
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
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapSelected: {
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    textWrap: {
      flex: 1,
    },
    rowLabel: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
    },
    rowLabelSelected: {
      color: colors.onPrimary,
    },
    rowDescription: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 1,
    },
    rowDescriptionSelected: {
      color: colors.onPrimary,
      opacity: 0.85,
    },
  });
}
