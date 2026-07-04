import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
  suffix?: string;
  multiline?: boolean;
  /** Optional adornment rendered at the end of the label row (e.g. an info-icon button). */
  labelRight?: ReactNode;
};

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  error,
  suffix,
  multiline,
  labelRight,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {labelRight}
      </View>
      <View style={[styles.inputRow, multiline && styles.inputRowMultiline, !!error && styles.inputError]}>
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          keyboardType={keyboardType}
          multiline={multiline}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: {
      marginBottom: spacing.md,
    },
    labelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    label: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '600',
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.input,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
    },
    inputError: {
      borderColor: colors.danger,
    },
    inputRowMultiline: {
      alignItems: 'flex-start',
    },
    input: {
      flex: 1,
      paddingVertical: spacing.sm + 4,
      color: colors.text,
      fontSize: typography.body,
    },
    inputMultiline: {
      minHeight: 90,
      textAlignVertical: 'top',
    },
    suffix: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginLeft: spacing.sm,
    },
    error: {
      color: colors.danger,
      fontSize: typography.small,
      marginTop: spacing.xs,
    },
  });
}
