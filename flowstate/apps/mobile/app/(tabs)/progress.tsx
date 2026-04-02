/**
 * Progress Tab — V2 spec §5
 *
 * Hybrid layout: summary card at top, charts/metrics below.
 * Pillar selector (All · Gym · Academic · Life) + date range (Week · Month · Year).
 *
 * Summary card: total active time (display Black), session count, top metric, delta badge.
 * Per-pillar sections:
 *   Gym     – frequency heatmap, PR table, plate-calc link
 *   Academic – study time bars, grade cards, focus score
 *   Life    – habit completion bars, streak leaderboard
 * Empty state: bar-chart-2 icon + copy.
 */
import React, { useCallback, useState, useMemo } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  FlatList,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { space, radius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';
import { AppText } from '../../components/primitives/Text';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { useUserPrefsStore, type Pillar } from '../../stores/userPrefsStore';
import { getModuleSpecs, getRoutines } from '@flowstate/core';

// ─── Types ────────────────────────────────────────────────────────────────────
type DateRange = 'week' | 'month' | 'year';
type PillarFilter = 'all' | Pillar;

interface SessionStats {
  totalActiveMs: number;
  sessionCount: number;
  plannedCount: number;
  deltaPct: number | null; // vs previous period
}

interface PRRow { lift: string; weight: number; date: string; est1RM: number }
interface StreakRow { label: string; current: number; best: number; pillar: string }
interface HabitRow { label: string; completionRate: number; pillar: string }

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatActiveTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return '—';
}

// ─── Mini bar chart ───────────────────────────────────────────────────────────
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const { themeTokens } = useTheme();
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View style={[MB.track, { backgroundColor: themeTokens.accentTint }]}>
      <View style={[MB.fill, { width: `${pct * 100}%` as any, backgroundColor: color }]} />
    </View>
  );
}
const MB = StyleSheet.create({
  track: { height: 6, borderRadius: 3, overflow: 'hidden', flex: 1 },
  fill: { height: '100%', borderRadius: 3 },
});

// ─── Segmented control ────────────────────────────────────────────────────────
function Segmented<T extends string>({ options, value, onChange, color }: {
  options: Array<{ key: T; label: string }>;
  value: T;
  onChange: (v: T) => void;
  color?: string;
}) {
  const { themeTokens } = useTheme();
  const activeColor = color ?? themeTokens.accent;
  return (
    <View style={[SEG.wrap, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}>
      {options.map(o => (
        <Pressable
          key={o.key}
          style={[SEG.btn, value === o.key && { backgroundColor: activeColor }]}
          onPress={() => onChange(o.key)}
        >
          <AppText
            variant="caption1"
            style={{ fontWeight: '600', color: value === o.key ? '#fff' : themeTokens.textSecondary }}
          >
            {o.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
const SEG = StyleSheet.create({
  wrap: { flexDirection: 'row', borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  btn: { paddingHorizontal: space[12], paddingVertical: space[8] },
});

// ─── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({ stats, pillarFilter, accentColor }: {
  stats: SessionStats | null;
  pillarFilter: PillarFilter;
  accentColor: string;
}) {
  const { themeTokens } = useTheme();
  const deltaUp = (stats?.deltaPct ?? 0) >= 0;
  return (
    <View style={[SC.card, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
      <View style={[SC.topBar, { backgroundColor: accentColor }]} />
      <View style={SC.body}>
        <View style={SC.left}>
          <AppText
            variant="display"
            style={{ fontWeight: '800', color: themeTokens.textPrimary, fontVariant: ['tabular-nums'] as any }}
          >
            {formatActiveTime(stats?.totalActiveMs ?? 0)}
          </AppText>
          <AppText variant="footnote" color={themeTokens.textTertiary}>Active time</AppText>
          <AppText
            variant="title3"
            style={{ fontWeight: '700', color: themeTokens.textPrimary, marginTop: space[8] }}
          >
            {stats?.sessionCount ?? 0}
            <AppText variant="footnote" color={themeTokens.textTertiary}>
              {stats?.plannedCount ? ` of ${stats.plannedCount}` : ''} sessions
            </AppText>
          </AppText>
        </View>
        {stats?.deltaPct != null && (
          <View style={[SC.delta, { backgroundColor: deltaUp ? themeTokens.success + '18' : themeTokens.destructive + '18' }]}>
            <Feather
              name={deltaUp ? 'trending-up' : 'trending-down'}
              size={14}
              color={deltaUp ? themeTokens.success : themeTokens.destructive}
            />
            <AppText
              variant="footnote"
              style={{ fontWeight: '600', color: deltaUp ? themeTokens.success : themeTokens.destructive }}
            >
              {Math.abs(Math.round(stats.deltaPct))}%
            </AppText>
          </View>
        )}
      </View>
    </View>
  );
}
const SC = StyleSheet.create({
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden', marginHorizontal: space[16] },
  topBar: { height: 4 },
  body: { padding: space[16], flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  left: { gap: space[2] },
  delta: { flexDirection: 'row', alignItems: 'center', gap: space[4], paddingHorizontal: space[8], paddingVertical: space[4], borderRadius: radius.full },
});

// ─── Gym section ──────────────────────────────────────────────────────────────
function GymSection({ color, onCalcPress }: { color: string; onCalcPress: () => void }) {
  const { themeTokens } = useTheme();
  // Placeholder PR rows — real data wired via gym stats screen
  const prs: PRRow[] = [];
  // Generate placeholder heatmap cells ONCE — Math.random() must never live in render.
  // Using [] dep so cells are stable for the lifetime of this component instance.
  const heatCells = useMemo(
    () => Array.from({ length: 52 * 7 }, () => ({ active: Math.random() < 0.2, weight: Math.random() })),
    [],
  );
  return (
    <View style={[SS.section, { marginHorizontal: space[16] }]}>
      <AppText variant="caption1" color={themeTokens.textTertiary} style={SS.label}>GYM</AppText>

      {/* Plate calc shortcut */}
      <Pressable style={[SS.actionRow, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]} onPress={onCalcPress}>
        <Feather name="tool" size={20} color={color} />
        <AppText variant="headline" style={{ flex: 1, fontWeight: '600' }}>Plate Calculator</AppText>
        <Feather name="chevron-right" size={18} color={themeTokens.textTertiary} />
      </Pressable>

      {/* PR table */}
      <View style={[SS.card, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
        <View style={SS.cardHeader}>
          <AppText variant="subheadline" style={{ fontWeight: '600' }}>Personal Records</AppText>
        </View>
        {prs.length === 0 ? (
          <AppText variant="footnote" color={themeTokens.textTertiary} style={SS.emptyCell}>
            No PRs logged yet. Add lifts to your gym routines.
          </AppText>
        ) : prs.map((pr, i) => (
          <View key={pr.lift} style={[SS.tableRow, i < prs.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeTokens.border }]}>
            <AppText variant="subheadline" style={{ flex: 2 }} numberOfLines={1}>{pr.lift}</AppText>
            <AppText variant="subheadline" style={{ fontWeight: '600', color }}>{pr.weight}kg</AppText>
            <AppText variant="footnote" color={themeTokens.textTertiary} style={{ flex: 1, textAlign: 'right' }}>{pr.date}</AppText>
          </View>
        ))}
      </View>

      {/* Frequency heatmap placeholder */}
      <View style={[SS.card, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
        <View style={SS.cardHeader}>
          <AppText variant="subheadline" style={{ fontWeight: '600' }}>Session Frequency</AppText>
          <AppText variant="footnote" color={themeTokens.textTertiary}>52 weeks</AppText>
        </View>
        <View style={SS.heatmapPlaceholder}>
          {heatCells.map((cell, i) => (
            <View
              key={i}
              style={[SS.heatCell, {
                backgroundColor: cell.active ? color : themeTokens.accentTint,
                opacity: cell.active ? 0.4 + 0.6 * cell.weight : 0.3,
              }]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── Academic section ─────────────────────────────────────────────────────────
function AcademicSection({ color, onGradesPress }: { color: string; onGradesPress: () => void }) {
  const { themeTokens } = useTheme();
  return (
    <View style={[SS.section, { marginHorizontal: space[16] }]}>
      <AppText variant="caption1" color={themeTokens.textTertiary} style={SS.label}>ACADEMIC</AppText>

      <View style={[SS.card, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
        <View style={SS.cardHeader}>
          <AppText variant="subheadline" style={{ fontWeight: '600' }}>Study Time</AppText>
          <AppText variant="footnote" color={themeTokens.textTertiary}>This week</AppText>
        </View>
        <AppText variant="footnote" color={themeTokens.textTertiary} style={SS.emptyCell}>
          Log study sessions to see your weekly breakdown.
        </AppText>
      </View>

      <Pressable style={[SS.actionRow, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]} onPress={onGradesPress}>
        <Feather name="book-open" size={20} color={color} />
        <AppText variant="headline" style={{ flex: 1, fontWeight: '600' }}>Grade Tracker</AppText>
        <Feather name="chevron-right" size={18} color={themeTokens.textTertiary} />
      </Pressable>
    </View>
  );
}

// ─── Life section ─────────────────────────────────────────────────────────────
function LifeSection({ color, streaks }: { color: string; streaks: StreakRow[] }) {
  const { themeTokens } = useTheme();
  const maxStreak = Math.max(...streaks.map(s => s.current), 1);
  return (
    <View style={[SS.section, { marginHorizontal: space[16] }]}>
      <AppText variant="caption1" color={themeTokens.textTertiary} style={SS.label}>LIFE</AppText>

      <View style={[SS.card, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
        <View style={SS.cardHeader}>
          <AppText variant="subheadline" style={{ fontWeight: '600' }}>Streaks</AppText>
        </View>
        {streaks.length === 0 ? (
          <AppText variant="footnote" color={themeTokens.textTertiary} style={SS.emptyCell}>
            No active streaks. Add habit modules to start tracking.
          </AppText>
        ) : [...streaks].sort((a, b) => b.current - a.current).map((s, i) => (
          <View key={s.label} style={[SS.tableRow, i < streaks.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeTokens.border }]}>
            <Feather name="zap" size={14} color={themeTokens.warning} />
            <AppText variant="subheadline" style={{ flex: 1, marginLeft: space[8] }} numberOfLines={1}>{s.label}</AppText>
            <AppText variant="subheadline" style={{ fontWeight: '700', color: themeTokens.warning }}>{s.current}</AppText>
            <MiniBar value={s.current} max={maxStreak} color={color} />
          </View>
        ))}
      </View>
    </View>
  );
}

const SS = StyleSheet.create({
  section: { marginBottom: space[24] },
  label: { letterSpacing: 0.5, marginBottom: space[8] },
  card: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden', marginBottom: space[12] },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: space[12], borderBottomWidth: StyleSheet.hairlineWidth },
  emptyCell: { padding: space[12] },
  tableRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[12], paddingVertical: space[8], gap: space[8] },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: space[12], padding: space[12], borderRadius: radius.md, borderWidth: 1, marginBottom: space[12] },
  heatmapPlaceholder: { flexDirection: 'row', flexWrap: 'wrap', padding: space[12], gap: 2 },
  heatCell: { width: 8, height: 8, borderRadius: 1 },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ProgressScreen() {
  const { themeTokens } = useTheme();
  const { db, isReady } = useDatabaseSafe();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const getPillarColour = useUserPrefsStore(s => s.getPillarColour);

  const [pillar, setPillar] = useState<PillarFilter>('all');
  const [range, setRange] = useState<DateRange>('week');
  const [hasData, setHasData] = useState(false);
  const [streaks] = useState<StreakRow[]>([]);

  useFocusEffect(useCallback(() => {
    if (!db || !isReady) return;
    (async () => {
      try {
        const routines = await getRoutines(db);
        setHasData((routines as any[]).length > 0);
      } catch {}
    })();
  }, [db, isReady]));

  const accentColor = useMemo(() => {
    if (pillar === 'all') return themeTokens.accent;
    return getPillarColour(pillar as Pillar);
  }, [pillar, themeTokens.accent, getPillarColour]);

  const PILLAR_OPTIONS: Array<{ key: PillarFilter; label: string }> = [
    { key: 'all', label: 'All' },
    { key: 'gym', label: 'Gym' },
    { key: 'academic', label: 'Academic' },
    { key: 'life', label: 'Life' },
  ];

  const RANGE_OPTIONS: Array<{ key: DateRange; label: string }> = [
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
    { key: 'year', label: 'Year' },
  ];

  return (
    <ScrollView
      style={[S.fill, { backgroundColor: themeTokens.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={[S.header, { paddingTop: insets.top + space[8] }]}>
        <AppText variant="title1" style={{ fontWeight: '700' }}>Progress</AppText>
        {/* Range picker (right) */}
        <Segmented options={RANGE_OPTIONS} value={range} onChange={setRange} />
      </View>

      {/* ── Pillar selector ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[S.pillarScroll]}
      >
        {PILLAR_OPTIONS.map(o => {
          const active = pillar === o.key;
          const c = o.key === 'all' ? themeTokens.accent : getPillarColour(o.key as Pillar);
          return (
            <Pressable
              key={o.key}
              style={[S.pillarPill, active ? { backgroundColor: c, borderColor: c } : { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
              onPress={() => setPillar(o.key)}
            >
              <AppText variant="subheadline" style={{ fontWeight: active ? '600' : '400', color: active ? '#fff' : themeTokens.textSecondary }}>
                {o.label}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* ── Summary card ── */}
      <SummaryCard stats={hasData ? { totalActiveMs: 0, sessionCount: 0, plannedCount: 0, deltaPct: null } : null} pillarFilter={pillar} accentColor={accentColor} />

      <View style={{ height: space[24] }} />

      {/* ── Empty state ── */}
      {!hasData ? (
        <View style={[S.empty, { marginHorizontal: space[16] }]}>
          <Feather name="bar-chart-2" size={36} color={themeTokens.textTertiary} />
          <AppText variant="body" color={themeTokens.textTertiary} style={{ textAlign: 'center', marginTop: space[12] }}>
            No sessions logged yet.
          </AppText>
          <AppText variant="footnote" color={themeTokens.textTertiary} style={{ textAlign: 'center', marginTop: space[4] }}>
            Complete a session to see your progress.
          </AppText>
        </View>
      ) : (
        <>
          {(pillar === 'all' || pillar === 'gym') && (
            <GymSection
              color={getPillarColour('gym')}
              onCalcPress={() => router.push('/tools/plate-calculator')}
            />
          )}
          {(pillar === 'all' || pillar === 'academic') && (
            <AcademicSection
              color={getPillarColour('academic')}
              onGradesPress={() => router.push('/statistics')}
            />
          )}
          {(pillar === 'all' || pillar === 'life') && (
            <LifeSection color={getPillarColour('life')} streaks={streaks} />
          )}
        </>
      )}
    </ScrollView>
  );
}

const S = StyleSheet.create({
  fill: { flex: 1 },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: space[16], paddingBottom: space[12],
  },
  pillarScroll: {
    paddingHorizontal: space[16], paddingBottom: space[16], gap: space[8],
  },
  pillarPill: {
    paddingHorizontal: space[16], paddingVertical: space[8], borderRadius: radius.full, borderWidth: 1,
  },
  empty: { alignItems: 'center', paddingVertical: space[48] },
});
