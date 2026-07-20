import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  plannedDays: number;
  totalDays: number;
  onDismiss: () => void;
};

/**
 * Gentle "X of Y days planned this week" recap card. Encouragement-only
 * copy - never framed as a grade or a failure, even when plannedDays is low.
 * Dismissibility: a small permanent "hide" flag in `useAppStore`
 * (`hideWeeklyRecap`), following the exact same one-way pattern as
 * `hasSeenMoreHint`. A per-week reset wasn't worth the extra state for a
 * card whose copy is inherently calm/positive regardless of the number -
 * once a user has decided they don't want the nudge, there's no week where
 * showing it again would be more welcome.
 */
export function WeeklyRecapCard({ plannedDays, totalDays, onDismiss }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const summary =
    plannedDays === 0
      ? t('home.weeklyRecap.summaryZero')
      : t('home.weeklyRecap.summary', { planned: plannedDays, total: totalDays });

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <Ionicons name="calendar-outline" size={16} color={colors.interactive} />
        <Text style={styles.text}>{summary}</Text>
        <Pressable accessibilityRole="button" onPress={onDismiss} hitSlop={8}>
          <Ionicons name="close" size={16} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.card,
      padding: spacing.sm,
      marginTop: spacing.sm,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    text: {
      flex: 1,
      color: colors.text,
      fontSize: typography.small,
      fontWeight: '600',
    },
  });
}
