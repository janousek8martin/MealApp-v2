import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'default' | 'compact';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function Button({ label, onPress, variant = 'primary', size = 'default', disabled, style }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (!disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    if (!reducedMotion) {
      scale.value = withTiming(0.96, { duration: 100 });
    }
  };

  const handlePressOut = () => {
    if (!reducedMotion) {
      scale.value = withSpring(1);
    }
  };

  return (
    <AnimatedPressable
      accessibilityRole="button"
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        ({ pressed }: { pressed: boolean }) => [
          styles.base,
          size === 'compact' && styles.compact,
          variant === 'primary' && styles.primary,
          variant === 'secondary' && styles.secondary,
          variant === 'ghost' && styles.ghost,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
          style,
        ],
        animatedStyle,
      ]}>
      <Text
        style={[
          styles.label,
          size === 'compact' && styles.labelCompact,
          variant === 'primary' ? styles.labelOnPrimary : styles.labelOnLight,
        ]}>
        {label}
      </Text>
    </AnimatedPressable>
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
      backgroundColor: colors.interactive,
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
      color: colors.onInteractive,
    },
    labelOnLight: {
      color: colors.primary,
    },
  });
}
