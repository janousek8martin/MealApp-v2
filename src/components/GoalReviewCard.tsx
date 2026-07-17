import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, Text, View } from 'react-native';

import { classifyGoalReview, type GoalReviewTier } from '@/domain/goalReview';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

const TIER_COLOR_KEY: Record<GoalReviewTier, keyof ColorTokens> = {
  realistic: 'success',
  ambitious: 'secondary',
  challenging: 'danger',
};

type Props = {
  currentWeightKg: number;
  goalWeightKg: number;
  /** When given, the review reacts to pace: duration estimate + a warning above the safe loss band. */
  rateKgPerWeek?: number;
};

/** Shows a feasibility tier (realistic/ambitious/challenging) for the requested weight change, framed as general clinical guidance - see domain/goalReview.ts. Rendered live under the tempo card's rate stepper, so it re-evaluates as the rate changes. */
export function GoalReviewCard({ currentWeightKg, goalWeightKg, rateKgPerWeek }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const review = classifyGoalReview(currentWeightKg, goalWeightKg, rateKgPerWeek);
  const pct = Math.round((Math.abs(goalWeightKg - currentWeightKg) / currentWeightKg) * 100);
  const tierColor = colors[TIER_COLOR_KEY[review.tier]];

  return (
    <View style={[styles.card, { borderColor: tierColor }]}>
      <Text style={[styles.tierTitle, { color: tierColor }]}>{t(`goalReview.${review.tier}Title`)}</Text>
      <Text style={styles.changeLabel}>{t('goalReview.changeLabel', { pct })}</Text>
      <Text style={styles.tierBody}>{t(`goalReview.${review.tier}Body`)}</Text>
      {review.estimatedWeeks !== null ? (
        <Text style={styles.durationLabel}>{t('goalReview.duration', { weeks: review.estimatedWeeks })}</Text>
      ) : null}
      {review.paceExceedsSafeBand ? (
        <Text style={[styles.paceWarning, { color: colors.danger }]}>{t('goalReview.paceWarning')}</Text>
      ) : null}
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: {
      borderRadius: radius.card,
      borderWidth: 1.5,
      backgroundColor: colors.surface,
      padding: spacing.md,
      marginBottom: spacing.md,
    },
    tierTitle: {
      fontSize: typography.subtitle,
      fontWeight: '800',
      marginBottom: 2,
    },
    changeLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '600',
      marginBottom: spacing.sm,
    },
    tierBody: {
      color: colors.text,
      fontSize: typography.body,
      lineHeight: 20,
    },
    durationLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '600',
      marginTop: spacing.sm,
    },
    paceWarning: {
      fontSize: typography.small,
      fontWeight: '600',
      lineHeight: 18,
      marginTop: spacing.xs,
    },
  });
}
