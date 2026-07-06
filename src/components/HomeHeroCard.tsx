import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProfileDropdownChip } from '@/components/ProfileDropdownChip';
import { ProgressRing } from '@/components/ProgressRing';
import type { TargetsResult } from '@/domain/targets';
import { useFood, usePhoto, useRecipe } from '@/hooks/library';
import type { MealRow } from '@/hooks/plan';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';
import { localizedName } from '@/utils/localized';

type Props = {
  householdId: string;
  targets: TargetsResult;
  eatenKcal: number;
  targetKcal: number;
  onEditProfile: () => void;
  nextMeal?: { slotLabel: string; meal: MealRow };
};

function NextMealRow({ slotLabel, meal, colors, styles }: { slotLabel: string; meal: MealRow; colors: ColorTokens; styles: ReturnType<typeof createStyles> }) {
  const { t } = useTranslation();
  const recipe = useRecipe(meal.itemType === 'recipe' ? meal.itemId : undefined);
  const food = useFood(meal.itemType === 'food' ? meal.itemId : undefined);
  const photo = usePhoto(meal.itemType, meal.itemId);
  const name = recipe ? localizedName(recipe) : food ? localizedName(food) : '';

  const openDetail = () => {
    if (meal.itemType === 'recipe') router.push({ pathname: '/recipe/[id]', params: { id: meal.itemId } });
    else router.push({ pathname: '/food/[id]', params: { id: meal.itemId } });
  };

  return (
    <Pressable accessibilityRole="button" style={styles.nextMealRow} onPress={openDetail}>
      {photo ? (
        <Image source={{ uri: photo.uri }} style={styles.nextMealThumb} contentFit="cover" />
      ) : (
        <View style={[styles.nextMealThumb, styles.nextMealThumbPlaceholder]} />
      )}
      <View style={styles.nextMealTextCol}>
        <Text style={styles.nextMealTitle}>{t('today.nextMealTitle')}</Text>
        <Text style={styles.nextMealName} numberOfLines={1}>
          {slotLabel} · {name}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.mint} />
    </Pressable>
  );
}

/**
 * Home screen's hero card – merges the profile selector, "edit profile"
 * link, and next-meal shortcut into the same card as the live TDCI, macros,
 * and today's eaten-vs-target ring, instead of separate rows/cards floating
 * around it.
 */
export function HomeHeroCard({ householdId, targets, eatenKcal, targetKcal, onEditProfile, nextMeal }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const heroGradient = useMemo(
    () => [colors.heroGradientStart, colors.heroGradientEnd] as const,
    [colors],
  );
  const macros = [
    { key: 'protein', grams: targets.macros.proteinG },
    { key: 'carbs', grams: targets.macros.carbsG },
    { key: 'fat', grams: targets.macros.fatG },
  ];
  const ringProgress = targetKcal > 0 ? eatenKcal / targetKcal : 0;
  const ringPercent = Math.round(ringProgress * 100);

  return (
    <LinearGradient
      colors={heroGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}>
      <Image
        source={require('../assets/images/hero/home-hero.png')}
        style={styles.heroTexture}
        contentFit="cover"
      />

      <View style={styles.headerRow}>
        <ProfileDropdownChip householdId={householdId} />
        <Pressable accessibilityRole="button" style={styles.editProfileLink} onPress={onEditProfile}>
          <Ionicons name="settings-outline" size={14} color={colors.onPrimary} />
          <Text style={styles.editProfileLabel}>{t('today.editProfile')}</Text>
        </Pressable>
      </View>

      <View style={styles.heroBody}>
        <View style={styles.heroLeft}>
          <View style={styles.heroRow}>
            <Text style={styles.kcal}>{Math.round(targets.adjustedTdciKcal)}</Text>
            <Text style={styles.kcalUnit}>kcal</Text>
          </View>
          <Text style={styles.mode}>{t(`tdciMode.${targets.mode}`)}</Text>
        </View>

        <ProgressRing
          size={84}
          strokeWidth={7}
          progress={ringProgress}
          trackColor="rgba(244, 241, 232, 0.2)"
          progressColor={colors.primaryLight}>
          <Text style={styles.ringPercent}>{ringPercent}%</Text>
          <Text style={styles.ringLabel}>{t('today.eaten')}</Text>
        </ProgressRing>
      </View>

      <View style={styles.macrosRow}>
        {macros.map((macro) => (
          <View key={macro.key} style={styles.macro}>
            <Text style={styles.macroValue}>{Math.round(macro.grams)} g</Text>
            <Text style={styles.macroLabel}>{t(`macros.${macro.key}`)}</Text>
          </View>
        ))}
      </View>

      {nextMeal ? (
        <NextMealRow slotLabel={nextMeal.slotLabel} meal={nextMeal.meal} colors={colors} styles={styles} />
      ) : null}
    </LinearGradient>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: {
      borderRadius: radius.card,
      padding: spacing.md,
      overflow: 'hidden',
    },
    heroTexture: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0.16,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    editProfileLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    editProfileLabel: {
      color: colors.onPrimary,
      fontSize: typography.small,
      fontWeight: '600',
    },
    heroBody: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    heroLeft: {
      flexShrink: 1,
    },
    heroRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
    },
    kcal: {
      color: colors.onPrimary,
      fontSize: typography.hero,
      fontWeight: '800',
      lineHeight: typography.hero + 4,
    },
    kcalUnit: {
      color: colors.mint,
      fontSize: typography.subtitle,
      fontWeight: '600',
      marginBottom: 4,
    },
    mode: {
      color: colors.onPrimary,
      opacity: 0.85,
      fontSize: typography.small,
      marginTop: 2,
    },
    ringPercent: {
      color: colors.onPrimary,
      fontSize: typography.body,
      fontWeight: '800',
    },
    ringLabel: {
      color: colors.mint,
      fontSize: 10,
      marginTop: 1,
    },
    macrosRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.md,
      backgroundColor: 'rgba(244, 241, 232, 0.12)',
      borderRadius: radius.input,
      padding: spacing.sm,
    },
    macro: {
      alignItems: 'center',
      flex: 1,
    },
    macroValue: {
      color: colors.onPrimary,
      fontSize: typography.body,
      fontWeight: '700',
    },
    macroLabel: {
      color: colors.mint,
      fontSize: typography.small,
      marginTop: 2,
    },
    nextMealRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
      backgroundColor: 'rgba(244, 241, 232, 0.12)',
      borderRadius: radius.input,
      padding: spacing.sm,
    },
    nextMealThumb: {
      width: 40,
      height: 40,
      borderRadius: radius.card - 12,
    },
    nextMealThumbPlaceholder: {
      backgroundColor: 'rgba(244, 241, 232, 0.25)',
    },
    nextMealTextCol: {
      flex: 1,
    },
    nextMealTitle: {
      color: colors.mint,
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    nextMealName: {
      color: colors.onPrimary,
      fontSize: typography.small,
      fontWeight: '700',
      marginTop: 1,
    },
  });
}
