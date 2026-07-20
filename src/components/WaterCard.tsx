import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import Svg, { Circle, ClipPath, Defs, G, Path, Rect } from 'react-native-svg';

import { WaterSettingsCard } from '@/components/WaterSettingsCard';
import { db } from '@/db/client';
import { logWater } from '@/db/repositories/water';
import { todayIsoDate } from '@/db/time';
import { mlToFlOz } from '@/domain/units';
import { DEFAULT_GLASS_ML, defaultWaterGoalMl } from '@/domain/water';
import { useWaterTotal } from '@/hooks/water';
import { useTheme } from '@/theme/ThemeContext';
import { radius, spacing, typography, type ColorTokens } from '@/theme/tokens';

// Tank sized to comfortably host two 44x44 hit targets (this app's standard
// touch-target size, see glassButton below) plus the percent readout and the
// glass-size label, all overlaid on the animated fill - see Martin's layout
// decision on task-10 ("tank IS the widget, controls live inside it").
const TANK_WIDTH = 208;
const TANK_HEIGHT = 148;
const TANK_RADIUS = radius.card;

// One static wave period per layer, each strip built at 2x its own period so
// the tiling loop (translateX by exactly one period) is seamless. Built once
// via useMemo below - never rebuild the `d` string per frame, that's a
// confirmed Android frame-drop source (see task-10 brief point 2).
const FRONT_WAVE_PERIOD = TANK_WIDTH;
const FRONT_WAVE_HEIGHT = 16;
const FRONT_WAVE_AMPLITUDE = FRONT_WAVE_HEIGHT / 2;
const BACK_WAVE_PERIOD = TANK_WIDTH * 1.3;
const BACK_WAVE_HEIGHT = 16;
const BACK_WAVE_AMPLITUDE = BACK_WAVE_HEIGHT / 4; // flatter/more subtle than the front layer

const BUBBLE_COUNT = 14; // fixed pool, kept within the 10-20 range (task-10 brief point 4/9)

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Builds a seamless tiling wave path: two periods wide, wave crest of `amplitude` above the midline. */
function buildWavePath(period: number, height: number, amplitude: number): string {
  const mid = height / 2;
  const crest = mid - amplitude;
  return (
    `M0 ${mid} Q${period / 4} ${crest} ${period / 2} ${mid} T${period} ${mid} T${period * 1.5} ${mid} T${period * 2} ${mid} ` +
    `V${height} H0 Z`
  );
}

type BubbleConfig = {
  id: number;
  startX: number;
  radius: number;
  duration: number;
  delay: number;
};

type Props = {
  profileId: string;
  sex: 'male' | 'female';
  weightKg: number;
  trackWater: boolean;
  /** Explicit override; falls back to the weight-based domain default. */
  waterGoalMl: number | null;
  /** Size of one logged serving; falls back to DEFAULT_GLASS_ML. */
  waterGlassMl: number | null;
  /** 'us' displays fl oz throughout; amounts are always stored in ml. */
  unitSystem: 'metric' | 'us';
};

/**
 * Home-screen hydration widget: an animated water tank whose gently waving,
 * bubbling surface rises with every logged glass. The -/+ controls, percent
 * readout, and glass-size label are overlaid directly on the tank (Martin's
 * layout call on task-10); the settings link sits in a small strip beside it.
 */
export function WaterCard({ profileId, sex, weightKg, trackWater, waterGoalMl, waterGlassMl, unitSystem }: Props) {
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
  const reducedMotion = useReducedMotion();

  // Water level: absolute y (in tank coordinates) of the water surface.
  // 0 = full tank (top), TANK_HEIGHT = empty (fully below the visible area).
  // Driven via a `translateY` transform on the fill group - never `height`,
  // which is a layout prop and doesn't take Reanimated's fast path.
  const levelY = useSharedValue(TANK_HEIGHT);
  useEffect(() => {
    const target = TANK_HEIGHT * (1 - progress);
    levelY.value = reducedMotion
      ? target
      : withTiming(target, { duration: 450, easing: Easing.out(Easing.cubic) });
  }, [progress, reducedMotion, levelY]);

  // Endless horizontal drift, one shared value per wave layer (transform-only).
  const frontPhase = useSharedValue(0);
  const backPhase = useSharedValue(-BACK_WAVE_PERIOD * 0.5); // offset start so the two layers never sync up
  useEffect(() => {
    if (reducedMotion) return;
    frontPhase.value = withRepeat(
      withTiming(-FRONT_WAVE_PERIOD, { duration: 3500, easing: Easing.linear }),
      -1,
      false,
    );
    backPhase.value = withRepeat(
      withTiming(-BACK_WAVE_PERIOD * 1.5, { duration: 6000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [reducedMotion, frontPhase, backPhase]);

  // Brief fill-level "pulse" when a glass is logged - a separate micro-
  // interaction from Button's own press-scale (that one's on the buttons).
  const pulseScale = useSharedValue(1);
  const triggerPulse = () => {
    if (reducedMotion) return;
    pulseScale.value = withSequence(
      withTiming(1.035, { duration: 110, easing: Easing.out(Easing.quad) }),
      withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) }),
    );
  };

  const levelGroupProps = useAnimatedProps(() => ({
    transform: [{ translateY: levelY.value }],
  }));
  const frontWaveProps = useAnimatedProps(() => ({
    transform: [{ translateX: frontPhase.value }],
  }));
  const backWaveProps = useAnimatedProps(() => ({
    transform: [{ translateX: backPhase.value }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const frontWavePath = useMemo(
    () => buildWavePath(FRONT_WAVE_PERIOD, FRONT_WAVE_HEIGHT, FRONT_WAVE_AMPLITUDE),
    [],
  );
  const backWavePath = useMemo(() => buildWavePath(BACK_WAVE_PERIOD, BACK_WAVE_HEIGHT, BACK_WAVE_AMPLITUDE), []);

  // Randomize each bubble's look/timing once at mount (plain JS on the JS
  // thread - never Math.random() inside a worklet).
  const bubbles = useMemo<BubbleConfig[]>(
    () =>
      Array.from({ length: BUBBLE_COUNT }, (_, id) => ({
        id,
        startX: 10 + Math.random() * (TANK_WIDTH - 20),
        radius: 1.5 + Math.random() * 2,
        duration: 2200 + Math.random() * 2200,
        delay: Math.random() * 4000,
      })),
    [],
  );

  const handleRemove = () => {
    triggerPulse();
    void logWater(db, profileId, -Math.min(glassMl, totalMl), today);
  };
  const handleAdd = () => {
    triggerPulse();
    void logWater(db, profileId, glassMl, today);
  };

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Ionicons name="water" size={16} color={colors.water} />
        <Text style={styles.title}>{t('water.cardTitle')}</Text>
      </View>

      <View style={styles.contentRow}>
        <View style={styles.tank}>
          <Animated.View style={[StyleSheet.absoluteFill, pulseStyle]}>
            <Svg width={TANK_WIDTH} height={TANK_HEIGHT}>
              <Defs>
                <ClipPath id="waterTankClip">
                  <Rect x={0} y={0} width={TANK_WIDTH} height={TANK_HEIGHT} rx={TANK_RADIUS} ry={TANK_RADIUS} />
                </ClipPath>
              </Defs>
              <G clipPath="url(#waterTankClip)">
                {reducedMotion ? (
                  <Rect
                    x={0}
                    y={TANK_HEIGHT * (1 - progress)}
                    width={TANK_WIDTH}
                    height={TANK_HEIGHT * progress + 2}
                    fill={colors.water}
                  />
                ) : (
                  <AnimatedG animatedProps={levelGroupProps}>
                    <Rect x={0} y={0} width={TANK_WIDTH} height={TANK_HEIGHT} fill={colors.water} />
                    <AnimatedG animatedProps={backWaveProps}>
                      <Path d={backWavePath} fill={colors.water} fillOpacity={0.4} />
                    </AnimatedG>
                    <AnimatedG animatedProps={frontWaveProps}>
                      <Path d={frontWavePath} fill={colors.water} fillOpacity={0.9} />
                    </AnimatedG>
                  </AnimatedG>
                )}
                {!reducedMotion &&
                  bubbles.map((bubble) => (
                    <WaterBubble
                      key={bubble.id}
                      config={bubble}
                      levelY={levelY}
                      tankHeight={TANK_HEIGHT}
                      color={colors.water}
                    />
                  ))}
              </G>
            </Svg>
          </Animated.View>

          <View style={styles.controlsOverlay} pointerEvents="box-none">
            <View style={styles.controlsScrim}>
              <View style={styles.percentRow}>
                <Text style={styles.percentText}>{Math.round(progress * 100)} %</Text>
                {reached && (
                  <Ionicons name="checkmark-circle" size={15} color={ON_WATER_FILL_COLOR} style={styles.reachedIcon} />
                )}
              </View>
              <View style={styles.buttonsRow}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('water.removeGlass')}
                  style={styles.glassButton}
                  onPress={handleRemove}>
                  <Ionicons name="remove" size={20} color={ON_WATER_FILL_COLOR} />
                </Pressable>
                <View style={styles.glassIconWrap}>
                  <MaterialCommunityIcons name="cup-water" size={22} color={ON_WATER_FILL_COLOR} />
                  <Text style={styles.glassIconLabel}>
                    {unitSystem === 'us'
                      ? `${Math.round(mlToFlOz(glassMl) * 10) / 10} fl oz`
                      : `${Math.round(glassMl)} ml`}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('water.addGlass')}
                  style={[styles.glassButton, styles.glassButtonPrimary]}
                  onPress={handleAdd}>
                  <Ionicons name="add" size={20} color={colors.onInteractive} />
                </Pressable>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.sideCol}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('water.settingsLink')}
            onPress={() => setSettingsVisible(true)}
            hitSlop={8}
            style={styles.settingsButton}>
            <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
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
              unitSystem={unitSystem}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/**
 * One rising, wobbling, fading bubble. `cy` is interpolated between the tank
 * bottom and the CURRENT water surface (`levelY`, shared with the fill
 * group) so bubbles only ever rise within the filled region, never into the
 * empty air above it.
 */
function WaterBubble({
  config,
  levelY,
  tankHeight,
  color,
}: {
  config: BubbleConfig;
  levelY: SharedValue<number>;
  tankHeight: number;
  color: string;
}) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(
      config.delay,
      withRepeat(withTiming(1, { duration: config.duration, easing: Easing.linear }), -1, false),
    );
    // config is stable for the lifetime of this bubble (built once in the parent's useMemo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedProps = useAnimatedProps(() => {
    const bottomY = tankHeight - 6;
    const topY = levelY.value + 6;
    const cy = bottomY - (bottomY - topY) * t.value;
    const cx = config.startX + Math.sin(t.value * Math.PI * 4) * 4;
    const opacity = interpolate(t.value, [0, 0.7, 1], [0, 0.8, 0], Extrapolation.CLAMP);
    return { cx, cy, opacity };
  });

  return <AnimatedCircle animatedProps={animatedProps} r={config.radius} fill={color} />;
}

/**
 * Deliberate, narrow exception to this codebase's "no hardcoded hex in
 * components" rule: this white always pairs specifically with the
 * `colors.water` fill directly behind it (in-tank readout/controls), not a
 * general theme role, and it must stay legible whether that patch of tank is
 * currently water-filled or empty background (the `controlsScrim` behind it
 * handles the empty-region contrast case). Do not reuse this outside the
 * in-tank controls, and do not hardcode another hex anywhere else in this file.
 */
const ON_WATER_FILL_COLOR = '#FFFFFF';

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
    contentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    tank: {
      width: TANK_WIDTH,
      height: TANK_HEIGHT,
      borderRadius: TANK_RADIUS,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    controlsOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    controlsScrim: {
      backgroundColor: 'rgba(0,0,0,0.32)', // translucent scrim, same convention as the settings modal's `backdrop` below
      borderRadius: radius.input,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      alignItems: 'center',
      gap: spacing.sm,
    },
    percentRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    percentText: {
      color: ON_WATER_FILL_COLOR,
      fontSize: typography.subtitle,
      fontWeight: '800',
    },
    reachedIcon: {
      marginLeft: spacing.xxs,
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
      alignItems: 'center',
      justifyContent: 'center',
    },
    glassButtonPrimary: {
      backgroundColor: colors.interactive,
    },
    glassIconWrap: {
      alignItems: 'center',
      gap: 2,
    },
    glassIconLabel: {
      color: ON_WATER_FILL_COLOR,
      fontSize: typography.small - 1,
      fontWeight: '600',
    },
    sideCol: {
      alignSelf: 'flex-start',
      paddingTop: spacing.xxs,
    },
    settingsButton: {
      width: 28,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
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
