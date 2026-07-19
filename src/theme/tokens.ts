/**
 * Design tokens – UI/UX brief (2026-07-19), "klidná důvěryhodnost" direction.
 * Dark Spruce (`primary`, brand/nav) + Olive Leaf (`interactive`, buttons/
 * controls/positive-state) on Beige/Ink Black. `attention` (warm amber) is
 * the ONLY color for a nutrition/goal/food-freshness state that needs to
 * stand out — never `danger`/red and never a red-green semaphore pairing,
 * see the brief's section 2.4: that measurably increases anxiety for
 * disordered-eating-prone users, and this app is used by a household with
 * children. `danger` is reserved for real system errors (network, form
 * validation, delete confirmation) only, never for a nutrition or
 * body-metric state. Shape (`ColorTokens`) is identical across modes so
 * every consumer can stay mode-agnostic and just read `colors.*` from
 * `useTheme()`.
 */

export type ColorTokens = {
  background: string;
  surface: string;
  /** A second, slightly-raised surface for nested cards / rows. */
  surfaceAlt: string;
  border: string;
  text: string;
  textSecondary: string;
  /** Brand/nav accent — hero gradient family, chips that represent the app itself (e.g. the profile pill). */
  primary: string;
  onPrimary: string;
  /** Interactive accent — buttons, active controls, switches, and positive/confirmed states (eaten, checked, within-tolerance). */
  interactive: string;
  onInteractive: string;
  /** Soft decorative fill for chip/tile backgrounds and placeholders — no semantic meaning of its own. */
  accentSoft: string;
  /** Water/hydration accent (sky blue) – used by WaterCard, deliberately distinct from the green primary. */
  water: string;
  /** The only color for a nutrition/goal/food-freshness state that needs to stand out (expiring pantry item, skipped meal, needs-review data, aggressive goal pace). Warm amber, never red. */
  attention: string;
  /** Real system errors only (network, form validation, delete confirmation) – never a nutrition or body-metric state. */
  danger: string;
  heroGradientStart: string;
  heroGradientEnd: string;
};

export const lightColors: ColorTokens = {
  background: '#EFF6E0',
  surface: '#F7FAEF',
  surfaceAlt: '#E9F0DA',
  border: '#DCE3D1',
  text: '#1C2A1E',
  textSecondary: '#5B6B5A',
  primary: '#28502E',
  onPrimary: '#FFFFFF',
  interactive: '#47682C',
  onInteractive: '#FFFFFF',
  accentSoft: '#DCE7D2',
  water: '#0EA5E9',
  attention: '#B08D57',
  danger: '#B3453D',
  heroGradientStart: '#28502E',
  heroGradientEnd: '#152A18',
};

export const darkColors: ColorTokens = {
  background: '#011627',
  surface: '#0F1B17',
  surfaceAlt: '#152520',
  border: '#22322C',
  text: '#EFF6E0',
  textSecondary: '#9BB09C',
  primary: '#AEC3B0',
  onPrimary: '#16241A',
  interactive: '#8FAE7A',
  onInteractive: '#12200F',
  accentSoft: '#25352A',
  water: '#38BDF8',
  attention: '#C9A876',
  danger: '#E08079',
  heroGradientStart: '#28502E',
  heroGradientEnd: '#011A0F',
};

/** Body-fat chart severity bands (Profile overview), per theme mode. No red — see the tolerance-color rule above; "overweight" uses the same amber as toleranceOff, not danger. */
export const bodyFatBandLight = {
  ideal: '#E3ECD6',
  average: '#F1EBD8',
  overweight: '#F0E2C9',
} as const;

export const bodyFatBandDark = {
  ideal: '#1B2E1D',
  average: '#2B2718',
  overweight: '#33291A',
} as const;

export const radius = {
  /** Large rounded cards per brief (~20–24px) */
  card: 22,
  input: 14,
  chip: 999,
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  ms: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
  xxxl: 64,
} as const;

export const typography = {
  /** Hero number/statistic */
  hero: 40,
  title: 24,
  subtitle: 18,
  body: 16,
  /** Chip/pill labels, list-row primary text at a slightly denser size than `body`. */
  label: 15,
  small: 13,
} as const;

/**
 * Space Grotesk (headings/display) + Inter (body/UI) per the UI/UX brief.
 * Loaded app-wide in src/app/_layout.tsx; `Text`'s default style is set to
 * `body` there so most existing screens pick up Inter with no per-file
 * change. Headings still need `fontFamily.heading` applied explicitly
 * (title/subtitle-sized text) - a Phase 6 (screen-by-screen pass) task.
 */
export const fontFamily = {
  heading: 'SpaceGrotesk_700Bold',
  headingMedium: 'SpaceGrotesk_500Medium',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
} as const;

/** Apply to any Text showing kcal/macro/weight numbers so digits align in columns. */
export const tabularNums = { fontVariant: ['tabular-nums'] as const };
