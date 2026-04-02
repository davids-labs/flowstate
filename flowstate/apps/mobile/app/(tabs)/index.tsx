import React, { useCallback, useMemo, useState } from 'react';
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
import { ActiveBlockWidget } from '../../components/home/ActiveBlockWidget';
import { PlannerAgenda } from '../../components/planner/PlannerAgenda';
import { PlannerSessionSheet } from '../../components/planner/PlannerSessionSheet';
import { TaskEditor, type TaskFormData } from '../../components/tasks/TaskEditor';
import { TrackerCard } from '../../components/trackers/TrackerCard';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { useSyncContext } from '../../components/SyncProvider';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';
import { loadPlannerDayBundle, type PlannerDayBundle, type PlannerTracker } from '../../lib/planner';
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

  const loadData = useCallback(async () => {
    if (!db || !isReady) return;
    await loadDay(db, today);
    const nextBundle = await loadPlannerDayBundle(db, today);
    setBundle(nextBundle);
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
    await loadData();
  }, [db, today, loadData]);

  const trackerItems = useMemo(() => bundle?.trackers ?? [], [bundle?.trackers]);

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
          <AppText variant="title1" style={{ fontWeight: '700' }}>
            Today
          </AppText>
          <AppText variant="subheadline" color={themeTokens.textSecondary}>
            {formatToday(today)}
          </AppText>
        </View>
        <View style={[styles.heroBadge, { backgroundColor: themeTokens.accentTint }]}>
          <AppText variant="caption1" color={themeTokens.accent} style={{ fontWeight: '700' }}>
            {completedPriorityCount}/{priorities.length || 0} priorities
          </AppText>
        </View>
      </View>

      <ActiveBlockWidget
        pillar="general"
        nextSession={bundle?.nextSession ?? null}
        emptyActionLabel="Add Session"
        onEmptyActionPress={() => setShowSessionSheet(true)}
      />

      <View style={[styles.sectionCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <AppText variant="headline" style={{ fontWeight: '700' }}>
              Top Priorities
            </AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              Keep the day focused on the few things that must happen.
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
                  onPress={() => db && toggleMustDo(db, index, syncDayPlan)}
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
              Agenda
            </AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              Tasks and sessions in one timeline for the day.
            </AppText>
          </View>
          <View style={styles.actionRow}>
            <Pressable
              style={[styles.actionButton, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
              onPress={() => openTaskEditor()}
            >
              <AppText variant="caption1" style={{ fontWeight: '700' }}>
                Task
              </AppText>
            </Pressable>
            <Pressable
              style={[styles.actionButton, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
              onPress={() => setShowSessionSheet(true)}
            >
              <AppText variant="caption1" style={{ fontWeight: '700' }}>
                Session
              </AppText>
            </Pressable>
          </View>
        </View>

        <PlannerAgenda
          items={bundle?.agenda ?? []}
          onTaskToggle={async (taskId, completed) => {
            if (!db) return;
            await updateTask(db, taskId, { completed });
            await loadData();
          }}
          onTaskPress={(taskId) => openTaskEditor(taskId)}
          onSessionPress={(sessionId) => router.push(`/session/${sessionId}` as any)}
          emptyTitle="Your day is open"
          emptySubtitle="Start with a task, a session, or a single top priority."
        />
      </View>

      <View style={styles.sectionShell}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionCopy}>
            <AppText variant="headline" style={{ fontWeight: '700' }}>
              Trackers
            </AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              Keep the logs you actually need close to the day.
            </AppText>
          </View>
          <Pressable onPress={() => router.push('/library' as any)}>
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
              <TrackerCard key={tracker.id} tracker={tracker as PlannerTracker & any} compact onChanged={loadData} />
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
        onSaved={loadData}
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
    gap: space[4],
  },
  heroBadge: {
    borderRadius: radius.full,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
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
    gap: space[4],
  },
  sectionCard: {
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
    gap: space[8],
  },
  actionButton: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
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
