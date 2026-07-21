import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { StreakDetailModal } from '@/components/StreakDetailModal';
import { InfoTooltip } from '@/components/ui/InfoTooltip';
import { longestConsecutiveRun } from '@/domain/streak';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  mealStreak: number;
  waterStreak: number;
  mealCompletionDates: Set<string>;
  waterGoalDates: Set<string>;
  todayMealCount: number;
  todayMealTotal: number;
  onAddMeal: () => void;
};

/**
 * Two equally-sized streak cards below the Home hero card - moved out of
 * HomeHeroCard (Martin's ask) so they read as their own row on the page
 * background instead of squeezed into the gradient card. Real theme colors
 * on the icons (attention/water) instead of the hero card's muted
 * accentSoft, since they're no longer sitting on a dark gradient.
 */
export function StreakRow({
  mealStreak,
  waterStreak,
  mealCompletionDates,
  waterGoalDates,
  todayMealCount,
  todayMealTotal,
  onAddMeal,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [openStreak, setOpenStreak] = useState<'meal' | 'water' | null>(null);

  return (
    <>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" style={styles.card} onPress={() => setOpenStreak('meal')}>
          <Ionicons name="flame" size={22} color={colors.attention} />
          <Text style={styles.value}>{mealStreak}</Text>
          <Text style={styles.label}>{t('today.mealStreak')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.card} onPress={() => setOpenStreak('water')}>
          <Ionicons name="water" size={22} color={colors.water} />
          <Text style={styles.value}>{waterStreak}</Text>
          <Text style={styles.label}>{t('today.waterStreak')}</Text>
        </Pressable>
        <InfoTooltip titleKey="tooltip.streak.title" bodyKey="tooltip.streak.body" />
      </View>

      <StreakDetailModal
        visible={openStreak !== null}
        onClose={() => setOpenStreak(null)}
        kind={openStreak ?? 'meal'}
        current={openStreak === 'water' ? waterStreak : mealStreak}
        best={longestConsecutiveRun(openStreak === 'water' ? waterGoalDates : mealCompletionDates)}
        historyDates={openStreak === 'water' ? waterGoalDates : mealCompletionDates}
        todayCount={openStreak === 'meal' ? todayMealCount : undefined}
        todayTotal={openStreak === 'meal' ? todayMealTotal : undefined}
        onAddMeal={openStreak === 'meal' ? onAddMeal : undefined}
      />
    </>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    card: {
      flex: 1,
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      gap: 2,
    },
    value: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '800',
    },
    label: {
      color: colors.textSecondary,
      fontSize: typography.small,
    },
  });
}
