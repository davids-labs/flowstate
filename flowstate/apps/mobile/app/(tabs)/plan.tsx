import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, Pressable, StyleSheet, FlatList, SafeAreaView, type ListRenderItemInfo } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { getActivePlan, getDayPlansInRange, getPlanProgress, type PlanProgressStats } from '@flowstate/core';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';
import StatCard from '../../components/charts/StatCard';
import HeatmapCalendar from '../../components/charts/HeatmapCalendar';

interface DayRow {
  date: string;
  title: string;
  mustDo: string[];
  mustDoDone: boolean[];
  dayNumber?: number;
  totalDays?: number;
  sessionCount: number;
}

export default function PlanScreen() {
  const router = useRouter();
  const { db, isReady } = useDatabaseSafe();
  const { themeColors } = useTheme();
  const [days, setDays] = useState<DayRow[]>([]);
  const [planName, setPlanName] = useState<string | null>(null);
  const [weekId, setWeekId] = useState(() => {
    // Compute current ISO week ID
    const now = new Date();
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
  });
  const [progress, setProgress] = useState<PlanProgressStats | null>(null);

  const loadData = useCallback(async () => {
    if (!db || !isReady) {
      setDays([]);
      return;
    }
    try {
      const plan = await getActivePlan(db);
      if (plan) {
        setPlanName(plan.name);
        const dbDays = await getDayPlansInRange(db, plan.startDate, plan.endDate);
        // Load plan progress analytics
        try {
          const prog = await getPlanProgress(db);
          if (prog) setProgress(prog);
        } catch { /* analytics optional */ }
        if (dbDays.length > 0) {
          setDays(dbDays.map((d: any) => ({
            date: d.date, title: d.title,
            mustDo: d.mustDo ?? [], mustDoDone: d.mustDoDone ?? [],
            dayNumber: d.dayNumber, totalDays: d.totalDays, sessionCount: 0,
          })));
          return;
        }
      }
      setDays([]);
    } catch {
      setDays([]);
    }
  }, [db, isReady]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const todayStr = new Date().toISOString().slice(0, 10);

  const DAY_ROW_HEIGHT = 72;

  const renderDayRow = useCallback(({ item: day }: ListRenderItemInfo<DayRow>) => {
    const doneCount = day.mustDoDone.filter(Boolean).length;
    const isToday = day.date === todayStr;

    return (
      <Pressable
        style={[styles.dayRow, { backgroundColor: themeColors.surface }, isToday && [styles.dayRowToday, { borderColor: themeColors.accent }]]}
        onPress={() => router.push(`/day/${day.date}`)}
      >
        <View style={styles.dateCol}>
          <Text style={[styles.dayLabel, { color: themeColors.textSecondary }]}>
            {new Date(day.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}
          </Text>
          <Text style={[styles.dayNum, { color: themeColors.text }]}>
            {new Date(day.date + 'T12:00:00').getDate()}
          </Text>
        </View>

        <View style={styles.infoCol}>
          <Text style={[styles.dayTitle, { color: themeColors.text }]} numberOfLines={1}>
            {day.title}
          </Text>
          <Text style={[styles.dayMeta, { color: themeColors.textSecondary }]}>
            {doneCount}/{day.mustDo.length} must-dos
            {day.dayNumber ? ` · Day ${day.dayNumber}` : ''}
            {day.totalDays ? ` of ${day.totalDays}` : ''}
          </Text>
        </View>

        <Feather name="chevron-right" size={18} color={themeColors.muted} />
      </Pressable>
    );
  }, [todayStr, router, themeColors]);

  const getItemLayout = useCallback((_: any, index: number) => ({
    length: DAY_ROW_HEIGHT,
    offset: DAY_ROW_HEIGHT * index,
    index,
  }), []);

  const keyExtractor = useCallback((item: DayRow) => item.date, []);

  const ListHeader = useMemo(() => (
    <View>
      <Pressable onPress={() => router.push(`/week/${weekId}`)}>
        <SectionHeader
          title={planName ?? 'This Week'}
          subtitle="Tap to view week →"
        />
      </Pressable>

      {/* ─── Plan Progress Cards ──── */}
      {progress && (
        <>
          {/* Big progress bar */}
          <View style={[styles.progressCard, { backgroundColor: themeColors.surface }]}>
            <View style={styles.progressLabelRow}>
              <Text style={[styles.progressLabel, { color: themeColors.text }]}>Plan Progress</Text>
              <Text style={[styles.progressPct, { color: themeColors.accent }]}>
                {Math.round(progress.progressPercent * 100)}%
              </Text>
            </View>
            <View style={[styles.progressBarOuter, { backgroundColor: themeColors.border }]}>
              <View
                style={[
                  styles.progressBarInner,
                  { width: `${Math.round(progress.progressPercent * 100)}%`, backgroundColor: themeColors.accent },
                ]}
              />
            </View>
            <Text style={[styles.progressMeta, { color: themeColors.muted }]}>
              {progress.completedDays} completed · {progress.remainingDays} remaining
              {progress.quietDays > 0 ? ` · ${progress.quietDays} quiet` : ''}
            </Text>
          </View>

          {/* Stat cards */}
          <View style={styles.statRow}>
            <StatCard
              label="Sessions"
              value={progress.sessionStats.completed}
              subtitle={`${Math.round(progress.sessionStats.completionRate * 100)}% done`}
              color={themeColors.accent}
            />
            <StatCard
              label="Must-Dos"
              value={`${Math.round(progress.mustDoStats.completionRate * 100)}%`}
              subtitle={`${progress.mustDoStats.completedItems} of ${progress.mustDoStats.totalItems}`}
              color={progress.mustDoStats.completionRate >= 0.8 ? themeColors.success : themeColors.warning}
            />
          </View>

          {/* Heatmap */}
          {progress.heatmapData.length > 0 && (
            <View style={[styles.heatmapCard, { backgroundColor: themeColors.surface }]}>
              <Text style={[styles.heatmapTitle, { color: themeColors.text }]}>Daily Completion</Text>
              <HeatmapCalendar data={progress.heatmapData} weeks={Math.ceil(progress.totalDays / 7)} />
            </View>
          )}
        </>
      )}

      <SectionHeader title="Days" />
    </View>
  ), [planName, weekId, progress, router, themeColors]);

  const ListFooter = useMemo(() => (
    <Pressable style={[styles.importBtn, { borderColor: themeColors.accent }]} onPress={() => router.push('/import/pick')}>
      <Feather name="upload" size={18} color={themeColors.accent} />
      <Text style={[styles.importBtnText, { color: themeColors.accent }]}>Import Plan from CSV</Text>
    </Pressable>
  ), [router, themeColors]);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: themeColors.background }]}>
      <FlatList
        data={days}
        renderItem={renderDayRow}
        keyExtractor={keyExtractor}
        getItemLayout={getItemLayout}
        ListHeaderComponent={ListHeader}
        ListFooterComponent={ListFooter}
        contentContainerStyle={styles.listContent}
        initialNumToRender={15}
        maxToRenderPerBatch={10}
        windowSize={5}
        removeClippedSubviews
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl,
  },
  progressCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  progressLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  progressLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  progressPct: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  progressBarOuter: {
    height: 8,
    borderRadius: borderRadius.sm,
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
  progressBarInner: {
    height: '100%',
    borderRadius: borderRadius.sm,
  },
  progressMeta: {
    fontSize: fontSize.xs,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  heatmapCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  heatmapTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  dayRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  dayRowToday: {
    borderWidth: 1.5,
  },
  dateCol: {
    width: 44,
    alignItems: "center",
    marginRight: spacing.md,
  },
  dayLabel: {
    fontSize: fontSize.xs,
    fontWeight: "500",
    textTransform: "uppercase",
  },
  dayNum: {
    fontSize: fontSize.xl,
    fontWeight: "700",
  },
  infoCol: {
    flex: 1,
  },
  dayTitle: {
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  dayMeta: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    marginTop: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  importBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
