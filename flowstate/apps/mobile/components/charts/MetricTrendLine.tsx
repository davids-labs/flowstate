/**
 * MetricTrendLine — raw value line graph with "Data Peeking"
 * and optional goal "Ghost Line" overlay.
 *
 * Tap any point to see the exact value, date, and timestamp.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Svg, { Polyline, Circle, Line, Text as SvgText, G } from 'react-native-svg';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

export interface DataPoint {
  date: string;
  value: number;
  loggedAt?: string;
}

export interface MetricTrendLineProps {
  label: string;
  points: DataPoint[];
  unit?: string;
  height?: number;
  color?: string;
  /** Goal "ghost line" — dotted overlay from startValue to targetValue */
  targetPath?: Array<{ date: string; value: number }>;
  /** Gap from linear target (positive = ahead, negative = behind) */
  gapFromTarget?: number;
}

export default function MetricTrendLine({
  label,
  points,
  unit = '',
  height = 160,
  color,
  targetPath,
  gapFromTarget,
}: MetricTrendLineProps) {
  const { themeColors } = useTheme();
  const lineColor = color ?? themeColors.accent;
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  if (points.length === 0) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Text style={[styles.label, { color: themeColors.text }]}>{label}</Text>
        <Text style={[styles.empty, { color: themeColors.muted }]}>No data yet</Text>
      </View>
    );
  }

  const svgWidth = 300;
  const padX = 40;
  const padY = 16;
  const chartW = svgWidth - padX * 2 + 20;
  const chartH = height - padY * 2 - 10;

  // Combine actual + target to get full value range
  const allValues = [
    ...points.map((p) => p.value),
    ...(targetPath ?? []).map((p) => p.value),
  ];
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;

  const toX = (i: number, total: number) => padX + (i / Math.max(total - 1, 1)) * chartW;
  const toY = (v: number) => padY + chartH - ((v - minVal) / range) * chartH;

  // Actual data coords
  const actualCoords = points.map((p, i) => ({
    x: toX(i, points.length),
    y: toY(p.value),
  }));
  const actualPolyline = actualCoords.map((c) => `${c.x},${c.y}`).join(' ');

  // Target path coords (ghost line)
  let targetPolyline = '';
  if (targetPath && targetPath.length > 0) {
    // Map target dates to the same x-axis range as our data
    const dateSet = new Map<string, number>();
    points.forEach((p, i) => dateSet.set(p.date, i));

    const targetCoords = targetPath
      .filter((tp) => dateSet.has(tp.date))
      .map((tp) => ({
        x: toX(dateSet.get(tp.date)!, points.length),
        y: toY(tp.value),
      }));

    if (targetCoords.length > 1) {
      targetPolyline = targetCoords.map((c) => `${c.x},${c.y}`).join(' ');
    }
  }

  // Y-axis labels
  const yTicks = [minVal, minVal + range / 2, maxVal];

  // Gap badge
  let gapText = '';
  if (gapFromTarget !== undefined && gapFromTarget !== 0) {
    const sign = gapFromTarget > 0 ? '+' : '';
    gapText = `${sign}${gapFromTarget}${unit ? ` ${unit}` : ''}`;
  }

  const selectedPoint = selectedIdx !== null ? points[selectedIdx] : null;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      <View style={styles.header}>
        <Text style={[styles.label, { color: themeColors.text }]}>{label}</Text>
        {gapText !== '' && (
          <Text
            style={[
              styles.gapBadge,
              {
                color: (gapFromTarget ?? 0) >= 0 ? themeColors.success : themeColors.danger,
              },
            ]}
          >
            {gapText}
          </Text>
        )}
      </View>

      {/* Data Peek tooltip */}
      {selectedPoint && (
        <View style={[styles.tooltip, { backgroundColor: themeColors.ink }]}>
          <Text style={styles.tooltipText}>
            {selectedPoint.date} · {selectedPoint.value}
            {unit ? ` ${unit}` : ''}
          </Text>
          {selectedPoint.loggedAt && (
            <Text style={styles.tooltipSub}>
              Logged {new Date(selectedPoint.loggedAt).toLocaleTimeString()}
            </Text>
          )}
        </View>
      )}

      <Pressable onPress={() => setSelectedIdx(null)}>
        <Svg width={svgWidth} height={height}>
          {/* Y-axis ticks */}
          {yTicks.map((v, i) => {
            const y = toY(v);
            return (
              <React.Fragment key={i}>
                <Line x1={padX - 4} y1={y} x2={padX + chartW} y2={y} stroke={themeColors.border} strokeWidth={0.5} strokeDasharray="3,3" />
                <SvgText x={padX - 8} y={y + 3} fontSize={9} fill={themeColors.muted} textAnchor="end">
                  {Math.round(v * 10) / 10}
                </SvgText>
              </React.Fragment>
            );
          })}

          {/* Ghost line (target path) */}
          {targetPolyline !== '' && (
            <Polyline
              points={targetPolyline}
              fill="none"
              stroke={themeColors.muted}
              strokeWidth={1.5}
              strokeDasharray="6,4"
              opacity={0.6}
            />
          )}

          {/* Actual line */}
          <Polyline
            points={actualPolyline}
            fill="none"
            stroke={lineColor}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points (tappable) */}
          {actualCoords.map((c, i) => (
            <Circle
              key={i}
              cx={c.x}
              cy={c.y}
              r={selectedIdx === i ? 6 : 3}
              fill={selectedIdx === i ? lineColor : 'transparent'}
              stroke={lineColor}
              strokeWidth={selectedIdx === i ? 2 : 1.5}
              onPress={() => setSelectedIdx(i)}
            />
          ))}

          {/* X-axis labels */}
          {points.length <= 14
            ? points.map((p, i) => (
                <SvgText key={i} x={actualCoords[i].x} y={height - 4} fontSize={8} fill={themeColors.muted} textAnchor="middle">
                  {p.date.slice(5)}
                </SvgText>
              ))
            : [0, Math.floor(points.length / 2), points.length - 1].map((i) => (
                <SvgText key={i} x={actualCoords[i].x} y={height - 4} fontSize={8} fill={themeColors.muted} textAnchor="middle">
                  {points[i].date.slice(5)}
                </SvgText>
              ))}
        </Svg>
      </Pressable>
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
  gapBadge: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  empty: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    padding: spacing.md,
  },
  tooltip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.xs,
  },
  tooltipText: {
    color: '#fff',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  tooltipSub: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: fontSize.xs,
  },
});
