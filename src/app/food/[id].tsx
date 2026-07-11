import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Image as RNImage, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EditActions } from '@/components/EditActions';
import { HintedScrollView } from '@/components/HintedScrollView';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ALLERGEN_ICONS, DIET_ICONS } from '@/constants/chipIcons';
import { db } from '@/db/client';
import { setRating, softDeleteFood } from '@/db/repositories/library';
import { useActiveProfile, useHousehold } from '@/hooks/data';
import { useFood, useFoodAllergens, useItemRating, usePhoto } from '@/hooks/library';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';
import { localizedName } from '@/utils/localized';

export default function FoodDetailScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const food = useFood(id);
  const allergens = useFoodAllergens(id);
  const photo = usePhoto('food', id);
  const { household } = useHousehold();
  const activeProfile = useActiveProfile(household?.id);
  const rating = useItemRating(activeProfile?.id, 'food', food?.id);

  if (!food) {
    return <SafeAreaView style={styles.safeArea} />;
  }

  const rate = (next: 'like' | 'dislike') => {
    if (!activeProfile) return;
    void setRating(db, activeProfile.id, 'food', food.id, rating === next ? null : next);
  };

  const micronutrients = food.micronutrientsJson
    ? (JSON.parse(food.micronutrientsJson) as Record<string, number>)
    : null;
  const dietFlags = food.dietFlagsJson ? (JSON.parse(food.dietFlagsJson) as string[]) : [];

  const rows: { label: string; value: string }[] = [
    { label: 'kcal', value: String(Math.round(food.kcalPer100)) },
    { label: t('macros.protein'), value: `${food.proteinPer100} g` },
    { label: t('macros.carbs'), value: `${food.carbsPer100} g` },
    { label: t('macros.fat'), value: `${food.fatPer100} g` },
    { label: t('macros.fiber'), value: food.fiberPer100 === null ? '–' : `${food.fiberPer100} g` },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <HintedScrollView contentContainerStyle={styles.content}>
        <ScreenHeader
          right={
            <EditActions
              onEdit={() => router.push({ pathname: '/food/edit', params: { id: food.id } })}
              onDelete={async () => {
                await softDeleteFood(db, food.id);
                router.back();
              }}
              deleteConfirmTitle={t('foodDetail.deleteTitle')}
              deleteConfirmMessage={t('foodDetail.deleteMessage')}
            />
          }
        />

        {photo ? (
          <Image source={{ uri: photo.uri }} style={styles.photo} contentFit="cover" />
        ) : (
          <View style={[styles.photo, styles.photoPlaceholder]} />
        )}

        <View style={styles.titleRow}>
          <Text style={styles.title}>{localizedName(food)}</Text>
          <View style={styles.ratingRow}>
            <Pressable accessibilityRole="button" onPress={() => rate('like')} hitSlop={8}>
              <Ionicons
                name={rating === 'like' ? 'thumbs-up' : 'thumbs-up-outline'}
                size={24}
                color={rating === 'like' ? colors.success : colors.textSecondary}
              />
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => rate('dislike')} hitSlop={8}>
              <Ionicons
                name={rating === 'dislike' ? 'thumbs-down' : 'thumbs-down-outline'}
                size={24}
                color={rating === 'dislike' ? colors.danger : colors.textSecondary}
              />
            </Pressable>
          </View>
        </View>
        <Text style={styles.meta}>
          {t(`foodCategory.${food.category}`)} · {t(`budget.${food.budget}`)}
          {food.shelfLifeDays ? ` · ${t('foodDetail.shelfLife', { count: food.shelfLifeDays })}` : ''}
        </Text>

        <Text style={styles.sectionTitle}>
          {t('foodDetail.nutritionPer100', {
            unit: food.baseUnit === 'piece' ? 'g' : food.baseUnit,
          })}
        </Text>
        <View style={styles.card}>
          {rows.map((row) => (
            <View key={row.label} style={styles.row}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <Text style={styles.rowValue}>{row.value}</Text>
            </View>
          ))}
          {food.baseUnit === 'piece' && food.gramsPerPiece ? (
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('foodDetail.pieceWeight')}</Text>
              <Text style={styles.rowValue}>{food.gramsPerPiece} g</Text>
            </View>
          ) : null}
        </View>

        {micronutrients && Object.keys(micronutrients).length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>{t('foodDetail.micronutrients')}</Text>
            <View style={styles.card}>
              {Object.entries(micronutrients).map(([key, value]) => (
                <View key={key} style={styles.row}>
                  <Text style={styles.rowLabel}>{t(`micros.${key}`)}</Text>
                  <Text style={styles.rowValue}>{value}</Text>
                </View>
              ))}
            </View>
          </>
        ) : null}

        {(allergens.length > 0 || dietFlags.length > 0) && (
          <>
            <Text style={styles.sectionTitle}>{t('foodDetail.tags')}</Text>
            <View style={styles.chipRow}>
              {allergens.map((allergen) => (
                <View key={allergen} style={[styles.chip, styles.allergenChip]}>
                  {ALLERGEN_ICONS[allergen] ? (
                    <RNImage source={ALLERGEN_ICONS[allergen]} style={styles.chipIcon} />
                  ) : null}
                  <Text style={styles.chipLabel}>{t(`allergens.${allergen}`)}</Text>
                </View>
              ))}
              {dietFlags.map((flag) => (
                <View key={flag} style={styles.chip}>
                  {DIET_ICONS[flag] ? <RNImage source={DIET_ICONS[flag]} style={styles.chipIcon} /> : null}
                  <Text style={styles.chipLabel}>{t(`diets.${flag}`)}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </HintedScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      padding: spacing.md,
      paddingBottom: spacing.xl,
    },
    photo: {
      width: '100%',
      height: 160,
      borderRadius: radius.card,
    },
    photoPlaceholder: {
      backgroundColor: colors.mint,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: spacing.md,
      gap: spacing.sm,
    },
    ratingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    title: {
      color: colors.text,
      fontSize: typography.title,
      fontWeight: '800',
      flex: 1,
    },
    meta: {
      color: colors.textSecondary,
      fontSize: typography.small,
      marginTop: 2,
    },
    sectionTitle: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '700',
      marginTop: spacing.md,
      marginBottom: spacing.sm,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    rowLabel: {
      color: colors.textSecondary,
      fontSize: typography.body,
    },
    rowValue: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: '600',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      backgroundColor: colors.mint,
      borderRadius: radius.chip,
      paddingVertical: spacing.xs + 2,
      paddingHorizontal: spacing.md,
    },
    allergenChip: {
      backgroundColor: colors.lime,
    },
    chipIcon: {
      width: 16,
      height: 16,
      resizeMode: 'contain',
    },
    chipLabel: {
      color: colors.text,
      fontSize: typography.small,
      fontWeight: '600',
    },
  });
}
