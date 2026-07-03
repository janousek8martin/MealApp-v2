import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import type { ColorTokens } from '@/theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;

type Props = {
  icon: IconName;
  /** Which theme accent drives the badge/blob colors. */
  accent?: 'primary' | 'secondary';
  /** Overall footprint (the badge itself is ~62% of this). */
  size?: number;
};

/**
 * Hand-built flat-vector-style illustration: a soft rounded blob background,
 * a colored icon badge, and a couple of decorative dots. Used in place of
 * bundled illustration assets (walkthrough pages, empty states) since we
 * have no image-generation tool and won't guess at external asset URLs –
 * this is fully theme-reactive (light/dark) and needs no extra files.
 */
export function IllustrationScene({ icon, accent = 'primary', size = 160 }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors, accent, size), [colors, accent, size]);

  return (
    <View style={styles.container}>
      <View style={styles.blob} />
      <View style={[styles.dot, styles.dotA]} />
      <View style={[styles.dot, styles.dotB]} />
      <View style={styles.badge}>
        <Ionicons name={icon} size={size * 0.42} color={colors.onPrimary} />
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens, accent: 'primary' | 'secondary', size: number) {
  const badgeColor = accent === 'primary' ? colors.primary : colors.secondary;
  const blobColor = accent === 'primary' ? colors.mint : colors.tealTint;
  const dotColor = accent === 'primary' ? colors.secondary : colors.primary;
  const badgeSize = size * 0.62;
  const blobSize = size;

  return StyleSheet.create({
    container: {
      width: size,
      height: size,
      alignItems: 'center',
      justifyContent: 'center',
    },
    blob: {
      position: 'absolute',
      width: blobSize,
      height: blobSize,
      borderRadius: blobSize * 0.42,
      backgroundColor: blobColor,
      transform: [{ rotate: '8deg' }],
    },
    badge: {
      width: badgeSize,
      height: badgeSize,
      borderRadius: badgeSize / 2,
      backgroundColor: badgeColor,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dot: {
      position: 'absolute',
      borderRadius: 999,
      opacity: 0.85,
    },
    dotA: {
      width: size * 0.14,
      height: size * 0.14,
      backgroundColor: dotColor,
      top: size * 0.04,
      right: size * 0.08,
    },
    dotB: {
      width: size * 0.09,
      height: size * 0.09,
      backgroundColor: colors.lime,
      bottom: size * 0.1,
      left: size * 0.1,
    },
  });
}
