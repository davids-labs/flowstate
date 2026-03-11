/**
 * Academic Stats — index screen
 *
 * Two tabs:
 * - Study Time: hours per session tag per week (stacked summary), recent study
 *   sessions (pillar=academic), and a weekly summary bar chart placeholder
 * - Grades: taps through to app/stats/academic/grades.tsx
 *
 * Data:
 * - Study sessions: getSessions filtered by pillar='academic'
 * - Study time by tag: getTaggedTimeLogs filtered by pillar='academic'
 * - Grade courses: getCourses → computeWeightedGrade per course
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
  getTaggedTimeLogs,
  getCourses,
  getCourseComponents,
  computeWeightedGrade,
} from '@flowstate/core';

type Tab = 'study' | 'grades';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatHours(seconds: number): string {
  const h = seconds / 3600;
  if (h < 1) return `${Math.round(h * 60)}m`;
  return `${h.toFixed(1)}h`;
}

function getWeekStart(offset = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() - offset * 7);
  return d.toISOString().slice(0, 10);
}

function gradeColor(grade: number | null): string {
  if (grade === null) return '#888';
  if (grade >= 85) return '#22c55e';
  if (grade >= 70) return '#f59e0b';
  return '#ef4444';
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AcademicStatsScreen() {
  const { themeColors } = useTheme();
  const router = useRouter();
  const { db } = useDatabaseSafe();

  const [tab, setTab] = useState<Tab>('study');
  const [loading, setLoading] = useState(true);

  // Study Time data
  const [weeklyStudySeconds, setWeeklyStudySeconds] = useState(0);
  const [tagBreakdown, setTagBreakdown] = useState<Array<{ tag: string; seconds: number }>>([]);
  const [recentSessions, setRecentSessions] = useState<any[]>([]);

  // Grades data
  const [courses, setCoursesState] = useState<any[]>([]);
  const [courseGrades, setCourseGrades] = useState<Record<string, number | null>>({});

  const load = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      // ── Study time ────────────────────────────────────────────────────────
      const weekStart = getWeekStart(0);

      // Tagged time logs for academic pillar
      const logs: any[] = await getTaggedTimeLogs(db, { pillar: 'academic' });
      let weekTotal = 0;
      const tagMap: Record<string, number> = {};
      for (const l of logs) {
        // Only count logs from this week
        if ((l.startedAt ?? '') >= weekStart) {
          weekTotal += l.durationSeconds ?? 0;
        }
        tagMap[l.tag] = (tagMap[l.tag] ?? 0) + (l.durationSeconds ?? 0);
      }
      setWeeklyStudySeconds(weekTotal);
      const tagArr = Object.entries(tagMap)
        .map(([tag, seconds]) => ({ tag, seconds }))
        .sort((a, b) => b.seconds - a.seconds)
        .slice(0, 8);
      setTagBreakdown(tagArr);

      // Recent sessions with academic pillar
      // No global getSessions exists, query via tagged time logs instead;
      // academic sessions show up in the tag log when using the Tag Timer.
      // We use recentSessions to list recent tagged academic logs instead.
      const academicLogs = logs
        .filter((l: any) => l.endedAt != null)
        .slice(0, 10)
        .map((l: any, i: number) => ({
          id: l.id ?? String(i),
          name: l.tag ? `#${l.tag}` : 'Study session',
          scheduledDate: (l.startedAt ?? '').slice(0, 10),
          totalDurationMs: (l.durationSeconds ?? 0) * 1000,
          totalPausedMs: 0,
        }));
      setRecentSessions(academicLogs);

      // ── Grades ────────────────────────────────────────────────────────────
      const allCourses: any[] = await getCourses(db);
      setCoursesState(allCourses);
      const grades: Record<string, number | null> = {};
      for (const c of allCourses) {
        const comps = await getCourseComponents(db, c.id);
        grades[c.id] = computeWeightedGrade(comps);
      }
      setCourseGrades(grades);
    } catch (e) {
      console.error('AcademicStats load error:', e);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const totalTagSeconds = tagBreakdown.reduce((s, t) => s + t.seconds, 0);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
          <Feather name="arrow-left" size={22} color={themeColors.text} />
        </Pressable>
        <Text style={[styles.title, { color: themeColors.text }]}>📚 Academic Stats</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Tab bar */}
      <View style={[styles.tabBar, { backgroundColor: themeColors.surface }]}>
        {(['study', 'grades'] as Tab[]).map((t) => (
          <Pressable
            key={t}
            style={[styles.tab, tab === t && { borderBottomColor: '#3b82f6', borderBottomWidth: 2 }]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, { color: tab === t ? '#3b82f6' : themeColors.muted }]}>
              {t === 'study' ? 'Study Time' : 'Grades'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color="#3b82f6" style={{ marginTop: 40 }} />
        ) : (
          <>
            {/* ── Study Time tab ── */}
            {tab === 'study' && (
              <View>
                {/* This week summary */}
                <View style={styles.statRow}>
                  <View style={[styles.statTile, { backgroundColor: themeColors.surface }]}>
                    <Text style={[styles.statValue, { color: '#3b82f6' }]}>{formatHours(weeklyStudySeconds)}</Text>
                    <Text style={[styles.statLabel, { color: themeColors.muted }]}>This Week</Text>
                  </View>
                  <View style={[styles.statTile, { backgroundColor: themeColors.surface }]}>
                    <Text style={[styles.statValue, { color: '#3b82f6' }]}>{tagBreakdown.length}</Text>
                    <Text style={[styles.statLabel, { color: themeColors.muted }]}>Subjects Tracked</Text>
                  </View>
                  <View style={[styles.statTile, { backgroundColor: themeColors.surface }]}>
                    <Text style={[styles.statValue, { color: '#3b82f6' }]}>{recentSessions.length}</Text>
                    <Text style={[styles.statLabel, { color: themeColors.muted }]}>Sessions Total</Text>
                  </View>
                </View>

                {/* Tag breakdown */}
                {tagBreakdown.length > 0 ? (
                  <View>
                    <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Time by Subject</Text>
                    <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
                      {tagBreakdown.map((t, i) => {
                        const pct = totalTagSeconds > 0 ? t.seconds / totalTagSeconds : 0;
                        return (
                          <View
                            key={t.tag}
                            style={[
                              styles.tagRow,
                              i < tagBreakdown.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.surfaceBorder },
                            ]}
                          >
                            <View style={{ flex: 1 }}>
                              <Text style={[styles.tagName, { color: themeColors.text }]}>#{t.tag}</Text>
                              <View style={[styles.progressTrack, { backgroundColor: themeColors.background }]}>
                                <View style={[styles.progressFill, { width: `${pct * 100}%`, backgroundColor: '#3b82f6' }]} />
                              </View>
                            </View>
                            <Text style={[styles.tagTime, { color: '#3b82f6' }]}>{formatHours(t.seconds)}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : (
                  <View style={[styles.emptyCard, { backgroundColor: themeColors.surface }]}>
                    <Text style={[styles.emptyTitle, { color: themeColors.muted }]}>No study time logged</Text>
                    <Text style={[styles.emptyHint, { color: themeColors.muted }]}>
                      Use the Tag Timer on Today screen with an 'academic' pillar to track study time by subject.
                    </Text>
                  </View>
                )}

                {/* Recent sessions */}
                {recentSessions.length > 0 && (
                  <View style={{ marginTop: spacing.md }}>
                    <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Recent Academic Sessions</Text>
                    <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
                      {recentSessions.slice(0, 5).map((s: any, i: number) => (
                        <View
                          key={s.id}
                          style={[
                            styles.sessionRow,
                            i < Math.min(recentSessions.length, 5) - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeColors.surfaceBorder },
                          ]}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.sessionName, { color: themeColors.text }]}>{s.name ?? 'Session'}</Text>
                            <Text style={[styles.sessionDate, { color: themeColors.muted }]}>{s.scheduledDate ?? ''}</Text>
                          </View>
                          {s.totalPausedMs !== null && (
                            <Text style={[styles.sessionDuration, { color: '#3b82f6' }]}>
                              {formatHours(Math.floor(((s.totalDurationMs ?? 0) - (s.totalPausedMs ?? 0)) / 1000))}
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* ── Grades tab ── */}
            {tab === 'grades' && (
              <View>
                <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Course Grades</Text>
                {courses.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: themeColors.surface }]}>
                    <Text style={[styles.emptyTitle, { color: themeColors.muted }]}>No courses yet</Text>
                    <Text style={[styles.emptyHint, { color: themeColors.muted }]}>
                      Open the Grade Tracker to add courses and grade components.
                    </Text>
                    <Pressable
                      style={[styles.openGradesBtn, { backgroundColor: '#3b82f6' }]}
                      onPress={() => router.push('/stats/academic/grades')}
                    >
                      <Text style={styles.openGradesBtnText}>Open Grade Tracker</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    {courses.map((c: any) => {
                      const grade = courseGrades[c.id];
                      return (
                        <Pressable
                          key={c.id}
                          style={[styles.courseCard, { backgroundColor: themeColors.surface }]}
                          onPress={() => router.push('/stats/academic/grades')}
                        >
                          <View style={{ flex: 1 }}>
                            <Text style={[styles.courseName, { color: themeColors.text }]}>{c.name}</Text>
                            {c.targetGrade != null && (
                              <Text style={[styles.courseTarget, { color: themeColors.muted }]}>Target: {c.targetGrade}%</Text>
                            )}
                          </View>
                          <Text style={[styles.courseGrade, { color: gradeColor(grade) }]}>
                            {grade !== null ? `${grade.toFixed(1)}%` : '—'}
                          </Text>
                          <Feather name="chevron-right" size={16} color={themeColors.muted} />
                        </Pressable>
                      );
                    })}
                    <Pressable
                      style={[styles.manageBtn, { backgroundColor: themeColors.surface }]}
                      onPress={() => router.push('/stats/academic/grades')}
                    >
                      <Feather name="edit-2" size={14} color="#3b82f6" />
                      <Text style={[styles.manageBtnText, { color: '#3b82f6' }]}>Manage Courses & Components</Text>
                    </Pressable>
                  </>
                )}
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
  tabText: { fontSize: fontSize.sm, fontWeight: '600' },
  content: { padding: spacing.md },
  statRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.md },
  statTile: {
    flex: 1,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statValue: { fontSize: fontSize.xl, fontWeight: '700' },
  statLabel: { fontSize: fontSize.xs },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  card: { borderRadius: borderRadius.lg, overflow: 'hidden', marginBottom: spacing.md },
  tagRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tagName: { fontSize: fontSize.sm, fontWeight: '600', marginBottom: 3 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2 },
  tagTime: { fontSize: fontSize.md, fontWeight: '700', minWidth: 44, textAlign: 'right' },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  sessionName: { fontSize: fontSize.sm, fontWeight: '600' },
  sessionDate: { fontSize: fontSize.xs },
  sessionDuration: { fontSize: fontSize.sm, fontWeight: '600' },
  courseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.sm,
  },
  courseName: { fontSize: fontSize.md, fontWeight: '700' },
  courseTarget: { fontSize: fontSize.xs, marginTop: 1 },
  courseGrade: { fontSize: fontSize.lg, fontWeight: '700', minWidth: 52, textAlign: 'right' },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  manageBtnText: { fontSize: fontSize.sm, fontWeight: '600' },
  emptyCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
  },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '600' },
  emptyHint: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 18 },
  openGradesBtn: {
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginTop: spacing.sm,
  },
  openGradesBtnText: { color: '#fff', fontWeight: '700', fontSize: fontSize.sm },
});
