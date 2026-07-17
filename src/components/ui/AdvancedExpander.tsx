import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { spacing, typography, type ColorTokens } from '@/theme/tokens';

/** Collapsed-by-default "Pokročilé" toggle wrapping advanced/rarely-used controls. Pure UI reorganization: nothing inside changes behavior, it's just hidden until opened. */
export function AdvancedExpander({ children, label }: { children: ReactNode; label?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.container}>
      <Pressable accessibilityRole="button" style={styles.header} onPress={() => setExpanded((prev) => !prev)}>
        <Text style={styles.label}>{label ?? t('settings.advanced')}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textSecondary} />
      </Pressable>
      {expanded ? <View>{children}</View> : null}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: {
      marginTop: spacing.sm,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.xs,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
    },
    label: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '700',
    },
  });
}
