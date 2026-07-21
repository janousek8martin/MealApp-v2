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
import Svg, { Circle, ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

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

// Wave layer "belly" depth - how far below the crest line each layer's fill
// extends. Deliberately much taller than the crest's own amplitude: at 16px
// (the original value) only ~11% of the 148px tank was ever tinted, leaving
// most of the visible water as an untextured flat fill below it (Martin's
// "nehybná plocha modré" note). 44px covers roughly the top third of the
// tank, which is the portion of the water that's actually near the surface
// at most fill levels.
const FRONT_WAVE_HEIGHT = 44;
const FRONT_WAVE_AMPLITUDE = 8; // crest swing stays subtle even though the belly got deeper
const BACK_WAVE_HEIGHT = 44;
const BACK_WAVE_AMPLITUDE = 5; // flatter/more subtle than the front layer

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

  // Measured on layout so the tank fills whatever width the card's flex
  // layout actually gives it (Martin's "roztáhni, ale ne na sílu" ask)
  // instead of a fixed size - same onLayout-measure pattern BodyFatCarousel
  // already uses elsewhere in this app.
  const [tankWidth, setTankWidth] = useState(TANK_WIDTH_FALLBACK);
  const onTankLayout = (event: { nativeEvent: { layout: { width: number } } }) => {
    const width = event.nativeEvent.layout.width;
    if (Math.abs(width - tankWidth) > 1) setTankWidth(width);
  };
  const frontWavePeriod = tankWidth;
  const backWavePeriod = tankWidth * 1.3;

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

  // Horizontal drift, one shared value per wave layer (transform-only).
  // One-directional (reverse:false) per Martin's ask - a ping-pong read as
  // "sloshing back and forth" which he didn't want. The earlier "drift/snap"
  // complaint this was fixing turned out to be the gradient rendering bug
  // below, not the reset itself - with that fixed, a hard reset from
  // -period back to 0 is seamless again (the frame at -period is pixel-
  // identical to the frame at 0, since the path is exactly periodic).
  const frontPhase = useSharedValue(0);
  const backPhase = useSharedValue(-backWavePeriod * 0.5); // offset start so the two layers never sync up
  useEffect(() => {
    if (reducedMotion) return;
    frontPhase.value = withRepeat(
      withTiming(-frontWavePeriod, { duration: 3500, easing: Easing.linear }),
      -1,
      false,
    );
    backPhase.value = withRepeat(
      withTiming(-backWavePeriod, { duration: 6000, easing: Easing.linear }),
      -1,
      false,
    );
  }, [reducedMotion, frontPhase, backPhase, frontWavePeriod, backWavePeriod]);

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
  // Wave layers fade out as the tank tops off (levelY -> 0) - a topped-off
  // tank has no headroom for a surface ripple, so showing wave texture
  // right at 100% read as wrong (Martin: "i když by teď vlnění vidět
  // nemělo být"). Fully faded by the time levelY is within 10 tank-units
  // of the top; unchanged (opacity 1) everywhere else.
  const frontWaveProps = useAnimatedProps(() => ({
    transform: [{ translateX: frontPhase.value }],
    opacity: interpolate(levelY.value, [0, 10], [0, 1], Extrapolation.CLAMP),
  }));
  const backWaveProps = useAnimatedProps(() => ({
    transform: [{ translateX: backPhase.value }],
    opacity: interpolate(levelY.value, [0, 10], [0, 1], Extrapolation.CLAMP),
  }));
  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const frontWavePath = useMemo(
    () => buildWavePath(frontWavePeriod, FRONT_WAVE_HEIGHT, FRONT_WAVE_AMPLITUDE),
    [frontWavePeriod],
  );
  const backWavePath = useMemo(
    () => buildWavePath(backWavePeriod, BACK_WAVE_HEIGHT, BACK_WAVE_AMPLITUDE),
    [backWavePeriod],
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
                {/*
                  Fades each wave layer's tint out to fully transparent by its
                  own bottom edge, instead of a flat-opacity fill that just
                  stops dead at y=height - a flat fill reads as a hard seam
                  between "tinted water" and "plain water" right at that
                  boundary (Martin: "vlnění je tak divně uprostřed" - looked
                  like two stacked blocks, not one body of water).

                  userSpaceOnUse with explicit y1/y2 in the path's own local
                  units (0..height), not the default objectBoundingBox - a
                  bounding-box-relative gradient on a shape sitting inside an
                  animated (Reanimated UI-thread) transform rendered wrong on
                  Android (the fade collapsed into a near-solid line instead
                  of spreading across the full height), so this pins the
                  gradient to fixed, transform-independent coordinates.
                */}
                <LinearGradient
                  id="frontWaveGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2={FRONT_WAVE_HEIGHT}
                  gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={WAVE_HIGHLIGHT_COLOR} stopOpacity={1} />
                  <Stop offset="1" stopColor={WAVE_HIGHLIGHT_COLOR} stopOpacity={0} />
                </LinearGradient>
                <LinearGradient
                  id="backWaveGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2={BACK_WAVE_HEIGHT}
                  gradientUnits="userSpaceOnUse">
                  <Stop offset="0" stopColor={WAVE_SHADOW_COLOR} stopOpacity={1} />
                  <Stop offset="1" stopColor={WAVE_SHADOW_COLOR} stopOpacity={0} />
                </LinearGradient>
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
                    <Rect x={0} y={0} width={tankWidth} height={TANK_HEIGHT} fill={colors.water} />
                    <AnimatedG animatedProps={backWaveProps}>
                      <Path d={backWavePath} fill="url(#backWaveGradient)" />
                    </AnimatedG>
                    <AnimatedG animatedProps={frontWaveProps}>
                      <Path d={frontWavePath} fill="url(#frontWaveGradient)" />
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
 * Same sanctioned-exception rationale as ON_WATER_FILL_COLOR above, for the
 * wave crests and bubbles: these MUST be visually distinct from the base
 * `colors.water` fill they're layered on top of. The wave layers used to be
 * `colors.water` at reduced opacity - which composites to exactly the same
 * solid color as the fully-opaque base fill directly behind them (alpha-
 * blending a color with itself never changes the result), so the "two-tone
 * wave + rising bubbles" were rendering correctly but were completely
 * invisible. White/black overlays instead of a second theme color, since
 * this needs to read as "lighter/darker water," not a distinct hue.
 */
const WAVE_HIGHLIGHT_COLOR = 'rgba(255, 255, 255, 0.32)'; // front wave - lighter
const WAVE_SHADOW_COLOR = 'rgba(0, 0, 0, 0.22)'; // back wave - darker
const BUBBLE_COLOR = 'rgba(255, 255, 255, 0.8)';

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
