import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  title: string;
  subtitle: string;
};

/** Temporary screen body used while the real feature screens are being built. */
export function PlaceholderScreen({ title, subtitle }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const heroGradient = useMemo(
    () => [colors.heroGradientStart, colors.heroGradientEnd] as const,
    [colors],
  );
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <LinearGradient
        colors={heroGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <Text style={styles.heroTitle}>{title}</Text>
      </LinearGradient>
      <View style={styles.body}>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      padding: spacing.md,
    },
    hero: {
      borderRadius: radius.card,
      padding: spacing.lg,
      minHeight: 140,
      justifyContent: 'flex-end',
    },
    heroTitle: {
      color: colors.onPrimary,
      fontSize: typography.title,
      fontWeight: '700',
    },
    body: {
      paddingVertical: spacing.lg,
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: 22,
    },
  });
}
