import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { StreakDetailModal } from '@/components/StreakDetailModal';
import { db } from '@/db/client';
import { addStreakFreeze, MAX_STREAK_FREEZES_PER_MONTH } from '@/db/repositories/streakFreezes';
import { countConsecutiveDays, longestConsecutiveRun } from '@/domain/streak';
import { useStreakFreezeDates } from '@/hooks/streak';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

type Props = {
  profileId: string | undefined;
  today: string;
  /** Dates with >=1 meal eaten - drives the orange flame's "lit today" state. */
  anyEatenDates: Set<string>;
  /** Dates with every planned meal eaten - drives the blue flame and the streak number itself. */
  allEatenDates: Set<string>;
  waterGoalDates: Set<string>;
  todayMealCount: number;
  todayMealTotal: number;
};

function union(a: Set<string>, b: Set<string>): Set<string> {
  return new Set([...a, ...b]);
}

/**
 * Two equally-sized streak cards below the Home hero card. Meal streak shows
 * two flames (orange = something eaten today, blue = the whole day's plan
 * eaten - the streak number itself tracks the stricter blue criterion, same
 * as before). Water streak keeps a single drop, which pulses once today's
 * goal is met. Manually-frozen dates (see StreakDetailModal's Freeze button)
 * count as qualifying everywhere a streak is computed, including the card's
 * own number - not just inside the modal.
 */
export function StreakRow({
  profileId,
  today,
  anyEatenDates,
  allEatenDates,
  waterGoalDates,
  todayMealCount,
  todayMealTotal,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [openStreak, setOpenStreak] = useState<'meal' | 'water' | null>(null);
  const reducedMotion = useReducedMotion();

  const mealFreezeDates = useStreakFreezeDates(profileId, 'meal', today);
  const waterFreezeDates = useStreakFreezeDates(profileId, 'water', today);

  const mealAnyQualifying = useMemo(() => union(anyEatenDates, mealFreezeDates), [anyEatenDates, mealFreezeDates]);
  const mealAllQualifying = useMemo(() => union(allEatenDates, mealFreezeDates), [allEatenDates, mealFreezeDates]);
  const waterQualifying = useMemo(() => union(waterGoalDates, waterFreezeDates), [waterGoalDates, waterFreezeDates]);

  const mealStreak = countConsecutiveDays(mealAllQualifying, today);
  const mealBest = longestConsecutiveRun(mealAllQualifying);
  const waterStreak = countConsecutiveDays(waterQualifying, today);
  const waterBest = longestConsecutiveRun(waterQualifying);

  const mealStartedToday = mealAnyQualifying.has(today);
  const mealCompletedToday = mealAllQualifying.has(today);
  const waterReachedToday = waterQualifying.has(today);

  const openKind = openStreak;
  const openFreezeDates = openKind === 'water' ? waterFreezeDates : mealFreezeDates;
  const openQualifiesAlready = openKind === 'water' ? waterReachedToday : mealCompletedToday;
  const canFreeze = !openQualifiesAlready && openFreezeDates.size < MAX_STREAK_FREEZES_PER_MONTH && !!profileId;

  const handleFreeze = () => {
    if (!profileId || !openKind) return;
    void addStreakFreeze(db, profileId, openKind, today);
  };

  // Gentle pulse loop while today's water goal is met - starts/stops
  // reactively as `waterReachedToday` flips, per Martin's ask.
  const dropletScale = useSharedValue(1);
  useEffect(() => {
    if (reducedMotion) return;
    if (waterReachedToday) {
      dropletScale.value = withRepeat(
        withSequence(withTiming(1.3, { duration: 450 }), withTiming(1, { duration: 450 })),
        -1,
        true,
      );
    } else {
      dropletScale.value = withTiming(1, { duration: 200 });
    }
  }, [waterReachedToday, reducedMotion, dropletScale]);
  const dropletStyle = useAnimatedStyle(() => ({ transform: [{ scale: dropletScale.value }] }));

  return (
    <>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" style={styles.card} onPress={() => setOpenStreak('meal')}>
          <View style={styles.flamesRow}>
            <Ionicons name="flame" size={16} color={mealStartedToday ? colors.attention : colors.border} />
            <Ionicons name="flame" size={16} color={mealCompletedToday ? colors.water : colors.border} />
          </View>
          <Text style={styles.value}>{mealStreak}</Text>
          <Text style={styles.label}>{t('today.mealStreak')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.card} onPress={() => setOpenStreak('water')}>
          <Animated.View style={dropletStyle}>
            <Ionicons name="water" size={16} color={colors.water} />
          </Animated.View>
          <Text style={styles.value}>{waterStreak}</Text>
          <Text style={styles.label}>{t('today.waterStreak')}</Text>
        </Pressable>
      </View>

      <StreakDetailModal
        visible={openStreak !== null}
        onClose={() => setOpenStreak(null)}
        kind={openStreak ?? 'meal'}
        current={openStreak === 'water' ? waterStreak : mealStreak}
        best={openStreak === 'water' ? waterBest : mealBest}
        historyDates={openStreak === 'water' ? waterQualifying : mealAllQualifying}
        todayCount={openStreak === 'meal' ? todayMealCount : undefined}
        todayTotal={openStreak === 'meal' ? todayMealTotal : undefined}
        freezesUsed={openFreezeDates.size}
        freezesMax={MAX_STREAK_FREEZES_PER_MONTH}
        canFreeze={canFreeze}
        onFreeze={handleFreeze}
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
      paddingVertical: spacing.sm,
      gap: 1,
    },
    flamesRow: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginBottom: 1,
    },
    value: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '800',
    },
    label: {
      color: colors.textSecondary,
      fontSize: typography.small,
    },
  });
}
