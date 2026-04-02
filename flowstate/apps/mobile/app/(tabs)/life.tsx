/**
 * Life Tab — dedicated lifestyle overview
 * Today's life sessions · streaks · life tasks · mood/rating modules · quick nav
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
  getStreaks,
  getModuleSpecs,
  getModuleValuesForDate,
} from '@flowstate/core';

// ─── Types ────────────────────────────────────────────────────────────────────
interface LifeSession {
  id: string;
  routineName: string;
  status: string;
  scheduledTime: string | null;
  durationMinutes: number;
}

interface LifeTask {
  id: string;
  title: string;
  priority: number;
  completed: boolean;
  dueDate: string | null;
}

interface StreakItem {
  moduleId: string;
  label: string;
  currentStreak: number;
  bestStreak: number;
}

interface RatingModule {
  id: string;
  label: string;
  maxValue: number;
  currentValue: number | null;
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function LifeScreen() {
  const { themeTokens } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { db, isReady } = useDatabaseSafe();
  const lifeColor = useUserPrefsStore(s => s.getPillarColour('life'));

  const [sessions, setSessions] = useState<LifeSession[]>([]);
  const [tasks, setTasksData] = useState<LifeTask[]>([]);
  const [streaks, setStreaks] = useState<StreakItem[]>([]);
  const [ratingModules, setRatingModules] = useState<RatingModule[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!db || !isReady) return;
    setLoading(true);
    try {
      const today = new Date().toISOString().slice(0, 10);

      // Life sessions for today
      try {
        const dayPlan = await getDayPlan(db, today);
        if (dayPlan?.id) {
          const allSessions: any[] = await getSessionsForDay(db, dayPlan.id);
          setSessions(
            allSessions
              .filter((s: any) => s.pillar === 'life')
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

      // Life tasks
      try {
        const rawTasks: any[] = await getTasks(db, { pillar: 'life' });
        setTasksData(rawTasks.map(t => ({
          id: t.id,
          title: t.title,
          priority: t.priority ?? 2,
          completed: !!t.completed,
          dueDate: t.dueDate ?? null,
        })));
      } catch { setTasksData([]); }

      // Streaks (life pillar only)
      try {
        const allSpecs: any[] = await getModuleSpecs(db);
        const lifeStreakIds = allSpecs
          .filter((s: any) => s.pillar === 'life' && !s.archivedAt &&
            (s.type === 'checkbox' || s.type === 'streak_counter'))
          .map((s: any) => s.id);
        const allStreaks: any[] = await getStreaks(db);
        const filtered = allStreaks.filter((s: any) => lifeStreakIds.includes(s.moduleId));
        setStreaks(filtered.map((s: any) => ({
          moduleId: s.moduleId,
          label: s.label,
          currentStreak: s.currentStreak,
          bestStreak: s.bestStreak,
        })));

        // Rating modules (life pillar)
        const ratingSpecs = allSpecs.filter(
          (s: any) => s.pillar === 'life' && !s.archivedAt && s.type === 'rating',
        );
        const todayValues: any[] = await getModuleValuesForDate(db, today);
        const valueMap: Record<string, number | null> = {};
        todayValues.forEach((v: any) => {
          try { valueMap[v.moduleId] = parseFloat(JSON.parse(v.value)); } catch { valueMap[v.moduleId] = null; }
        });
        setRatingModules(ratingSpecs.map((s: any) => {
          const maxValue: number = s.config?.max ?? 10;
          return {
            id: s.id,
            label: s.label,
            maxValue,
            currentValue: valueMap[s.id] ?? null,
          };
        }));
      } catch { setStreaks([]); setRatingModules([]); }
    } finally {
      setLoading(false);
    }
  }, [db, isReady]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleToggleTask = useCallback(async (task: LifeTask) => {
    if (!db) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = !task.completed;
    setTasksData(prev => prev.map(t => t.id === task.id ? { ...t, completed: next } : t));
    try {
      await updateTask(db, task.id, { completed: next });
    } catch {
      setTasksData(prev => prev.map(t => t.id === task.id ? { ...t, completed: task.completed } : t));
    }
  }, [db]);

  const sessionStatusIcon = (status: string): any => {
    if (status === 'completed') return 'check-circle';
    if (status === 'in_progress') return 'clock';
    return 'play';
  };

  const sessionStatusColor = (status: string) => {
    if (status === 'completed') return themeTokens.success;
    if (status === 'in_progress') return themeTokens.warning;
    return lifeColor;
  };

  const incompleteTasks = tasks.filter(t => !t.completed);
  const completedTasks = tasks.filter(t => t.completed);
  const activeStreaks = streaks.filter(s => s.currentStreak > 0);

  return (
    <View style={{ flex: 1, backgroundColor: themeTokens.background }}>
      {/* Life accent bar */}
      <View style={[S.accentBar, { backgroundColor: lifeColor, paddingTop: insets.top }]} />

      <ScrollView
        contentContainerStyle={[S.scroll, { paddingBottom: insets.bottom + space[32] }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={[S.header, { paddingTop: insets.top + space[20] }]}>
          <View style={S.headerLeft}>
            <AppText variant="title1" style={{ fontWeight: '800', color: lifeColor }}>Life</AppText>
            <AppText variant="subheadline" color={themeTokens.textSecondary}>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </AppText>
          </View>
          <View style={S.headerActions}>
            <Pressable
              style={[S.iconBtn, { backgroundColor: lifeColor + '20' }]}
              onPress={() => router.push('/stats/life' as any)}
            >
              <Feather name="bar-chart-2" size={18} color={lifeColor} />
            </Pressable>
          </View>
        </View>

        {/* Hero stats row */}
        <View style={S.heroRow}>
          <View style={[S.heroCard, { backgroundColor: lifeColor + '18', borderColor: lifeColor + '40' }]}>
            <AppText variant="title2" style={{ fontWeight: '800', color: lifeColor }}>{sessions.length}</AppText>
            <AppText variant="caption1" color={themeTokens.textSecondary}>Sessions Today</AppText>
          </View>
          <View style={[S.heroCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
            <AppText variant="title2" style={{ fontWeight: '800', color: themeTokens.textPrimary }}>{incompleteTasks.length}</AppText>
            <AppText variant="caption1" color={themeTokens.textSecondary}>Open Tasks</AppText>
          </View>
          <View style={[S.heroCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
            <AppText variant="title2" style={{ fontWeight: '800', color: themeTokens.textPrimary }}>{activeStreaks.length}</AppText>
            <AppText variant="caption1" color={themeTokens.textSecondary}>Active Streaks</AppText>
          </View>
        </View>

        {/* Today's life sessions */}
        <View style={S.section}>
          <View style={S.sectionHeader}>
            <AppText variant="headline" style={{ fontWeight: '700' }}>Today's Sessions</AppText>
            <AppText variant="caption1" color={themeTokens.textSecondary}>{sessions.length} planned</AppText>
          </View>
          {sessions.length === 0 ? (
            <View style={[S.emptyCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
              <Feather name="calendar" size={24} color={themeTokens.textTertiary} />
              <AppText variant="body" color={themeTokens.textTertiary} style={{ marginTop: space[8] }}>No life sessions planned today</AppText>
              <AppText variant="caption1" color={themeTokens.textTertiary}>Plan sessions in the Plan tab</AppText>
            </View>
          ) : (
            sessions.map(sess => (
              <Pressable
                key={sess.id}
                style={({ pressed }) => [S.sessionCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }, pressed && { opacity: 0.75 }]}
                onPress={() => router.push(`/session/${sess.id}` as any)}
              >
                <View style={[S.stripe, { backgroundColor: lifeColor }]} />
                <View style={S.sessionBody}>
                  <AppText variant="headline" style={{ fontWeight: '600' }} numberOfLines={1}>{sess.routineName}</AppText>
                  <AppText variant="footnote" color={themeTokens.textSecondary}>
                    {sess.scheduledTime ? `${sess.scheduledTime} · ` : ''}{sess.durationMinutes > 0 ? `${sess.durationMinutes} min` : ''}
                  </AppText>
                </View>
                <View style={[S.statusBadge, { backgroundColor: sessionStatusColor(sess.status) + '20' }]}>
                  <Feather name={sessionStatusIcon(sess.status)} size={14} color={sessionStatusColor(sess.status)} />
                  <AppText variant="caption2" style={{ color: sessionStatusColor(sess.status), fontWeight: '600' }}>
                    {sess.status === 'completed' ? 'Done' : sess.status === 'in_progress' ? 'Active' : 'Start'}
                  </AppText>
                </View>
              </Pressable>
            ))
          )}
        </View>

        {/* Streaks */}
        <View style={S.section}>
          <View style={S.sectionHeader}>
            <AppText variant="headline" style={{ fontWeight: '700' }}>Streaks</AppText>
            <Pressable onPress={() => router.push('/stats/life' as any)}>
              <AppText variant="caption1" style={{ color: lifeColor }}>View all</AppText>
            </Pressable>
          </View>
          {streaks.length === 0 ? (
            <View style={[S.emptyCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
              <Feather name="zap" size={24} color={themeTokens.textTertiary} />
              <AppText variant="body" color={themeTokens.textTertiary} style={{ marginTop: space[8] }}>No life streaks yet</AppText>
              <AppText variant="caption1" color={themeTokens.textTertiary}>Add checkbox modules in Library</AppText>
            </View>
          ) : (
            <View style={[S.streaksCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
              {streaks.map((s, i) => {
                const maxStreak = Math.max(...streaks.map(x => x.bestStreak), 1);
                const fillRatio = s.currentStreak / maxStreak;
                return (
                  <View
                    key={s.moduleId}
                    style={[
                      S.streakRow,
                      i < streaks.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeTokens.border },
                    ]}
                  >
                    <Feather name="zap" size={14} color={s.currentStreak > 0 ? lifeColor : themeTokens.textTertiary} />
                    <AppText variant="body" style={{ flex: 1, fontWeight: '500', marginLeft: space[8] }} numberOfLines={1}>{s.label}</AppText>
                    <View style={S.streakBarBg}>
                      <View style={[S.streakBarFill, { width: `${Math.round(fillRatio * 100)}%`, backgroundColor: lifeColor }]} />
                    </View>
                    <AppText variant="body" style={{ fontWeight: '700', color: s.currentStreak > 0 ? lifeColor : themeTokens.textTertiary, minWidth: 28, textAlign: 'right' }}>
                      {s.currentStreak}
                    </AppText>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Mood / Rating check-in */}
        {ratingModules.length > 0 && (
          <View style={S.section}>
            <View style={S.sectionHeader}>
              <AppText variant="headline" style={{ fontWeight: '700' }}>Today's Check-In</AppText>
              <AppText variant="caption1" color={themeTokens.textSecondary}>{ratingModules.filter(r => r.currentValue !== null).length}/{ratingModules.length} rated</AppText>
            </View>
            <View style={[S.ratingsCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
              {ratingModules.map((mod, i) => (
                <View
                  key={mod.id}
                  style={[
                    S.ratingRow,
                    i < ratingModules.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeTokens.border },
                  ]}
                >
                  <AppText variant="body" style={{ flex: 1, fontWeight: '500' }} numberOfLines={1}>{mod.label}</AppText>
                  {mod.currentValue !== null ? (
                    <View style={[S.ratingBadge, { backgroundColor: lifeColor + '20' }]}>
                      <AppText variant="footnote" style={{ color: lifeColor, fontWeight: '700' }}>
                        {mod.currentValue}/{mod.maxValue}
                      </AppText>
                    </View>
                  ) : (
                    <AppText variant="caption1" color={themeTokens.textTertiary}>Not logged</AppText>
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Life tasks */}
        <View style={S.section}>
          <View style={S.sectionHeader}>
            <AppText variant="headline" style={{ fontWeight: '700' }}>Life Tasks</AppText>
            <Pressable
              onPress={() => router.push('/todos' as any)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
            >
              <Feather name="plus" size={16} color={lifeColor} />
              <AppText variant="caption1" style={{ color: lifeColor, fontWeight: '600' }}>New</AppText>
            </Pressable>
          </View>

          {incompleteTasks.length === 0 && (
            <View style={[S.emptyCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
              <Feather name="check-square" size={24} color={themeTokens.textTertiary} />
              <AppText variant="body" color={themeTokens.textTertiary} style={{ marginTop: space[8] }}>No open life tasks</AppText>
            </View>
          )}

          {incompleteTasks.map(task => (
            <View key={task.id} style={[S.taskCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
              <Pressable
                style={[S.taskCircle, { borderColor: lifeColor }]}
                onPress={() => handleToggleTask(task)}
                hitSlop={8}
              >
                {task.completed && <Feather name="check" size={11} color={lifeColor} />}
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
                <Pressable
                  key={task.id}
                  style={[S.taskCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border, opacity: 0.55 }]}
                  onPress={() => handleToggleTask(task)}
                >
                  <View style={[S.taskCircle, { borderColor: lifeColor, backgroundColor: lifeColor }]}>
                    <Feather name="check" size={11} color="#fff" />
                  </View>
                  <AppText variant="body" style={{ flex: 1, textDecorationLine: 'line-through' }} color={themeTokens.textTertiary} numberOfLines={1}>{task.title}</AppText>
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Quick access */}
        <View style={S.section}>
          <AppText variant="headline" style={{ fontWeight: '700', marginBottom: space[12] }}>Quick Access</AppText>
          <View style={S.quickRow}>
            <Pressable
              style={[S.quickCard, { backgroundColor: lifeColor + '18', borderColor: lifeColor + '40' }]}
              onPress={() => router.push('/stats/life' as any)}
            >
              <Feather name="bar-chart-2" size={22} color={lifeColor} />
              <AppText variant="subheadline" style={{ fontWeight: '600', color: lifeColor }}>Life Stats</AppText>
            </Pressable>
            <Pressable
              style={[S.quickCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}
              onPress={() => router.push('/(tabs)/plan' as any)}
            >
              <Feather name="calendar" size={22} color={themeTokens.textSecondary} />
              <AppText variant="subheadline" style={{ fontWeight: '600' }} color={themeTokens.textPrimary}>Plan</AppText>
            </Pressable>
          </View>
          <View style={[S.quickRow, { marginTop: space[8] }]}>
            <Pressable
              style={[S.quickCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}
              onPress={() => router.push('/(tabs)/library' as any)}
            >
              <Feather name="layers" size={22} color={themeTokens.textSecondary} />
              <AppText variant="subheadline" style={{ fontWeight: '600' }} color={themeTokens.textPrimary}>Library</AppText>
            </Pressable>
            <Pressable
              style={[S.quickCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}
              onPress={() => router.push('/todos' as any)}
            >
              <Feather name="check-square" size={22} color={themeTokens.textSecondary} />
              <AppText variant="subheadline" style={{ fontWeight: '600' }} color={themeTokens.textPrimary}>All Tasks</AppText>
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

  // Sessions
  sessionCard: { flexDirection: 'row', alignItems: 'stretch', borderRadius: radius.md, borderWidth: 1, overflow: 'hidden', marginBottom: space[8] },
  stripe: { width: 3 },
  sessionBody: { flex: 1, paddingHorizontal: space[12], paddingVertical: space[12], gap: space[4] },
  statusBadge: { paddingHorizontal: space[8], paddingVertical: space[8], alignSelf: 'center', marginRight: space[12], borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', gap: 4 },

  // Streaks
  streaksCard: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  streakRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[12], paddingVertical: space[12] },
  streakBarBg: { width: 60, height: 6, borderRadius: 3, backgroundColor: 'rgba(128,128,128,0.15)', overflow: 'hidden', marginHorizontal: space[8] },
  streakBarFill: { height: 6, borderRadius: 3 },

  // Ratings
  ratingsCard: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[12], paddingVertical: space[12] },
  ratingBadge: { paddingHorizontal: space[8], paddingVertical: space[4], borderRadius: radius.sm },

  // Tasks
  taskCard: { flexDirection: 'row', alignItems: 'center', gap: space[8], borderRadius: radius.md, borderWidth: 1, padding: space[12], marginBottom: space[8] },
  taskCircle: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  priDot: { width: 7, height: 7, borderRadius: 4 },

  // Quick access
  quickRow: { flexDirection: 'row', gap: space[8] },
  quickCard: { flex: 1, borderRadius: radius.md, borderWidth: 1, padding: space[16], alignItems: 'center', gap: space[8] },
});
