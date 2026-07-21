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

import { InfoTooltip } from '@/components/ui/InfoTooltip';
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
// decision on task-10 ("tank IS the widget, controls live inside it"). Width
// is now responsive (measured via onLayout, see `tankWidth` state below)
// instead of fixed, so the tank fills whatever space the card's flex layout
// gives it rather than sitting at an arbitrary fixed size - this constant is
// only the pre-first-layout fallback used for the very first render.
const TANK_WIDTH_FALLBACK = 208;
const TANK_HEIGHT = 148;
const TANK_RADIUS = radius.card;

const WAVE_AMPLITUDE = 6;
const SHADOW_WAVE_AMPLITUDE = 5;

const BUBBLE_COUNT = 14; // fixed pool, kept within the 10-20 range (task-10 brief point 4/9)

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedPath = Animated.createAnimatedComponent(Path);

/**
 * Both the "filled belly with a gradient fade" and the "open stroked line"
 * attempts were still fundamentally a decoration drawn NEAR the water's top
 * edge (a flat-topped Rect underneath it), not the water's edge itself -
 * that separation from the actual fill boundary is what kept reading as
 * "the wave is below/separate from the surface," no matter how the
 * decoration itself was tuned (Martin, repeatedly; confirmed by his
 * reference image - a single wavy-topped fill, not a line on a flat one).
 *
 * This builds the water body's OWN top edge as the wave curve - closes all
 * the way down to `bodyHeight` (the tank's full height), so the shape IS
 * the water, full stop. Oscillates between y=0 (crest) and y=2*amplitude
 * (trough); two periods wide for the seamless-tiling scroll (driver %
 * period, see below).
 */
function buildWaterBodyPath(period: number, bodyHeight: number, amplitude: number): string {
  const baseline = amplitude;
  const crest = 0;
  return (
    `M0 ${baseline} Q${period / 4} ${crest} ${period / 2} ${baseline} T${period} ${baseline} T${period * 1.5} ${baseline} T${period * 2} ${baseline} ` +
    `V${bodyHeight} H0 Z`
  );
}

/**
 * Just the crest curve (no V/H/Z fill-close) - a second, subtler ripple
 * riding ON the water body's own already-correct surface (stroked, not a
 * second filled shape with its own depth), rather than a competing "is this
 * below the water" element like the earlier standalone attempts.
 */
function buildWaveLinePath(period: number, amplitude: number): string {
  const baseline = amplitude;
  const crest = 0;
  return `M0 ${baseline} Q${period / 4} ${crest} ${period / 2} ${baseline} T${period} ${baseline} T${period * 1.5} ${baseline} T${period * 2} ${baseline}`;
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

  // Measured on layout so the tank fills whatever width the card's flex
  // layout actually gives it (Martin's "roztáhni, ale ne na sílu" ask)
  // instead of a fixed size - same onLayout-measure pattern BodyFatCarousel
  // already uses elsewhere in this app.
  const [tankWidth, setTankWidth] = useState(TANK_WIDTH_FALLBACK);
  const onTankLayout = (event: { nativeEvent: { layout: { width: number } } }) => {
    const width = event.nativeEvent.layout.width;
    if (Math.abs(width - tankWidth) > 1) setTankWidth(width);
  };
  const wavePeriod = tankWidth;
  const shadowWavePeriod = tankWidth * 1.3; // different period so the two ripples never sync up

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

  // Horizontal drift. Previously a `withRepeat(withTiming(-period), -1,
  // false)` loop - mathematically seamless (the path is exactly periodic,
  // so the frame at -period is pixel-identical to the frame at 0), but
  // Martin kept seeing a visible jump at the reset regardless of how slow
  // it ran, meaning something about the discrete reset EVENT itself (not
  // the math) was the problem - likely a frame landing exactly on the
  // boundary getting composited oddly on this renderer.
  //
  // Removed the reset entirely instead of continuing to chase it: the
  // driver counts down smoothly and WITHOUT ever resetting (one very long
  // `withTiming`, well past any real session length), and the actual
  // on-screen offset is derived every frame via `% period` inside the
  // animatedProps worklet below. Since the driver itself never jumps, and
  // JS's `%` of a smoothly-changing negative number is itself smooth
  // across each wrap (there's no discrete "start over" instant to land a
  // frame on), there's nothing left to be visible.
  const LOOP_DURATION_MS = 2 * 60 * 60 * 1000; // 2h - far longer than any real session, so it never actually completes
  const waveDriver = useSharedValue(0);
  const shadowWaveDriver = useSharedValue(-shadowWavePeriod * 0.5); // offset start so the two ripples never overlap identically
  useEffect(() => {
    if (reducedMotion) return;
    const speed = wavePeriod / 7000; // px/ms
    const shadowSpeed = shadowWavePeriod / 12000; // slower - reads as a deeper, lazier layer
    waveDriver.value = withTiming(waveDriver.value - speed * LOOP_DURATION_MS, {
      duration: LOOP_DURATION_MS,
      easing: Easing.linear,
    });
    shadowWaveDriver.value = withTiming(shadowWaveDriver.value - shadowSpeed * LOOP_DURATION_MS, {
      duration: LOOP_DURATION_MS,
      easing: Easing.linear,
    });
  }, [reducedMotion, waveDriver, shadowWaveDriver, wavePeriod, shadowWavePeriod]);

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
  // No opacity fade here anymore - this shape IS the water body now (its
  // own top edge is the wave), not a decoration layered over a separate
  // always-visible fill, so fading it would fade the water itself away.
  const waveProps = useAnimatedProps(() => ({
    transform: [{ translateX: waveDriver.value % wavePeriod }],
  }));
  const shadowWaveProps = useAnimatedProps(() => ({
    transform: [{ translateX: shadowWaveDriver.value % shadowWavePeriod }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const waterBodyPath = useMemo(() => buildWaterBodyPath(wavePeriod, TANK_HEIGHT, WAVE_AMPLITUDE), [wavePeriod]);
  const shadowWavePath = useMemo(
    () => buildWaveLinePath(shadowWavePeriod, SHADOW_WAVE_AMPLITUDE),
    [shadowWavePeriod],
  );

  // Randomize each bubble's look/timing once at mount (plain JS on the JS
  // thread - never Math.random() inside a worklet). Regenerates if the
  // measured tank width changes (rare - only on rotation/multi-window).
  const bubbles = useMemo<BubbleConfig[]>(
    () =>
      Array.from({ length: BUBBLE_COUNT }, (_, id) => ({
        id,
        startX: 10 + Math.random() * (tankWidth - 20),
        radius: 1.5 + Math.random() * 2,
        duration: 2200 + Math.random() * 2200,
        delay: Math.random() * 4000,
      })),
    [tankWidth],
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('water.settingsLink')}
          onPress={() => setSettingsVisible(true)}
          hitSlop={8}
          style={styles.settingsButton}>
          <Ionicons name="settings-outline" size={16} color={colors.textSecondary} />
        </Pressable>
        <InfoTooltip titleKey="tooltip.waterGoal.title" bodyKey="tooltip.waterGoal.body" />
      </View>

      <View style={styles.contentRow}>
        <View style={styles.tank} onLayout={onTankLayout}>
          <Animated.View style={[StyleSheet.absoluteFill, pulseStyle]}>
            <Svg width={tankWidth} height={TANK_HEIGHT}>
              <Defs>
                <ClipPath id="waterTankClip">
                  <Rect x={0} y={0} width={tankWidth} height={TANK_HEIGHT} rx={TANK_RADIUS} ry={TANK_RADIUS} />
                </ClipPath>
              </Defs>
              <G clipPath="url(#waterTankClip)">
                {reducedMotion ? (
                  <Rect
                    x={0}
                    y={TANK_HEIGHT * (1 - progress)}
                    width={tankWidth}
                    height={TANK_HEIGHT * progress + 2}
                    fill={colors.water}
                  />
                ) : (
                  <AnimatedG animatedProps={levelGroupProps}>
                    {/*
                      The water body's own top edge IS the wave (see
                      buildWaterBodyPath) - no separate flat-topped fill
                      underneath it to read as a mismatched "surface".
                    */}
                    <AnimatedPath d={waterBodyPath} fill={colors.water} animatedProps={waveProps} />
                    {/*
                      A second, subtler ripple stroked directly ON the body's
                      own (already-correct) surface - not a separate filled
                      shape with its own depth, so it can't read as "below
                      the water" the way the earlier standalone shadow layer
                      did.
                    */}
                    <AnimatedPath
                      d={shadowWavePath}
                      stroke={WAVE_SHADOW_COLOR}
                      strokeWidth={2}
                      fill="none"
                      animatedProps={shadowWaveProps}
                    />
                  </AnimatedG>
                )}
                {!reducedMotion &&
                  bubbles.map((bubble) => (
                    <WaterBubble
                      key={bubble.id}
                      config={bubble}
                      levelY={levelY}
                      tankHeight={TANK_HEIGHT}
                      color={BUBBLE_COLOR}
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
                  style={[styles.glassButton, styles.glassButtonSecondary]}
                  onPress={handleRemove}>
                  <Ionicons name="remove" size={20} color={colors.water} />
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
                  <Ionicons name="add" size={20} color={ON_WATER_FILL_COLOR} />
                </Pressable>
              </View>
            </View>
          </View>
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

/**
 * Same sanctioned-exception rationale as ON_WATER_FILL_COLOR above: bubbles
 * must be visually distinct from the `colors.water` fill they rise through,
 * and a second theme hue would misread as a second liquid rather than
 * "lighter water" - white at partial opacity instead.
 */
const BUBBLE_COLOR = 'rgba(255, 255, 255, 0.8)';
/** Same rationale - a stroke color for the shadow ripple, distinct from the water fill it rides on. */
const WAVE_SHADOW_COLOR = 'rgba(0, 0, 0, 0.2)';

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
      justifyContent: 'center',
      gap: spacing.sm,
    },
    // flex:1 (not a fixed width) so the tank fills the full contentRow width
    // - see the `tankWidth` onLayout measurement.
    tank: {
      flex: 1,
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
      backgroundColor: colors.water,
    },
    // Same circular field as the primary (+) button, just white instead of
    // water-blue - back inside the tank next to +, per Martin's ask.
    glassButtonSecondary: {
      backgroundColor: ON_WATER_FILL_COLOR,
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
