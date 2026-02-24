/**
 * TrendLine – a simple sparkline component for rating / data-input trends.
 * Uses react-native-svg directly to avoid heavy charting deps on web.
 */

import React from 'react';
import { View, Text } from 'react-native';
import Svg, { Polyline, Circle, Line } from 'react-native-svg';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

export interface TrendLineProps {
  label: string;
  points: Array<{ date: string; value: number }>;
  height?: number;
  color?: string;
  average?: number;
  unit?: string;
  trend?: 'up' | 'down' | 'flat';
}

export default function TrendLine({
  label,
  points,
  height = 100,
  color,
  average,
  unit = '',
  trend,
}: TrendLineProps) {
  const { themeColors } = useTheme();
  const lineColor = color ?? themeColors.accent;

  if (points.length === 0) {
    return (
      <View style={{ backgroundColor: themeColors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: themeColors.border, padding: spacing.md, marginBottom: spacing.sm }}>
        <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: themeColors.text }}>{label}</Text>
        <Text style={{ fontSize: fontSize.sm, color: themeColors.muted, textAlign: 'center', padding: spacing.md }}>No data yet</Text>
      </View>
    );
  }

  const width = 260;
  const padX = 16;
  const padY = 12;
  const chartW = width - padX * 2;
  const chartH = height - padY * 2;

  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const coords = points.map((p, i) => ({
    x: padX + (i / Math.max(points.length - 1, 1)) * chartW,
    y: padY + chartH - ((p.value - min) / range) * chartH,
  }));

  const polyline = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const avgY = padY + chartH - (((average ?? 0) - min) / range) * chartH;

  const trendIcon = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';

  return (
    <View style={{ backgroundColor: themeColors.surface, borderRadius: borderRadius.md, borderWidth: 1, borderColor: themeColors.border, padding: spacing.md, marginBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.xs }}>
        <Text style={{ fontSize: fontSize.sm, fontWeight: '600', color: themeColors.text }}>{label}</Text>
        {average !== undefined && (
          <Text style={{ fontSize: fontSize.xs, color: themeColors.muted }}>
            avg {average}
            {unit ? ` ${unit}` : ''} {trendIcon}
          </Text>
        )}
      </View>
      <Svg width={width} height={height}>
        {/* Average line */}
        {average !== undefined && (
          <Line
            x1={padX}
            y1={avgY}
            x2={width - padX}
            y2={avgY}
            stroke={themeColors.border}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
        )}
        {/* Sparkline */}
        <Polyline
          points={polyline}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* End dot */}
        {coords.length > 0 && (
          <Circle
            cx={coords[coords.length - 1].x}
            cy={coords[coords.length - 1].y}
            r={4}
            fill={lineColor}
          />
        )}
      </Svg>
    </View>
  );
}
