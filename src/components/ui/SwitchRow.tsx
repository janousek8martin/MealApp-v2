import { StyleSheet, Switch, Text, View } from 'react-native';

import { colors, spacing, typography } from '@/theme/tokens';

type Props = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
};

export function SwitchRow({ label, value, onChange, hint }: Props) {
  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primaryLight }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  textCol: {
    flex: 1,
  },
  label: {
    color: colors.text,
    fontSize: typography.body,
    fontWeight: '600',
  },
  hint: {
    color: colors.textSecondary,
    fontSize: typography.small,
    marginTop: 2,
  },
});
