import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { makeTheme, type Theme, type ThemeName } from '@bygsmart/tokens';

export type { Theme, ThemeName, ThemeColors, ColorToken } from '@bygsmart/tokens';

interface ThemeContextValue {
  theme: Theme;
  outdoor: boolean;
  setOutdoor: (on: boolean) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Provides the active theme. Follows the OS light/dark scheme by default; `outdoor`
 * forces the high-contrast field theme (P6). `forced` pins a theme (tests, the gallery).
 */
export function ThemeProvider({ children, forced }: { children: ReactNode; forced?: ThemeName }) {
  const system = useColorScheme();
  const [outdoor, setOutdoor] = useState(false);
  const value = useMemo<ThemeContextValue>(() => {
    const name: ThemeName = forced ?? (outdoor ? 'outdoor' : system === 'dark' ? 'dark' : 'light');
    return { theme: makeTheme(name), outdoor, setOutdoor };
  }, [forced, outdoor, system]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** The active theme. Falls back to light when used outside a provider (safe default). */
export function useTheme(): Theme {
  return useContext(ThemeContext)?.theme ?? makeTheme('light');
}

export function useOutdoorMode(): { outdoor: boolean; setOutdoor: (on: boolean) => void } {
  const ctx = useContext(ThemeContext);
  return { outdoor: ctx?.outdoor ?? false, setOutdoor: ctx?.setOutdoor ?? (() => {}) };
}
