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
};

/** Shows a feasibility tier (realistic/ambitious/challenging) for the requested weight change, framed as general clinical guidance - see domain/goalReview.ts. */
export function GoalReviewCard({ currentWeightKg, goalWeightKg }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const tier = classifyGoalReview(currentWeightKg, goalWeightKg);
  const pct = Math.round((Math.abs(goalWeightKg - currentWeightKg) / currentWeightKg) * 100);
  const tierColor = colors[TIER_COLOR_KEY[tier]];

  return (
    <View style={[styles.card, { borderColor: tierColor }]}>
      <Text style={[styles.tierTitle, { color: tierColor }]}>{t(`goalReview.${tier}Title`)}</Text>
      <Text style={styles.changeLabel}>{t('goalReview.changeLabel', { pct })}</Text>
      <Text style={styles.tierBody}>{t(`goalReview.${tier}Body`)}</Text>
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
  });
}
