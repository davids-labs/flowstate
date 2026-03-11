/**
 * Life Pillar Stats Screen
 *
 * Shows:
 * 1. Module streak leaderboard — ranked by current streak length for all
 *    modules with streakEnabled = true
 * 2. Streak breakdown: current / longest for each streak module
 * 3. Tagged time summary — total time logged per tag (from taggedTimeLogs)
 * 4. 7-day Log Activity summary — how many module values were logged each day
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { fontSize, spacing, borderRadius } from '../../../constants/theme';
import { useTheme } from '../../../constants/ThemeContext';
import { useDatabaseSafe } from '../../../components/DatabaseProvider';
import {
  getModuleSpecs,
  getAllStreaks,
  getTaggedTimeLogs,
  getModuleValuesForDate,
} from '@flowstate/core';
import type { StreakInfo } from '@flowstate/core';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${m % 60}m`;
  return `${m}m`;
}

function last7Days(): string[] {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function dayLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][d.getDay()];
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ModuleSpec {
  id: string;
  label: string;
  emoji?: string;
  streakEnabled?: number;
}

interface TagSummary {
  tag: string;
  totalSeconds: number;
  sessionCount: number;
  pillar?: string;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function LifeStatsScreen() {
  const { themeColors } = useTheme();
  const router = useRouter();
  const { db } = useDatabaseSafe();

  const [loading, setLoading] = useState(true);
  const [streakModules, setStreakModules] = useState<ModuleSpec[]>([]);
  const [streaks, setStreaks] = useState<Record<string, StreakInfo>>({});
  const [tagSummaries, setTagSummaries] = useState<TagSummary[]>([]);
  const [logCounts, setLogCounts] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      // 1. Load streak modules
      const allMods: ModuleSpec[] = await getModuleSpecs(db);
      const streakMods = allMods.filter((m) => Number(m.streakEnabled) === 1);
      setStreakModules(streakMods);

      // 2. Load streak info for all streak modules
      if (streakMods.length > 0) {
        const ids = streakMods.map((m) => m.id);
        const info = await getAllStreaks(db, ids);
        setStreaks(info);
      }

      // 3. Tagged time logs — aggregate by tag
      const logs: any[] = await getTaggedTimeLogs(db);
      const tagMap: Record<string, TagSummary> = {};
      for (const l of logs) {
        if (!tagMap[l.tag]) {
          tagMap[l.tag] = { tag: l.tag, totalSeconds: 0, sessionCount: 0, pillar: l.pillar };
        }
        tagMap[l.tag].totalSeconds += l.durationSeconds ?? 0;
        tagMap[l.tag].sessionCount += 1;
      }
      const summaries = Object.values(tagMap).sort((a, b) => b.totalSeconds - a.totalSeconds);
      setTagSummaries(summaries);

      // 4. 7-day log activity
      const days = last7Days();
      const counts: Record<string, number> = {};
      for (const d of days) {
        const vals = await getModuleValuesForDate(db, d);
        counts[d] = vals.length;
      }
      setLogCounts(counts);
    } catch (e) {
      console.error('LifeStats load error:', e);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const days = last7Days();
  const maxCount = Math.max(1, ...days.map((d) => logCounts[d] ?? 0));

  // Sort streak modules by current streak desc
  const sortedStreakMods = [...streakModules].sort(
    (a, b) => (streaks[b.id]?.currentStreak ?? 0) - (streaks[a.id]?.currentStreak ?? 0),
  );

  const totalTagSeconds = tagSummaries.reduce((s, t) => s + t.totalSeconds, 0);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
          <Feather name="arrow-left" size={22} color={themeColors.text} />
        </Pressable>
        <Text style={[styles.title, { color: themeColors.text }]}>🌱 Life Stats</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={themeColors.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* ── 7-day activity bar ─────────────────────────────────── */}
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>7-Day Log Activity</Text>
            <View style={[styles.activityCard, { backgroundColor: themeColors.surface }]}>
              <View style={styles.activityBars}>
                {days.map((d) => {
                  const count = logCounts[d] ?? 0;
                  const heightPct = count / maxCount;
                  return (
                    <View key={d} style={styles.activityBarCol}>
                      <View style={styles.activityBarTrack}>
                        <View
                          style={[
                            styles.activityBarFill,
                            {
                              height: `${Math.max(heightPct * 100, 4)}%`,
                              backgroundColor: count > 0 ? themeColors.accent : themeColors.surfaceBorder,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.activityLabel, { color: themeColors.muted }]}>
                        {dayLabel(d)}
                      </Text>
                      <Text style={[styles.activityCount, { color: themeColors.muted }]}>
                        {count}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <Text style={[styles.activityNote, { color: themeColors.muted }]}>
                Module logs per day across all pillars
              </Text>
            </View>

            {/* ── Streak leaderboard ─────────────────────────────────── */}
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Streak Leaderboard</Text>
            {sortedStreakMods.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: themeColors.surface }]}>
                <Text style={[styles.emptyText, { color: themeColors.muted }]}>
                  Enable streaks on any module to track daily consistency.
                </Text>
              </View>
            ) : (
              <View style={[styles.leaderboard, { backgroundColor: themeColors.surface }]}>
                {sortedStreakMods.map((mod, idx) => {
                  const info = streaks[mod.id];
                  const current = info?.currentStreak ?? 0;
                  const longest = info?.longestStreak ?? 0;
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                  return (
                    <View
                      key={mod.id}
                      style={[
                        styles.leaderRow,
                        idx < sortedStreakMods.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.surfaceBorder },
                      ]}
                    >
                      <Text style={styles.medal}>{medal}</Text>
                      <Text style={styles.modEmoji}>{mod.emoji ?? '📋'}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.modLabel, { color: themeColors.text }]}>{mod.label}</Text>
                        <Text style={[styles.modMeta, { color: themeColors.muted }]}>
                          Longest: {longest} day{longest !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <View style={styles.streakBadge}>
                        <Text style={[styles.streakNum, { color: current > 0 ? '#f59e0b' : themeColors.muted }]}>
                          {current}
                        </Text>
                        <Text style={[styles.streakFlame, { opacity: current > 0 ? 1 : 0.3 }]}>🔥</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* ── Tagged time summary ────────────────────────────────── */}
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Tagged Time</Text>
            {tagSummaries.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: themeColors.surface }]}>
                <Text style={[styles.emptyText, { color: themeColors.muted }]}>
                  Use the Tag Timer on the Today screen to track time by activity tag.
                </Text>
              </View>
            ) : (
              <View style={[styles.tagList, { backgroundColor: themeColors.surface }]}>
                {/* Total row */}
                <View style={[styles.tagTotalRow, { borderBottomColor: themeColors.surfaceBorder }]}>
                  <Text style={[styles.tagTotalLabel, { color: themeColors.muted }]}>Total tagged time</Text>
                  <Text style={[styles.tagTotalValue, { color: themeColors.text }]}>
                    {formatDuration(totalTagSeconds)}
                  </Text>
                </View>
                {tagSummaries.map((t, i) => {
                  const pct = totalTagSeconds > 0 ? t.totalSeconds / totalTagSeconds : 0;
                  return (
                    <View
                      key={t.tag}
                      style={[
                        styles.tagRow,
                        i < tagSummaries.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.surfaceBorder },
                      ]}
                    >
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.tagName, { color: themeColors.text }]}>#{t.tag}</Text>
                        <Text style={[styles.tagMeta, { color: themeColors.muted }]}>
                          {t.sessionCount} session{t.sessionCount !== 1 ? 's' : ''}
                          {t.pillar ? ` · ${t.pillar}` : ''}
                        </Text>
                        {/* Progress bar */}
                        <View style={[styles.tagBar, { backgroundColor: themeColors.background }]}>
                          <View style={[styles.tagBarFill, { width: `${pct * 100}%`, backgroundColor: themeColors.accent }]} />
                        </View>
                      </View>
                      <Text style={[styles.tagDuration, { color: themeColors.accent }]}>
                        {formatDuration(t.totalSeconds)}
                      </Text>
                    </View>
                  );
                })}
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
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 56,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: fontSize.xl, fontWeight: '700' },
  content: { padding: spacing.md },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  // 7-day activity
  activityCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  activityBars: {
    flexDirection: 'row',
    height: 80,
    gap: 4,
    alignItems: 'flex-end',
  },
  activityBarCol: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    height: '100%',
    justifyContent: 'flex-end',
  },
  activityBarTrack: {
    width: '70%',
    height: 56,
    justifyContent: 'flex-end',
  },
  activityBarFill: {
    width: '100%',
    borderRadius: 3,
  },
  activityLabel: { fontSize: 10 },
  activityCount: { fontSize: 9 },
  activityNote: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  // Leaderboard
  leaderboard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  leaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  medal: { fontSize: 16, width: 24 },
  modEmoji: { fontSize: 20, width: 28 },
  modLabel: { fontSize: fontSize.sm, fontWeight: '600' },
  modMeta: { fontSize: fontSize.xs, marginTop: 1 },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  streakNum: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  streakFlame: { fontSize: 18 },
  // Tag list
  tagList: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  tagTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tagTotalLabel: { fontSize: fontSize.xs },
  tagTotalValue: { fontSize: fontSize.md, fontWeight: '700' },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tagName: { fontSize: fontSize.sm, fontWeight: '600' },
  tagMeta: { fontSize: fontSize.xs, marginTop: 1 },
  tagBar: {
    height: 4,
    borderRadius: 2,
    marginTop: 4,
    overflow: 'hidden',
  },
  tagBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  tagDuration: { fontSize: fontSize.md, fontWeight: '700', minWidth: 50, textAlign: 'right' },
  // Empty states
  emptyCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 18,
  },
});
