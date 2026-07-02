import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import type { TargetsResult } from '@/domain/targets';
import { colors, heroGradient, radius, spacing, typography } from '@/theme/tokens';

type Props = {
  name: string;
  targets: TargetsResult;
};

/** Hero gradient card with the live TDCI and macro breakdown. */
export function TdciCard({ name, targets }: Props) {
  const { t } = useTranslation();
  const macros = [
    { key: 'protein', grams: targets.macros.proteinG },
    { key: 'carbs', grams: targets.macros.carbsG },
    { key: 'fat', grams: targets.macros.fatG },
    { key: 'fiber', grams: targets.fiberG },
  ];

  return (
    <LinearGradient
      colors={heroGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}>
      <Text style={styles.name}>{name}</Text>
      <View style={styles.heroRow}>
        <Text style={styles.kcal}>{Math.round(targets.adjustedTdciKcal)}</Text>
        <Text style={styles.kcalUnit}>kcal</Text>
      </View>
      <Text style={styles.mode}>{t(`tdciMode.${targets.mode}`)}</Text>

      <View style={styles.macrosRow}>
        {macros.map((macro) => (
          <View key={macro.key} style={styles.macro}>
            <Text style={styles.macroValue}>{Math.round(macro.grams)} g</Text>
            <Text style={styles.macroLabel}>{t(`macros.${macro.key}`)}</Text>
          </View>
        ))}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  name: {
    color: colors.mint,
    fontSize: typography.small,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  kcal: {
    color: colors.onPrimary,
    fontSize: typography.hero,
    fontWeight: '800',
    lineHeight: typography.hero + 4,
  },
  kcalUnit: {
    color: colors.mint,
    fontSize: typography.subtitle,
    fontWeight: '600',
    marginBottom: 4,
  },
  mode: {
    color: colors.onPrimary,
    opacity: 0.85,
    fontSize: typography.small,
    marginTop: 2,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.lg,
    backgroundColor: 'rgba(244, 241, 232, 0.12)',
    borderRadius: radius.input,
    padding: spacing.md,
  },
  macro: {
    alignItems: 'center',
    flex: 1,
  },
  macroValue: {
    color: colors.onPrimary,
    fontSize: typography.body,
    fontWeight: '700',
  },
  macroLabel: {
    color: colors.mint,
    fontSize: typography.small,
    marginTop: 2,
  },
});
