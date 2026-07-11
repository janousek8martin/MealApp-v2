import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { db } from '@/db/client';
import { logWater } from '@/db/repositories/water';
import { todayIsoDate } from '@/db/time';
import { defaultWaterGoalMl } from '@/domain/water';
import { useWaterTotal } from '@/hooks/water';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

const GLASS_ML = 250;

type Props = {
  profileId: string;
  sex: 'male' | 'female';
  weightKg: number;
  /** Explicit override; falls back to the weight-based domain default. */
  waterGoalMl: number | null;
};

/** Home-screen widget: today's water progress + quick +/- a glass. Only rendered by the caller when the profile has trackWater enabled. */
export function WaterCard({ profileId, sex, weightKg, waterGoalMl }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = todayIsoDate();
  const totalMl = useWaterTotal(profileId, today);
  const goalMl = waterGoalMl ?? defaultWaterGoalMl(weightKg, sex);
  const progress = goalMl > 0 ? Math.min(1, totalMl / goalMl) : 0;
  const reached = totalMl >= goalMl;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="water-outline" size={18} color={colors.primary} />
        <Text style={styles.title}>{t('water.cardTitle')}</Text>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      <View style={styles.footerRow}>
        <Text style={styles.amountText}>
          {Math.round(totalMl)} / {Math.round(goalMl)} ml
        </Text>
        {reached ? <Text style={styles.reachedText}>{t('water.goalReached')}</Text> : null}
      </View>

      <View style={styles.buttonsRow}>
        <Pressable
          accessibilityRole="button"
          style={styles.glassButton}
          onPress={() => void logWater(db, profileId, -GLASS_ML, today)}>
          <Ionicons name="remove" size={16} color={colors.primary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={[styles.glassButton, styles.glassButtonPrimary]}
          onPress={() => void logWater(db, profileId, GLASS_ML, today)}>
          <Ionicons name="add" size={16} color={colors.onPrimary} />
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginTop: spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    title: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
    },
    progressTrack: {
      height: 8,
      borderRadius: 4,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    progressFill: {
      height: 8,
      backgroundColor: colors.primary,
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.xs,
    },
    amountText: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '600',
    },
    reachedText: {
      color: colors.success,
      fontSize: typography.small,
      fontWeight: '700',
    },
    buttonsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm,
      justifyContent: 'flex-end',
    },
    glassButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    glassButtonPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
  });
}
