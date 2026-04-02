import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUserPrefsStore, deriveTint, ThemePreset } from '../stores/userPrefsStore';

// ─── V2 Design Tokens ─────────────────────────────────────────────────────────
// Source: UI Overhaul Guide V2 §0.1 · March 2026
// Flat structure — destructure exactly what you need, no dot chains.
// Naming: camelCase translations of the spec token names.
//   surface.elevated → surfaceElevated
//   border.strong    → borderStrong
//   text.primary     → textPrimary
//   accent.tint      → accentTint
// ─────────────────────────────────────────────────────────────────────────────

const lightTokens = {
  // ── Background & Surface ────────────────────────────────────────
  background:        '#FFFFFF',
  surface:           '#F2F2F7',
  surfaceElevated:   '#FFFFFF',
  surfaceInput:      '#FFFFFF',
  border:            'rgba(0,0,0,0.12)',
  borderStrong:      'rgba(0,0,0,0.22)',

  // ── Text ────────────────────────────────────────────────────────
  textPrimary:       '#000000',
  textSecondary:     'rgba(60,60,67,0.6)',
  textTertiary:      'rgba(60,60,67,0.3)',
  textPlaceholder:   'rgba(60,60,67,0.24)',
  textOnAccent:      '#FFFFFF',

  // ── Accent & Interactive ────────────────────────────────────────
  accent:            '#4F46E5',   // Indigo — all non-pillar interactive elements
  accentTint:        '#EEF2FF',
  destructive:       '#EF4444',
  success:           '#10B981',
  warning:           '#F59E0B',

  // ── Legacy aliases — kept to avoid breaking unmigrated call sites ─
  // Remove these as each screen is migrated.
  ink:               '#000000',
  text:              '#000000',
  muted:             'rgba(60,60,67,0.6)',
  accentLight:       '#EEF2FF',
  surfaceBorder:     'rgba(0,0,0,0.12)',
  danger:            '#EF4444',
  white:             '#FFFFFF',
  indigo:            '#4F46E5',
};

const darkTokens = {
  // ── Background & Surface ────────────────────────────────────────
  background:        '#000000',   // true OLED black
  surface:           '#1C1C1E',   // system grouped background
  surfaceElevated:   '#2C2C2E',
  surfaceInput:      '#1C1C1E',
  border:            'rgba(255,255,255,0.10)',
  borderStrong:      'rgba(255,255,255,0.18)',

  // ── Text ────────────────────────────────────────────────────────
  textPrimary:       '#FFFFFF',
  textSecondary:     'rgba(235,235,245,0.6)',
  textTertiary:      'rgba(235,235,245,0.3)',
  textPlaceholder:   'rgba(235,235,245,0.24)',
  textOnAccent:      '#FFFFFF',

  // ── Accent & Interactive ────────────────────────────────────────
  accent:            '#4F46E5',
  accentTint:        '#1E1B4B',
  destructive:       '#EF4444',
  success:           '#10B981',
  warning:           '#F59E0B',

  // ── Legacy aliases ───────────────────────────────────────────────
  ink:               '#FFFFFF',
  text:              '#FFFFFF',
  muted:             'rgba(235,235,245,0.6)',
  accentLight:       '#1E1B4B',
  surfaceBorder:     'rgba(255,255,255,0.10)',
  danger:            '#EF4444',
  white:             '#FFFFFF',
  indigo:            '#4F46E5',
};

export type ThemeTokens = typeof lightTokens;

// Theme preference: 'system' | 'light' | 'dark'
export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeContextType {
  isDark: boolean;
  themePreference: ThemePreference;
  /** V2 flat token object — destructure exactly what you need */
  themeTokens: ThemeTokens;
  /** @deprecated Use themeTokens instead */
  themeColors: ThemeTokens;
  setThemePreference: (pref: ThemePreference) => void;
  /** @deprecated Use setThemePreference('dark' | 'light') */
  toggleDarkMode: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  isDark: false,
  themePreference: 'system',
  themeTokens: lightTokens,
  themeColors: lightTokens,
  setThemePreference: () => {},
  toggleDarkMode: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

// ─── Theme preset overlays ────────────────────────────────────────────────────
// Each preset only overrides the tokens it cares about; the rest fall through to the base.
const PRESET_OVERLAYS: Record<ThemePreset, { light: Partial<typeof lightTokens>; dark: Partial<typeof darkTokens> }> = {
  default:   { light: {}, dark: {} },
  midnight:  { light: {}, dark: { background: '#0A0A14', surface: '#12121F', surfaceElevated: '#1C1C2E' } },
  warm:      { light: { background: '#FFFBF5', surface: '#F5EDD8', surfaceElevated: '#FFFBF5' },
                dark:  { background: '#0F0A00', surface: '#1C1400', surfaceElevated: '#2A1E00' } },
  forest:    { light: { background: '#F5FBF5', surface: '#E8F5E8', surfaceElevated: '#F5FBF5' },
                dark:  { background: '#030D03', surface: '#091409', surfaceElevated: '#102010' } },
  ocean:     { light: { background: '#F0F8FF', surface: '#E0F0FF', surfaceElevated: '#F0F8FF' },
                dark:  { background: '#020810', surface: '#061020', surfaceElevated: '#0A1828' } },
  mono:      { light: { accent: '#1C1C1E', accentTint: '#F2F2F7', accentLight: '#F2F2F7' },
                dark:  { accent: '#EBEBF5', accentTint: '#2C2C2E', accentLight: '#2C2C2E' } },
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [themePreference, setThemePreferenceState] = useState<ThemePreference>('system');

  // Subscribe to user pref store fields that affect theming
  const accentColour   = useUserPrefsStore(s => s.accentColour);
  const themePreset    = useUserPrefsStore(s => s.themePreset);
  const darkBackground = useUserPrefsStore(s => s.darkBackground);

  useEffect(() => {
    AsyncStorage.getItem('setting_themePreference').then(v => {
      if (v === 'light' || v === 'dark' || v === 'system') {
        setThemePreferenceState(v);
      } else {
        AsyncStorage.getItem('setting_darkMode').then(legacy => {
          if (legacy === 'true') setThemePreferenceState('dark');
        }).catch(() => {});
      }
    }).catch(() => {});
  }, []);

  const setThemePreference = useCallback((pref: ThemePreference) => {
    setThemePreferenceState(pref);
    AsyncStorage.setItem('setting_themePreference', pref).catch(() => {});
  }, []);

  const toggleDarkMode = useCallback((v: boolean) => {
    setThemePreference(v ? 'dark' : 'light');
  }, [setThemePreference]);

  const isDark = useMemo(() => {
    if (themePreference === 'dark') return true;
    if (themePreference === 'light') return false;
    return systemScheme === 'dark';
  }, [themePreference, systemScheme]);

  const themeTokens = useMemo(() => {
    const base = isDark ? { ...darkTokens } : { ...lightTokens };
    // Apply preset overlay
    const overlay = isDark ? PRESET_OVERLAYS[themePreset].dark : PRESET_OVERLAYS[themePreset].light;
    const withPreset = { ...base, ...overlay } as typeof lightTokens;

    // Soft dark background override
    if (isDark && darkBackground === 'soft') {
      withPreset.background      = '#0D0D0D';
      withPreset.surface         = '#1A1A1A';
      withPreset.surfaceElevated = '#252525';
    }

    // Dynamic accent colour (skip if mono preset as it has its own accent)
    if (themePreset !== 'mono') {
      withPreset.accent     = accentColour;
      withPreset.accentTint = deriveTint(accentColour, isDark);
      withPreset.accentLight = deriveTint(accentColour, isDark);
      withPreset.indigo     = accentColour; // legacy alias
    }

    return withPreset;
  }, [isDark, themePreset, darkBackground, accentColour]);

  const value = useMemo(() => ({
    isDark,
    themePreference,
    themeTokens,
    themeColors: themeTokens,
    setThemePreference,
    toggleDarkMode,
  }), [isDark, themePreference, themeTokens, setThemePreference, toggleDarkMode]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}
