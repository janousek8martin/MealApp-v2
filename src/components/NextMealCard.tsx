import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useFood, usePhoto, useRecipe } from '@/hooks/library';
import type { MealRow } from '@/hooks/plan';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';
import { localizedName } from '@/utils/localized';

type Props = {
  slotLabel: string;
  meal: MealRow;
};

/** Quick link to whatever the next upcoming meal slot resolves to today. */
export function NextMealCard({ slotLabel, meal }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const recipe = useRecipe(meal.itemType === 'recipe' ? meal.itemId : undefined);
  const food = useFood(meal.itemType === 'food' ? meal.itemId : undefined);
  const photo = usePhoto(meal.itemType, meal.itemId);
  const name = recipe ? localizedName(recipe) : food ? localizedName(food) : '';

  const openDetail = () => {
    if (meal.itemType === 'recipe') router.push({ pathname: '/recipe/[id]', params: { id: meal.itemId } });
    else router.push({ pathname: '/food/[id]', params: { id: meal.itemId } });
  };

  return (
    <Pressable accessibilityRole="button" style={styles.card} onPress={openDetail}>
      {photo ? (
        <Image source={{ uri: photo.uri }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]} />
      )}
      <View style={styles.textCol}>
        <Text style={styles.title}>{t('today.nextMealTitle')}</Text>
        <Text style={styles.slotLabel}>{slotLabel}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.sm,
      marginTop: spacing.md,
    },
    thumb: {
      width: 52,
      height: 52,
      borderRadius: radius.card - 8,
    },
    thumbPlaceholder: {
      backgroundColor: colors.mint,
    },
    textCol: {
      flex: 1,
    },
    title: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '700',
      textTransform: 'uppercase',
    },
    slotLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 2,
    },
    name: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '700',
      marginTop: 2,
    },
  });
}
