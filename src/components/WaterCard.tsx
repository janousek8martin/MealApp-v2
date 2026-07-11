import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
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

/** Compact Home-screen widget: today's water progress + logging a drunk glass. Only rendered by the caller when the profile has trackWater enabled. */
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
        <Ionicons name="water" size={16} color={colors.primary} />
        <Text style={styles.title}>{t('water.cardTitle')}</Text>
        <Text style={[styles.amountText, reached && styles.amountReached]}>
          {Math.round(totalMl)} / {Math.round(goalMl)} ml
        </Text>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('water.removeGlass')}
          style={styles.glassButton}
          onPress={() => void logWater(db, profileId, -GLASS_ML, today)}>
          <Ionicons name="remove" size={14} color={colors.primary} />
          <MaterialCommunityIcons name="cup-water" size={16} color={colors.primary} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('water.addGlass')}
          style={[styles.glassButton, styles.glassButtonPrimary]}
          onPress={() => void logWater(db, profileId, GLASS_ML, today)}>
          <Ionicons name="add" size={14} color={colors.onPrimary} />
          <MaterialCommunityIcons name="cup-water" size={16} color={colors.onPrimary} />
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
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      marginTop: spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    title: {
      flex: 1,
      color: colors.text,
      fontSize: typography.small,
      fontWeight: '700',
    },
    amountText: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '600',
    },
    amountReached: {
      color: colors.success,
      fontWeight: '700',
    },
    bottomRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    progressTrack: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    progressFill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    glassButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
      height: 32,
      paddingHorizontal: spacing.sm + 2,
      borderRadius: radius.chip,
      borderWidth: 1,
      borderColor: colors.border,
    },
    glassButtonPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
  });
}
