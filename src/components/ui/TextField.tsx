import { StyleSheet, Text, TextInput, View, type KeyboardTypeOptions } from 'react-native';

import { colors, radius, spacing, typography } from '@/theme/tokens';

type Props = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  error?: string;
  suffix?: string;
};

export function TextField({ label, value, onChangeText, placeholder, keyboardType, error, suffix }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputRow, !!error && styles.inputError]}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          keyboardType={keyboardType}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  label: {
    color: colors.textSecondary,
    fontSize: typography.small,
    marginBottom: spacing.xs,
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
    borderColor: '#B3541E',
  },
  input: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    color: colors.text,
    fontSize: typography.body,
  },
  suffix: {
    color: colors.textSecondary,
    fontSize: typography.small,
    marginLeft: spacing.sm,
  },
  error: {
    color: '#B3541E',
    fontSize: typography.small,
    marginTop: spacing.xs,
  },
});
