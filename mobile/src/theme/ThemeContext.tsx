import React, { createContext, useContext, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { darkColors, lightColors, ThemeColors } from './tokens';

type ThemeMode = 'dark' | 'light';

interface ThemeValue {
  mode: ThemeMode;
  colors: ThemeColors;
}

const ThemeContext = createContext<ThemeValue>({ mode: 'dark', colors: darkColors });

// Dark-first: tizim sozlamasi light bo'lsa light, aks holda dark.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const scheme = useColorScheme();
  const value = useMemo<ThemeValue>(() => {
    const mode: ThemeMode = scheme === 'light' ? 'light' : 'dark';
    return { mode, colors: mode === 'light' ? lightColors : darkColors };
  }, [scheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  return useContext(ThemeContext);
}
