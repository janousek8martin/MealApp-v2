/**
 * Design tokens – "green tea" visual identity, revision 2 (redesign V2).
 * Palette C: dark green + teal/lime, white background.
 */

export const colors = {
  /** App background – pure white */
  background: '#FFFFFF',
  /** Hero panel ombre gradient, light → deep green */
  heroGradientStart: '#4E7A4A',
  heroGradientEnd: '#1E3320',
  /** Primary accent – buttons, progress ring */
  primary: '#2E4A32',
  primaryLight: '#3E6B3E',
  /** Secondary accent – success, completed meals, progress */
  success: '#9BC53D',
  /** Secondary accent – info, highlights, secondary CTAs */
  teal: '#2E8C8C',
  /** Complementary blocks – categories, tags, chips */
  mint: '#A8D8C8',
  lime: '#D9EDB0',
  tealTint: '#BFE3E3',
  /** Destructive actions (delete, warnings) */
  danger: '#E06A4E',
  /** Text */
  text: '#243620',
  textSecondary: '#6E7A5E',
  /** Subtle borders / dividers */
  border: '#DCE8E2',
  /** Card surfaces – soft mint tint against the white background */
  surface: '#EFF6F4',
  onPrimary: '#FFFFFF',
} as const;

/** Body-fat chart severity bands (Profile overview). */
export const bodyFatBand = {
  ideal: '#E6FFE6',
  average: '#FFFDE6',
  overweight: '#FFE6E6',
} as const;

export const heroGradient = [colors.heroGradientStart, colors.heroGradientEnd] as const;

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
