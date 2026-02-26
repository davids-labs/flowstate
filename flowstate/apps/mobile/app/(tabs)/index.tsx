import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { SessionCard } from '../../components/modules/SessionCard';
import { ModuleCard } from '../../components/modules/ModuleCard';
import { getModuleSpecs, getActivePlan, getDayPlan as getDbDayPlan, getSessionsForDay, getHomescreenLayout, getRoutine, getRoutineBlocks, getAllStreaks } from '@flowstate/core';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { useModuleValue, parseNumber } from '../../hooks/useModuleValue';
import { useDayStore } from '../../stores/dayStore';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

/** Wrapper that wires useModuleValue so each module card is interactive */
function HomeModuleCard({ module, compact, widthStyle, streak }: { module: any; compact?: boolean; widthStyle?: any; streak?: { currentStreak?: number; longestStreak?: number } }) {
  const { value, setValue } = useModuleValue(module.id);
  const config = module.config ?? {};

  // Parse value for the specific type
  let parsedValue: unknown = value;
  if (module.type === 'checkbox') parsedValue = value === 'true' || value === '1';
  else if (module.type === 'rating' || module.type === 'data_input' || module.type === 'tally') parsedValue = parseNumber(value);
  else if (module.type === 'text_note' || module.type === 'photo_log') parsedValue = value ?? '';
  // For streak modules, prefer DB-derived streaks when available
  if (module.type === 'streak_counter' && typeof streak?.currentStreak === 'number') {
    parsedValue = streak.currentStreak;
  }

  return (
    <ModuleCard
      id={module.id}
      type={module.type}
      label={module.label}
      emoji={module.emoji}
      config={config}
      surface="homescreen"
      compact={compact}
      value={parsedValue}
      onValueChange={(v) => setValue(String(v ?? ''))}
    />
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { db, isReady } = useDatabaseSafe();
  const { loadDay } = useDayStore();
  const { themeColors } = useTheme();

  const [liveModules, setLiveModules] = useState<any[]>([]);
  const [loggedModules, setLoggedModules] = useState<any[]>([]);
  const [todayModules, setTodayModules] = useState<any[]>([]);
  const [todayData, setTodayData] = useState<any>(null);
  const [todaySessions, setTodaySessions] = useState<any[]>([]);
  const [planName, setPlanName] = useState<string | null>(null);
  const [dayInfo, setDayInfo] = useState<{ dayNumber?: number; totalDays?: number }>({});
  const [hasCustomLayout, setHasCustomLayout] = useState(false);
  const [layoutWidths, setLayoutWidths] = useState<Record<string, number>>({});
  const [streaks, setStreaks] = useState<Record<string, { currentStreak: number; longestStreak: number }>>({});

  const loadData = useCallback(async () => {
    if (!db || !isReady) return;
    try {
      const specs = await getModuleSpecs(db);
      const activeSpecs = specs.filter((s: any) => !s.archivedAt);
      const layout = await getHomescreenLayout(db);

      if (layout.length > 0) {
        // Use saved layout to determine module ordering and zones
        setHasCustomLayout(true);
        const widths: Record<string, number> = {};
        const zone1: any[] = [];
        const zone2: any[] = [];
        const zone3: any[] = [];

        for (const entry of layout) {
          const spec = activeSpecs.find((s: any) => s.id === entry.moduleId);
          if (!spec) continue;
          widths[spec.id] = (entry as any).width ?? 1;
          if (entry.zone === 1) zone1.push(spec);
          else if (entry.zone === 2) zone2.push(spec);
          else if (entry.zone === 3) zone3.push(spec);
        }
        setLiveModules(zone1);
        setTodayModules(zone2);
        setLoggedModules(zone3);
        setLayoutWidths(widths);
      } else {
        // Fallback: derive from module placements
        setHasCustomLayout(false);
        const homeSpecs = activeSpecs.filter((s: any) => {
          const placements = Array.isArray(s.placements) ? s.placements : [];
          return placements.includes('homescreen');
        });
        setLiveModules(homeSpecs.filter((s: any) => s.isLive));
        setLoggedModules(homeSpecs.filter((s: any) => !s.isLive));
        setTodayModules([]);
        setLayoutWidths({});
      }

      // Load today's data
      const todayStr = new Date().toISOString().slice(0, 10);
      // Hydrate day store so useModuleValue has today's values
      await loadDay(db, todayStr);
      const dayPlan = await getDbDayPlan(db, todayStr);
      if (dayPlan) {
        setTodayData(dayPlan);
        setDayInfo({ dayNumber: dayPlan.dayNumber, totalDays: dayPlan.totalDays });
        // Load real sessions from DB and enrich with routine data
        try {
          const sessionsData = await getSessionsForDay(db, dayPlan.id);
          // Enrich sessions with routine info
          const enriched = await Promise.all(
            sessionsData.map(async (s: any) => {
              try {
                const routine = await getRoutine(db, s.routineId);
                const blocks = await getRoutineBlocks(db, s.routineId);
                return {
                  ...s,
                  durationMinutes: routine?.totalDurationMinutes ?? 0,
                  blockCount: blocks?.length ?? 0,
                };
              } catch {
                return { ...s, durationMinutes: 0, blockCount: 0 };
              }
            }),
          );
          setTodaySessions(enriched);
        } catch {}
      }

      const plan = await getActivePlan(db);
      if (plan) setPlanName(plan.name);

      // Load streaks for all active modules
      try {
        const ids = activeSpecs.map((s: any) => s.id);
        const streakData = await getAllStreaks(db, ids);
        setStreaks(streakData);
      } catch {}
    } catch (err) {
      console.error('Failed to load homescreen data:', err);
    }
  }, [db, isReady]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  if (!isReady) {
    return (
      <ScreenWrapper>
        <ActivityIndicator size="large" color={themeColors.accent} style={{ marginTop: 60 }} />
      </ScreenWrapper>
    );
  }

  const today = todayData;
  const doneCount = (today?.mustDoDone ?? []).filter(Boolean).length;
  const mustDoTotal = (today?.mustDo ?? []).length;
  const sessions = todaySessions;

  return (
    <ScreenWrapper>
      {/* ── Header with Settings ── */}
      <View style={styles.headerRow}>
        <Pressable style={styles.editLayoutBtn} onPress={() => router.push('/layout-editor')}>
          <Feather name="grid" size={18} color={themeColors.accent} />
          <Text style={[styles.editLayoutText, { color: themeColors.accent }]}>Edit Layout</Text>
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable style={styles.settingsBtn} onPress={() => router.push('/settings')}>
          <Feather name="settings" size={22} color={themeColors.muted} />
        </Pressable>
      </View>

      {/* ── Quick Stats Bar ── */}
      {today && (
        <View style={[styles.quickStatsBar, { backgroundColor: themeColors.surface }]}>
          <View style={styles.quickStat}>
            <Text style={[styles.quickStatValue, { color: themeColors.accent }]}>
              {mustDoTotal > 0 ? Math.round((doneCount / mustDoTotal) * 100) : 0}%
            </Text>
            <Text style={[styles.quickStatLabel, { color: themeColors.muted }]}>Must-Dos</Text>
          </View>
          <View style={[styles.quickStatDivider, { backgroundColor: themeColors.border }]} />
          <View style={styles.quickStat}>
            <Text style={[styles.quickStatValue, { color: themeColors.text }]}>{sessions.length}</Text>
            <Text style={[styles.quickStatLabel, { color: themeColors.muted }]}>Sessions</Text>
          </View>
          <View style={[styles.quickStatDivider, { backgroundColor: themeColors.border }]} />
          <View style={styles.quickStat}>
            <Text style={[styles.quickStatValue, { color: themeColors.text }]}>
              {Object.values(streaks).filter(s => s.currentStreak > 0).length}
            </Text>
            <Text style={[styles.quickStatLabel, { color: themeColors.muted }]}>Active Streaks</Text>
          </View>
        </View>
      )}

      {/* ── Zone 1: Live Modules ── */}
      <SectionHeader title="Live" subtitle="Updating in real time" />

      {liveModules.length > 0 ? (
        <View style={styles.liveGrid}>
          {liveModules.map((m: any) => (
            <Pressable
              key={m.id}
              style={[
                styles.liveCell,
                layoutWidths[m.id] === 2 && styles.liveCellFull,
              ]}
              onPress={() => router.push(`/modules/${m.id}`)}
            >
              <HomeModuleCard module={m} compact streak={streaks[m.id]} />
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyCard, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>No live modules yet</Text>
          <Pressable onPress={() => router.push('/modules/create')}>
            <Text style={[styles.emptyLink, { color: themeColors.accent }]}>Create a countdown, streak, or progress module →</Text>
          </Pressable>
        </View>
      )}

      {/* ── Zone 2: Today Snapshot ── */}
      <SectionHeader
        title="Today"
        subtitle={planName && dayInfo.dayNumber ? `Day ${dayInfo.dayNumber} of ${dayInfo.totalDays}` : today?.title}
      />

      {/* Zone 2 modules (if any from custom layout) */}
      {todayModules.length > 0 && (
        <View style={styles.todayModuleGrid}>
          {todayModules.map((m: any) => (
            <View key={m.id} style={[
              styles.todayModuleCell,
              layoutWidths[m.id] === 2 && styles.todayModuleCellFull,
            ]}>
              <HomeModuleCard module={m} streak={streaks[m.id]} />
            </View>
          ))}
        </View>
      )}

      <View style={[styles.snapshotCard, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.snapshotTitle, { color: themeColors.text }]}>{today?.title ?? 'No plan today'}</Text>
        <Text style={[styles.snapshotMeta, { color: themeColors.textSecondary }]}>
          {mustDoTotal > 0 ? `${doneCount}/${mustDoTotal} must-dos` : 'No must-dos'}
          {dayInfo.dayNumber ? ` · Day ${dayInfo.dayNumber} of ${dayInfo.totalDays}` : ''}
          {sessions.length > 0 ? ` · ${sessions.length} sessions` : ''}
        </Text>

        {sessions.map((s: any) => (
          <SessionCard
            key={s.id}
            sessionId={s.id}
            routineName={s.routineName}
            durationMinutes={s.durationMinutes ?? 0}
            blockCount={s.blockCount ?? 0}
            status={s.status}
          />
        ))}

        <Pressable
          style={[styles.startDayBtn, { backgroundColor: themeColors.accent }]}
          onPress={() => router.push('/(tabs)/today')}
        >
          <Text style={[styles.startDayText, { color: themeColors.white }]}>Open Today →</Text>
        </Pressable>
      </View>

      {/* ── Zone 3: Logged Modules ── */}
      <SectionHeader title="Daily Log" subtitle="Tap to record" />

      {loggedModules.length > 0 ? (
        <View style={styles.logGrid}>
          {loggedModules.map((m: any) => (
            <View key={m.id} style={[
              styles.logCell,
              layoutWidths[m.id] === 2 && styles.logCellFull,
              !layoutWidths[m.id] && styles.logCellFull,
            ]}>
              <HomeModuleCard module={m} streak={streaks[m.id]} />
            </View>
          ))}
        </View>
      ) : (
        <View style={[styles.emptyCard, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.emptyText, { color: themeColors.textSecondary }]}>No daily log modules</Text>
          <Pressable onPress={() => router.push('/modules/create')}>
            <Text style={[styles.emptyLink, { color: themeColors.accent }]}>Create a checkbox, rating, or text note →</Text>
          </Pressable>
        </View>
      )}

      {/* Manage links */}
      <View style={styles.manageLinkRow}>
        <Pressable style={styles.manageBtn} onPress={() => router.push('/modules')}>
          <Feather name="settings" size={16} color={themeColors.accent} />
          <Text style={[styles.manageBtnText, { color: themeColors.accent }]}>Modules</Text>
        </Pressable>
        <Pressable style={styles.manageBtn} onPress={() => router.push('/routines')}>
          <Feather name="layers" size={16} color={themeColors.accent} />
          <Text style={[styles.manageBtnText, { color: themeColors.accent }]}>Routines</Text>
        </Pressable>
        <Pressable style={styles.manageBtn} onPress={() => router.push('/statistics')}>
          <Feather name="bar-chart-2" size={16} color={themeColors.accent} />
          <Text style={[styles.manageBtnText, { color: themeColors.accent }]}>Statistics</Text>
        </Pressable>
        <Pressable style={styles.manageBtn} onPress={() => router.push('/gallery')}>
          <Feather name="image" size={16} color={themeColors.accent} />
          <Text style={[styles.manageBtnText, { color: themeColors.accent }]}>Gallery</Text>
        </Pressable>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  editLayoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  editLayoutText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  settingsBtn: {
    padding: spacing.xs,
  },
  liveGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  liveCell: {
    flex: 1,
    minWidth: "40%",
  },
  liveCellFull: {
    flex: 0,
    width: "100%",
    minWidth: "100%",
  },
  todayModuleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  todayModuleCell: {
    flex: 1,
    minWidth: "40%",
  },
  todayModuleCellFull: {
    flex: 0,
    width: "100%",
    minWidth: "100%",
  },
  logGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  logCell: {
    flex: 1,
    minWidth: "40%",
  },
  logCellFull: {
    flex: 0,
    width: "100%",
    minWidth: "100%",
  },
  snapshotCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  snapshotTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    marginBottom: spacing.xs,
  },
  snapshotMeta: {
    fontSize: fontSize.sm,
    marginBottom: spacing.md,
  },
  startDayBtn: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
    marginTop: spacing.sm,
  },
  startDayText: {
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  manageLinkRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
  },
  manageBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  emptyCard: {
    borderRadius: borderRadius.md,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.sm,
  },
  emptyLink: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  quickStatsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  quickStat: {
    alignItems: 'center',
    flex: 1,
  },
  quickStatValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  quickStatLabel: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  quickStatDivider: {
    width: 1,
    height: 32,
  },
});
