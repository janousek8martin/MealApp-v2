import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

export type ChipOption = { value: string; label: string };

type SingleProps = {
  label: string;
  options: ChipOption[];
  value: string | null;
  onChange: (value: string) => void;
  multi?: false;
};

type MultiProps = {
  label: string;
  options: ChipOption[];
  value: string[];
  onChange: (value: string[]) => void;
  multi: true;
};

type Props = SingleProps | MultiProps;

/** Rounded chip group used across forms (single or multi select). */
export function ChipSelect(props: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const isSelected = (option: string) =>
    props.multi ? props.value.includes(option) : props.value === option;

  const toggle = (option: string) => {
    if (props.multi) {
      const next = props.value.includes(option)
        ? props.value.filter((item) => item !== option)
        : [...props.value, option];
      props.onChange(next);
    } else {
      props.onChange(option);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.chips}>
        {props.options.map((option) => {
          const selected = isSelected(option.value);
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => toggle(option.value)}
              style={[styles.chip, selected && styles.chipSelected]}>
              <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: {
      marginBottom: spacing.md,
    },
    label: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginBottom: spacing.xs,
      fontWeight: '600',
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      borderRadius: radius.chip,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipLabel: {
      color: colors.text,
      fontSize: typography.small,
      fontWeight: '500',
    },
    chipLabelSelected: {
      color: colors.onPrimary,
    },
  });
}
