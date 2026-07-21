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
  /** ISO date strings ('YYYY-MM-DD') on which this streak's goal was hit (frozen days included) - the same set used to compute `current`/`best`. */
  historyDates: Set<string>;
  /** For kind: 'meal' only - e.g. "3 of 5 meals logged today"; ignored for 'water'. */
  todayCount?: number;
  todayTotal?: number;
  freezesUsed: number;
  freezesMax: number;
  /** false once today already qualifies on its own, or the monthly allowance is used up. */
  canFreeze: boolean;
  onFreeze: () => void;
};

function hoursLeftToday(): number {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return Math.max(0, Math.round((midnight.getTime() - now.getTime()) / (1000 * 60 * 60)));
}

/** Tap-to-open detail behind the Home hero card's streak pills - current vs. best, a day-history strip, a Freeze action, and (meal streak only) today's logged-meal count. */
export function StreakDetailModal({
  visible,
  onClose,
  kind,
  current,
  best,
  historyDates,
  todayCount,
  todayTotal,
  freezesUsed,
  freezesMax,
  canFreeze,
  onFreeze,
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

  const iconColor = kind === 'meal' ? colors.attention : colors.water;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name={kind === 'meal' ? 'flame' : 'water'} size={22} color={iconColor} />
              <Text style={styles.title}>{t(kind === 'meal' ? 'streakDetail.mealTitle' : 'streakDetail.waterTitle')}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.statsGrid}>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{t('streakDetail.current')}</Text>
              <Text style={styles.statValue}>{current}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{t('streakDetail.best')}</Text>
              <Text style={styles.statValue}>{best}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{t('streakDetail.freezesLeft')}</Text>
              <Text style={styles.statValue}>{Math.max(0, freezesMax - freezesUsed)}</Text>
              <Text style={styles.statHint}>{t('streakDetail.freezesResetMonthly')}</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statLabel}>{t('streakDetail.timeLeft')}</Text>
              <Text style={styles.statValue}>{hoursLeftToday()}</Text>
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
            <Button
              label={t('streakDetail.freeze')}
              variant="secondary"
              disabled={!canFreeze}
              onPress={onFreeze}
              style={styles.actionButton}
            />
            <Button label={t('common.close')} onPress={onClose} style={styles.actionButton} />
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
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    title: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '800',
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    stat: {
      flexBasis: '47%',
      flexGrow: 1,
      alignItems: 'flex-start',
      backgroundColor: colors.surfaceAlt,
      borderRadius: radius.input,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
    },
    statLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '600',
    },
    statValue: {
      color: colors.text,
      fontSize: typography.title,
      fontWeight: '800',
      marginTop: 2,
    },
    statHint: {
      color: colors.textSecondary,
      fontSize: typography.small - 2,
      marginTop: 1,
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
