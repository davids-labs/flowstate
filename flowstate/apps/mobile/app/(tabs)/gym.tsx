/**
 * Gym Tab — dedicated gym overview
 * Today's gym sessions · gym tasks · quick nav to Plate Calc & Gym Stats
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
  getPRsAllLifts,
} from '@flowstate/core';

interface GymSession {
  id: string;
  routineName: string;
  status: string;
  scheduledTime: string | null;
  durationMinutes: number;
}

interface GymTask {
  id: string;
  title: string;
  priority: number;
  completed: boolean;
  dueDate: string | null;
}

interface PRRow {
  lift: string;
  weight: number;
  date: string;
}

export default function GymScreen() {
  const { themeTokens } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { db, isReady } = useDatabaseSafe();
  const gymColor = useUserPrefsStore(s => s.getPillarColour('gym'));

  const [sessions, setSessions] = useState<GymSession[]>([]);
  const [tasks, setTasksData] = useState<GymTask[]>([]);
  const [prs, setPrs] = useState<PRRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!db || !isReady) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);
      // Gym sessions for today
      try {
        const dayPlan = await getDayPlan(db, today);
        if (dayPlan?.id) {
          const allSessions: any[] = await getSessionsForDay(db, dayPlan.id);
          const gymSessions: GymSession[] = allSessions
            .filter((s: any) => (s.pillar ?? '') === 'gym' || (s.routineName ?? '').toLowerCase().includes('gym'))
            .map((s: any) => ({
              id: s.id,
              routineName: s.routineName,
              status: s.status ?? 'pending',
              scheduledTime: s.scheduledTime ?? null,
              durationMinutes: s.durationMinutes ?? 0,
            }));
          setSessions(gymSessions);
        } else {
          setSessions([]);
        }
      } catch { setSessions([]); }

      // Gym tasks
      try {
        const rawTasks: any[] = await getTasks(db, { pillar: 'gym' });
        setTasksData(rawTasks.map(t => ({
          id: t.id,
          title: t.title,
          priority: t.priority ?? 2,
          completed: !!t.completed,
          dueDate: t.dueDate ?? null,
        })));
      } catch { setTasksData([]); }

      // PRs (top 5 by max weight)
      try {
        const rawPRs: any[] = await getPRsAllLifts(db);
        setPrs(rawPRs.slice(0, 5).map((r: any) => ({
          lift: r.primaryLift ?? r.label ?? '—',
          weight: r.maxValue ?? 0,
          date: r.date ?? '',
        })));
      } catch { setPrs([]); }
    } finally {
      setLoading(false);
    }
  }, [db, isReady]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleToggleTask = useCallback(async (task: GymTask) => {
    if (!db) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !task.completed;
    // optimistic update
    setTasksData(prev => prev.map(t => t.id === task.id ? { ...t, completed: next } : t));
    try {
      await updateTask(db, task.id, { completed: next });
    } catch (e) {
      console.error('Failed to toggle task:', e);
      // revert
      setTasksData(prev => prev.map(t => t.id === task.id ? { ...t, completed: task.completed } : t));
    }
  }, [db]);

  const sessionStatusIcon = (status: string) => {
    if (status === 'completed') return 'check-circle';
    if (status === 'in_progress') return 'clock';
    return 'play';
  };

  const sessionStatusColor = (status: string) => {
    if (status === 'completed') return themeTokens.success;
    if (status === 'in_progress') return themeTokens.warning;
    return gymColor;
  };

  const incompleteTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);

  return (
    <View style={{ flex: 1, backgroundColor: themeTokens.background }}>
      {/* Gym accent bar */}
      <View style={[S.accentBar, { backgroundColor: gymColor, paddingTop: insets.top }]} />

      <ScrollView
        contentContainerStyle={[S.scroll, { paddingBottom: insets.bottom + space[32] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[S.header, { paddingTop: insets.top + space[20] }]}>
          <View style={S.headerLeft}>
            <AppText variant="title1" style={{ fontWeight: '800', color: gymColor }}>Gym</AppText>
            <AppText variant="subheadline" color={themeTokens.textSecondary}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </AppText>
          </View>
          <View style={S.headerActions}>
            <Pressable
              style={[S.iconBtn, { backgroundColor: gymColor + '20' }]}
              onPress={() => router.push('/tools/plate-calculator' as any)}
            >
              <Feather name="sliders" size={18} color={gymColor} />
            </Pressable>
            <Pressable
              style={[S.iconBtn, { backgroundColor: gymColor + '20' }]}
              onPress={() => router.push('/stats/gym' as any)}
            >
              <Feather name="bar-chart-2" size={18} color={gymColor} />
            </Pressable>
          </View>
        </View>

        {/* Hero stats row */}
        <View style={S.heroRow}>
          <View style={[S.heroCard, { backgroundColor: gymColor + '18', borderColor: gymColor + '40' }]}>
            <AppText variant="title2" style={{ fontWeight: '800', color: gymColor }}>{sessions.length}</AppText>
            <AppText variant="caption1" color={themeTokens.textSecondary}>Sessions Today</AppText>
          </View>
          <View style={[S.heroCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
            <AppText variant="title2" style={{ fontWeight: '800', color: themeTokens.textPrimary }}>{incompleteTasks.length}</AppText>
            <AppText variant="caption1" color={themeTokens.textSecondary}>Open Tasks</AppText>
          </View>
          <View style={[S.heroCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
            <AppText variant="title2" style={{ fontWeight: '800', color: themeTokens.textPrimary }}>{prs.length}</AppText>
            <AppText variant="caption1" color={themeTokens.textSecondary}>Tracked Lifts</AppText>
          </View>
        </View>

        {/* Today's sessions */}
        <View style={S.section}>
          <View style={S.sectionHeader}>
            <AppText variant="headline" style={{ fontWeight: '700' }}>Today's Sessions</AppText>
            <AppText variant="caption1" color={themeTokens.textSecondary}>{sessions.length} planned</AppText>
          </View>
          {sessions.length === 0 ? (
            <View style={[S.emptyCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
              <Feather name="calendar" size={24} color={themeTokens.textTertiary} />
              <AppText variant="body" color={themeTokens.textTertiary} style={{ marginTop: space[8] }}>No gym sessions planned for today</AppText>
              <AppText variant="caption1" color={themeTokens.textTertiary}>Plan sessions in the Plan tab</AppText>
            </View>
          ) : (
            sessions.map(sess => (
              <Pressable
                key={sess.id}
                style={({ pressed }) => [S.sessionCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }, pressed && { opacity: 0.75 }]}
                onPress={() => router.push(`/session/${sess.id}` as any)}
              >
                <View style={[S.stripe, { backgroundColor: gymColor }]} />
                <View style={S.sessionBody}>
                  <AppText variant="headline" style={{ fontWeight: '600' }} numberOfLines={1}>{sess.routineName}</AppText>
                  <AppText variant="footnote" color={themeTokens.textSecondary}>
                    {sess.scheduledTime ? `${sess.scheduledTime} · ` : ''}{sess.durationMinutes > 0 ? `${sess.durationMinutes} min` : ''}
                  </AppText>
                </View>
                <View style={[S.statusBadge, { backgroundColor: sessionStatusColor(sess.status) + '20' }]}>
                  <Feather name={sessionStatusIcon(sess.status) as any} size={14} color={sessionStatusColor(sess.status)} />
                  <AppText variant="caption2" style={{ color: sessionStatusColor(sess.status), fontWeight: '600' }}>
                    {sess.status === 'completed' ? 'Done' : sess.status === 'in_progress' ? 'Active' : 'Start'}
                  </AppText>
                </View>
              </Pressable>
            ))
          )}
        </View>

        {/* Gym tasks */}
        <View style={S.section}>
          <View style={S.sectionHeader}>
            <AppText variant="headline" style={{ fontWeight: '700' }}>Gym Tasks</AppText>
            <Pressable
              onPress={() => router.push('/todos' as any)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Feather name="plus" size={16} color={gymColor} />
              <AppText variant="caption1" style={{ color: gymColor, fontWeight: '600' }}>New</AppText>
            </Pressable>
          </View>

          {incompleteTasks.length === 0 && (
            <View style={[S.emptyCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
              <Feather name="check-square" size={24} color={themeTokens.textTertiary} />
              <AppText variant="body" color={themeTokens.textTertiary} style={{ marginTop: space[8] }}>No open gym tasks</AppText>
            </View>
          )}

          {incompleteTasks.map(task => (
            <View key={task.id} style={[S.taskCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
              <Pressable
                style={[S.taskCircle, { borderColor: gymColor }]}
                onPress={() => handleToggleTask(task)}
                hitSlop={8}
              >
                {task.completed && <Feather name="check" size={11} color={gymColor} />}
              </Pressable>
              <AppText variant="body" style={{ flex: 1 }} numberOfLines={2}>{task.title}</AppText>
              {task.priority === 3 && <View style={[S.priDot, { backgroundColor: themeTokens.destructive }]} />}
              {task.priority === 2 && <View style={[S.priDot, { backgroundColor: themeTokens.warning }]} />}
            </View>
          ))}

          {completedTasks.length > 0 && (
            <View style={{ marginTop: space[8] }}>
              <AppText variant="caption2" color={themeTokens.textTertiary} style={{ marginBottom: space[4] }}>DONE ({completedTasks.length})</AppText>
              {completedTasks.map(task => (
                <Pressable key={task.id} style={[S.taskCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border, opacity: 0.55 }]} onPress={() => handleToggleTask(task)}>
                  <View style={[S.taskCircle, { borderColor: gymColor, backgroundColor: gymColor }]}>
                    <Feather name="check" size={11} color="#fff" />
                  </View>
                  <AppText variant="body" style={{ flex: 1, textDecorationLine: 'line-through' }} color={themeTokens.textTertiary} numberOfLines={1}>{task.title}</AppText>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Quick links */}
        <View style={S.section}>
          <AppText variant="headline" style={{ fontWeight: '700', marginBottom: space[12] }}>Quick Access</AppText>
          <View style={S.quickRow}>
            <Pressable
              style={[S.quickCard, { backgroundColor: gymColor + '18', borderColor: gymColor + '40' }]}
              onPress={() => router.push('/tools/plate-calculator' as any)}
            >
              <Feather name="sliders" size={22} color={gymColor} />
              <AppText variant="subheadline" style={{ fontWeight: '600', color: gymColor }}>Plate Calc</AppText>
            </Pressable>
            <Pressable
              style={[S.quickCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}
              onPress={() => router.push('/stats/gym' as any)}
            >
              <Feather name="bar-chart-2" size={22} color={themeTokens.textSecondary} />
              <AppText variant="subheadline" style={{ fontWeight: '600' }} color={themeTokens.textPrimary}>Gym Stats</AppText>
            </Pressable>
          </View>
        </View>

        {/* PRs preview */}
        {prs.length > 0 && (
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <AppText variant="headline" style={{ fontWeight: '700' }}>Personal Records</AppText>
              <Pressable onPress={() => router.push('/stats/gym' as any)}>
                <AppText variant="caption1" style={{ color: gymColor }}>View all</AppText>
              </Pressable>
            </View>
            <View style={[S.prsCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
              {prs.map((pr, i) => (
                <View key={i} style={[S.prRow, i < prs.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeTokens.border }]}>
                  <AppText variant="body" style={{ flex: 1, fontWeight: '500' }} numberOfLines={1}>{pr.lift}</AppText>
                  <AppText variant="body" style={{ fontWeight: '700', color: gymColor }}>{pr.weight} kg</AppText>
                  <AppText variant="caption1" color={themeTokens.textSecondary} style={{ minWidth: 60, textAlign: 'right' }}>
                    {pr.date ? pr.date.slice(0, 10) : ''}
                  </AppText>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

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
  sessionCard: { flexDirection: 'row', alignItems: 'stretch', borderRadius: radius.md, borderWidth: 1, overflow: 'hidden', marginBottom: space[8] },
  stripe: { width: 3 },
  sessionBody: { flex: 1, paddingHorizontal: space[12], paddingVertical: space[12], gap: space[4] },
  statusBadge: { paddingHorizontal: space[8], paddingVertical: space[8], alignSelf: 'center', marginRight: space[12], borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', gap: 4 },
  taskCard: { flexDirection: 'row', alignItems: 'center', gap: space[8], borderRadius: radius.md, borderWidth: 1, padding: space[12], marginBottom: space[8] },
  taskCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  priDot: { width: 7, height: 7, borderRadius: 4 },
  quickRow: { flexDirection: 'row', gap: space[8] },
  quickCard: { flex: 1, borderRadius: radius.md, borderWidth: 1, padding: space[16], alignItems: 'center', gap: space[8] },
  prsCard: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  prRow: { flexDirection: 'row', alignItems: 'center', gap: space[8], paddingHorizontal: space[12], paddingVertical: space[12] },
});
