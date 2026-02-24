/**
 * ConsistencyGrid — 365-day "GitHub-style" contribution heatmap.
 * Binary: colored if logged, empty if not. No levels, no scores.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontSize, spacing } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

export interface ConsistencyGridProps {
  /** Array of { date, logged } for 365 days */
  days: Array<{ date: string; logged: boolean }>;
  label?: string;
  totalLogged?: number;
  color?: string;
}

const CELL = 12;
const GAP = 2;
const ROWS = 7;
const DAY_LABELS = ['M', '', 'W', '', 'F', '', ''];

export default function ConsistencyGrid({
  days,
  label,
  totalLogged,
  color,
}: ConsistencyGridProps) {
  const { themeColors } = useTheme();
  const activeColor = color ?? themeColors.accent;

  // Group days into columns of 7 (weeks), starting from the oldest
  const columns: Array<Array<{ date: string; logged: boolean }>> = [];
  for (let i = 0; i < days.length; i += 7) {
    columns.push(days.slice(i, i + 7));
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      <View style={styles.header}>
        {label && <Text style={[styles.label, { color: themeColors.text }]}>{label}</Text>}
        {totalLogged !== undefined && (
          <Text style={[styles.subtitle, { color: themeColors.muted }]}>
            {totalLogged}/365 days
          </Text>
        )}
      </View>

      <View style={styles.gridWrapper}>
        {/* Day labels */}
        <View style={styles.dayLabels}>
          {DAY_LABELS.map((d, i) => (
            <Text
              key={i}
              style={[styles.dayLabel, { color: themeColors.muted, height: CELL + GAP }]}
            >
              {d}
            </Text>
          ))}
        </View>

        {/* Grid */}
        <View style={styles.grid}>
          {columns.map((col, ci) => (
            <View key={ci} style={styles.column}>
              {col.map((cell, ri) => (
                <View
                  key={ri}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: cell.logged ? activeColor : themeColors.border,
                      opacity: cell.logged ? 1 : 0.3,
                    },
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={[styles.legendCell, { backgroundColor: themeColors.border, opacity: 0.3 }]} />
        <Text style={[styles.legendText, { color: themeColors.muted }]}>No entry</Text>
        <View style={[styles.legendCell, { backgroundColor: activeColor }]} />
        <Text style={[styles.legendText, { color: themeColors.muted }]}>Logged</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: fontSize.xs,
  },
  gridWrapper: {
    flexDirection: 'row',
  },
  dayLabels: {
    marginRight: 4,
  },
  dayLabel: {
    fontSize: 8,
    width: 14,
    textAlign: 'right',
    lineHeight: CELL + GAP,
  },
  grid: {
    flexDirection: 'row',
    gap: GAP,
    flexWrap: 'nowrap',
    overflow: 'hidden',
  },
  column: {
    gap: GAP,
  },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 2,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: spacing.sm,
    gap: 4,
  },
  legendCell: {
    width: CELL,
    height: CELL,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 9,
    marginRight: spacing.sm,
  },
});
