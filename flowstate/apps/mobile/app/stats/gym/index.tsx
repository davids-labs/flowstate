/**
 * Gym Stats Screen — V2 spec §9.2
 *
 * Three tabs: Volume · PRs · Frequency
 * Summary card with 4pt pillar-colour top stripe per tab.
 * Plate Calc shortcut in header top-right.
 */
import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { space, radius } from '../../../constants/theme';
import { useTheme } from '../../../constants/ThemeContext';
import { AppText } from '../../../components/primitives/Text';
import { useDatabaseSafe } from '../../../components/DatabaseProvider';
import { useUserPrefsStore } from '../../../stores/userPrefsStore';
import {
  getVolumeByLift,
  getPRsAllLifts,
  getGymSessionFrequency,
} from '@flowstate/core';

type Tab = 'volume' | 'prs' | 'frequency';

function epley(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

// ─── Mini horizontal bar ──────────────────────────────────────────────────────
function MiniBar({
  value,
  max,
  color,
}: {
  value: number;
  max: number;
  color: string;
}) {
  const { themeTokens } = useTheme();
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  return (
    <View
      style={{
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
        flex: 1,
        backgroundColor: themeTokens.accentTint ?? themeTokens.surface,
      }}
    >
      <View
        style={{
          width: `${pct * 100}%` as any,
          height: '100%',
          borderRadius: 3,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

// ─── Summary card ─────────────────────────────────────────────────────────────
function SummaryCard({
  title,
  value,
  sub,
  color,
}: {
  title: string;
  value: string;
  sub: string;
  color: string;
}) {
  const { themeTokens } = useTheme();
  return (
    <View
      style={[
        SC.card,
        {
          backgroundColor: themeTokens.surfaceElevated,
          borderColor: themeTokens.border,
        },
      ]}
    >
      <View style={[SC.stripe, { backgroundColor: color }]} />
      <View style={SC.body}>
        <AppText variant="footnote" color={themeTokens.textTertiary}>
          {title}
        </AppText>
        <AppText
          variant="title1"
          style={{ fontWeight: '800', color: themeTokens.textPrimary }}
        >
          {value}
        </AppText>
        <AppText
          variant="footnote"
          color={themeTokens.textSecondary}
          style={{ marginTop: space[4] }}
        >
          {sub}
        </AppText>
      </View>
    </View>
  );
}
const SC = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginHorizontal: space[16],
    marginBottom: space[20],
  },
  stripe: { height: 4 },
  body: { padding: space[16] },
});

// ─── Tab bar ──────────────────────────────────────────────────────────────────
function TabBar({
  tab,
  onChange,
  color,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  color: string;
}) {
  const { themeTokens } = useTheme();
  const tabs: { key: Tab; label: string }[] = [
    { key: 'volume', label: 'Volume' },
    { key: 'prs', label: 'PRs' },
    { key: 'frequency', label: 'Frequency' },
  ];
  return (
    <View
      style={[
        TB.wrap,
        {
          backgroundColor: themeTokens.surface,
          borderColor: themeTokens.border,
        },
      ]}
    >
      {tabs.map((t) => (
        <Pressable
          key={t.key}
          style={[TB.btn, tab === t.key && { backgroundColor: color }]}
          onPress={() => onChange(t.key)}
        >
          <AppText
            variant="subheadline"
            style={{
              fontWeight: '600',
              color: tab === t.key ? '#fff' : themeTokens.textSecondary,
            }}
          >
            {t.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}
const TB = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    marginHorizontal: space[16],
    marginBottom: space[16],
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
  },
  btn: { flex: 1, paddingVertical: 10, alignItems: 'center' },
});

// ─── Frequency heatmap ────────────────────────────────────────────────────────
function FrequencyHeatmap({
  data,
  color,
}: {
  data: Record<string, number>;
  color: string;
}) {
  const { themeTokens } = useTheme();
  const cells = useMemo(() => {
    const today = new Date();
    const days: Array<{ key: string; count: number }> = [];
    for (let i = 364; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      days.push({ key: iso, count: data[iso] ?? 0 });
    }
    return days;
  }, [data]);
  // Use reduce instead of spread-into-Math.max to avoid stack issues on large arrays.
  const max = cells.reduce((m, c) => Math.max(m, c.count), 1);

  return (
    <View style={{ paddingHorizontal: space[16] }}>
      <AppText
        variant="caption1"
        color={themeTokens.textTertiary}
        style={{ marginBottom: space[8] }}
      >
        LAST 52 WEEKS
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 2 }}>
        {cells.map((c, i) => (
          <View
            key={`${c.key}${i}`}
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: c.count > 0 ? color : themeTokens.surface,
              opacity: c.count > 0 ? 0.4 + 0.6 * (c.count / max) : 1,
            }}
          />
        ))}
      </View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: space[8],
          marginTop: space[8],
        }}
      >
        <AppText variant="caption2" color={themeTokens.textTertiary}>
          Less
        </AppText>
        {[0.2, 0.4, 0.6, 0.8, 1].map((o) => (
          <View
            key={o}
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              backgroundColor: color,
              opacity: o,
            }}
          />
        ))}
        <AppText variant="caption2" color={themeTokens.textTertiary}>
          More
        </AppText>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function GymStatsScreen() {
  const { themeTokens } = useTheme();
  const router = useRouter();
  const { db } = useDatabaseSafe();
  const insets = useSafeAreaInsets();
  const getPillarColour = useUserPrefsStore((s) => s.getPillarColour);
  const gymColor = getPillarColour('gym');

  const [tab, setTab] = useState<Tab>('volume');
  const [loading, setLoading] = useState(true);
  const [sessionCount, setSessionCount] = useState(0);
  const [weeklyCount, setWeeklyCount] = useState(0);
  const [volumeData, setVolumeData] = useState<
    Array<{ primaryLift: string; date: string; totalVolume: number }>
  >([]);
  const [prData, setPrData] = useState<
    Array<{
      moduleId: string;
      primaryLift: string;
      maxValue: number;
      date: string;
    }>
  >([]);
  const [freqDayMap, setFreqDayMap] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const [vol, prs, freq] = await Promise.all([
        getVolumeByLift(db),
        getPRsAllLifts(db),
        getGymSessionFrequency(db),
      ]);
      setVolumeData(vol);
      setPrData(prs);
      const total = (freq as any[]).reduce((s: number, f: any) => s + f.count, 0);
      setSessionCount(total);

      const now = new Date();
      const oneJan = new Date(now.getFullYear(), 0, 1);
      const weekNum = Math.ceil(
        ((now.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7,
      );
      const currentWeek = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      setWeeklyCount(
        (freq as any[]).find((f: any) => f.week === currentWeek)?.count ?? 0,
      );

      const dayMap: Record<string, number> = {};
      for (const f of freq as any[]) {
        dayMap[f.week] = f.count;
      }
      setFreqDayMap(dayMap);
    } catch (e) {
      console.error('GymStats load error:', e);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const liftGroups = useMemo(() => {
    const m: Record<string, number> = {};
    for (const v of volumeData) {
      m[v.primaryLift] = (m[v.primaryLift] ?? 0) + v.totalVolume;
    }
    return Object.entries(m)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
  }, [volumeData]);
  const maxVolume = Math.max(...liftGroups.map(([, v]) => v), 1);
  // Compute once — was called twice in JSX causing double traversal.
  const totalVolume = liftGroups.reduce((s, [, v]) => s + v, 0);

  return (
    <View style={{ flex: 1, backgroundColor: themeTokens.background }}>
      {/* Header */}
      <View
        style={[
          HDR.wrap,
          {
            paddingTop: insets.top + space[8],
            backgroundColor: themeTokens.background,
            borderBottomColor: themeTokens.border,
          },
        ]}
      >
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/(tabs)')
          }
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color={themeTokens.textPrimary} />
        </Pressable>
        <AppText
          variant="title1"
          style={{ fontWeight: '700', flex: 1, marginLeft: space[12] }}
        >
          Gym Stats
        </AppText>
        <Pressable
          style={[HDR.calcBtn, { backgroundColor: gymColor }]}
          onPress={() => router.push('/tools/plate-calculator')}
        >
          <Feather name="tool" size={16} color="#fff" />
          <AppText variant="caption1" style={{ fontWeight: '600', color: '#fff' }}>
            Plate Calc
          </AppText>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={gymColor} />
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        >
          <View style={{ height: space[16] }} />
          <TabBar tab={tab} onChange={setTab} color={gymColor} />

          {/* ── Volume ── */}
          {tab === 'volume' && (
            <>
              <SummaryCard
                title="Total volume (all time)"
                value={
                  totalVolume > 0
                    ? `${Math.round(totalVolume / 1000)}k kg`
                    : '—'
                }
                sub="Tracked lifts"
                color={gymColor}
              />
              <View style={{ paddingHorizontal: space[16] }}>
                <AppText
                  variant="caption1"
                  color={themeTokens.textTertiary}
                  style={{ marginBottom: space[8] }}
                >
                  VOLUME BY LIFT (ALL TIME)
                </AppText>
                {liftGroups.length === 0 ? (
                  <View
                    style={[
                      EMPTY.wrap,
                      {
                        backgroundColor: themeTokens.surface,
                        borderColor: themeTokens.border,
                      },
                    ]}
                  >
                    <Feather
                      name="bar-chart-2"
                      size={28}
                      color={themeTokens.textTertiary}
                    />
                    <AppText
                      variant="body"
                      color={themeTokens.textTertiary}
                      style={{ textAlign: 'center', marginTop: space[8] }}
                    >
                      {'No lift data yet.\nTag routines with lift names to track volume.'}
                    </AppText>
                  </View>
                ) : (
                  liftGroups.map(([lift, vol]) => (
                    <View
                      key={lift}
                      style={[
                        VOL.row,
                        {
                          backgroundColor: themeTokens.surfaceElevated,
                          borderColor: themeTokens.border,
                        },
                      ]}
                    >
                      <AppText
                        variant="subheadline"
                        style={{ flex: 1 }}
                        numberOfLines={1}
                      >
                        {lift}
                      </AppText>
                      <MiniBar value={vol} max={maxVolume} color={gymColor} />
                      <AppText
                        variant="footnote"
                        style={{
                          fontWeight: '600',
                          color: gymColor,
                          width: 60,
                          textAlign: 'right',
                        }}
                      >
                        {vol >= 1000 ? `${(vol / 1000).toFixed(1)}k` : vol} kg
                      </AppText>
                    </View>
                  ))
                )}
              </View>
            </>
          )}

          {/* ── PRs ── */}
          {tab === 'prs' && (
            <>
              <SummaryCard
                title="Personal records"
                value={String(prData.length)}
                sub="Across all tracked lifts"
                color={gymColor}
              />
              <View style={{ paddingHorizontal: space[16] }}>
                <AppText
                  variant="caption1"
                  color={themeTokens.textTertiary}
                  style={{ marginBottom: space[8] }}
                >
                  RECORDS
                </AppText>
                {prData.length === 0 ? (
                  <View
                    style={[
                      EMPTY.wrap,
                      {
                        backgroundColor: themeTokens.surface,
                        borderColor: themeTokens.border,
                      },
                    ]}
                  >
                    <Feather name="award" size={28} color={themeTokens.textTertiary} />
                    <AppText
                      variant="body"
                      color={themeTokens.textTertiary}
                      style={{ textAlign: 'center', marginTop: space[8] }}
                    >
                      {'No PRs yet.\nLog gym sessions to start tracking personal records.'}
                    </AppText>
                  </View>
                ) : (
                  <View
                    style={{
                      backgroundColor: themeTokens.surfaceElevated,
                      borderColor: themeTokens.border,
                      borderRadius: radius.lg,
                      borderWidth: 1,
                      overflow: 'hidden',
                    }}
                  >
                    <View
                      style={[
                        PR.headerRow,
                        { borderBottomColor: themeTokens.border },
                      ]}
                    >
                      <AppText
                        variant="caption1"
                        color={themeTokens.textTertiary}
                        style={{ flex: 2 }}
                      >
                        LIFT
                      </AppText>
                      <AppText
                        variant="caption1"
                        color={themeTokens.textTertiary}
                        style={{ width: 55, textAlign: 'right' }}
                      >
                        WEIGHT
                      </AppText>
                      <AppText
                        variant="caption1"
                        color={themeTokens.textTertiary}
                        style={{ width: 60, textAlign: 'right' }}
                      >
                        EST 1RM
                      </AppText>
                      <AppText
                        variant="caption1"
                        color={themeTokens.textTertiary}
                        style={{ width: 60, textAlign: 'right' }}
                      >
                        DATE
                      </AppText>
                    </View>
                    {prData.map((pr, i) => (
                      <View
                        key={pr.moduleId}
                        style={[
                          PR.row,
                          i < prData.length - 1 && {
                            borderBottomWidth: StyleSheet.hairlineWidth,
                            borderBottomColor: themeTokens.border,
                          },
                        ]}
                      >
                        <AppText
                          variant="subheadline"
                          style={{ flex: 2, fontWeight: '600' }}
                          numberOfLines={1}
                        >
                          {pr.primaryLift}
                        </AppText>
                        <AppText
                          variant="subheadline"
                          style={{
                            width: 55,
                            textAlign: 'right',
                            color: gymColor,
                            fontWeight: '700',
                          }}
                        >
                          {pr.maxValue}kg
                        </AppText>
                        <AppText
                          variant="footnote"
                          color={themeTokens.textSecondary}
                          style={{ width: 60, textAlign: 'right' }}
                        >
                          {epley(pr.maxValue, 1)}kg
                        </AppText>
                        <AppText
                          variant="footnote"
                          color={themeTokens.textTertiary}
                          style={{ width: 60, textAlign: 'right' }}
                        >
                          {pr.date?.slice(5)}
                        </AppText>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </>
          )}

          {/* ── Frequency ── */}
          {tab === 'frequency' && (
            <>
              <SummaryCard
                title="Sessions this week"
                value={String(weeklyCount)}
                sub={`${sessionCount} total all time`}
                color={gymColor}
              />
              <FrequencyHeatmap data={freqDayMap} color={gymColor} />
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const HDR = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[16],
    paddingBottom: space[12],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  calcBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingHorizontal: space[12],
    paddingVertical: space[8],
    borderRadius: radius.md,
  },
});
const VOL = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    padding: space[12],
    borderRadius: radius.md,
    borderWidth: 1,
    marginBottom: space[8],
  },
});
const PR = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    paddingHorizontal: space[12],
    paddingVertical: space[8],
    borderBottomWidth: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[12],
    paddingVertical: space[12],
  },
});
const EMPTY = StyleSheet.create({
  wrap: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    padding: space[24],
  },
});
