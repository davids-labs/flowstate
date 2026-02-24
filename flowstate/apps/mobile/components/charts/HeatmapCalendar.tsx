/**
 * HeatmapCalendar – GitHub-style grid of colored squares
 * showing daily completion levels.
 */

import React from 'react';
import { View, Text } from 'react-native';
import { fontSize, spacing } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

export interface HeatmapData {
  date: string;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface HeatmapCalendarProps {
  data: HeatmapData[];
  /** Number of weeks to show (columns) */
  weeks?: number;
}

const CELL = 14;
const GAP = 3;
const DAYS_OF_WEEK = ['M', '', 'W', '', 'F', '', 'S'];

export default function HeatmapCalendar({ data, weeks = 12 }: HeatmapCalendarProps) {
  const { themeColors } = useTheme();

  const LEVEL_COLORS = [
    themeColors.border,        // 0 – no data / quiet
    '#FDE68A',                 // 1 – poor
    '#FCD34D',                 // 2 – partial
    '#A3E635',                 // 3 – good
    themeColors.success,       // 4 – complete
  ];
  // Build lookup
  const map = new Map<string, number>();
  for (const d of data) map.set(d.date, d.level);

  // Determine end date (today) and start
  const today = new Date();
  const endDate = new Date(today);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - weeks * 7);

  // Build grid: columns = weeks, rows = 7 days (Mon-Sun)
  const columns: Array<Array<{ date: string; level: number }>> = [];
  const cur = new Date(startDate);
  // Align to Monday
  cur.setDate(cur.getDate() - ((cur.getDay() + 6) % 7));

  while (cur <= endDate) {
    const col: Array<{ date: string; level: number }> = [];
    for (let d = 0; d < 7; d++) {
      const dateStr = cur.toISOString().slice(0, 10);
      col.push({ date: dateStr, level: map.get(dateStr) ?? 0 });
      cur.setDate(cur.getDate() + 1);
    }
    columns.push(col);
  }

  return (
    <View style={{ paddingVertical: spacing.sm }}>
      {/* Day labels */}
      <View style={{ position: 'absolute', left: 0, top: spacing.sm }}>
        {DAYS_OF_WEEK.map((d, i) => (
          <Text key={i} style={{ height: CELL + GAP, fontSize: 9, color: themeColors.muted, lineHeight: CELL + GAP, width: 16, textAlign: 'right' }}>
            {d}
          </Text>
        ))}
      </View>
      {/* Grid */}
      <View style={{ flexDirection: 'row', marginLeft: 20, gap: GAP }}>
        {columns.map((col, ci) => (
          <View key={ci} style={{ gap: GAP }}>
            {col.map((cell, ri) => (
              <View
                key={ri}
                style={{ width: CELL, height: CELL, borderRadius: 3, backgroundColor: LEVEL_COLORS[cell.level] }}
              />
            ))}
          </View>
        ))}
      </View>
      {/* Legend */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: spacing.sm, gap: 3 }}>
        <Text style={{ fontSize: 9, color: themeColors.muted, marginHorizontal: 4 }}>Less</Text>
        {LEVEL_COLORS.map((c, i) => (
          <View key={i} style={{ width: CELL, height: CELL, borderRadius: 3, backgroundColor: c }} />
        ))}
        <Text style={{ fontSize: 9, color: themeColors.muted, marginHorizontal: 4 }}>More</Text>
      </View>
    </View>
  );
}
