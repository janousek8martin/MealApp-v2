import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, type ColorTokens } from '@/theme/tokens';

type Props = {
  visible: boolean;
  onPressIn: () => void;
  onPressOut: () => void;
  /** Extra clearance above the screen's bottom edge, e.g. to sit above a sticky footer. */
  bottomOffset?: number;
};

/** Floating "more content below" hint, positioned just above the tab bar (or a screen's sticky footer). */
export function ScrollDownHintButton({ visible, onPressIn, onPressOut, bottomOffset = 0 }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!visible) return null;

  return (
    <Pressable
      accessibilityRole="button"
      style={[styles.button, { bottom: spacing.sm + bottomOffset }]}
      onPressIn={onPressIn}
      onPressOut={onPressOut}>
      <Ionicons name="chevron-down" size={20} color={colors.onPrimary} />
    </Pressable>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    button: {
      position: 'absolute',
      alignSelf: 'center',
      width: 36,
      height: 36,
      borderRadius: radius.chip,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 4,
      shadowOffset: { width: 0, height: 2 },
      elevation: 3,
    },
  });
}
