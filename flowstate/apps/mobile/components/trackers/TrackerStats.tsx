import React, { useEffect, useMemo, useState } from 'react';
import { Image, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import {
  getTracker,
  getTrackerComparison,
  getTrackerEntries,
  getTrackerSeries,
  getTrackerSummary,
  getTrackers,
  type TrackerComparisonPoint,
  type TrackerSeriesPoint,
  type TrackerSpec,
  type TrackerSummary,
} from '@flowstate/core';
import { useDatabaseSafe } from '../DatabaseProvider';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';
import { AppText } from '../primitives/Text';

type RangeKey = '30d' | '90d' | '365d';

function getRangeStart(range: RangeKey): string {
  const date = new Date();
  if (range === '30d') date.setDate(date.getDate() - 29);
  if (range === '90d') date.setDate(date.getDate() - 89);
  if (range === '365d') date.setDate(date.getDate() - 364);
  return date.toISOString().slice(0, 10);
}

function formatDate(date: string | null | undefined): string {
  if (!date) return 'None';
  if (date.includes('-W')) return date;
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function renderHistoryValue(entry: any): string {
  if (Array.isArray(entry?.value)) return `${entry.value.length} photos`;
  if (typeof entry?.value === 'boolean') return entry.value ? 'Done' : 'Open';
  if (entry?.value == null) return 'No value';
  return String(entry.value);
}

function normalizeComparisonToSeries(points: TrackerComparisonPoint[], key: 'leftValue' | 'rightValue'): TrackerSeriesPoint[] {
  return points
    .filter((point) => typeof point[key] === 'number')
    .map((point) => ({ date: point.date, value: Number(point[key] ?? 0) }));
}

function SeriesChart({
  left,
  right,
  leftColor,
  rightColor,
}: {
  left: TrackerSeriesPoint[];
  right?: TrackerSeriesPoint[];
  leftColor: string;
  rightColor: string;
}) {
  const { width } = useWindowDimensions();
  const chartWidth = Math.max(220, width - space[32] - space[32]);
  const chartHeight = 180;
  const padding = 20;
  const allValues = [...left.map((point) => point.value), ...(right ?? []).map((point) => point.value)];

  if (left.length === 0 || allValues.length === 0) {
    return null;
  }

  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const spread = Math.max(1, maxValue - minValue);
  const project = (points: TrackerSeriesPoint[]) =>
    points
      .map((point, index) => {
        const x =
          points.length === 1
            ? chartWidth / 2
            : padding + (index / Math.max(1, points.length - 1)) * (chartWidth - padding * 2);
        const y = chartHeight - padding - ((point.value - minValue) / spread) * (chartHeight - padding * 2);
        return `${x},${y}`;
      })
      .join(' ');

  return (
    <View style={styles.chartWrap}>
      <Svg width={chartWidth} height={chartHeight}>
        <Line x1={padding} y1={chartHeight - padding} x2={chartWidth - padding} y2={chartHeight - padding} stroke="rgba(127,127,127,0.25)" strokeWidth="1" />
        <Line x1={padding} y1={padding} x2={padding} y2={chartHeight - padding} stroke="rgba(127,127,127,0.25)" strokeWidth="1" />
        <Polyline fill="none" stroke={leftColor} strokeWidth="3" points={project(left)} />
        {right && right.length > 0 ? <Polyline fill="none" stroke={rightColor} strokeWidth="3" points={project(right)} /> : null}
        {left.map((point, index) => {
          const x =
            left.length === 1
              ? chartWidth / 2
              : padding + (index / Math.max(1, left.length - 1)) * (chartWidth - padding * 2);
          const y = chartHeight - padding - ((point.value - minValue) / spread) * (chartHeight - padding * 2);
          return <Circle key={`left-${point.date}`} cx={x} cy={y} r="3" fill={leftColor} />;
        })}
        {(right ?? []).map((point, index) => {
          const x =
            (right ?? []).length === 1
              ? chartWidth / 2
              : padding + (index / Math.max(1, (right ?? []).length - 1)) * (chartWidth - padding * 2);
          const y = chartHeight - padding - ((point.value - minValue) / spread) * (chartHeight - padding * 2);
          return <Circle key={`right-${point.date}`} cx={x} cy={y} r="3" fill={rightColor} />;
        })}
      </Svg>
    </View>
  );
}

export function TrackerStats({ trackerId }: { trackerId: string }) {
  const { db } = useDatabaseSafe();
  const { themeTokens } = useTheme();
  const [tracker, setTracker] = useState<TrackerSpec | null>(null);
  const [summary, setSummary] = useState<TrackerSummary | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [series, setSeries] = useState<TrackerSeriesPoint[]>([]);
  const [allTrackers, setAllTrackers] = useState<TrackerSpec[]>([]);
  const [comparisonTrackerId, setComparisonTrackerId] = useState<string | null>(null);
  const [comparison, setComparison] = useState<TrackerComparisonPoint[]>([]);
  const [range, setRange] = useState<RangeKey>('30d');

  useEffect(() => {
    if (!db || !trackerId) return;
    let mounted = true;

    (async () => {
      const startDate = getRangeStart(range);
      const [nextTracker, nextSummary, nextHistory, nextSeries, nextTrackers] = await Promise.all([
        getTracker(db, trackerId),
        getTrackerSummary(db, trackerId),
        getTrackerEntries(db, trackerId, { limit: 12 }),
        getTrackerSeries(db, trackerId, { startDate, groupBy: range === '365d' ? 'week' : 'day' }),
        getTrackers(db, { includeArchived: false }),
      ]);

      if (!mounted) return;
      setTracker(nextTracker);
      setSummary(nextSummary);
      setHistory(nextHistory);
      setSeries(nextSeries);
      setAllTrackers(nextTrackers);
    })().catch((error) => console.error('Failed to load tracker stats', error));

    return () => {
      mounted = false;
    };
  }, [db, trackerId, range]);

  useEffect(() => {
    if (!db || !trackerId || !comparisonTrackerId) {
      setComparison([]);
      return;
    }
    let mounted = true;
    (async () => {
      const startDate = getRangeStart(range);
      const points = await getTrackerComparison(db, trackerId, comparisonTrackerId, {
        startDate,
        groupBy: range === '365d' ? 'week' : 'day',
      });
      if (mounted) setComparison(points);
    })().catch((error) => console.error('Failed to load tracker comparison', error));
    return () => {
      mounted = false;
    };
  }, [db, trackerId, comparisonTrackerId, range]);

  const comparisonOptions = useMemo(
    () =>
      allTrackers.filter((candidate) => candidate.id !== trackerId).slice(0, 10),
    [allTrackers, trackerId],
  );

  const comparisonTracker = useMemo(
    () => allTrackers.find((candidate) => candidate.id === comparisonTrackerId) ?? null,
    [allTrackers, comparisonTrackerId],
  );

  return (
    <View style={styles.container}>
      <View style={styles.rangeRow}>
        {(['30d', '90d', '365d'] as RangeKey[]).map((option) => (
          <Pressable
            key={option}
            style={[
              styles.rangeChip,
              {
                backgroundColor: range === option ? themeTokens.accentTint : themeTokens.surface,
                borderColor: range === option ? themeTokens.accent : themeTokens.border,
              },
            ]}
            onPress={() => setRange(option)}
          >
            <AppText variant="caption1" color={range === option ? themeTokens.accent : themeTokens.textSecondary}>
              {option.toUpperCase()}
            </AppText>
          </Pressable>
        ))}
      </View>

      <View style={styles.summaryGrid}>
        <View style={[styles.metricCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
          <AppText variant="caption1" color={themeTokens.textSecondary}>Current</AppText>
          <AppText variant="headline" style={{ fontWeight: '700' }}>{summary?.currentDisplay ?? '...'}</AppText>
        </View>
        <View style={[styles.metricCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
          <AppText variant="caption1" color={themeTokens.textSecondary}>Last Logged</AppText>
          <AppText variant="headline" style={{ fontWeight: '700' }}>{formatDate(summary?.lastLoggedDate)}</AppText>
        </View>
        <View style={[styles.metricCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
          <AppText variant="caption1" color={themeTokens.textSecondary}>Best</AppText>
          <AppText variant="headline" style={{ fontWeight: '700' }}>{summary?.bestValue ?? '—'}</AppText>
        </View>
        <View style={[styles.metricCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
          <AppText variant="caption1" color={themeTokens.textSecondary}>Reminder</AppText>
          <AppText variant="headline" style={{ fontWeight: '700' }}>{summary?.nextReminderAt ? formatDate(summary.nextReminderAt.slice(0, 10)) : 'None'}</AppText>
        </View>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
        <View style={styles.sectionHeader}>
          <View style={{ flex: 1, gap: space[4] }}>
            <AppText variant="headline" style={{ fontWeight: '700' }}>Overlay</AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              Compare this tracker with another on the same time axis.
            </AppText>
          </View>
        </View>
        <View style={styles.compareRow}>
          <Pressable
            style={[
              styles.compareChip,
              {
                backgroundColor: comparisonTrackerId ? themeTokens.surface : themeTokens.accentTint,
                borderColor: comparisonTrackerId ? themeTokens.border : themeTokens.accent,
              },
            ]}
            onPress={() => setComparisonTrackerId(null)}
          >
            <AppText variant="caption1" color={comparisonTrackerId ? themeTokens.textSecondary : themeTokens.accent}>
              Single
            </AppText>
          </Pressable>
          {comparisonOptions.map((option) => (
            <Pressable
              key={option.id}
              style={[
                styles.compareChip,
                {
                  backgroundColor: comparisonTrackerId === option.id ? themeTokens.accentTint : themeTokens.surface,
                  borderColor: comparisonTrackerId === option.id ? themeTokens.accent : themeTokens.border,
                },
              ]}
              onPress={() => setComparisonTrackerId(option.id)}
            >
              <AppText variant="caption1" color={comparisonTrackerId === option.id ? themeTokens.accent : themeTokens.textSecondary}>
                {option.label}
              </AppText>
            </Pressable>
          ))}
        </View>
        <SeriesChart
          left={comparisonTrackerId ? normalizeComparisonToSeries(comparison, 'leftValue') : series}
          right={comparisonTrackerId ? normalizeComparisonToSeries(comparison, 'rightValue') : undefined}
          leftColor={themeTokens.accent}
          rightColor={themeTokens.success}
        />
        <View style={styles.legendRow}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: themeTokens.accent }]} />
            <AppText variant="caption1" color={themeTokens.textSecondary}>{tracker?.label ?? 'Tracker'}</AppText>
          </View>
          {comparisonTracker ? (
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: themeTokens.success }]} />
              <AppText variant="caption1" color={themeTokens.textSecondary}>{comparisonTracker.label}</AppText>
            </View>
          ) : null}
        </View>
      </View>

      <View style={[styles.sectionCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
        <AppText variant="headline" style={{ fontWeight: '700' }}>Recent history</AppText>
        <View style={styles.historyList}>
          {history.length === 0 ? (
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              No saved entries yet.
            </AppText>
          ) : (
            history.map((entry) => (
              <View key={entry.id} style={[styles.historyRow, { borderTopColor: themeTokens.border }]}>
                <View style={{ flex: 1, gap: space[4] }}>
                  <AppText variant="subheadline" style={{ fontWeight: '600' }}>
                    {renderHistoryValue(entry)}
                  </AppText>
                  <AppText variant="caption1" color={themeTokens.textSecondary}>
                    {formatDate(entry.date)}
                  </AppText>
                </View>
                {Array.isArray(entry.value) ? (
                  <View style={styles.historyPhotos}>
                    {entry.value.slice(0, 3).map((photo: any) => (
                      <Image key={photo.uri ?? photo} source={{ uri: photo.uri ?? photo }} style={styles.historyPhoto} />
                    ))}
                  </View>
                ) : null}
              </View>
            ))
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space[16],
  },
  rangeRow: {
    flexDirection: 'row',
    gap: space[8],
  },
  rangeChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[8],
  },
  metricCard: {
    flexBasis: '48%',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space[12],
    gap: space[4],
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[16],
    gap: space[12],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[12],
  },
  compareRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[8],
  },
  compareChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
  },
  chartWrap: {
    alignItems: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[12],
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  historyList: {
    gap: space[8],
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    paddingTop: space[12],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  historyPhotos: {
    flexDirection: 'row',
    gap: space[4],
  },
  historyPhoto: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
  },
});
