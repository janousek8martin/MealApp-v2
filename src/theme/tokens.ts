/**
 * Design tokens – redesign V2, revision 3 ("P2").
 * Emerald (primary) + violet (secondary) accent system, light + dark modes.
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
  /** Secondary (violet) accent – decorative highlights, charts, alt CTAs. */
  secondary: string;
  secondaryLight: string;
  success: string;
  /** Kept for API compatibility with older call sites; same as `success`. */
  teal: string;
  mint: string;
  lime: string;
  tealTint: string;
  danger: string;
  text: string;
  textSecondary: string;
  border: string;
  surface: string;
  /** A second, slightly-raised surface for nested cards / rows. */
  surfaceAlt: string;
};

export const lightColors: ColorTokens = {
  background: '#FFFFFF',
  heroGradientStart: '#1F5C46',
  heroGradientEnd: '#0B2F22',
  primary: '#059669',
  primaryLight: '#10B981',
  onPrimary: '#FFFFFF',
  secondary: '#7C3AED',
  secondaryLight: '#8B5CF6',
  success: '#22C55E',
  teal: '#22C55E',
  mint: '#D1FAE5',
  lime: '#ECFCCB',
  tealTint: '#EDE9FE',
  danger: '#DC2626',
  text: '#16211B',
  textSecondary: '#5B6B60',
  border: '#E1E7E3',
  surface: '#F6F8F7',
  surfaceAlt: '#EDF2EF',
};

export const darkColors: ColorTokens = {
  background: '#0D1512',
  heroGradientStart: '#1F5C46',
  heroGradientEnd: '#081D15',
  primary: '#34D399',
  primaryLight: '#6EE7B7',
  onPrimary: '#0D1512',
  secondary: '#A78BFA',
  secondaryLight: '#C4B5FD',
  success: '#4ADE80',
  teal: '#4ADE80',
  mint: '#123527',
  lime: '#1F2A12',
  tealTint: '#241A3D',
  danger: '#F87171',
  text: '#EFF5F2',
  textSecondary: '#8FA398',
  border: '#2A3630',
  surface: '#161F1B',
  surfaceAlt: '#1E2924',
};

/** Body-fat chart severity bands (Profile overview), per theme mode. */
export const bodyFatBandLight = {
  ideal: '#E6FFE6',
  average: '#FFFDE6',
  overweight: '#FFE6E6',
} as const;

export const bodyFatBandDark = {
  ideal: '#123B1F',
  average: '#3B3512',
  overweight: '#3B1414',
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
 * @deprecated Static light-mode colors, kept only so any not-yet-migrated
 * call site still compiles. New code must use `useTheme()` from
 * `@/theme/ThemeContext` instead of importing `colors` directly.
 */
export const colors = lightColors;
/** @deprecated use `useTheme().bodyFatBand` instead. */
export const bodyFatBand = bodyFatBandLight;
export const heroGradient = [lightColors.heroGradientStart, lightColors.heroGradientEnd] as const;
