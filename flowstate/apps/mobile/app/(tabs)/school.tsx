/**
 * School Tab — Academic pillar homebase
 *
 * Sections:
 *   1. Header with academic accent + date
 *   2. Hero stats — sessions today · open tasks · active courses
 *   3. Today's academic sessions → /session/[id]
 *   4. Courses grade overview (expandable) → /stats/academic/grades
 *   5. Academic tasks with inline toggle → /todos
 *   6. Weekly study time summary → /stats/academic
 *   7. Quick access — Grade Tracker · Academic Stats
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { space, radius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';
import { AppText } from '../../components/primitives/Text';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { useUserPrefsStore } from '../../stores/userPrefsStore';
import {
  getDayPlan,
  getSessionsForDay,
  getTasks,
  updateTask,
  getCourses,
  getCourseComponents,
  computeWeightedGrade,
  getTaggedTimeLogs,
} from '@flowstate/core';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AcademicSession {
  id: string;
  routineName: string;
  status: string;
  scheduledTime: string | null;
  durationMinutes: number;
}

interface AcademicTask {
  id: string;
  title: string;
  priority: number;
  completed: boolean;
  dueDate: string | null;
}

interface CourseRow {
  id: string;
  name: string;
  targetGrade: number | null;
  grade: number | null;
  componentCount: number;
  gradedCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gradeColor(grade: number | null, accent: string): string {
  if (grade === null) return '#888';
  if (grade >= 85) return '#22c55e';
  if (grade >= 70) return '#f59e0b';
  return '#ef4444';
}

function fmtGrade(g: number | null): string {
  if (g === null) return '—';
  return `${Math.round(g)}%`;
}

function fmtHours(seconds: number): string {
  if (seconds === 0) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h === 0) return `${m}m`;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function sessionStatusIcon(status: string): string {
  if (status === 'completed') return 'check-circle';
  if (status === 'in_progress') return 'clock';
  return 'play';
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function SchoolScreen() {
  const { themeTokens } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { db, isReady } = useDatabaseSafe();
  const academicColor = useUserPrefsStore(s => s.getPillarColour('academic'));

  const [sessions, setSessions] = useState<AcademicSession[]>([]);
  const [tasks, setTasks] = useState<AcademicTask[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [weekStudySeconds, setWeekStudySeconds] = useState(0);
  const [tagBreakdown, setTagBreakdown] = useState<Array<{ tag: string; seconds: number }>>([]);
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!db || !isReady) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const weekStart = (() => {
        const d = new Date();
        d.setDate(d.getDate() - d.getDay());
        return d.toISOString().slice(0, 10);
      })();

      // Today's academic sessions
      try {
        const dayPlan = await getDayPlan(db, today);
        if (dayPlan?.id) {
          const all: any[] = await getSessionsForDay(db, dayPlan.id);
          setSessions(
            all
              .filter((s: any) => (s.pillar ?? '') === 'academic' || (s.routineName ?? '').toLowerCase().includes('study'))
              .map((s: any) => ({
                id: s.id,
                routineName: s.routineName,
                status: s.status ?? 'pending',
                scheduledTime: s.scheduledTime ?? null,
                durationMinutes: s.durationMinutes ?? 0,
              })),
          );
        } else {
          setSessions([]);
        }
      } catch { setSessions([]); }

      // Tasks
      try {
        const raw: any[] = await getTasks(db, { pillar: 'academic' });
        setTasks(raw.map(t => ({
          id: t.id,
          title: t.title,
          priority: t.priority ?? 2,
          completed: !!t.completed,
          dueDate: t.dueDate ?? null,
        })));
      } catch { setTasks([]); }

      // Courses + weighted grades
      try {
        const rawCourses: any[] = await getCourses(db);
        const courseRows: CourseRow[] = [];
        for (const c of rawCourses) {
          const components: any[] = await getCourseComponents(db, c.id);
          const grade = computeWeightedGrade(components);
          courseRows.push({
            id: c.id,
            name: c.name,
            targetGrade: c.targetGrade ?? null,
            grade,
            componentCount: components.length,
            gradedCount: components.filter((x: any) => x.receivedGrade !== null).length,
          });
        }
        setCourses(courseRows);
      } catch { setCourses([]); }

      // Weekly study time
      try {
        const logs: any[] = await getTaggedTimeLogs(db, { pillar: 'academic' });
        let total = 0;
        const tagMap: Record<string, number> = {};
        for (const l of logs) {
          if ((l.startedAt ?? '') >= weekStart) total += l.durationSeconds ?? 0;
          tagMap[l.tag] = (tagMap[l.tag] ?? 0) + (l.durationSeconds ?? 0);
        }
        setWeekStudySeconds(total);
        setTagBreakdown(
          Object.entries(tagMap)
            .map(([tag, seconds]) => ({ tag, seconds }))
            .sort((a, b) => b.seconds - a.seconds)
            .slice(0, 5),
        );
      } catch { setWeekStudySeconds(0); setTagBreakdown([]); }

    } finally {
      setLoading(false);
    }
  }, [db, isReady]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleToggleTask = useCallback(async (task: AcademicTask) => {
    if (!db) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !task.completed;
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: next } : t));
    try {
      await updateTask(db, task.id, { completed: next });
    } catch {
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, completed: task.completed } : t));
    }
  }, [db]);

  const incompleteTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  const sessionStatusColor = (status: string) => {
    if (status === 'completed') return themeTokens.success;
    if (status === 'in_progress') return themeTokens.warning;
    return academicColor;
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeTokens.background }}>
      {/* Accent bar */}
      <View style={[S.accentBar, { backgroundColor: academicColor }]} />

      <ScrollView
        contentContainerStyle={[S.scroll, { paddingBottom: insets.bottom + space[32] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ─────────────────────────────────────────────── */}
        <View style={[S.header, { paddingTop: insets.top + space[20] }]}>
          <View style={S.headerLeft}>
            <AppText variant="title1" style={{ fontWeight: '800', color: academicColor }}>School</AppText>
            <AppText variant="subheadline" color={themeTokens.textSecondary}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </AppText>
          </View>
          <View style={S.headerActions}>
            <Pressable
              style={[S.iconBtn, { backgroundColor: academicColor + '20' }]}
              onPress={() => router.push('/stats/academic/grades' as any)}
            >
              <Feather name="award" size={18} color={academicColor} />
            </Pressable>
            <Pressable
              style={[S.iconBtn, { backgroundColor: academicColor + '20' }]}
              onPress={() => router.push('/stats/academic' as any)}
            >
              <Feather name="bar-chart-2" size={18} color={academicColor} />
            </Pressable>
          </View>
        </View>

        {/* ── Hero stats ─────────────────────────────────────────── */}
        <View style={S.heroRow}>
          <View style={[S.heroCard, { backgroundColor: academicColor + '18', borderColor: academicColor + '40' }]}>
            <AppText variant="title2" style={{ fontWeight: '800', color: academicColor }}>{sessions.length}</AppText>
            <AppText variant="caption1" color={themeTokens.textSecondary}>Sessions Today</AppText>
          </View>
          <View style={[S.heroCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
            <AppText variant="title2" style={{ fontWeight: '800', color: themeTokens.textPrimary }}>{incompleteTasks.length}</AppText>
            <AppText variant="caption1" color={themeTokens.textSecondary}>Open Tasks</AppText>
          </View>
          <View style={[S.heroCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
            <AppText variant="title2" style={{ fontWeight: '800', color: themeTokens.textPrimary }}>{courses.length}</AppText>
            <AppText variant="caption1" color={themeTokens.textSecondary}>Courses</AppText>
          </View>
        </View>

        {/* ── Weekly study time ──────────────────────────────────── */}
        {(weekStudySeconds > 0 || tagBreakdown.length > 0) && (
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <AppText variant="headline" style={{ fontWeight: '700' }}>This Week</AppText>
              <Pressable onPress={() => router.push('/stats/academic' as any)}>
                <AppText variant="caption1" style={{ color: academicColor }}>Full stats</AppText>
              </Pressable>
            </View>
            <View style={[S.studyCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
              <View style={S.studyTotalRow}>
                <Feather name="clock" size={16} color={academicColor} />
                <AppText variant="title3" style={{ fontWeight: '700', color: academicColor }}>{fmtHours(weekStudySeconds)}</AppText>
                <AppText variant="caption1" color={themeTokens.textSecondary}>study time this week</AppText>
              </View>
              {tagBreakdown.length > 0 && (
                <View style={S.tagBreakdown}>
                  {tagBreakdown.map((t, i) => {
                    const maxSec = tagBreakdown[0].seconds;
                    const frac = maxSec > 0 ? t.seconds / maxSec : 0;
                    return (
                      <View key={i} style={S.tagRow}>
                        <AppText variant="caption1" style={{ width: 90 }} numberOfLines={1} color={themeTokens.textSecondary}>{t.tag || 'Untagged'}</AppText>
                        <View style={[S.tagBarBg, { backgroundColor: themeTokens.border }]}>
                          <View style={[S.tagBarFill, { width: `${Math.round(frac * 100)}%` as any, backgroundColor: academicColor }]} />
                        </View>
                        <AppText variant="caption1" color={themeTokens.textSecondary} style={{ minWidth: 34, textAlign: 'right' }}>{fmtHours(t.seconds)}</AppText>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          </View>
        )}

        {/* ── Today's sessions ───────────────────────────────────── */}
        <View style={S.section}>
          <View style={S.sectionHeader}>
            <AppText variant="headline" style={{ fontWeight: '700' }}>Today's Sessions</AppText>
            <AppText variant="caption1" color={themeTokens.textSecondary}>{sessions.length} planned</AppText>
          </View>
          {sessions.length === 0 ? (
            <View style={[S.emptyCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
              <Feather name="calendar" size={24} color={themeTokens.textTertiary} />
              <AppText variant="body" color={themeTokens.textTertiary} style={{ marginTop: space[8] }}>No academic sessions today</AppText>
            </View>
          ) : sessions.map(sess => (
            <Pressable
              key={sess.id}
              style={({ pressed }) => [S.sessionCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }, pressed && { opacity: 0.75 }]}
              onPress={() => router.push(`/session/${sess.id}` as any)}
            >
              <View style={[S.stripe, { backgroundColor: academicColor }]} />
              <View style={S.sessionBody}>
                <AppText variant="headline" style={{ fontWeight: '600' }} numberOfLines={1}>{sess.routineName}</AppText>
                <AppText variant="footnote" color={themeTokens.textSecondary}>
                  {[sess.scheduledTime, sess.durationMinutes > 0 ? `${sess.durationMinutes} min` : null].filter(Boolean).join(' · ')}
                </AppText>
              </View>
              <View style={[S.statusBadge, { backgroundColor: sessionStatusColor(sess.status) + '20' }]}>
                <Feather name={sessionStatusIcon(sess.status) as any} size={14} color={sessionStatusColor(sess.status)} />
                <AppText variant="caption2" style={{ color: sessionStatusColor(sess.status), fontWeight: '600' }}>
                  {sess.status === 'completed' ? 'Done' : sess.status === 'in_progress' ? 'Active' : 'Start'}
                </AppText>
              </View>
            </Pressable>
          ))}
        </View>

        {/* ── Courses ────────────────────────────────────────────── */}
        <View style={S.section}>
          <View style={S.sectionHeader}>
            <AppText variant="headline" style={{ fontWeight: '700' }}>Courses</AppText>
            <Pressable onPress={() => router.push('/stats/academic/grades' as any)}>
              <AppText variant="caption1" style={{ color: academicColor }}>Manage</AppText>
            </Pressable>
          </View>
          {courses.length === 0 ? (
            <View style={[S.emptyCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
              <Feather name="book-open" size={24} color={themeTokens.textTertiary} />
              <AppText variant="body" color={themeTokens.textTertiary} style={{ marginTop: space[8] }}>No courses yet</AppText>
              <AppText variant="caption1" color={themeTokens.textTertiary}>Add courses in Grade Tracker</AppText>
            </View>
          ) : courses.map(course => {
            const isExpanded = expandedCourse === course.id;
            const gc = gradeColor(course.grade, academicColor);
            const forecast = course.targetGrade !== null && course.grade !== null
              ? course.targetGrade - course.grade
              : null;
            return (
              <View key={course.id} style={[S.courseCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
                <Pressable
                  style={S.courseHeader}
                  onPress={() => setExpandedCourse(isExpanded ? null : course.id)}
                >
                  <View style={[S.courseStripe, { backgroundColor: gc }]} />
                  <View style={{ flex: 1, gap: space[2] }}>
                    <AppText variant="subheadline" style={{ fontWeight: '600' }} numberOfLines={1}>{course.name}</AppText>
                    <AppText variant="caption1" color={themeTokens.textSecondary}>
                      {course.gradedCount}/{course.componentCount} graded
                    </AppText>
                  </View>
                  <View style={S.gradeRight}>
                    <AppText variant="title3" style={{ fontWeight: '800', color: gc }}>{fmtGrade(course.grade)}</AppText>
                    {forecast !== null && (
                      <AppText variant="caption2" style={{ color: forecast <= 0 ? themeTokens.success : themeTokens.warning }}>
                        {forecast <= 0 ? 'On track' : `Need +${Math.round(forecast)}%`}
                      </AppText>
                    )}
                  </View>
                  <Feather
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={themeTokens.textSecondary}
                    style={{ marginLeft: space[4] }}
                  />
                </Pressable>
                {isExpanded && (
                  <Pressable
                    style={[S.courseExpanded, { borderTopColor: themeTokens.border }]}
                    onPress={() => router.push('/stats/academic/grades' as any)}
                  >
                    <AppText variant="footnote" color={academicColor} style={{ fontWeight: '600' }}>
                      Open Grade Tracker →
                    </AppText>
                  </Pressable>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Academic tasks ─────────────────────────────────────── */}
        <View style={S.section}>
          <View style={S.sectionHeader}>
            <AppText variant="headline" style={{ fontWeight: '700' }}>Tasks</AppText>
            <Pressable
              onPress={() => router.push('/todos' as any)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Feather name="plus" size={16} color={academicColor} />
              <AppText variant="caption1" style={{ color: academicColor, fontWeight: '600' }}>New</AppText>
            </Pressable>
          </View>

          {incompleteTasks.length === 0 ? (
            <View style={[S.emptyCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
              <Feather name="check-square" size={24} color={themeTokens.textTertiary} />
              <AppText variant="body" color={themeTokens.textTertiary} style={{ marginTop: space[8] }}>No open academic tasks</AppText>
            </View>
          ) : incompleteTasks.map(task => (
            <View key={task.id} style={[S.taskCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
              <Pressable
                style={[S.taskCircle, { borderColor: academicColor }]}
                onPress={() => handleToggleTask(task)}
                hitSlop={8}
              />
              <View style={{ flex: 1, gap: space[2] }}>
                <AppText variant="body" numberOfLines={2}>{task.title}</AppText>
                {task.dueDate && (
                  <AppText variant="caption2" color={themeTokens.textSecondary}>{task.dueDate}</AppText>
                )}
              </View>
              {task.priority === 3 && <View style={[S.priDot, { backgroundColor: themeTokens.destructive }]} />}
              {task.priority === 2 && <View style={[S.priDot, { backgroundColor: themeTokens.warning }]} />}
            </View>
          ))}

          {completedTasks.length > 0 && (
            <View style={{ marginTop: space[8] }}>
              <AppText variant="caption2" color={themeTokens.textTertiary} style={{ marginBottom: space[4] }}>
                DONE ({completedTasks.length})
              </AppText>
              {completedTasks.map(task => (
                <Pressable
                  key={task.id}
                  style={[S.taskCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border, opacity: 0.55 }]}
                  onPress={() => handleToggleTask(task)}
                >
                  <View style={[S.taskCircle, { borderColor: academicColor, backgroundColor: academicColor }]}>
                    <Feather name="check" size={11} color="#fff" />
                  </View>
                  <AppText variant="body" style={{ flex: 1, textDecorationLine: 'line-through' }} color={themeTokens.textTertiary} numberOfLines={1}>
                    {task.title}
                  </AppText>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* ── Quick access ───────────────────────────────────────── */}
        <View style={S.section}>
          <AppText variant="headline" style={{ fontWeight: '700', marginBottom: space[12] }}>Quick Access</AppText>
          <View style={S.quickRow}>
            <Pressable
              style={[S.quickCard, { backgroundColor: academicColor + '18', borderColor: academicColor + '40' }]}
              onPress={() => router.push('/stats/academic/grades' as any)}
            >
              <Feather name="award" size={22} color={academicColor} />
              <AppText variant="subheadline" style={{ fontWeight: '600', color: academicColor, textAlign: 'center' }}>Grade Tracker</AppText>
            </Pressable>
            <Pressable
              style={[S.quickCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}
              onPress={() => router.push('/stats/academic' as any)}
            >
              <Feather name="trending-up" size={22} color={themeTokens.textSecondary} />
              <AppText variant="subheadline" style={{ fontWeight: '600', textAlign: 'center' }} color={themeTokens.textPrimary}>Study Stats</AppText>
            </Pressable>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  accentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, zIndex: 10 },
  scroll: { paddingHorizontal: space[16], gap: space[4] },

  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingBottom: space[16] },
  headerLeft: { gap: space[4] },
  headerActions: { flexDirection: 'row', gap: space[8], marginTop: space[4] },
  iconBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },

  heroRow: { flexDirection: 'row', gap: space[8], marginBottom: space[8] },
  heroCard: { flex: 1, borderRadius: radius.md, borderWidth: 1, padding: space[12], alignItems: 'center', gap: space[4] },

  section: { marginBottom: space[16] },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space[12] },
  emptyCard: { borderRadius: radius.md, borderWidth: 1, padding: space[20], alignItems: 'center', gap: space[4] },

  // Study time card
  studyCard: { borderRadius: radius.md, borderWidth: 1, padding: space[12], gap: space[12] },
  studyTotalRow: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
  tagBreakdown: { gap: space[8] },
  tagRow: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
  tagBarBg: { flex: 1, height: 4, borderRadius: 2, overflow: 'hidden' },
  tagBarFill: { height: 4, borderRadius: 2 },

  // Sessions
  sessionCard: { flexDirection: 'row', alignItems: 'stretch', borderRadius: radius.md, borderWidth: 1, overflow: 'hidden', marginBottom: space[8] },
  stripe: { width: 3 },
  sessionBody: { flex: 1, paddingHorizontal: space[12], paddingVertical: space[12], gap: space[4] },
  statusBadge: { paddingHorizontal: space[8], alignSelf: 'center', marginRight: space[12], borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: space[8] },

  // Courses
  courseCard: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden', marginBottom: space[8] },
  courseHeader: { flexDirection: 'row', alignItems: 'center', padding: space[12] },
  courseStripe: { width: 3, height: '100%', position: 'absolute', left: 0, top: 0, bottom: 0 },
  gradeRight: { alignItems: 'flex-end', gap: space[2], marginRight: space[4] },
  courseExpanded: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: space[12], paddingVertical: space[12] },

  // Tasks
  taskCard: { flexDirection: 'row', alignItems: 'center', gap: space[8], borderRadius: radius.md, borderWidth: 1, padding: space[12], marginBottom: space[8] },
  taskCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  priDot: { width: 7, height: 7, borderRadius: 4 },

  // Quick access
  quickRow: { flexDirection: 'row', gap: space[8] },
  quickCard: { flex: 1, borderRadius: radius.md, borderWidth: 1, padding: space[16], alignItems: 'center', gap: space[8] },
});
