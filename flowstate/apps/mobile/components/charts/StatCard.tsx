/**
 * StatCard – a single numeric stat with label and optional trend.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

export interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  trend?: 'up' | 'down' | 'flat';
  color?: string;
}

export default function StatCard({
  label,
  value,
  subtitle,
  trend,
  color,
}: StatCardProps) {
  const { themeColors } = useTheme();
  const valueColor = color ?? themeColors.accent;
  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : trend === 'flat' ? '→' : null;
  const trendColor = trend === 'up' ? themeColors.success : trend === 'down' ? themeColors.danger : themeColors.muted;

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: themeColors.border, padding: spacing.md, minWidth: 100 }}>
      <Text style={{ fontSize: fontSize.xs, color: themeColors.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: spacing.xs }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <Text style={{ fontSize: fontSize.xl, fontWeight: '700', color: valueColor }}>{value}</Text>
        {trendIcon && (
          <Text style={{ fontSize: fontSize.lg, fontWeight: '600', marginLeft: spacing.xs, color: trendColor }}>{trendIcon}</Text>
        )}
      </View>
      {subtitle && <Text style={{ fontSize: fontSize.xs, color: themeColors.muted, marginTop: spacing.xs }}>{subtitle}</Text>}
    </View>
  );
}
