import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { todayIsoDate } from '@/db/time';
import { addDays } from '@/domain/week';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

/** How many trailing days the day-history strip shows - 2 weeks fits cleanly across the sheet width without cramping the dots. */
const HISTORY_DAYS = 14;

type Props = {
  visible: boolean;
  onClose: () => void;
  kind: 'meal' | 'water';
  current: number;
  best: number;
  /** ISO date strings ('YYYY-MM-DD') on which this streak's goal was hit - the same `mealCompletionDates`/`waterGoalDates` set already flowing through HomeHeroCard. Used to render the day-history strip. */
  historyDates: Set<string>;
  /** For kind: 'meal' only - e.g. "3 of 5 meals logged today"; ignored for 'water'. */
  todayCount?: number;
  todayTotal?: number;
  onAddMeal?: () => void;
};

/** Tap-to-open detail behind the Home hero card's streak pills - shows current vs. best streak, a day-by-day history strip, and (meal streak only) today's logged-meal count. */
export function StreakDetailModal({
  visible,
  onClose,
  kind,
  current,
  best,
  historyDates,
  todayCount,
  todayTotal,
  onAddMeal,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const historyDays = useMemo(() => {
    const today = todayIsoDate();
    return Array.from({ length: HISTORY_DAYS }, (_, i) => {
      const date = addDays(today, i - (HISTORY_DAYS - 1));
      return { date, hit: historyDates.has(date) };
    });
  }, [historyDates]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Ionicons name={kind === 'meal' ? 'flame' : 'water'} size={22} color={colors.primary} />
            <Text style={styles.title}>{t(kind === 'meal' ? 'streakDetail.mealTitle' : 'streakDetail.waterTitle')}</Text>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{current}</Text>
              <Text style={styles.statLabel}>{t('streakDetail.current')}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statValue}>{best}</Text>
              <Text style={styles.statLabel}>{t('streakDetail.best')}</Text>
            </View>
          </View>

          <View style={styles.historyStrip}>
            {historyDays.map(({ date, hit }) => (
              <View key={date} style={[styles.historyDot, hit ? styles.historyDotHit : styles.historyDotMissed]} />
            ))}
          </View>

          {kind === 'meal' && todayCount !== undefined && todayTotal !== undefined ? (
            <Text style={styles.todayText}>
              {t('streakDetail.mealsLoggedToday', { count: todayCount, total: todayTotal })}
            </Text>
          ) : null}

          <View style={styles.actions}>
            {kind === 'meal' && onAddMeal ? (
              <Button label={t('streakDetail.addMeal')} onPress={onAddMeal} style={styles.actionButton} />
            ) : null}
            <Button label={t('common.close')} variant="secondary" onPress={onClose} style={styles.actionButton} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    sheet: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      padding: spacing.lg,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.md,
    },
    title: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '800',
    },
    statsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    stat: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.input,
      paddingVertical: spacing.md,
    },
    statValue: {
      color: colors.text,
      fontSize: typography.title,
      fontWeight: '800',
    },
    statLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 2,
    },
    historyStrip: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: spacing.md,
    },
    historyDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    historyDotHit: {
      backgroundColor: colors.interactive,
    },
    historyDotMissed: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: colors.border,
    },
    todayText: {
      color: colors.textSecondary,
      fontSize: typography.small,
      textAlign: 'center',
      marginTop: spacing.md,
    },
    actions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.lg,
    },
    actionButton: {
      flex: 1,
    },
  });
}
