import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { createTask, getActivePlan, getTask, updateTask } from '@flowstate/core';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppText } from '../../components/primitives/Text';
import { PlannerAgenda } from '../../components/planner/PlannerAgenda';
import { PlannerSessionSheet } from '../../components/planner/PlannerSessionSheet';
import { TaskEditor, type TaskFormData } from '../../components/tasks/TaskEditor';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';
import { loadPlannerDayBundle, type PlannerDayBundle } from '../../lib/planner';
import { refreshAmbientState } from '../../services/systemSync';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, offset: number) {
  const date = new Date(`${isoDate}T12:00:00`);
  date.setDate(date.getDate() + offset);
  return date.toISOString().slice(0, 10);
}

function compareDates(left: string, right: string) {
  return left.localeCompare(right);
}

function formatLongDate(isoDate: string) {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function buildDateWindow(selectedDate: string, activePlan: any | null) {
  const windowStart = addDays(selectedDate, -3);
  const windowEnd = addDays(selectedDate, 10);
  const startDate = activePlan?.startDate && compareDates(activePlan.startDate, windowStart) > 0
    ? activePlan.startDate
    : windowStart;
  const endDate = activePlan?.endDate && compareDates(activePlan.endDate, windowEnd) < 0
    ? activePlan.endDate
    : windowEnd;

  const dates: string[] = [];
  let cursor = startDate;
  while (compareDates(cursor, endDate) <= 0 && dates.length < 28) {
    dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

function DateChip({
  date,
  selected,
  onPress,
}: {
  date: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { themeTokens } = useTheme();
  const dateObj = new Date(`${date}T12:00:00`);

  return (
    <Pressable
      style={[
        styles.dateChip,
        {
          backgroundColor: selected ? themeTokens.accent : themeTokens.surfaceElevated,
          borderColor: selected ? themeTokens.accent : themeTokens.border,
        },
      ]}
      onPress={onPress}
    >
      <AppText
        variant="caption1"
        color={selected ? '#fff' : themeTokens.textSecondary}
        style={{ fontWeight: '700' }}
      >
        {dateObj.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()}
      </AppText>
      <AppText
        variant="headline"
        color={selected ? '#fff' : themeTokens.textPrimary}
        style={{ fontWeight: '700' }}
      >
        {dateObj.getDate()}
      </AppText>
    </Pressable>
  );
}

export default function PlanScreen() {
  const { db, isReady } = useDatabaseSafe();
  const { themeTokens } = useTheme();
  const [activePlan, setActivePlan] = useState<any | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [bundle, setBundle] = useState<PlannerDayBundle | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showTaskEditor, setShowTaskEditor] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<TaskFormData> | undefined>(undefined);
  const [showSessionSheet, setShowSessionSheet] = useState(false);
  const [editingSession, setEditingSession] = useState<{
    id: string;
    routineId: string | null;
    routineName: string;
    scheduledTime: string | null;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!db || !isReady) return;
    const currentPlan = await getActivePlan(db);
    setActivePlan(currentPlan);
    const targetDate = currentPlan
      ? compareDates(selectedDate, currentPlan.startDate) < 0
        ? currentPlan.startDate
        : compareDates(selectedDate, currentPlan.endDate) > 0
          ? currentPlan.endDate
          : selectedDate
      : selectedDate;
    if (targetDate !== selectedDate) setSelectedDate(targetDate);
    const dayBundle = await loadPlannerDayBundle(db, targetDate);
    setBundle(dayBundle);
  }, [db, isReady, selectedDate]);

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

  const visibleDates = useMemo(() => buildDateWindow(selectedDate, activePlan), [selectedDate, activePlan]);
  const sessionCount = (bundle?.agenda ?? []).filter((item) => item.kind === 'session').length;
  const taskCount = (bundle?.agenda ?? []).filter((item) => item.kind === 'task').length;

  const openTaskEditor = useCallback(async (taskId?: string) => {
    if (!db || !taskId) {
      setEditingTask({ dueDate: selectedDate, pillar: 'general', priority: 2 });
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
      dueDate: task.dueDate ?? selectedDate,
      dueTime: task.dueTime ?? '',
      priority: task.priority ?? 2,
      notes: task.notes ?? '',
      recurrence: task.recurrence ?? '',
    });
    setShowTaskEditor(true);
  }, [db, selectedDate]);

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
        dueDate: data.dueDate || selectedDate,
        dueTime: data.dueTime || undefined,
        priority: data.priority,
        notes: data.notes || undefined,
      });
    }
    setShowTaskEditor(false);
    await refreshAmbientState(db);
    await loadData();
  }, [db, selectedDate, loadData]);

  if (!bundle && !isReady) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingState}>
          <ActivityIndicator color={themeTokens.accent} />
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            Loading planner...
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
            Plan
          </AppText>
          <AppText variant="subheadline" color={themeTokens.textSecondary}>
            {activePlan?.name ?? 'Build the next few days with the same calm view you use to run today.'}
          </AppText>
        </View>
        <View style={[styles.planBadge, { backgroundColor: themeTokens.accentTint }]}>
          <AppText variant="caption1" color={themeTokens.accent} style={{ fontWeight: '700' }}>
            {activePlan?.totalDays ? `${activePlan.totalDays} days` : 'Rolling view'}
          </AppText>
        </View>
      </View>

      <View style={styles.dateStripHeader}>
        <Pressable
          style={[styles.navButton, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
          onPress={() => setSelectedDate(addDays(selectedDate, -7))}
        >
          <Feather name="chevron-left" size={16} color={themeTokens.textPrimary} />
        </Pressable>
        <AppText variant="headline" style={{ fontWeight: '700' }}>
          {formatLongDate(selectedDate)}
        </AppText>
        <Pressable
          style={[styles.navButton, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
          onPress={() => setSelectedDate(addDays(selectedDate, 7))}
        >
          <Feather name="chevron-right" size={16} color={themeTokens.textPrimary} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dateStrip}>
        {visibleDates.map((date) => (
          <DateChip
            key={date}
            date={date}
            selected={date === selectedDate}
            onPress={() => setSelectedDate(date)}
          />
        ))}
      </ScrollView>

      <View style={[styles.summaryCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
        <View style={styles.summaryHeader}>
          <View style={styles.summaryCopy}>
            <AppText variant="headline" style={{ fontWeight: '700' }}>
              {bundle?.dayPlan?.title ?? 'Open day'}
            </AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              {bundle?.dayPlan?.mustDo?.length
                ? `${bundle.dayPlan.mustDo.length} top priorities`
                : 'No priorities set for this day yet'}
            </AppText>
          </View>
          <View style={styles.summaryMeta}>
            <AppText variant="caption1" color={themeTokens.textSecondary}>
              {sessionCount} sessions
            </AppText>
            <AppText variant="caption1" color={themeTokens.textSecondary}>
              {taskCount} tasks
            </AppText>
          </View>
        </View>
        {bundle?.dayPlan?.mustDo?.length ? (
          <View style={styles.priorityPreview}>
            {bundle.dayPlan.mustDo.map((priority, index) => (
              <View key={`${priority}-${index}`} style={styles.priorityPreviewRow}>
                <View
                  style={[
                    styles.priorityPreviewDot,
                    {
                      backgroundColor: bundle.dayPlan?.mustDoDone?.[index]
                        ? themeTokens.accent
                        : themeTokens.borderStrong,
                    },
                  ]}
                />
                <AppText variant="footnote" color={themeTokens.textSecondary} numberOfLines={1}>
                  {priority}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      <View style={styles.sectionHeader}>
        <View style={styles.sectionCopy}>
          <AppText variant="headline" style={{ fontWeight: '700' }}>
            Agenda
          </AppText>
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            Add, retime, and review tasks and sessions for the selected day.
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
            onPress={() => {
              setEditingSession(null);
              setShowSessionSheet(true);
            }}
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
          await refreshAmbientState(db);
          await loadData();
        }}
        onTaskPress={(taskId) => openTaskEditor(taskId)}
        onSessionPress={(sessionId) => {
          const session = (bundle?.agenda ?? []).find(
            (item) => item.kind === 'session' && item.id === sessionId,
          );
          if (!session || session.kind !== 'session') return;
          setEditingSession({
            id: session.id,
            routineId: session.routineId,
            routineName: session.routineName,
            scheduledTime: session.time,
          });
          setShowSessionSheet(true);
        }}
        emptyTitle="This day is open"
        emptySubtitle="Use the planner to add structure before you need it."
      />

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
        date={selectedDate}
        initialSession={editingSession}
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
    marginBottom: space[16],
  },
  heroCopy: {
    flex: 1,
    gap: space[4],
  },
  planBadge: {
    borderRadius: radius.full,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
  },
  dateStripHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[12],
    marginBottom: space[12],
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateStrip: {
    gap: space[8],
    paddingBottom: space[8],
    marginBottom: space[16],
  },
  dateChip: {
    width: 68,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingVertical: space[12],
    alignItems: 'center',
    gap: space[4],
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[16],
    gap: space[12],
    marginBottom: space[24],
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[12],
  },
  summaryCopy: {
    flex: 1,
    gap: space[4],
  },
  summaryMeta: {
    alignItems: 'flex-end',
    gap: space[4],
  },
  priorityPreview: {
    gap: space[8],
  },
  priorityPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
  },
  priorityPreviewDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[12],
    marginBottom: space[12],
  },
  sectionCopy: {
    flex: 1,
    gap: space[4],
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
  loadingState: {
    alignItems: 'center',
    gap: space[12],
    paddingTop: space[48],
  },
});
