/**
 * Design tokens – "green tea" visual identity.
 * Hex values are mandated by the project brief (CLAUDE.md) and must not drift.
 */

export const colors = {
  /** App background – cream */
  background: '#F4F1E8',
  /** Hero panel ombre gradient, light → deep green */
  heroGradientStart: '#4E7A4A',
  heroGradientEnd: '#1E3320',
  /** Primary accent – buttons, progress ring */
  primary: '#2E4A32',
  primaryLight: '#3E6B3E',
  /** Secondary accent – success, completed meals */
  success: '#639922',
  /** Complementary blocks – categories, tags */
  sand: '#E3D9A8',
  olive: '#B7D19C',
  earth: '#CBB79A',
  /** Text */
  text: '#243620',
  textSecondary: '#6E7A5E',
  /** Subtle borders / dividers */
  border: '#DDE3D0',
  /** Surfaces (cards on cream background) */
  surface: '#FFFFFF',
  onPrimary: '#F4F1E8',
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
