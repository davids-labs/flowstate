// ─── FlowState V2 Design Tokens ──────────────────────────────────
// Source: UI Overhaul Guide V2 · March 2026
// Based on 4pt grid · SF Pro system font · Things 3 × Linear aesthetic
//
// COLOUR RULE: Never use these static tokens for runtime colors.
// Always use the memoised tokens from useTheme() (ThemeContext.tsx).
// These structural constants (spacing, radius, type scale, motion) are
// safe to reference directly in StyleSheet.create().

// ─── Spacing Scale (4pt grid) ────────────────────────────────────
export const space = {
  2: 2,
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  48: 48,
} as const;

// Legacy aliases kept for unmigrated callers — migrate to `space.*`
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// ─── Border Radius ────────────────────────────────────────────────
export const radius = {
  sm: 8,    // compact chips, badges, small inputs
  md: 12,   // standard cards, buttons
  lg: 16,   // large cards, modals, sheets
  xl: 20,   // hero cards, active block widget
  full: 9999,
} as const;

// Legacy alias
export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

// ─── Typography Scale ─────────────────────────────────────────────
// Font: system default (SF Pro on iOS, Roboto on Android)
// Never set fontFamily explicitly — use fontWeight only.
export type TypographyVariant =
  | 'display'
  | 'title1'
  | 'title2'
  | 'title3'
  | 'headline'
  | 'body'
  | 'callout'
  | 'subheadline'
  | 'footnote'
  | 'caption1'
  | 'caption2';

export const typography: Record<
  TypographyVariant,
  { fontSize: number; fontWeight: string; letterSpacing: number; lineHeight: number }
> = {
  display:     { fontSize: 34, fontWeight: '800', letterSpacing: -0.4, lineHeight: 41 },
  title1:      { fontSize: 28, fontWeight: '700', letterSpacing: -0.3, lineHeight: 34 },
  title2:      { fontSize: 22, fontWeight: '700', letterSpacing: -0.2, lineHeight: 28 },
  title3:      { fontSize: 20, fontWeight: '600', letterSpacing: 0,    lineHeight: 25 },
  headline:    { fontSize: 17, fontWeight: '600', letterSpacing: 0,    lineHeight: 22 },
  body:        { fontSize: 17, fontWeight: '400', letterSpacing: 0,    lineHeight: 22 },
  callout:     { fontSize: 16, fontWeight: '400', letterSpacing: 0,    lineHeight: 21 },
  subheadline: { fontSize: 15, fontWeight: '400', letterSpacing: 0,    lineHeight: 20 },
  footnote:    { fontSize: 13, fontWeight: '400', letterSpacing: 0,    lineHeight: 18 },
  caption1:    { fontSize: 12, fontWeight: '400', letterSpacing: 0,    lineHeight: 16 },
  caption2:    { fontSize: 11, fontWeight: '400', letterSpacing: 0.07, lineHeight: 13 },
};

// Legacy fontSize alias
export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 22,
  xxl: 28,
  hero: 48,
};

// ─── Motion / Animation Constants ────────────────────────────────
export const motion = {
  springDefault: { damping: 20, stiffness: 300, mass: 0.8 },
  springSheet:   { damping: 26, stiffness: 400 },
  cardExpand:    200,   // ms, ease-out
  tabSwitch:     150,   // ms, opacity crossfade
  switchboardPill: 150, // ms spring width
  swipeThreshold: 80,   // pt, reveal swipe actions
} as const;

// Legacy timing alias
export const timing = {
  fast: 150,
  normal: 200,
  slow: 220,
};

// ─── Default Pillar Colours ───────────────────────────────────────
// These are DEFAULTS. Runtime values come from userPrefsStore.
// Use getPillarColour() instead of referencing these directly.
export const pillarColors = {
  gym:      '#E53E3E',
  academic: '#3B82F6',
  life:     '#10B981',
  general:  '#4F46E5', // accent (indigo)
} as const;

export const pillarTints = {
  gym:      '#FEE2E2',
  academic: '#DBEAFE',
  life:     '#D1FAE5',
  general:  '#EEF2FF',
} as const;

// ─── Static Legacy Color Export (LIGHT ONLY) ─────────────────────
// Kept for backward compat during migration. Prefer useTheme().
export const colors = {
  ink:           '#000000',
  text:          '#000000',
  muted:         'rgba(60,60,67,0.6)',
  border:        'rgba(0,0,0,0.12)',
  background:    '#FFFFFF',
  accent:        '#4F46E5',
  surface:       '#F2F2F7',
  surfaceBorder: 'rgba(0,0,0,0.12)',
  accentLight:   '#EEF2FF',
  textSecondary: 'rgba(60,60,67,0.6)',
  success:       '#10B981',
  warning:       '#F59E0B',
  danger:        '#EF4444',
  white:         '#FFFFFF',
  indigo:        '#4F46E5',
};
