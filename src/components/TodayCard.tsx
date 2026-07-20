import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  eatenCount: number;
  plannedTotal: number;
};

/**
 * Small "glance" card near the top of Home: today's eaten-vs-planned meal
 * count plus one calm status line. Reuses `todayMealCount`/`todayMealTotal`
 * already computed in `index.tsx` (from `usePortionsForDate`) - no new
 * query. Copy is deliberately silent-skip: a day with nothing planned yet
 * reads as neutral ("nothing planned yet"), never as a missed obligation.
 */
export function TodayCard({ eatenCount, plannedTotal }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const statusKey =
    plannedTotal === 0
      ? 'home.today.statusNonePlanned'
      : eatenCount >= plannedTotal
        ? 'home.today.statusAllDone'
        : 'home.today.statusOnTrack';

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
        <Text style={styles.count}>
          {plannedTotal === 0 ? '—' : `${eatenCount}/${plannedTotal}`}
        </Text>
        <Text style={styles.countLabel}>{t('home.today.mealsLabel')}</Text>
      </View>
      <Text style={styles.status}>{t(statusKey)}</Text>
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
      padding: spacing.sm,
      marginTop: spacing.sm,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    count: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '800',
    },
    countLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
    },
    status: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 2,
    },
  });
}
