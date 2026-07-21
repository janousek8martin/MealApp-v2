import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { InfoTooltip } from '@/components/ui/InfoTooltip';
import type { TargetsResult } from '@/domain/targets';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  name: string;
  targets: TargetsResult;
};

/** Hero gradient card with the live TDCI and macro breakdown. */
export function TdciCard({ name, targets }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const heroGradient = useMemo(
    () => [colors.heroGradientStart, colors.heroGradientEnd] as const,
    [colors],
  );
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
      <Image
        source={require('../assets/images/hero/home-hero.png')}
        style={styles.heroTexture}
        contentFit="cover"
      />
      <View style={styles.nameRow}>
        <Text style={styles.name}>{name}</Text>
        <InfoTooltip titleKey="tooltip.macros.title" bodyKey="tooltip.macros.body" color={colors.accentSoft} />
      </View>
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

      {targets.fatFloorViolated ? <Text style={styles.fatFloorWarning}>{t('tdciMode.fatFloorViolated')}</Text> : null}
    </LinearGradient>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: {
      borderRadius: radius.card,
      padding: spacing.lg,
      overflow: 'hidden',
    },
    heroTexture: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.16,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    name: {
      color: colors.accentSoft,
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
      color: colors.accentSoft,
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
      color: colors.accentSoft,
      fontSize: typography.small,
      marginTop: 2,
    },
    fatFloorWarning: {
      color: colors.onPrimary,
      fontSize: typography.small,
      marginTop: spacing.sm,
      opacity: 0.9,
    },
  });
}
