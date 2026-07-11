import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { WaterSettingsCard } from '@/components/WaterSettingsCard';
import { TextField } from '@/components/ui/TextField';
import { db } from '@/db/client';
import { logWater } from '@/db/repositories/water';
import { todayIsoDate } from '@/db/time';
import { defaultWaterGoalMl } from '@/domain/water';
import { useWaterTotal } from '@/hooks/water';
import { useAppStore } from '@/stores/appStore';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

const GLASS_ML = 250;

type Props = {
  profileId: string;
  sex: 'male' | 'female';
  weightKg: number;
  trackWater: boolean;
  /** Explicit override; falls back to the weight-based domain default. */
  waterGoalMl: number | null;
};

function parseNumber(value: string): number | null {
  const parsed = Number(value.replace(',', '.'));
  return Number.isFinite(parsed) && value.trim() !== '' ? parsed : null;
}

/**
 * Home-screen hydration widget: a row of tappable glasses (the next empty
 * one shows a "+", tapping the last filled one removes a glass), a one-time
 * explainer banner, a total row with % of the daily goal, and quick links
 * for logging a custom amount and opening the water settings in place.
 */
export function WaterCard({ profileId, sex, weightKg, trackWater, waterGoalMl }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = todayIsoDate();
  const totalMl = useWaterTotal(profileId, today);
  const goalMl = waterGoalMl ?? defaultWaterGoalMl(weightKg, sex);
  const progress = goalMl > 0 ? Math.min(1, totalMl / goalMl) : 0;
  const reached = totalMl >= goalMl;

  const bannerDismissed = useAppStore((s) => s.waterBannerDismissed);
  const setBannerDismissed = useAppStore((s) => s.setWaterBannerDismissed);

  const [customVisible, setCustomVisible] = useState(false);
  const [customText, setCustomText] = useState('');
  const [settingsVisible, setSettingsVisible] = useState(false);

  const glassCount = Math.max(1, Math.ceil(goalMl / GLASS_ML));
  const filledCount = Math.min(glassCount, Math.floor(totalMl / GLASS_ML));

  // Toggle semantics: tapping an empty glass fills everything up to and
  // including it; tapping a filled glass un-fills it and everything after
  // (so tapping the last filled one removes exactly one glass).
  const onGlassPress = (index: number) => {
    const targetMl = (index < filledCount ? index : index + 1) * GLASS_ML;
    const delta = targetMl - totalMl;
    if (delta !== 0) void logWater(db, profileId, delta, today);
  };

  const addCustom = () => {
    const amount = parseNumber(customText);
    if (amount === null || amount <= 0) return;
    void logWater(db, profileId, amount, today);
    setCustomText('');
    setCustomVisible(false);
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="water" size={16} color={colors.primary} />
        <Text style={styles.title}>{t('water.cardTitle')}</Text>
        <Text style={[styles.amountText, reached && styles.amountReached]}>
          {Math.round(totalMl)} / {Math.round(goalMl)} ml
        </Text>
      </View>

      <View style={styles.glassesRow}>
        {Array.from({ length: glassCount }, (_, index) => {
          const filled = index < filledCount;
          const isNext = index === filledCount;
          return (
            <Pressable
              key={index}
              accessibilityRole="button"
              accessibilityLabel={filled ? t('water.removeGlass') : t('water.addGlass')}
              onPress={() => onGlassPress(index)}
              style={[styles.glass, filled && styles.glassFilled, isNext && styles.glassNext]}>
              {isNext ? (
                <Ionicons name="add" size={18} color={colors.primary} />
              ) : (
                <MaterialCommunityIcons
                  name={filled ? 'cup-water' : 'cup-outline'}
                  size={20}
                  color={filled ? colors.primary : colors.border}
                />
              )}
            </Pressable>
          );
        })}
      </View>

      {!bannerDismissed ? (
        <View style={styles.banner}>
          <Text style={styles.bannerText}>{t('water.banner')}</Text>
          <Pressable accessibilityRole="button" onPress={() => setBannerDismissed(true)} hitSlop={8}>
            <Ionicons name="close" size={16} color={colors.text} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>
          {t('water.totalLabel')} – {Math.round(totalMl)} / {Math.round(goalMl)} ml
        </Text>
        <Text style={[styles.totalPercent, reached && styles.amountReached]}>{Math.round(progress * 100)} %</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
      </View>

      {customVisible ? (
        <View style={styles.customRow}>
          <View style={styles.customField}>
            <TextField
              label={t('water.customAmount')}
              value={customText}
              onChangeText={setCustomText}
              keyboardType="decimal-pad"
              suffix="ml"
            />
          </View>
          <Pressable accessibilityRole="button" style={styles.customAddButton} onPress={addCustom}>
            <Ionicons name="checkmark" size={18} color={colors.onPrimary} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.footerRow}>
        <Pressable
          accessibilityRole="button"
          style={styles.footerLink}
          onPress={() => setCustomVisible((prev) => !prev)}>
          <Ionicons name="add" size={16} color={colors.primary} />
          <Text style={styles.footerLinkLabel}>{t('water.addCustom')}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" style={styles.footerLink} onPress={() => setSettingsVisible(true)}>
          <Ionicons name="settings-outline" size={16} color={colors.primary} />
          <Text style={styles.footerLinkLabel}>{t('water.settingsLink')}</Text>
        </Pressable>
      </View>

      <Modal visible={settingsVisible} transparent animationType="fade" onRequestClose={() => setSettingsVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSettingsVisible(false)}>
          <Pressable style={styles.settingsSheet} onPress={() => undefined}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>{t('water.settingsLink')}</Text>
              <Pressable accessibilityRole="button" onPress={() => setSettingsVisible(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            </View>
            <WaterSettingsCard profileId={profileId} trackWater={trackWater} waterGoalMl={waterGoalMl} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function createStyles(colors: ColorTokens) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.surface,
      borderRadius: radius.card,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      marginTop: spacing.sm,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      marginBottom: spacing.sm,
    },
    title: {
      flex: 1,
      color: colors.text,
      fontSize: typography.small,
      fontWeight: '700',
    },
    amountText: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '600',
    },
    amountReached: {
      color: colors.success,
      fontWeight: '700',
    },
    glassesRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs + 2,
      marginBottom: spacing.sm,
    },
    glass: {
      width: 38,
      height: 42,
      borderRadius: radius.input - 4,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    glassFilled: {
      borderColor: colors.primary,
      backgroundColor: colors.mint,
    },
    glassNext: {
      borderColor: colors.primary,
      backgroundColor: colors.mint,
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.mint,
      borderRadius: radius.input,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      marginBottom: spacing.sm,
    },
    bannerText: {
      flex: 1,
      color: colors.text,
      fontSize: typography.small,
      lineHeight: 18,
    },
    totalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.xs,
    },
    totalLabel: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '600',
    },
    totalPercent: {
      color: colors.textSecondary,
      fontSize: typography.small,
      fontWeight: '700',
    },
    progressTrack: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.background,
      overflow: 'hidden',
      marginBottom: spacing.sm,
    },
    progressFill: {
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
    customRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginBottom: spacing.xs,
    },
    customField: {
      flex: 1,
    },
    customAddButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    footerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    footerLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.xs,
    },
    footerLinkLabel: {
      color: colors.primary,
      fontSize: typography.small,
      fontWeight: '700',
    },
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.4)',
      justifyContent: 'center',
      padding: spacing.lg,
    },
    settingsSheet: {
      backgroundColor: colors.background,
      borderRadius: radius.card,
      padding: spacing.md,
    },
    settingsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    settingsTitle: {
      color: colors.text,
      fontSize: typography.subtitle,
      fontWeight: '800',
    },
  });
}
