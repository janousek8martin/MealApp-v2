import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { useAppStore } from '@/stores/appStore';
import {
  bodyFatBandDark,
  bodyFatBandLight,
  darkColors,
  lightColors,
  type ColorTokens,
} from './tokens';

export type ThemeMode = 'light' | 'dark';

export type BodyFatBandColors = Record<'ideal' | 'average' | 'overweight', string>;

type ThemeContextValue = {
  mode: ThemeMode;
  colors: ColorTokens;
  bodyFatBand: BodyFatBandColors;
};

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  colors: lightColors,
  bodyFatBand: bodyFatBandLight,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useAppStore((s) => s.themeMode);
  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      colors: mode === 'dark' ? darkColors : lightColors,
      bodyFatBand: mode === 'dark' ? bodyFatBandDark : bodyFatBandLight,
    }),
    [mode],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The single source of truth for colors – always read theme via this hook, never import `colors` statically. */
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
