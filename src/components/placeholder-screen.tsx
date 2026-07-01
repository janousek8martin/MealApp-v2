import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, heroGradient, radius, spacing, typography } from '@/theme/tokens';

type Props = {
  title: string;
  subtitle: string;
};

/** Temporary screen body used while the real feature screens are being built. */
export function PlaceholderScreen({ title, subtitle }: Props) {
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

const styles = StyleSheet.create({
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
