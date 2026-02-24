// ─── FlowState Design Tokens ─────────────────────────────────────
// Source: Style Lookbook + Interaction Guide v1
// Aesthetic: Notion/Linear with iOS polish. Neutral-first, single accent.
//
// IMPORTANT: For colors, use `useTheme()` from ThemeContext.tsx.
// The static `colors` export below is LIGHT-ONLY and should only be
// used in StyleSheet.create() for non-color structural styles.
// Always use `themeColors` from useTheme() for runtime color values.

export const colors = {
  // Core palette (from interaction guide) — LIGHT ONLY, prefer useTheme()
  ink: '#0B0F14',           // Headings + primary text
  text: '#1E2630',          // Body text
  muted: '#667085',         // Secondary text + meta
  border: '#E4E7EC',        // Dividers + strokes
  background: '#F8FAFC',    // Background surface
  accent: '#2563EB',        // Primary action + focus

  // Derived
  surface: '#FFFFFF',       // Card backgrounds (white on light-grey BG)
  surfaceBorder: '#E4E7EC', // Alias for border
  accentLight: '#DBEAFE',   // Accent tint for backgrounds
  textSecondary: '#667085', // Alias for muted

  // Semantic
  success: '#16A34A',
  warning: '#D97706',
  danger: '#DC2626',
  white: '#FFFFFF',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  hero: 48,
};

export const borderRadius = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

// ─── Animation Durations (150–220ms per interaction guide) ──────
export const timing = {
  fast: 150,
  normal: 200,
  slow: 220,
};
