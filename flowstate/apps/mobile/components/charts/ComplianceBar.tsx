/**
 * ComplianceBar – horizontal bar showing % compliance for a single habit.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

export interface ComplianceBarProps {
  label: string;
  rate: number; // 0..1
  completed: number;
  total: number;
  color?: string;
}

export default function ComplianceBar({
  label,
  rate,
  completed,
  total,
  color,
}: ComplianceBarProps) {
  const { themeColors } = useTheme();
  const barColor = color ?? themeColors.accent;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm }}>
      <View style={{ width: 100, marginRight: spacing.sm }}>
        <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: themeColors.text }} numberOfLines={1}>
          {label}
        </Text>
        <Text style={{ fontSize: fontSize.xs, color: themeColors.muted }}>
          {completed}/{total} days
        </Text>
      </View>
      <View style={{ flex: 1, height: 8, backgroundColor: themeColors.border, borderRadius: borderRadius.sm, overflow: 'hidden' }}>
        <View
          style={{
            height: '100%',
            borderRadius: borderRadius.sm,
            width: `${Math.round(rate * 100)}%`,
            backgroundColor: rate >= 0.8 ? themeColors.success : rate >= 0.5 ? barColor : themeColors.warning,
          }}
        />
      </View>
      <Text style={{ width: 40, textAlign: 'right', fontSize: fontSize.sm, fontWeight: '600', color: themeColors.text, marginLeft: spacing.sm }}>
        {Math.round(rate * 100)}%
      </Text>
    </View>
  );
}
