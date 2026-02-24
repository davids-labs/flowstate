import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Light palette (existing) ──────────────────────────────────
const lightColors = {
  ink: '#0B0F14',
  text: '#1E2630',
  muted: '#667085',
  border: '#E4E7EC',
  background: '#F8FAFC',
  accent: '#2563EB',
  surface: '#FFFFFF',
  surfaceBorder: '#E4E7EC',
  accentLight: '#DBEAFE',
  textSecondary: '#667085',
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  white: '#FFFFFF',
};

// ─── Dark palette ──────────────────────────────────────────────
const darkColors = {
  ink: '#F1F5F9',
  text: '#E2E8F0',
  muted: '#94A3B8',
  border: '#334155',
  background: '#0F172A',
  accent: '#3B82F6',
  surface: '#1E293B',
  surfaceBorder: '#334155',
  accentLight: '#1E3A5F',
  textSecondary: '#94A3B8',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  white: '#FFFFFF',
};

export type ThemeColors = typeof lightColors;

interface ThemeContextType {
  isDark: boolean;
  themeColors: ThemeColors;
  toggleDarkMode: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  themeColors: lightColors,
  toggleDarkMode: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem('setting_darkMode').then(v => {
      if (v === 'true') setIsDark(true);
    }).catch(() => {});
  }, []);

  const toggleDarkMode = useCallback((v: boolean) => {
    setIsDark(v);
    AsyncStorage.setItem('setting_darkMode', String(v)).catch(() => {});
  }, []);

  const themeColors = useMemo(() => isDark ? darkColors : lightColors, [isDark]);

  return (
    <ThemeContext.Provider value={{ isDark, themeColors, toggleDarkMode }}>
      {children}
    </ThemeContext.Provider>
  );
}
