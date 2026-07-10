import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActivityInfoModal } from '@/components/ActivityInfoModal';
import { TextField } from '@/components/ui/TextField';
import { ACTIVITY_MULTIPLIER_DOTS, type ActivityLevel } from '@/domain/constants';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

const LEVELS: { value: ActivityLevel; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'sedentary', icon: 'desktop-outline' },
  { value: 'light', icon: 'walk-outline' },
  { value: 'moderate', icon: 'footsteps-outline' },
  { value: 'active', icon: 'bicycle-outline' },
  { value: 'very_active', icon: 'barbell-outline' },
];

const DOT_KEYS = ['activityLow', 'activityMedium', 'activityHigh'] as const;

function dotIndex(dots: readonly [number, number, number], multiplier: number | null): number {
  if (multiplier === null) return 1;
  const index = dots.findIndex((value) => Math.abs(value - multiplier) < 0.001);
  return index === -1 ? 1 : index;
}

type Props = {
  value: ActivityLevel | null;
  onChange: (level: ActivityLevel) => void;
  multiplier: number | null;
  onChangeMultiplier: (value: number) => void;
  customTdeeKcal: string;
  onChangeCustomTdeeKcal: (text: string) => void;
  error?: string;
};

/**
 * "How is your lifestyle?" - a vertical card list describing everyday
 * movement only (no exercise, see the hint text); training itself is
 * accounted for separately via workout days (WORKOUT_DAY_KCAL_BONUS_PCT).
 * Below the selected level, the existing Low/Medium/High fine-tune dots
 * still let a profile land on a specific point in that level's range.
 * A collapsible "I know my maintenance calories" field lets a profile skip
 * the estimate entirely (TargetsInput.customTdeeKcal).
 */
export function LifestylePicker({
  value,
  onChange,
  multiplier,
  onChangeMultiplier,
  customTdeeKcal,
  onChangeCustomTdeeKcal,
  error,
}: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [infoVisible, setInfoVisible] = useState(false);
  const [customTdeeExpanded, setCustomTdeeExpanded] = useState(customTdeeKcal.trim() !== '');

  const hasCustomTdee = customTdeeKcal.trim() !== '';

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{t('activityQuestion.title')}</Text>
        <Pressable accessibilityRole="button" onPress={() => setInfoVisible(true)} hitSlop={8}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
        </Pressable>
      </View>
      <Text style={styles.hint}>{t('activityQuestion.hint')}</Text>

      <View style={[styles.cardList, hasCustomTdee && styles.disabled]}>
        {LEVELS.map((level) => {
          const selected = value === level.value;
          return (
            <Pressable
              key={level.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(level.value)}
              style={[styles.card, selected && styles.cardSelected]}>
              <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
                <Ionicons name={level.icon} size={20} color={selected ? colors.onPrimary : colors.primary} />
              </View>
              <View style={styles.cardText}>
                <Text style={[styles.cardTitle, selected && styles.cardTitleSelected]}>
                  {t(`activity.${level.value}`)}
                </Text>
                <Text style={styles.cardSubtitle}>{t(`activityInfo.${level.value}`)}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {value && !hasCustomTdee ? (
        <View style={styles.dotsRow}>
          {ACTIVITY_MULTIPLIER_DOTS[value].map((dotValue, index) => {
            const selected = dotIndex(ACTIVITY_MULTIPLIER_DOTS[value], multiplier) === index;
            return (
              <Pressable
                key={index}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onChangeMultiplier(dotValue)}
                style={styles.dotWrap}>
                <Text style={styles.dotLabel}>{t(`form.${DOT_KEYS[index]}`)}</Text>
                <View style={[styles.dot, selected && styles.dotSelected]} />
                <Text style={styles.dotValue}>{dotValue}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        style={styles.customToggle}
        onPress={() => setCustomTdeeExpanded((prev) => !prev)}>
        <Ionicons name={customTdeeExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.primary} />
        <Text style={styles.customToggleLabel}>{t('customTdee.toggle')}</Text>
      </Pressable>
      {customTdeeExpanded ? (
        <>
          <TextField
            label={t('customTdee.label')}
            value={customTdeeKcal}
            onChangeText={onChangeCustomTdeeKcal}
            keyboardType="decimal-pad"
            suffix="kcal"
          />
          <Text style={styles.customHint}>{t('customTdee.hint')}</Text>
        </>
      ) : null}

      <ActivityInfoModal visible={infoVisible} onClose={() => setInfoVisible(false)} />
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 2,
    },
    title: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
    },
    hint: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginBottom: spacing.sm,
    },
    cardList: {
      gap: spacing.xs + 2,
      marginBottom: spacing.sm,
    },
    disabled: {
      opacity: 0.45,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      borderRadius: radius.card - 6,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
    },
    cardSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    iconWrap: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    iconWrapSelected: {
      backgroundColor: 'rgba(255,255,255,0.2)',
    },
    cardText: {
      flex: 1,
    },
    cardTitle: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
    },
    cardTitleSelected: {
      color: colors.onPrimary,
    },
    cardSubtitle: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 1,
    },
    error: {
      color: colors.danger,
      fontSize: typography.small,
      marginBottom: spacing.sm,
    },
    dotsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xl,
      marginBottom: spacing.md,
    },
    dotWrap: {
      alignItems: 'center',
      gap: 4,
    },
    dot: {
      width: 16,
      height: 16,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    dotSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    dotValue: {
      color: colors.text,
      fontSize: typography.small,
      fontWeight: '600',
    },
    dotLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
    },
    customToggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.sm,
      alignSelf: 'flex-start',
    },
    customToggleLabel: {
      color: colors.primary,
      fontSize: typography.small,
      fontWeight: '600',
    },
    customHint: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: -spacing.sm,
      marginBottom: spacing.md,
    },
  });
}
