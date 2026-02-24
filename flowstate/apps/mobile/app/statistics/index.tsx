/**
 * Statistics Screen — the "Data Mirror" hub.
 *
 * Six visualisation panels for a single selected module:
 * 1. Total Volume (bar chart)
 * 2. Metric Trend (line graph with data peeking + goal ghost line)
 * 3. Consistency Grid (365-day heatmap)
 * 4. Circadian Distribution (24h clock)
 * 5. Photo Stream (link to gallery)
 * 6. Searchable Ledger (raw table)
 *
 * Plus Goal Summary when a goal is set.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { SectionHeader } from '../../components/layout/SectionHeader';
import VolumeBarChart from '../../components/charts/VolumeBarChart';
import MetricTrendLine from '../../components/charts/MetricTrendLine';
import ConsistencyGrid from '../../components/charts/ConsistencyGrid';
import CircadianClock from '../../components/charts/CircadianClock';
import RawLedger from '../../components/charts/RawLedger';
import GoalSummaryCard from '../../components/charts/GoalSummaryCard';
import {
  getModuleSpecs,
  getModuleVolume,
  getMetricTrend,
  getConsistencyGrid,
  getCircadianDistribution,
  getRawLedger,
  getGoalsForModule,
  calculateGoalMetrics,
} from '@flowstate/core';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

import type { GoalMetrics, VolumeData, MetricTrendData, ConsistencyData, CircadianData, LedgerPage } from '@flowstate/core';

interface ModuleOption {
  id: string;
  label: string;
  emoji?: string | null;
  type: string;
}

type TimeRange = '7d' | '30d' | '90d' | '365d';

function getDateRange(range: TimeRange): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  switch (range) {
    case '7d': start.setDate(start.getDate() - 7); break;
    case '30d': start.setDate(start.getDate() - 30); break;
    case '90d': start.setDate(start.getDate() - 90); break;
    case '365d': start.setDate(start.getDate() - 365); break;
  }
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

export default function StatisticsScreen() {
  const { db, isReady } = useDatabaseSafe();
  const { themeColors } = useTheme();
  const router = useRouter();

  const [modules, setModules] = useState<ModuleOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');

  // Data state
  const [volumeData, setVolumeData] = useState<VolumeData | null>(null);
  const [trendData, setTrendData] = useState<MetricTrendData | null>(null);
  const [consistencyData, setConsistencyData] = useState<ConsistencyData | null>(null);
  const [circadianData, setCircadianData] = useState<CircadianData | null>(null);
  const [ledgerData, setLedgerData] = useState<LedgerPage | null>(null);
  const [goalMetrics, setGoalMetrics] = useState<GoalMetrics | null>(null);
  const [ledgerPage, setLedgerPage] = useState(1);

  // Load module list
  useFocusEffect(
    useCallback(() => {
      if (!db || !isReady) return;
      getModuleSpecs(db).then((specs: any[]) => {
        setModules(
          specs
            .filter((s) => !s.archivedAt)
            .map((s) => ({ id: s.id, label: s.label, emoji: s.emoji, type: s.type })),
        );
      });
    }, [db, isReady]),
  );

  // Load data when module or time range changes
  useFocusEffect(
    useCallback(() => {
      if (!db || !isReady || !selectedId) return;

      const { start, end } = getDateRange(timeRange);
      const groupBy = timeRange === '7d' || timeRange === '30d' ? 'day' : 'week';

      // Parallel data fetch
      Promise.all([
        getModuleVolume(db, selectedId, start, end, groupBy),
        getMetricTrend(db, selectedId, start, end),
        getConsistencyGrid(db, selectedId),
        getCircadianDistribution(db, start, end, selectedId),
        getRawLedger(db, selectedId, { page: 1, pageSize: 50, startDate: start, endDate: end }),
        loadGoalMetrics(db, selectedId),
      ]).then(([vol, trend, consistency, circadian, ledger, goal]) => {
        setVolumeData(vol);
        setTrendData(trend);
        setConsistencyData(consistency);
        setCircadianData(circadian);
        setLedgerData(ledger);
        setGoalMetrics(goal);
        setLedgerPage(1);
      }).catch(console.error);
    }, [db, isReady, selectedId, timeRange]),
  );

  async function loadGoalMetrics(database: any, moduleId: string): Promise<GoalMetrics | null> {
    const goals = await getGoalsForModule(database, moduleId);
    if (goals.length === 0) return null;
    // Use the most recent goal
    const sorted = [...goals].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return calculateGoalMetrics(database, sorted[0].id);
  }

  const handleLoadMoreLedger = useCallback(async () => {
    if (!db || !selectedId || !ledgerData?.hasMore) return;
    const { start, end } = getDateRange(timeRange);
    const nextPage = ledgerPage + 1;
    const more = await getRawLedger(db, selectedId, { page: nextPage, pageSize: 50, startDate: start, endDate: end });
    setLedgerData({
      ...more,
      entries: [...(ledgerData?.entries ?? []), ...more.entries],
    });
    setLedgerPage(nextPage);
  }, [db, selectedId, ledgerData, ledgerPage, timeRange]);

  const handleLedgerSearch = useCallback(
    async (query: string) => {
      if (!db || !selectedId) return;
      const { start, end } = getDateRange(timeRange);
      const results = await getRawLedger(db, selectedId, {
        page: 1,
        pageSize: 50,
        search: query || undefined,
        startDate: start,
        endDate: end,
      });
      setLedgerData(results);
      setLedgerPage(1);
    },
    [db, selectedId, timeRange],
  );

  const TIME_RANGES: { key: TimeRange; label: string }[] = [
    { key: '7d', label: '7D' },
    { key: '30d', label: '30D' },
    { key: '90d', label: '90D' },
    { key: '365d', label: '1Y' },
  ];

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <SectionHeader title="Statistics" subtitle="Data Mirror" />

        {/* Module selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.modulePicker}
          contentContainerStyle={styles.modulePickerContent}
        >
          {modules.map((m) => (
            <Pressable
              key={m.id}
              style={[
                styles.moduleChip,
                {
                  backgroundColor: selectedId === m.id ? themeColors.accent : themeColors.surface,
                  borderColor: themeColors.surfaceBorder,
                },
              ]}
              onPress={() => setSelectedId(m.id)}
            >
              <Text
                style={[
                  styles.moduleChipText,
                  { color: selectedId === m.id ? themeColors.white : themeColors.text },
                ]}
                numberOfLines={1}
              >
                {m.emoji ? `${m.emoji} ` : ''}{m.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {!selectedId && (
          <View style={styles.placeholder}>
            <Feather name="bar-chart-2" size={40} color={themeColors.muted} />
            <Text style={[styles.placeholderText, { color: themeColors.text }]}>
              Select a module to view its data
            </Text>
          </View>
        )}

        {selectedId && (
          <>
            {/* Time range selector */}
            <View style={styles.timeRow}>
              {TIME_RANGES.map((r) => (
                <Pressable
                  key={r.key}
                  style={[
                    styles.timeChip,
                    {
                      backgroundColor: timeRange === r.key ? themeColors.accent : themeColors.surface,
                      borderColor: themeColors.surfaceBorder,
                    },
                  ]}
                  onPress={() => setTimeRange(r.key)}
                >
                  <Text
                    style={[
                      styles.timeChipText,
                      { color: timeRange === r.key ? themeColors.white : themeColors.text },
                    ]}
                  >
                    {r.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Goal Summary (if active) */}
            {goalMetrics && (
              <GoalSummaryCard
                label={goalMetrics.label}
                unit={goalMetrics.unit}
                startValue={goalMetrics.startValue}
                targetValue={goalMetrics.targetValue}
                currentValue={goalMetrics.currentValue}
                requiredDailyRate={goalMetrics.requiredDailyRate}
                actualDailyRate={goalMetrics.actualDailyRate}
                adjustedDailyRate={goalMetrics.adjustedDailyRate}
                daysRemaining={goalMetrics.daysRemaining}
                daysElapsed={goalMetrics.daysElapsed}
                progressFraction={goalMetrics.progressFraction}
                isAhead={goalMetrics.isAhead}
                gapFromLinear={goalMetrics.gapFromLinear}
              />
            )}

            {/* 1. Volume Bar Chart */}
            {volumeData && (
              <VolumeBarChart
                bars={volumeData.bars}
                unit={volumeData.unit}
                label={`${volumeData.label} — Volume`}
                groupBy={timeRange === '7d' || timeRange === '30d' ? 'day' : 'week'}
              />
            )}

            {/* 2. Metric Trend Line */}
            {trendData && trendData.points.length > 0 && (
              <MetricTrendLine
                label={`${trendData.label} — Trend`}
                points={trendData.points}
                unit={trendData.unit}
                targetPath={goalMetrics?.targetPath}
                gapFromTarget={goalMetrics?.gapFromLinear}
              />
            )}

            {/* 3. Consistency Grid */}
            {consistencyData && (
              <ConsistencyGrid
                days={consistencyData.days}
                label={`${consistencyData.label} — Consistency`}
                totalLogged={consistencyData.totalLogged}
              />
            )}

            {/* 4. Circadian Distribution */}
            {circadianData && circadianData.totalSessions > 0 && (
              <CircadianClock
                buckets={circadianData.buckets}
                label={`${circadianData.label} — When`}
                peakHour={circadianData.peakHour}
                totalSessions={circadianData.totalSessions}
              />
            )}

            {/* 5. Photo Stream link */}
            <Pressable
              style={[styles.linkCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}
              onPress={() => router.push('/gallery')}
            >
              <Feather name="image" size={18} color={themeColors.accent} />
              <Text style={[styles.linkText, { color: themeColors.text }]}>Photo Stream</Text>
              <Feather name="chevron-right" size={18} color={themeColors.muted} />
            </Pressable>

            {/* 6. Searchable Ledger */}
            {ledgerData && (
              <RawLedger
                entries={ledgerData.entries}
                label={`${trendData?.label ?? 'Module'} — Raw Log`}
                unit={trendData?.unit}
                hasMore={ledgerData.hasMore}
                onLoadMore={handleLoadMoreLedger}
                onSearch={handleLedgerSearch}
              />
            )}

            <View style={styles.bottomSpacer} />
          </>
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  modulePicker: {
    marginBottom: spacing.sm,
  },
  modulePickerContent: {
    gap: spacing.xs,
    paddingRight: spacing.md,
  },
  moduleChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    borderWidth: 1,
  },
  moduleChipText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  timeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  timeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  timeChipText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  placeholder: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  placeholderText: {
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  linkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  linkText: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  bottomSpacer: {
    height: spacing.xxl,
  },
});
