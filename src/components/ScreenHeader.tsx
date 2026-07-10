import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { spacing, type ColorTokens } from '@/theme/tokens';

type Props = {
  /** Rendered right-aligned next to the back button (e.g. EditActions). */
  right?: ReactNode;
  onBack?: () => void;
};

/**
 * The standard sub-screen top bar: a circular chevron-back on the left and an
 * optional right-side slot. Every screen pushed on top of the tabs should use
 * this so nobody forgets the way back (audit N1/N2).
 */
export function ScreenHeader({ right, onBack }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.topBar}>
      <Pressable accessibilityRole="button" onPress={onBack ?? (() => router.back())} style={styles.back}>
        <Ionicons name="chevron-back" size={22} color={colors.text} />
      </Pressable>
      {right}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    back: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
