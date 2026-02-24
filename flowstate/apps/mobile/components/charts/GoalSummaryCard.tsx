/**
 * GoalSummaryCard — neutral "Required Daily Rate" display.
 *
 * No scolding, no praise. Just: "The physics of the situation
 * requires Y per day to get from A to B by Date X."
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

export interface GoalSummaryCardProps {
  label: string;
  unit: string;
  startValue: number;
  targetValue: number;
  currentValue: number | null;
  requiredDailyRate: number;
  actualDailyRate: number;
  adjustedDailyRate: number | null;
  daysRemaining: number;
  daysElapsed: number;
  progressFraction: number;
  isAhead: boolean;
  gapFromLinear: number;
}

export default function GoalSummaryCard({
  label,
  unit,
  startValue,
  targetValue,
  currentValue,
  requiredDailyRate,
  actualDailyRate,
  adjustedDailyRate,
  daysRemaining,
  daysElapsed,
  progressFraction,
  isAhead,
  gapFromLinear,
}: GoalSummaryCardProps) {
  const { themeColors } = useTheme();

  const direction = targetValue > startValue ? '+' : '';
  const formatRate = (rate: number) => `${direction}${rate}${unit ? ` ${unit}` : ''}`;

  // "Buffer" feature: show how yesterday's miss redistributes work
  const showAdjusted = adjustedDailyRate !== null && Math.abs(adjustedDailyRate - requiredDailyRate) > 0.001;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Feather name="target" size={16} color={themeColors.accent} />
          <Text style={[styles.label, { color: themeColors.text }]}>{label}</Text>
        </View>
        <Text style={[styles.daysLeft, { color: themeColors.muted }]}>
          {daysRemaining}d remaining
        </Text>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: themeColors.border }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.round(Math.min(progressFraction, 1) * 100)}%`,
              backgroundColor: isAhead ? themeColors.success : themeColors.accent,
            },
          ]}
        />
      </View>
      <View style={styles.progressLabels}>
        <Text style={[styles.progressValue, { color: themeColors.muted }]}>
          {startValue}{unit ? ` ${unit}` : ''}
        </Text>
        {currentValue !== null && (
          <Text style={[styles.progressCurrent, { color: themeColors.text }]}>
            Now: {currentValue}{unit ? ` ${unit}` : ''}
          </Text>
        )}
        <Text style={[styles.progressValue, { color: themeColors.muted }]}>
          {targetValue}{unit ? ` ${unit}` : ''}
        </Text>
      </View>

      {/* Metrics grid */}
      <View style={styles.metricsRow}>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: themeColors.muted }]}>Required / day</Text>
          <Text style={[styles.metricValue, { color: themeColors.text }]}>
            {formatRate(requiredDailyRate)}
          </Text>
        </View>
        <View style={styles.metric}>
          <Text style={[styles.metricLabel, { color: themeColors.muted }]}>Actual / day</Text>
          <Text style={[styles.metricValue, { color: themeColors.text }]}>
            {formatRate(actualDailyRate)}
          </Text>
        </View>
        {showAdjusted && (
          <View style={styles.metric}>
            <Text style={[styles.metricLabel, { color: themeColors.muted }]}>Adjusted / day</Text>
            <Text style={[styles.metricValue, { color: themeColors.warning }]}>
              {formatRate(adjustedDailyRate!)}
            </Text>
          </View>
        )}
      </View>

      {/* Gap indicator */}
      {currentValue !== null && gapFromLinear !== 0 && (
        <View style={[styles.gapRow, { borderTopColor: themeColors.border }]}>
          <Text style={[styles.gapText, { color: isAhead ? themeColors.success : themeColors.danger }]}>
            {isAhead
              ? `Ahead by ${Math.abs(gapFromLinear)}${unit ? ` ${unit}` : ''}`
              : `Off-track by ${Math.abs(gapFromLinear)}${unit ? ` ${unit}` : ''}`}
          </Text>
        </View>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  daysLeft: {
    fontSize: fontSize.xs,
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.sm,
  },
  progressValue: {
    fontSize: fontSize.xs,
  },
  progressCurrent: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  metricsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  metricValue: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  gapRow: {
    borderTopWidth: 1,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    alignItems: 'center',
  },
  gapText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
