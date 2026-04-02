import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  createTask,
  getTask,
  updateMustDoDone,
  updateTask,
  upsertDayPlan,
} from '@flowstate/core';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppText } from '../../components/primitives/Text';
import { LiveSessionDock } from '../../components/shared/LiveSessionDock';
import { PlannerSessionSheet } from '../../components/planner/PlannerSessionSheet';
import { TaskEditor, type TaskFormData } from '../../components/tasks/TaskEditor';
import { TrackerCard } from '../../components/trackers/TrackerCard';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { useSyncContext } from '../../components/SyncProvider';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';
import {
  loadPlannerDayBundle,
  type PlannerDayBundle,
  type PlannerTimelineItem,
  type PlannerTracker,
} from '../../lib/planner';
import { getInboxBadgeCount } from '../../services/inbox';
import { refreshAmbientState } from '../../services/systemSync';
import { useDayStore } from '../../stores/dayStore';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function formatToday(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function formatTimeLabel(value: string | null | undefined) {
  if (!value) return 'Flexible';
  return value;
}

function AgendaLane({
  title,
  items,
  onTaskToggle,
  onTaskPress,
  onSessionPress,
  emptyLabel,
}: {
  title: string;
  items: PlannerTimelineItem[];
  onTaskToggle: (taskId: string, completed: boolean) => void;
  onTaskPress: (taskId: string) => void;
  onSessionPress: (sessionId: string) => void;
  emptyLabel: string;
}) {
  const { themeTokens } = useTheme();

  return (
    <View style={styles.lane}>
      <View style={styles.laneHeader}>
        <AppText variant="caption1" color={themeTokens.textSecondary} style={styles.laneLabel}>
          {title}
        </AppText>
      </View>
      {items.length === 0 ? (
        <View style={[styles.emptyLaneCard, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}>
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            {emptyLabel}
          </AppText>
        </View>
      ) : (
        items.map((item) => {
          const taskDone = item.kind === 'task' ? item.completed : false;
          return (
            <Pressable
              key={item.id}
              style={[styles.agendaCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}
              onPress={() => {
                if (item.kind === 'task') {
                  onTaskPress(item.id);
                  return;
                }
                onSessionPress(item.id);
              }}
            >
              <View style={styles.agendaMeta}>
                <View
                  style={[
                    styles.agendaTimeChip,
                    {
                      backgroundColor:
                        item.kind === 'session' ? themeTokens.accentTint : themeTokens.surface,
                      borderColor: themeTokens.border,
                    },
                  ]}
                >
                  <AppText
                    variant="caption1"
                    color={item.kind === 'session' ? themeTokens.accent : themeTokens.textSecondary}
                    style={{ fontWeight: '700' }}
                  >
                    {formatTimeLabel(item.time)}
                  </AppText>
                </View>
                <AppText variant="caption1" color={themeTokens.textSecondary}>
                  {item.kind === 'session' ? 'Session' : 'Task'}
                </AppText>
              </View>

              <View style={styles.agendaBody}>
                <View style={styles.agendaCopy}>
                  <AppText
                    variant="headline"
                    color={taskDone ? themeTokens.textTertiary : themeTokens.textPrimary}
                    style={taskDone ? styles.completedText : undefined}
                    numberOfLines={2}
                  >
                    {item.title}
                  </AppText>
                  <AppText variant="footnote" color={themeTokens.textSecondary}>
                    {item.kind === 'session'
                      ? item.status === 'completed'
                        ? 'Completed'
                        : item.status === 'in_progress'
                          ? 'In progress'
                          : 'Ready to run'
                      : taskDone
                        ? 'Checked off'
                        : `Priority ${item.priority}`}
                  </AppText>
                </View>

                {item.kind === 'task' ? (
                  <Pressable
                    style={[
                      styles.agendaCheck,
                      {
                        borderColor: taskDone ? themeTokens.accent : themeTokens.borderStrong,
                        backgroundColor: taskDone ? themeTokens.accent : 'transparent',
                      },
                    ]}
                    onPress={(event) => {
                      event.stopPropagation();
                      onTaskToggle(item.id, !item.completed);
                    }}
                  >
                    {taskDone ? <Feather name="check" size={12} color="#fff" /> : null}
                  </Pressable>
                ) : (
                  <Feather name="arrow-up-right" size={16} color={themeTokens.textTertiary} />
                )}
              </View>
            </Pressable>
          );
        })
      )}
    </View>
  );
}

export default function TodayScreen() {
  const router = useRouter();
  const { db, isReady } = useDatabaseSafe();
  const { themeTokens } = useTheme();
  const { syncDayPlan } = useSyncContext();
  const dayPlan = useDayStore((state) => state.dayPlan);
  const isLoading = useDayStore((state) => state.isLoading);
  const loadDay = useDayStore((state) => state.loadDay);
  const toggleMustDo = useDayStore((state) => state.toggleMustDo);

  const today = todayIso();
  const [bundle, setBundle] = useState<PlannerDayBundle | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [newPriority, setNewPriority] = useState('');
  const [showTaskEditor, setShowTaskEditor] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<TaskFormData> | undefined>(undefined);
  const [showSessionSheet, setShowSessionSheet] = useState(false);
  const [inboxCount, setInboxCount] = useState(0);

  const loadData = useCallback(async () => {
    if (!db || !isReady) return;
    await loadDay(db, today);
    const [nextBundle, nextInboxCount] = await Promise.all([
      loadPlannerDayBundle(db, today),
      getInboxBadgeCount(db),
    ]);
    setBundle(nextBundle);
    setInboxCount(nextInboxCount);
  }, [db, isReady, loadDay, today]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const priorities = dayPlan?.mustDo ?? [];
  const prioritiesDone = dayPlan?.mustDoDone ?? [];
  const completedPriorityCount = prioritiesDone.filter(Boolean).length;
  const openPriorityCount = priorities.length - completedPriorityCount;
  const agenda = bundle?.agenda ?? [];
  const trackerItems = bundle?.trackers ?? [];
  const nowItems = agenda.slice(0, 1);
  const nextItems = agenda.slice(1, 3);
  const laterItems = agenda.slice(3, 7);

  const savePriorities = useCallback(async (
    nextMustDo: string[],
    nextDone: boolean[],
  ) => {
    if (!db) return;

    const existingPlan = dayPlan;
    if (existingPlan) {
      await upsertDayPlan(db, {
        date: today,
        title: existingPlan.title ?? formatToday(today),
        dayNumber: existingPlan.dayNumber ?? undefined,
        totalDays: existingPlan.totalDays ?? undefined,
        mustDo: nextMustDo,
        moduleIds: existingPlan.moduleIds ?? [],
      });
      await updateMustDoDone(db, existingPlan.id, nextDone);
    } else {
      const createdId = await upsertDayPlan(db, {
        date: today,
        title: formatToday(today),
        mustDo: nextMustDo,
        mustDoDone: nextDone,
        moduleIds: [],
      });
      await updateMustDoDone(db, createdId, nextDone);
    }

    syncDayPlan(today, { mustDo: nextMustDo, mustDoDone: nextDone });
    await refreshAmbientState(db);
    await loadData();
  }, [db, dayPlan, today, syncDayPlan, loadData]);

  const addPriority = useCallback(async () => {
    const trimmed = newPriority.trim();
    if (!trimmed) return;
    await savePriorities(
      [...priorities, trimmed],
      [...prioritiesDone, false],
    );
    setNewPriority('');
  }, [newPriority, priorities, prioritiesDone, savePriorities]);

  const removePriority = useCallback(async (index: number) => {
    await savePriorities(
      priorities.filter((_, currentIndex) => currentIndex !== index),
      prioritiesDone.filter((_, currentIndex) => currentIndex !== index),
    );
  }, [priorities, prioritiesDone, savePriorities]);

  const openTaskEditor = useCallback(async (taskId?: string) => {
    if (!db || !taskId) {
      setEditingTask({ dueDate: today, pillar: 'general', priority: 2 });
      setShowTaskEditor(true);
      return;
    }

    const task = await getTask(db, taskId);
    if (!task) return;
    setEditingTask({
      id: task.id,
      title: task.title ?? '',
      pillar: task.pillar ?? 'general',
      category: task.category ?? '',
      dueDate: task.dueDate ?? today,
      dueTime: task.dueTime ?? '',
      priority: task.priority ?? 2,
      notes: task.notes ?? '',
      recurrence: task.recurrence ?? '',
    });
    setShowTaskEditor(true);
  }, [db, today]);

  const saveTask = useCallback(async (data: TaskFormData) => {
    if (!db) return;
    if (data.id) {
      await updateTask(db, data.id, {
        title: data.title,
        pillar: data.pillar || 'general',
        category: data.category || null,
        dueDate: data.dueDate || null,
        dueTime: data.dueTime || null,
        priority: data.priority,
        notes: data.notes || null,
        recurrence: data.recurrence || null,
      });
    } else {
      await createTask(db, {
        title: data.title,
        pillar: 'general',
        category: data.category || undefined,
        dueDate: data.dueDate || today,
        dueTime: data.dueTime || undefined,
        priority: data.priority,
        notes: data.notes || undefined,
      });
    }
    setShowTaskEditor(false);
    await refreshAmbientState(db);
    await loadData();
  }, [db, today, loadData]);

  if (!bundle && (isLoading || !isReady)) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingState}>
          <ActivityIndicator color={themeTokens.accent} />
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            Loading today...
          </AppText>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper onRefresh={handleRefresh} refreshing={refreshing}>
      <View style={styles.hero}>
        <View style={styles.heroCopy}>
          <AppText variant="title1" style={{ fontWeight: '800' }}>
            Today
          </AppText>
          <AppText variant="subheadline" color={themeTokens.textSecondary}>
            {formatToday(today)}
          </AppText>
        </View>
        <View style={[styles.heroBadge, { backgroundColor: themeTokens.accentTint }]}>
          <AppText variant="caption1" color={themeTokens.accent} style={{ fontWeight: '700' }}>
            {completedPriorityCount}/{priorities.length || 0} locked in
          </AppText>
        </View>
      </View>

      <View style={[styles.briefCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <AppText variant="headline" style={{ fontWeight: '700' }}>
              Morning Brief
            </AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              Get clear on what matters before the day starts drifting.
            </AppText>
          </View>
          <Pressable
            style={[styles.roundButton, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
            onPress={() => router.push('/inbox')}
          >
            <Feather name="inbox" size={16} color={themeTokens.textPrimary} />
          </Pressable>
        </View>

        <View style={styles.briefGrid}>
          <View style={[styles.briefTile, { backgroundColor: themeTokens.surface }]}>
            <AppText variant="title3" style={{ fontWeight: '800' }}>
              {openPriorityCount}
            </AppText>
            <AppText variant="caption1" color={themeTokens.textSecondary}>
              priorities left
            </AppText>
          </View>
          <View style={[styles.briefTile, { backgroundColor: themeTokens.surface }]}>
            <AppText variant="title3" style={{ fontWeight: '800' }}>
              {inboxCount}
            </AppText>
            <AppText variant="caption1" color={themeTokens.textSecondary}>
              inbox items
            </AppText>
          </View>
          <View style={[styles.briefTileWide, { backgroundColor: themeTokens.surface }]}>
            <AppText variant="caption1" color={themeTokens.textSecondary}>
              Next session
            </AppText>
            <AppText variant="headline" style={{ fontWeight: '700' }} numberOfLines={1}>
              {bundle?.nextSession?.routineName ?? 'No session queued'}
            </AppText>
            <AppText variant="caption1" color={themeTokens.textSecondary}>
              {bundle?.nextSession?.scheduledTime ?? 'Add one from Plan or Today'}
            </AppText>
          </View>
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.primaryButton, { backgroundColor: themeTokens.accent }]}
            onPress={() => router.push('/inbox')}
          >
            <Feather name="arrow-up-right" size={16} color="#fff" />
            <AppText variant="caption1" onAccent style={{ fontWeight: '700' }}>
              Open Inbox
            </AppText>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
            onPress={() => router.push('/plan')}
          >
            <Feather name="calendar" size={16} color={themeTokens.textPrimary} />
            <AppText variant="caption1" style={{ fontWeight: '700' }}>
              Open Plan
            </AppText>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionShell}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <AppText variant="headline" style={{ fontWeight: '700' }}>
              Live Session
            </AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              One place to run what is active without the old duplicate timer surfaces.
            </AppText>
          </View>
        </View>
        <LiveSessionDock
          variant="inline"
          nextSession={bundle?.nextSession ?? null}
          onEmptyActionPress={() => setShowSessionSheet(true)}
        />
      </View>

      <View style={[styles.sectionCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <AppText variant="headline" style={{ fontWeight: '700' }}>
              Top Priorities
            </AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              Keep the day focused on the few things that really have to happen.
            </AppText>
          </View>
        </View>

        <View style={styles.priorityList}>
          {priorities.length === 0 ? (
            <View style={styles.emptyInline}>
              <Feather name="check-circle" size={16} color={themeTokens.textTertiary} />
              <AppText variant="footnote" color={themeTokens.textSecondary}>
                No priorities yet. Add one below.
              </AppText>
            </View>
          ) : (
            priorities.map((priority, index) => (
              <View key={`${priority}-${index}`} style={styles.priorityRow}>
                <Pressable
                  style={[
                    styles.priorityCheck,
                    {
                      borderColor: prioritiesDone[index] ? themeTokens.accent : themeTokens.borderStrong,
                      backgroundColor: prioritiesDone[index] ? themeTokens.accent : 'transparent',
                    },
                  ]}
                  onPress={async () => {
                    if (!db) return;
                    await toggleMustDo(db, index, syncDayPlan);
                    await refreshAmbientState(db);
                    await loadData();
                  }}
                  hitSlop={8}
                >
                  {prioritiesDone[index] ? <Feather name="check" size={12} color="#fff" /> : null}
                </Pressable>
                <AppText
                  variant="body"
                  color={prioritiesDone[index] ? themeTokens.textTertiary : themeTokens.textPrimary}
                  style={prioritiesDone[index] ? styles.completedText : undefined}
                  numberOfLines={2}
                >
                  {priority}
                </AppText>
                <Pressable onPress={() => removePriority(index)} hitSlop={8}>
                  <Feather name="trash-2" size={14} color={themeTokens.textTertiary} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        <View style={[styles.priorityComposer, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}>
          <TextInput
            style={[styles.priorityInput, { color: themeTokens.textPrimary }]}
            placeholder="Add a top priority..."
            placeholderTextColor={themeTokens.textTertiary}
            value={newPriority}
            onChangeText={setNewPriority}
            onSubmitEditing={addPriority}
            returnKeyType="done"
          />
          <Pressable
            style={[styles.inlineButton, { backgroundColor: themeTokens.accent }]}
            onPress={addPriority}
            disabled={!newPriority.trim()}
          >
            <Feather name="plus" size={14} color="#fff" />
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionShell}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <AppText variant="headline" style={{ fontWeight: '700' }}>
              Now, Next, Later
            </AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              A calmer agenda split into what deserves attention now versus what can wait.
            </AppText>
          </View>
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.secondaryButton, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
              onPress={() => openTaskEditor()}
            >
              <AppText variant="caption1" style={{ fontWeight: '700' }}>
                Task
              </AppText>
            </Pressable>
            <Pressable
              style={[styles.secondaryButton, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
              onPress={() => setShowSessionSheet(true)}
            >
              <AppText variant="caption1" style={{ fontWeight: '700' }}>
                Session
              </AppText>
            </Pressable>
          </View>
        </View>

        <AgendaLane
          title="Now"
          items={nowItems}
          emptyLabel="Nothing pinned right now."
          onTaskToggle={async (taskId, completed) => {
            if (!db) return;
            await updateTask(db, taskId, { completed });
            await refreshAmbientState(db);
            await loadData();
          }}
          onTaskPress={(taskId) => openTaskEditor(taskId)}
          onSessionPress={(sessionId) => router.push(`/session/${sessionId}` as any)}
        />
        <AgendaLane
          title="Next"
          items={nextItems}
          emptyLabel="No immediate follow-up yet."
          onTaskToggle={async (taskId, completed) => {
            if (!db) return;
            await updateTask(db, taskId, { completed });
            await refreshAmbientState(db);
            await loadData();
          }}
          onTaskPress={(taskId) => openTaskEditor(taskId)}
          onSessionPress={(sessionId) => router.push(`/session/${sessionId}` as any)}
        />
        <AgendaLane
          title="Later"
          items={laterItems}
          emptyLabel="The back half of the day is still open."
          onTaskToggle={async (taskId, completed) => {
            if (!db) return;
            await updateTask(db, taskId, { completed });
            await refreshAmbientState(db);
            await loadData();
          }}
          onTaskPress={(taskId) => openTaskEditor(taskId)}
          onSessionPress={(sessionId) => router.push(`/session/${sessionId}` as any)}
        />
      </View>

      <View style={styles.sectionShell}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <AppText variant="headline" style={{ fontWeight: '700' }}>
              Quick Log
            </AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              Keep the trackers you actually use close to the day instead of buried elsewhere.
            </AppText>
          </View>
          <Pressable onPress={() => router.push('/track' as any)}>
            <AppText variant="caption1" color={themeTokens.accent} style={{ fontWeight: '700' }}>
              Manage
            </AppText>
          </Pressable>
        </View>

        {trackerItems.length === 0 ? (
          <View style={[styles.sectionCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
            <View style={styles.emptyInline}>
              <Feather name="layers" size={16} color={themeTokens.textTertiary} />
              <AppText variant="footnote" color={themeTokens.textSecondary}>
                No trackers pinned for today yet.
              </AppText>
            </View>
          </View>
        ) : (
          <View style={styles.trackerList}>
            {trackerItems.map((tracker) => (
              <TrackerCard
                key={tracker.id}
                tracker={tracker as PlannerTracker & any}
                compact
                onChanged={async () => {
                  if (!db) return;
                  await refreshAmbientState(db);
                  await loadData();
                }}
              />
            ))}
          </View>
        )}
      </View>

      <TaskEditor
        visible={showTaskEditor}
        initial={editingTask}
        onSave={saveTask}
        onCancel={() => setShowTaskEditor(false)}
        hidePillar
        defaultPillar="general"
      />

      <PlannerSessionSheet
        visible={showSessionSheet}
        date={today}
        onClose={() => setShowSessionSheet(false)}
        onSaved={async () => {
          if (!db) return;
          await refreshAmbientState(db);
          await loadData();
        }}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[12],
    marginBottom: space[12],
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroBadge: {
    borderRadius: radius.full,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
  },
  briefCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[16],
    gap: space[16],
  },
  briefGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[10],
  },
  briefTile: {
    flex: 1,
    minWidth: 108,
    borderRadius: radius.lg,
    paddingHorizontal: space[12],
    paddingVertical: space[14],
    gap: 4,
  },
  briefTileWide: {
    width: '100%',
    borderRadius: radius.lg,
    paddingHorizontal: space[12],
    paddingVertical: space[14],
    gap: 4,
  },
  sectionShell: {
    marginTop: space[24],
    gap: space[12],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[12],
  },
  sectionCopy: {
    flex: 1,
    gap: 4,
  },
  roundButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionCard: {
    marginTop: space[24],
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[16],
    gap: space[12],
  },
  priorityList: {
    gap: space[8],
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
  },
  priorityCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  completedText: {
    textDecorationLine: 'line-through',
  },
  priorityComposer: {
    borderWidth: 1,
    borderRadius: radius.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    paddingHorizontal: space[12],
    paddingVertical: space[12],
  },
  priorityInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  inlineButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[8],
  },
  primaryButton: {
    minHeight: 40,
    borderRadius: radius.full,
    paddingHorizontal: space[14],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  secondaryButton: {
    minHeight: 40,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space[14],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  lane: {
    gap: space[8],
  },
  laneHeader: {
    paddingHorizontal: space[4],
  },
  laneLabel: {
    letterSpacing: 0.7,
    fontWeight: '700',
  },
  emptyLaneCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space[12],
    paddingVertical: space[12],
  },
  agendaCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[14],
    gap: space[12],
  },
  agendaMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[12],
  },
  agendaTimeChip: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space[10],
    paddingVertical: space[6],
  },
  agendaBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
  },
  agendaCopy: {
    flex: 1,
    gap: 4,
  },
  agendaCheck: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackerList: {
    gap: space[8],
  },
  loadingState: {
    alignItems: 'center',
    gap: space[12],
    paddingTop: space[48],
  },
});
