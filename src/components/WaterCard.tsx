import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { WaterSettingsCard } from '@/components/WaterSettingsCard';
import { db } from '@/db/client';
import { logWater } from '@/db/repositories/water';
import { todayIsoDate } from '@/db/time';
import { DEFAULT_GLASS_ML, defaultWaterGoalMl } from '@/domain/water';
import { useWaterTotal } from '@/hooks/water';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

const TANK_WIDTH = 76;
const TANK_HEIGHT = 96;
/** One wave period; the strip is two periods wide and loops by one period. */
const WAVE_PERIOD = 80;
const WAVE_STRIP_HEIGHT = 12;

type Props = {
  profileId: string;
  sex: 'male' | 'female';
  weightKg: number;
  trackWater: boolean;
  /** Explicit override; falls back to the weight-based domain default. */
  waterGoalMl: number | null;
  /** Size of one logged serving; falls back to DEFAULT_GLASS_ML. */
  waterGlassMl: number | null;
};

/**
 * Home-screen hydration widget: a small water tank whose animated, gently
 * waving surface rises with every logged glass, plus -/+ controls (the glass
 * icon between them shows what one tap means) and a link to the per-profile
 * water settings (goal + glass size) opened in place.
 */
export function WaterCard({ profileId, sex, weightKg, trackWater, waterGoalMl, waterGlassMl }: Props) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const today = todayIsoDate();
  const totalMl = useWaterTotal(profileId, today);
  const goalMl = waterGoalMl ?? defaultWaterGoalMl(weightKg, sex);
  const glassMl = waterGlassMl ?? DEFAULT_GLASS_ML;
  const progress = goalMl > 0 ? Math.min(1, totalMl / goalMl) : 0;
  const reached = totalMl >= goalMl;

  const [settingsVisible, setSettingsVisible] = useState(false);

  // Endless horizontal drift of the wave strip (native driver, transform only).
  const waveAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(waveAnim, { toValue: 1, duration: 1800, easing: Easing.linear, useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [waveAnim]);
  const waveTranslate = waveAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -WAVE_PERIOD] });

  // Water level follows progress with a short ease (height = layout prop, JS driver).
  const levelAnim = useRef(new Animated.Value(progress)).current;
  useEffect(() => {
    Animated.timing(levelAnim, {
      toValue: progress,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progress, levelAnim]);
  const waterHeight = levelAnim.interpolate({ inputRange: [0, 1], outputRange: [0, TANK_HEIGHT] });

  const wavePath = useMemo(() => {
    const w = WAVE_PERIOD;
    const mid = WAVE_STRIP_HEIGHT / 2;
    return (
      `M0 ${mid} Q${w / 4} 0 ${w / 2} ${mid} T${w} ${mid} T${w * 1.5} ${mid} T${w * 2} ${mid} ` +
      `V${WAVE_STRIP_HEIGHT} H0 Z`
    );
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="water" size={16} color={colors.primary} />
        <Text style={styles.title}>{t('water.cardTitle')}</Text>
        <Text style={[styles.amountText, reached && styles.amountReached]}>
          {Math.round(totalMl)} / {Math.round(goalMl)} ml
        </Text>
      </View>

      <View style={styles.contentRow}>
        <View style={styles.tank}>
          <Animated.View style={[styles.water, { height: waterHeight }]}>
            <Animated.View style={[styles.waveStrip, { transform: [{ translateX: waveTranslate }] }]}>
              <Svg width={WAVE_PERIOD * 2} height={WAVE_STRIP_HEIGHT}>
                <Path d={wavePath} fill={colors.primary} />
              </Svg>
            </Animated.View>
            <View style={styles.waterBody} />
          </Animated.View>
        </View>

        <View style={styles.controlsCol}>
          <Text style={[styles.percentText, reached && styles.amountReached]}>{Math.round(progress * 100)} %</Text>
          <View style={styles.buttonsRow}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('water.removeGlass')}
              style={styles.glassButton}
              onPress={() => void logWater(db, profileId, -Math.min(glassMl, totalMl), today)}>
              <Ionicons name="remove" size={20} color={colors.primary} />
            </Pressable>
            <View style={styles.glassIconWrap}>
              <MaterialCommunityIcons name="cup-water" size={26} color={colors.primary} />
              <Text style={styles.glassIconLabel}>{Math.round(glassMl)} ml</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('water.addGlass')}
              style={[styles.glassButton, styles.glassButtonPrimary]}
              onPress={() => void logWater(db, profileId, glassMl, today)}>
              <Ionicons name="add" size={20} color={colors.onPrimary} />
            </Pressable>
          </View>
          <Pressable accessibilityRole="button" style={styles.settingsLink} onPress={() => setSettingsVisible(true)}>
            <Ionicons name="settings-outline" size={14} color={colors.primary} />
            <Text style={styles.settingsLinkLabel}>{t('water.settingsLink')}</Text>
          </Pressable>
        </View>
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
            <WaterSettingsCard
              profileId={profileId}
              trackWater={trackWater}
              waterGoalMl={waterGoalMl}
              waterGlassMl={waterGlassMl}
            />
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
    contentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    tank: {
      width: TANK_WIDTH,
      height: TANK_HEIGHT,
      borderRadius: radius.input,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
      overflow: 'hidden',
      justifyContent: 'flex-end',
    },
    water: {
      overflow: 'hidden',
    },
    waveStrip: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: WAVE_PERIOD * 2,
      height: WAVE_STRIP_HEIGHT,
    },
    waterBody: {
      flex: 1,
      marginTop: WAVE_STRIP_HEIGHT - 1,
      backgroundColor: colors.primary,
    },
    controlsCol: {
      flex: 1,
      alignItems: 'center',
      gap: spacing.sm,
    },
    percentText: {
      color: colors.textSecondary,
      fontSize: typography.subtitle,
      fontWeight: '800',
    },
    buttonsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    glassButton: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    glassButtonPrimary: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    glassIconWrap: {
      alignItems: 'center',
      gap: 2,
    },
    glassIconLabel: {
      color: colors.textSecondary,
      fontSize: typography.small - 1,
      fontWeight: '600',
    },
    settingsLink: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: 2,
    },
    settingsLinkLabel: {
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
