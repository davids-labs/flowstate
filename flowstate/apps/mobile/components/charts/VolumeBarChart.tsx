/**
 * VolumeBarChart — simple bar chart showing time or count per period.
 * Uses react-native-svg for lightweight rendering (no heavy charting lib).
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Rect, Text as SvgText, Line } from 'react-native-svg';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

export interface VolumeBarChartProps {
  bars: Array<{ period: string; volume: number }>;
  unit: 'minutes' | 'count';
  label?: string;
  height?: number;
  color?: string;
  groupBy?: 'day' | 'week';
}

export default function VolumeBarChart({
  bars,
  unit,
  label,
  height = 180,
  color,
  groupBy = 'day',
}: VolumeBarChartProps) {
  const { themeColors } = useTheme();
  const barColor = color ?? themeColors.accent;

  if (bars.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        {label && <Text style={[styles.label, { color: themeColors.text }]}>{label}</Text>}
        <Text style={[styles.empty, { color: themeColors.muted }]}>No data yet</Text>
      </View>
    );
  }

  const svgWidth = 300;
  const padL = 40;
  const padR = 10;
  const padT = 10;
  const padB = 28;
  const chartW = svgWidth - padL - padR;
  const chartH = height - padT - padB;

  const maxVol = Math.max(...bars.map((b) => b.volume), 1);
  const barWidth = Math.max(4, Math.min(24, (chartW / bars.length) * 0.7));
  const barGap = (chartW - barWidth * bars.length) / Math.max(bars.length - 1, 1);

  const totalVolume = bars.reduce((s, b) => s + b.volume, 0);
  const unitLabel = unit === 'minutes' ? `${Math.round(totalVolume)}min total` : `${totalVolume} entries total`;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      <View style={styles.header}>
        {label && <Text style={[styles.label, { color: themeColors.text }]}>{label}</Text>}
        <Text style={[styles.subtitle, { color: themeColors.muted }]}>{unitLabel}</Text>
      </View>
      <Svg width={svgWidth} height={height}>
        {/* Y-axis baseline */}
        <Line x1={padL} y1={padT + chartH} x2={svgWidth - padR} y2={padT + chartH} stroke={themeColors.border} strokeWidth={1} />

        {/* Y-axis labels */}
        {[0, 0.5, 1].map((frac) => {
          const y = padT + chartH - frac * chartH;
          const val = Math.round(maxVol * frac);
          return (
            <React.Fragment key={frac}>
              <Line x1={padL} y1={y} x2={svgWidth - padR} y2={y} stroke={themeColors.border} strokeWidth={0.5} strokeDasharray="4,4" />
              <SvgText x={padL - 4} y={y + 4} fontSize={9} fill={themeColors.muted} textAnchor="end">
                {val}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Bars */}
        {bars.map((bar, i) => {
          const barH = (bar.volume / maxVol) * chartH;
          const x = padL + i * (barWidth + barGap);
          const y = padT + chartH - barH;
          // Show abbreviated X label for every Nth bar
          const showLabel = bars.length <= 14 || i % Math.ceil(bars.length / 10) === 0;
          const xLabel = groupBy === 'week' ? bar.period : bar.period.slice(5); // MM-DD

          return (
            <React.Fragment key={i}>
              <Rect x={x} y={y} width={barWidth} height={barH} rx={2} fill={barColor} opacity={0.85} />
              {showLabel && (
                <SvgText x={x + barWidth / 2} y={padT + chartH + 14} fontSize={8} fill={themeColors.muted} textAnchor="middle">
                  {xLabel}
                </SvgText>
              )}
            </React.Fragment>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: fontSize.xs,
  },
  empty: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    padding: spacing.md,
  },
});
