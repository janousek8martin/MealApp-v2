import { useMemo } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  hint?: string;
};

export function SwitchRow({ label, value, onChange, hint }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      <View style={styles.textCol}>
        <Text style={styles.label}>{label}</Text>
        {hint ? <Text style={styles.hint}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.interactive }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
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
}
