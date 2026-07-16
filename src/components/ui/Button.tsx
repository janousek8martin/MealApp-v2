import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  /** 'compact' shrinks padding and font size for dense rows (e.g. Plan screen's footer). Defaults to 'default'. */
  size?: 'default' | 'compact';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({ label, onPress, variant = 'primary', size = 'default', disabled, style }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        size === 'compact' && styles.compact,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'ghost' && styles.ghost,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}>
      <Text
        style={[
          styles.label,
          size === 'compact' && styles.labelCompact,
          variant === 'primary' ? styles.labelOnPrimary : styles.labelOnLight,
        ]}>
        {label}
      </Text>
    </Pressable>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    base: {
      borderRadius: radius.input,
      paddingVertical: spacing.md - 2,
      paddingHorizontal: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    compact: {
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
    },
    primary: {
      backgroundColor: colors.primary,
    },
    secondary: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    ghost: {
      backgroundColor: 'transparent',
    },
    disabled: {
      opacity: 0.45,
    },
    pressed: {
      opacity: 0.85,
    },
    label: {
      fontSize: typography.body,
      fontWeight: '600',
    },
    labelCompact: {
      fontSize: typography.small,
    },
    labelOnPrimary: {
      color: colors.onPrimary,
    },
    labelOnLight: {
      color: colors.primary,
    },
  });
}
