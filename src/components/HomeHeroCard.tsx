import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProfileDropdownChip } from '@/components/ProfileDropdownChip';
import { ProgressRing } from '@/components/ProgressRing';
import type { TargetsResult } from '@/domain/targets';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  householdId: string;
  targets: TargetsResult;
  eatenKcal: number;
  targetKcal: number;
  onEditProfile: () => void;
};

/**
 * Home screen's hero card – merges the profile selector and "edit profile"
 * link into the same card as the live TDCI, macros, and today's
 * eaten-vs-target ring, instead of a separate row floating above it.
 */
export function HomeHeroCard({ householdId, targets, eatenKcal, targetKcal, onEditProfile }: Props) {
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
  ];
  const ringProgress = targetKcal > 0 ? eatenKcal / targetKcal : 0;
  const ringPercent = Math.round(ringProgress * 100);

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

      <View style={styles.headerRow}>
        <ProfileDropdownChip householdId={householdId} />
        <Pressable accessibilityRole="button" style={styles.editProfileLink} onPress={onEditProfile}>
          <Ionicons name="settings-outline" size={14} color={colors.onPrimary} />
          <Text style={styles.editProfileLabel}>{t('today.editProfile')}</Text>
        </Pressable>
      </View>

      <View style={styles.heroBody}>
        <View style={styles.heroLeft}>
          <View style={styles.heroRow}>
            <Text style={styles.kcal}>{Math.round(targets.adjustedTdciKcal)}</Text>
            <Text style={styles.kcalUnit}>kcal</Text>
          </View>
          <Text style={styles.mode}>{t(`tdciMode.${targets.mode}`)}</Text>
        </View>

        <ProgressRing
          size={84}
          strokeWidth={7}
          progress={ringProgress}
          trackColor="rgba(244, 241, 232, 0.2)"
          progressColor={colors.primaryLight}>
          <Text style={styles.ringPercent}>{ringPercent}%</Text>
          <Text style={styles.ringLabel}>{t('today.eaten')}</Text>
        </ProgressRing>
      </View>

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
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    editProfileLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    editProfileLabel: {
      color: colors.onPrimary,
      fontSize: typography.small,
      fontWeight: '600',
    },
    heroBody: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroLeft: {
      flexShrink: 1,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
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
    ringPercent: {
      color: colors.onPrimary,
      fontSize: typography.body,
      fontWeight: '800',
    },
    ringLabel: {
      color: colors.mint,
      fontSize: 10,
      marginTop: 1,
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
}
