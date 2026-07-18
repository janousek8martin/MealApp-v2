/**
 * Design tokens – UI/UX brief (2026-07-19), "klidná důvěryhodnost" direction.
 * Dark Spruce (brand) + Olive Leaf (interactive) on Beige/Ink Black, with a
 * SEPARATE tolerance-status palette (toleranceOk/toleranceOff) that must
 * never be conflated with brand green or reused as a red/green semaphore —
 * see the brief's section 2.4. `danger` is reserved for real system errors
 * (network, form validation) only, never for a nutrition/body-metric state.
 * Shape (`ColorTokens`) is identical across modes so every consumer can stay
 * mode-agnostic and just read `colors.*` from `useTheme()`.
 */

export type ColorTokens = {
  background: string;
  heroGradientStart: string;
  heroGradientEnd: string;
  primary: string;
  primaryLight: string;
  onPrimary: string;
  /** Muted alt accent – decorative highlights, charts, alt CTAs. Same color family as primary (brief: no second independent palette). */
  secondary: string;
  secondaryLight: string;
  /** Water/hydration accent (sky blue) – used by WaterCard, deliberately distinct from the green primary. */
  water: string;
  /** @deprecated Use `toleranceOk` for nutrition/goal state, or `primary` for generic brand success. Kept for un-migrated call sites. */
  success: string;
  /** Kept for API compatibility with older call sites; same as `success`. */
  teal: string;
  mint: string;
  lime: string;
  tealTint: string;
  /** "Within tolerance" / goal-met state. Deliberately its own token, not aliased to `primary` — the brief warns that reusing brand green here makes its *absence* silently read as failure. */
  toleranceOk: string;
  /** "Outside tolerance" state. Warm amber, never red — see brief 2.4 (semaphore red/green measurably increases anxiety for disordered-eating-prone users, and this app is used by a household with children). */
  toleranceOff: string;
  /** Real system errors only (network, form validation, delete confirmation) – never a nutrition or body-metric state. */
  danger: string;
  text: string;
  textSecondary: string;
  border: string;
  surface: string;
  /** A second, slightly-raised surface for nested cards / rows. */
  surfaceAlt: string;
};

export const lightColors: ColorTokens = {
  background: '#EFF6E0',
  heroGradientStart: '#28502E',
  heroGradientEnd: '#152A18',
  primary: '#28502E',
  primaryLight: '#47682C',
  onPrimary: '#FFFFFF',
  secondary: '#47682C',
  secondaryLight: '#6B8F4C',
  water: '#0EA5E9',
  success: '#47682C',
  teal: '#47682C',
  mint: '#D5E2CD',
  lime: '#D6E1C5',
  tealTint: '#DFE9D4',
  toleranceOk: '#47682C',
  toleranceOff: '#B08D57',
  danger: '#B3453D',
  text: '#1C2A1E',
  textSecondary: '#5B6B5A',
  border: '#DCE3D1',
  surface: '#F7FAEF',
  surfaceAlt: '#E9F0DA',
};

export const darkColors: ColorTokens = {
  background: '#011627',
  heroGradientStart: '#28502E',
  heroGradientEnd: '#011A0F',
  primary: '#AEC3B0',
  primaryLight: '#C6D6C7',
  onPrimary: '#011627',
  secondary: '#AEC3B0',
  secondaryLight: '#C6D6C7',
  water: '#38BDF8',
  success: '#AEC3B0',
  teal: '#AEC3B0',
  mint: '#24393A',
  lime: '#0F2628',
  tealTint: '#1B303B',
  toleranceOk: '#AEC3B0',
  toleranceOff: '#C7A06B',
  danger: '#D3675F',
  text: '#EFF6E0',
  textSecondary: '#9BB09C',
  border: '#0F2836',
  surface: '#04202F',
  surfaceAlt: '#0A2B3A',
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
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const typography = {
  /** Hero number/statistic */
  hero: 40,
  title: 24,
  subtitle: 18,
  body: 16,
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

/**
 * @deprecated Static light-mode colors, kept only so any not-yet-migrated
 * call site still compiles. New code must use `useTheme()` from
 * `@/theme/ThemeContext` instead of importing `colors` directly.
 */
export const colors = lightColors;
/** @deprecated use `useTheme().bodyFatBand` instead. */
export const bodyFatBand = bodyFatBandLight;
export const heroGradient = [lightColors.heroGradientStart, lightColors.heroGradientEnd] as const;
