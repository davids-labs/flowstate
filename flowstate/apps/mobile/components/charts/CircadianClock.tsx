/**
 * CircadianClock — 24-hour density visualization.
 *
 * Shows when you actually do things, mapped to a radial clock.
 * No "productivity" claims — just a heat map of your day.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Text as SvgText, G } from 'react-native-svg';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

export interface CircadianClockProps {
  /** 24 buckets, one per hour */
  buckets: Array<{ hour: number; count: number; totalMinutes: number }>;
  label?: string;
  peakHour?: number;
  totalSessions?: number;
  size?: number;
}

export default function CircadianClock({
  buckets,
  label,
  peakHour,
  totalSessions,
  size = 220,
}: CircadianClockProps) {
  const { themeColors } = useTheme();
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 20;
  const innerR = outerR * 0.35;

  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  // Draw arcs for each hour
  const hourArcs = buckets.map((b) => {
    const intensity = b.count / maxCount;
    const barR = innerR + (outerR - innerR) * intensity;
    const startAngle = (b.hour / 24) * 360 - 90; // 0h at top
    const endAngle = ((b.hour + 1) / 24) * 360 - 90;
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;

    // Arc path (outer)
    const x1 = cx + barR * Math.cos(startRad);
    const y1 = cy + barR * Math.sin(startRad);
    const x2 = cx + barR * Math.cos(endRad);
    const y2 = cy + barR * Math.sin(endRad);

    // Inner arc
    const ix1 = cx + innerR * Math.cos(startRad);
    const iy1 = cy + innerR * Math.sin(startRad);
    const ix2 = cx + innerR * Math.cos(endRad);
    const iy2 = cy + innerR * Math.sin(endRad);

    const largeArc = 0; // each segment is < 180°

    const d = [
      `M ${ix1} ${iy1}`,
      `L ${x1} ${y1}`,
      `A ${barR} ${barR} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix2} ${iy2}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1}`,
      'Z',
    ].join(' ');

    return { d, intensity, hour: b.hour, count: b.count };
  });

  // Hour labels (every 3 hours)
  const hourLabels = [0, 3, 6, 9, 12, 15, 18, 21];

  const formatHour = (h: number) => {
    if (h === 0) return '12a';
    if (h < 12) return `${h}a`;
    if (h === 12) return '12p';
    return `${h - 12}p`;
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      <View style={styles.header}>
        {label && <Text style={[styles.label, { color: themeColors.text }]}>{label}</Text>}
        {totalSessions !== undefined && (
          <Text style={[styles.subtitle, { color: themeColors.muted }]}>
            {totalSessions} sessions
          </Text>
        )}
      </View>

      <View style={styles.clockWrapper}>
        <Svg width={size} height={size}>
          {/* Background ring */}
          <Circle cx={cx} cy={cy} r={outerR} fill="none" stroke={themeColors.border} strokeWidth={1} />
          <Circle cx={cx} cy={cy} r={innerR} fill="none" stroke={themeColors.border} strokeWidth={0.5} />

          {/* Hour arcs */}
          {hourArcs.map((arc) => (
            <Path
              key={arc.hour}
              d={arc.d}
              fill={themeColors.accent}
              opacity={arc.intensity > 0 ? 0.2 + arc.intensity * 0.7 : 0.05}
            />
          ))}

          {/* Hour labels */}
          {hourLabels.map((h) => {
            const angle = (h / 24) * 360 - 90;
            const rad = (angle * Math.PI) / 180;
            const lx = cx + (outerR + 12) * Math.cos(rad);
            const ly = cy + (outerR + 12) * Math.sin(rad);
            return (
              <SvgText
                key={h}
                x={lx}
                y={ly + 3}
                fontSize={9}
                fill={themeColors.muted}
                textAnchor="middle"
              >
                {formatHour(h)}
              </SvgText>
            );
          })}
        </Svg>
      </View>

      {peakHour !== undefined && (
        <Text style={[styles.peakText, { color: themeColors.muted }]}>
          Most active: {formatHour(peakHour)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: spacing.xs,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: fontSize.xs,
  },
  clockWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  peakText: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
  },
});
