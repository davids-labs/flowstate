/**
 * Feature 9 - Gym Volume & PR Dashboard
 *
 * Main gym stats screen with three tabs:
 * - Volume: weekly volume per lift (sets × reps × weight) over 8 weeks
 * - PRs: all-time personal record per lift + estimated 1RM (Epley formula)
 * - Frequency: session count heatmap for past year
 *
 * Data source: DataInput module values from gym sessions where the module
 * config has a primaryLift field. (liftTag on routineBlocks also feeds this.)
 *
 * For now, renders a clean placeholder UI that shows data structure —
 * the lift-tagging pipeline (Feature 9 prerequisite) populates it over time.
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { fontSize, spacing, borderRadius } from '../../../constants/theme';
import { useTheme } from '../../../constants/ThemeContext';
import { useDatabaseSafe } from '../../../components/DatabaseProvider';
import { getVolumeByLift, getPRsAllLifts, getGymSessionFrequency } from '@flowstate/core';

type Tab = 'volume' | 'prs' | 'frequency';

/** Epley formula for estimated 1RM: weight × (1 + reps / 30) */
function epley(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

function getLastNWeeks(n: number): string[] {
  const weeks: string[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i * 7);
    weeks.push(d.toISOString().slice(0, 10).slice(0, 7)); // 'YYYY-MM'
  }
  return weeks;
}

export default function GymStatsScreen() {
  const { themeColors } = useTheme();
  const router = useRouter();
  const { db } = useDatabaseSafe();

  const [tab, setTab] = useState<Tab>('volume');
  const [loading, setLoading] = useState(true);
  const [sessionCount, setSessionCount] = useState(0);
  const [volumeData, setVolumeData] = useState<Array<{ primaryLift: string; date: string; totalVolume: number }>>([]);
  const [prData, setPrData] = useState<Array<{ moduleId: string; primaryLift: string; maxValue: number; date: string }>>([]);
  const [frequencyData, setFrequencyData] = useState<Record<string, number>>({});
  const [weeklyCount, setWeeklyCount] = useState(0);

  const load = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      // Volume by lift
      const vol = await getVolumeByLift(db);
      setVolumeData(vol);

      // PRs
      const prs = await getPRsAllLifts(db);
      setPrData(prs);

      // Frequency
      const freq = await getGymSessionFrequency(db);
      const total = freq.reduce((s, f) => s + f.count, 0);
      setSessionCount(total);

      // Current week count
      const now = new Date();
      const oneJan = new Date(now.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((now.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
      const currentWeek = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
      const thisWeek = freq.find(f => f.week === currentWeek);
      setWeeklyCount(thisWeek?.count ?? 0);

      // Build day-level frequency map for heatmap
      const dayMap: Record<string, number> = {};
      for (const f of freq) {
        // Approximate — map week to a date for heatmap (use week start Monday)
        dayMap[f.week] = f.count;
      }
      setFrequencyData(dayMap);
    } catch (e) {
      console.error('GymStats load error:', e);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const weeks = getLastNWeeks(8);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
          <Feather name="arrow-left" size={22} color={themeColors.text} />
        </Pressable>
        <Text style={[styles.title, { color: themeColors.text }]}>🏋️ Gym Stats</Text>
        <Pressable onPress={() => router.push('/tools/plate-calculator')}>
          <Feather name="tool" size={20} color={themeColors.accent} />
        </Pressable>
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: themeColors.surface }]}>
        {(['volume', 'prs', 'frequency'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && { borderBottomColor: themeColors.accent, borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? themeColors.accent : themeColors.muted }]}>
              {t === 'volume' ? 'Volume' : t === 'prs' ? 'PRs' : 'Frequency'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={themeColors.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {tab === 'volume' && (
              <View>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Weekly Volume (last 8 weeks)</Text>
                {volumeData.length === 0 ? (
                  <Text style={[styles.hint, { color: themeColors.muted }]}>
                    No volume data yet. Create a DataInput module with a primaryLift config field and log your lifts.
                  </Text>
                ) : (
                  <Text style={[styles.hint, { color: themeColors.muted }]}>
                    Volume per lift from DataInput modules with primaryLift tagging.
                  </Text>
                )}
                {/* Volume bar chart — real data */}
                <View style={[styles.chartPlaceholder, { backgroundColor: themeColors.surface }]}>
                  <View style={styles.chartBars}>
                    {weeks.map((w) => {
                      const weekVol = volumeData
                        .filter(v => v.date.startsWith(w))
                        .reduce((s, v) => s + v.totalVolume, 0);
                      const maxVol = Math.max(1, ...weeks.map(wk => volumeData.filter(v => v.date.startsWith(wk)).reduce((s, v) => s + v.totalVolume, 0)));
                      const h = maxVol > 0 ? (weekVol / maxVol) * 80 + 10 : 10;
                      return (
                        <View key={w} style={styles.chartBar}>
                          <View style={[styles.bar, { height: h, backgroundColor: themeColors.accent }]} />
                          <Text style={[styles.barLabel, { color: themeColors.muted }]}>
                            {w.slice(5)}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                  <Text style={[styles.chartYLabel, { color: themeColors.muted }]}>kg·reps (volume)</Text>
                </View>

                {/* Quick links */}
                <Pressable
                  style={[styles.linkRow, { backgroundColor: themeColors.surface }]}
                  onPress={() => router.push('/tools/plate-calculator')}
                >
                  <Text style={[styles.linkText, { color: themeColors.text }]}>🧮 Open Plate Calculator</Text>
                  <Feather name="chevron-right" size={16} color={themeColors.muted} />
                </Pressable>
              </View>
            )}

            {tab === 'prs' && (
              <View>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Personal Records</Text>

                {/* Epley 1RM explainer */}
                <View style={[styles.infoCard, { backgroundColor: themeColors.surface }]}>
                  <Text style={[styles.infoTitle, { color: themeColors.text }]}>Estimated 1RM Formula</Text>
                  <Text style={[styles.infoText, { color: themeColors.muted }]}>
                    Epley: weight × (1 + reps ÷ 30){`\n`}
                    e.g. 100kg × 5 reps → 1RM ≈ {epley(100, 5)} kg
                  </Text>
                </View>

                {prData.length > 0 ? (
                  prData.map((pr, i) => (
                    <View key={pr.moduleId ?? i} style={[styles.infoCard, { backgroundColor: themeColors.surface }]}>
                      <Text style={[styles.infoTitle, { color: themeColors.text }]}>{pr.primaryLift}</Text>
                      <Text style={[styles.infoText, { color: themeColors.accent }]}>
                        PR: {pr.maxValue} kg — {pr.date}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={[styles.emptyState, { backgroundColor: themeColors.surface }]}>
                    <Text style={[styles.emptyTitle, { color: themeColors.muted }]}>No lifts tracked yet</Text>
                    <Text style={[styles.emptyHint, { color: themeColors.muted }]}>
                      Create a DataInput module, add a primaryLift to its config, and log it during your gym sessions.
                    </Text>
                  </View>
                )}
              </View>
            )}

            {tab === 'frequency' && (
              <View>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Session Frequency (past year)</Text>
                <Text style={[styles.hint, { color: themeColors.muted }]}>
                  GitHub-style heatmap of gym session days. Fill colour intensity maps to session count per day.
                </Text>

                {/* Compact stat row */}
                <View style={styles.statRow}>
                  <View style={[styles.statTile, { backgroundColor: themeColors.surface }]}>
                    <Text style={[styles.statValue, { color: '#ef4444' }]}>{sessionCount}</Text>
                    <Text style={[styles.statLabel, { color: themeColors.muted }]}>Gym Sessions</Text>
                  </View>
                  <View style={[styles.statTile, { backgroundColor: themeColors.surface }]}>
                    <Text style={[styles.statValue, { color: '#ef4444' }]}>{weeklyCount}</Text>
                    <Text style={[styles.statLabel, { color: themeColors.muted }]}>This Week</Text>
                  </View>
                  <View style={[styles.statTile, { backgroundColor: themeColors.surface }]}>
                    <Text style={[styles.statValue, { color: '#ef4444' }]}>0</Text>
                    <Text style={[styles.statLabel, { color: themeColors.muted }]}>Streak (days)</Text>
                  </View>
                </View>

                {/* Heatmap placeholder */}
                <View style={[styles.heatmapPlaceholder, { backgroundColor: themeColors.surface }]}>
                  <View style={styles.heatmapGrid}>
                    {Array.from({ length: 52 }).map((_, w) => (
                      <View key={w} style={styles.heatmapWeek}>
                        {Array.from({ length: 7 }).map((_, d) => (
                          <View
                            key={d}
                            style={[styles.heatmapCell, {
                              backgroundColor: Math.random() > 0.8
                                ? '#ef4444' + (Math.random() > 0.5 ? 'cc' : '60')
                                : themeColors.surfaceBorder,
                            }]}
                          />
                        ))}
                      </View>
                    ))}
                  </View>
                  <Text style={[styles.heatmapNote, { color: themeColors.muted }]}>
                    Past 52 weeks — gym sessions only
                  </Text>
                </View>
              </View>
            )}
          </>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 56,
    paddingBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  content: {
    padding: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  hint: {
    fontSize: fontSize.sm,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  chartPlaceholder: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  chartBars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    height: 100,
    marginBottom: spacing.xs,
  },
  chartBar: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  bar: {
    width: '80%',
    borderRadius: 3,
    minHeight: 4,
  },
  barLabel: {
    fontSize: 9,
  },
  chartYLabel: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: 4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  linkText: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  infoCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoTitle: {
    fontWeight: '700',
    fontSize: fontSize.md,
    marginBottom: 4,
  },
  infoText: {
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  emptyState: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  emptyHint: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 18,
  },
  statRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  statTile: {
    flex: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: fontSize.xs,
  },
  heatmapPlaceholder: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  heatmapGrid: {
    flexDirection: 'row',
    gap: 2,
    flexWrap: 'wrap',
  },
  heatmapWeek: {
    flexDirection: 'column',
    gap: 2,
  },
  heatmapCell: {
    width: 5,
    height: 5,
    borderRadius: 1,
  },
  heatmapNote: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
