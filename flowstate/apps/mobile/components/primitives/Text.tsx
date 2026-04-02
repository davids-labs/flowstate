import React from 'react';
import { Text as RNText, TextStyle, TextProps as RNTextProps } from 'react-native';
import { useTheme } from '../../constants/ThemeContext';
import { typography, TypographyVariant } from '../../constants/theme';
import { useUserPrefsStore } from '../../stores/userPrefsStore';

// ─── AppText — V2 Typography Primitive ───────────────────────────────────────
// Usage:
//   <AppText variant="title1">Hello</AppText>
//   <AppText variant="footnote" color={themeTokens.textSecondary}>Meta</AppText>
//   <AppText variant="caption2" onAccent>Badge text on colour bg</AppText>
//
// Rules:
//   • Never set fontFamily — system font automatically resolves to SF Pro / Roboto.
//   • Always use a variant — no ad-hoc fontSize/fontWeight in components.
//   • Override colour via `color` prop only. Default is textPrimary.
//
// User preferences applied automatically:
//   • fontSizeOffset  — adds ±pt to every variant's fontSize
//   • boldMode        — steps fontWeight up one level (400→600, 600→700, 700→800)
//   • lineHeightScale — 'compact'=0.9×, 'normal'=1×, 'relaxed'=1.2×
// ─────────────────────────────────────────────────────────────────────────────

export interface AppTextProps extends Omit<RNTextProps, 'style'> {
  /** Typography scale variant from §0.2 */
  variant?: TypographyVariant;
  /** Explicit colour override. Defaults to textPrimary. */
  color?: string;
  /** Shortcut: applies textOnAccent (#FFFFFF) for text sitting on a coloured surface. */
  onAccent?: boolean;
  /** Additional style overrides (non-typography). Avoid fontSize/fontWeight here. */
  style?: TextStyle | TextStyle[];
  children?: React.ReactNode;
}

// Step up one notch in the weight ladder
function bumpWeight(w: string): TextStyle['fontWeight'] {
  const ladder = ['100', '200', '300', '400', '500', '600', '700', '800', '900'];
  const idx = ladder.indexOf(w);
  return (idx >= 0 && idx < ladder.length - 1 ? ladder[idx + 1] : w) as TextStyle['fontWeight'];
}

const LINE_HEIGHT_SCALES: Record<'compact' | 'normal' | 'relaxed', number> = {
  compact: 0.9,
  normal:  1.0,
  relaxed: 1.2,
};

export function AppText({
  variant = 'body',
  color,
  onAccent,
  style,
  children,
  ...rest
}: AppTextProps) {
  const { themeTokens } = useTheme();
  const fontSizeOffset  = useUserPrefsStore(s => s.fontSizeOffset);
  const boldMode        = useUserPrefsStore(s => s.boldMode);
  const lineHeightScale = useUserPrefsStore(s => s.lineHeightScale);

  const spec = typography[variant];

  const resolvedColor = onAccent
    ? themeTokens.textOnAccent
    : color ?? themeTokens.textPrimary;

  const resolvedFontSize   = spec.fontSize + fontSizeOffset;
  const resolvedFontWeight = boldMode
    ? bumpWeight(spec.fontWeight)
    : (spec.fontWeight as TextStyle['fontWeight']);
  const resolvedLineHeight = Math.round(spec.lineHeight * LINE_HEIGHT_SCALES[lineHeightScale]);

  const baseStyle: TextStyle = {
    fontSize:      resolvedFontSize,
    fontWeight:    resolvedFontWeight,
    letterSpacing: spec.letterSpacing,
    lineHeight:    resolvedLineHeight,
    color:         resolvedColor,
  };

  const flatStyle = Array.isArray(style)
    ? [baseStyle, ...style]
    : style
    ? [baseStyle, style]
    : baseStyle;

  return (
    <RNText style={flatStyle} allowFontScaling={false} {...rest}>
      {children}
    </RNText>
  );
}

// Convenience re-export so callers can do: import { AppText } from '@/components/primitives/Text'
export default AppText;
