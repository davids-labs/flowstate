import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
  type SectionListData,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createTask,
  deleteTask,
  getTask,
  getTasks,
  updateTask,
} from '@flowstate/core';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { AppText } from '../../components/primitives/Text';
import { TaskEditor, type TaskFormData } from '../../components/tasks/TaskEditor';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';

type Mode = 'list' | 'calendar';
type TaskSectionKey = 'Overdue' | 'Today' | 'Upcoming' | 'Inbox' | 'Completed';

interface TTask {
  id: string;
  title?: string | null;
  pillar?: string | null;
  dueDate?: string | null;
  dueTime?: string | null;
  priority?: number | null;
  completed?: number | 0;
  category?: string | null;
  notes?: string | null;
  recurrence?: string | null;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatLongDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function addDays(date: string, offset: number) {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + offset);
  return next.toISOString().slice(0, 10);
}

function compareTasks(left: TTask, right: TTask) {
  const leftDate = left.dueDate ?? '9999-12-31';
  const rightDate = right.dueDate ?? '9999-12-31';
  if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);

  const leftTime = left.dueTime ?? '99:99';
  const rightTime = right.dueTime ?? '99:99';
  if (leftTime !== rightTime) return leftTime.localeCompare(rightTime);

  const leftPriority = left.priority ?? 2;
  const rightPriority = right.priority ?? 2;
  if (leftPriority !== rightPriority) return leftPriority - rightPriority;

  return (left.title ?? '').localeCompare(right.title ?? '');
}

function priorityColor(priority: number | null | undefined, fallback: string) {
  if (priority === 1) return '#EF4444';
  if (priority === 2) return '#F59E0B';
  return fallback;
}

function taskSection(task: TTask): TaskSectionKey {
  if (task.completed) return 'Completed';
  if (!task.dueDate) return 'Inbox';
  if (task.dueDate < todayISO()) return 'Overdue';
  if (task.dueDate === todayISO()) return 'Today';
  return 'Upcoming';
}

function dueLabel(task: TTask) {
  if (!task.dueDate) return task.category ?? 'Inbox';

  const datePart =
    task.dueDate === todayISO()
      ? 'Today'
      : task.dueDate === addDays(todayISO(), 1)
        ? 'Tomorrow'
        : new Date(`${task.dueDate}T12:00:00`).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          });

  if (task.dueTime) return `${datePart} · ${task.dueTime}`;
  return datePart;
}

function CalendarGrid({
  tasks,
  selectedDate,
  onSelectDate,
}: {
  tasks: TTask[];
  selectedDate: string;
  onSelectDate: (date: string) => void;
}) {
  const { themeTokens } = useTheme();
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth());
  const today = todayISO();

  const monthLabel = useMemo(
    () =>
      new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    [viewYear, viewMonth],
  );

  const cells = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1).getDay();
    const total = new Date(viewYear, viewMonth + 1, 0).getDate();
    const nextCells: Array<number | null> = Array(first).fill(null);
    for (let day = 1; day <= total; day += 1) nextCells.push(day);
    while (nextCells.length % 7 !== 0) nextCells.push(null);
    return nextCells;
  }, [viewYear, viewMonth]);

  const countsByDate = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const task of tasks) {
      if (!task.dueDate) continue;
      counts[task.dueDate] = (counts[task.dueDate] ?? 0) + 1;
    }
    return counts;
  }, [tasks]);

  function monthISO(day: number) {
    return `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  function moveMonth(offset: number) {
    const next = new Date(viewYear, viewMonth + offset, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  return (
    <View style={[styles.calendarCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
      <View style={styles.calendarHeader}>
        <Pressable
          style={[styles.calendarNav, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
          onPress={() => moveMonth(-1)}
        >
          <Feather name="chevron-left" size={16} color={themeTokens.textPrimary} />
        </Pressable>
        <AppText variant="headline" style={{ fontWeight: '700' }}>
          {monthLabel}
        </AppText>
        <Pressable
          style={[styles.calendarNav, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
          onPress={() => moveMonth(1)}
        >
          <Feather name="chevron-right" size={16} color={themeTokens.textPrimary} />
        </Pressable>
      </View>

      <View style={styles.calendarDowRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
          <View key={day} style={styles.calendarCell}>
            <AppText variant="caption2" color={themeTokens.textTertiary}>
              {day}
            </AppText>
          </View>
        ))}
      </View>

      <View style={styles.calendarGrid}>
        {cells.map((day, index) => {
          if (!day) return <View key={`empty-${index}`} style={styles.calendarCell} />;

          const date = monthISO(day);
          const count = countsByDate[date] ?? 0;
          const isToday = date === today;
          const isSelected = date === selectedDate;

          return (
            <Pressable key={date} style={styles.calendarCell} onPress={() => onSelectDate(date)}>
              <View
                style={[
                  styles.calendarBadge,
                  isToday ? { backgroundColor: themeTokens.accent } : null,
                  isSelected && !isToday
                    ? { borderWidth: 1, borderColor: themeTokens.accent, backgroundColor: themeTokens.accentTint }
                    : null,
                ]}
              >
                <AppText
                  variant="footnote"
                  color={
                    isToday
                      ? '#fff'
                      : isSelected
                        ? themeTokens.accent
                        : themeTokens.textPrimary
                  }
                  style={{ fontWeight: isToday || isSelected ? '700' : '500' }}
                >
                  {day}
                </AppText>
              </View>
              <View style={styles.calendarDots}>
                {Array.from({ length: Math.min(count, 3) }).map((_, dotIndex) => (
                  <View
                    key={`${date}-${dotIndex}`}
                    style={[styles.calendarDot, { backgroundColor: themeTokens.accent }]}
                  />
                ))}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function ModeSwitch({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (value: Mode) => void;
}) {
  const { themeTokens } = useTheme();

  return (
    <View style={[styles.modeSwitch, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}>
      {[
        { key: 'list' as const, label: 'List' },
        { key: 'calendar' as const, label: 'Calendar' },
      ].map((option) => {
        const active = mode === option.key;
        return (
          <Pressable
            key={option.key}
            style={[
              styles.modeButton,
              active ? { backgroundColor: themeTokens.accent } : null,
            ]}
            onPress={() => onChange(option.key)}
          >
            <AppText
              variant="caption1"
              color={active ? '#fff' : themeTokens.textSecondary}
              style={{ fontWeight: '700' }}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: keyof typeof Feather.glyphMap;
}) {
  const { themeTokens } = useTheme();

  return (
    <View style={[styles.summaryCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
      <View style={[styles.summaryIcon, { backgroundColor: themeTokens.accentTint }]}>
        <Feather name={icon} size={14} color={themeTokens.accent} />
      </View>
      <AppText variant="title3" style={{ fontWeight: '700' }}>
        {value}
      </AppText>
      <AppText variant="caption1" color={themeTokens.textSecondary}>
        {label}
      </AppText>
    </View>
  );
}

function TaskRow({
  item,
  onToggle,
  onPress,
  onDelete,
}: {
  item: TTask;
  onToggle: (id: string, completed: boolean) => void;
  onPress: (id: string) => void;
  onDelete: (task: TTask) => void;
}) {
  const { themeTokens } = useTheme();
  const done = !!item.completed;
  const accent = done ? themeTokens.accent : themeTokens.borderStrong;

  return (
    <Pressable
      style={[styles.taskRow, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}
      onPress={() => onPress(item.id)}
      onLongPress={() => onDelete(item)}
    >
      <Pressable
        style={[
          styles.checkbox,
          {
            borderColor: accent,
            backgroundColor: done ? themeTokens.accent : 'transparent',
          },
        ]}
        onPress={(event) => {
          event.stopPropagation();
          onToggle(item.id, !done);
        }}
        hitSlop={8}
      >
        {done ? <Feather name="check" size={12} color="#fff" /> : null}
      </Pressable>

      <View style={styles.taskCopy}>
        <AppText
          variant="body"
          color={done ? themeTokens.textTertiary : themeTokens.textPrimary}
          style={done ? styles.completedText : undefined}
          numberOfLines={2}
        >
          {item.title ?? ''}
        </AppText>
        <AppText variant="footnote" color={themeTokens.textSecondary}>
          {dueLabel(item)}
        </AppText>
      </View>

      <View style={styles.taskMeta}>
        <View style={[styles.priorityDot, { backgroundColor: priorityColor(item.priority, themeTokens.textTertiary) }]} />
        <Feather name="chevron-right" size={14} color={themeTokens.textTertiary} />
      </View>
    </Pressable>
  );
}

const SECTION_ORDER: TaskSectionKey[] = ['Overdue', 'Today', 'Upcoming', 'Inbox', 'Completed'];

export default function TodosScreen() {
  const { themeTokens } = useTheme();
  const { db, isReady } = useDatabaseSafe();
  const insets = useSafeAreaInsets();
  const [tasks, setTasks] = useState<TTask[]>([]);
  const [mode, setMode] = useState<Mode>('list');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskFormData | undefined>(undefined);
  const [calendarDate, setCalendarDate] = useState(todayISO());

  const loadTasks = useCallback(async () => {
    if (!db || !isReady) return;
    try {
      const rows = await getTasks(db);
      setTasks((rows as TTask[]).slice().sort(compareTasks));
    } catch {
      // Keep the current UI state if task loading fails.
    }
  }, [db, isReady]);

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks]),
  );

  const handleToggle = useCallback(async (id: string, completed: boolean) => {
    if (!db) return;
    setTasks((current) =>
      current.map((task) => (task.id === id ? { ...task, completed: completed ? 1 : 0 } : task)),
    );
    try {
      await updateTask(db, id, { completed });
      await loadTasks();
    } catch {
      await loadTasks();
    }
  }, [db, loadTasks]);

  const openEditor = useCallback(async (id?: string) => {
    if (!db || !id) {
      setEditingTask({
        dueDate: '',
        dueTime: '',
        pillar: 'general',
        priority: 2,
        title: '',
        category: '',
        notes: '',
        recurrence: '',
      });
      setShowEditor(true);
      return;
    }

    const task = await getTask(db, id);
    if (!task) return;
    setEditingTask({
      id: task.id,
      title: task.title ?? '',
      pillar: task.pillar ?? 'general',
      category: task.category ?? '',
      dueDate: task.dueDate ?? '',
      dueTime: task.dueTime ?? '',
      priority: task.priority ?? 2,
      notes: task.notes ?? '',
      recurrence: task.recurrence ?? '',
    });
    setShowEditor(true);
  }, [db]);

  const saveTask = useCallback(async (data: TaskFormData) => {
    if (!db) return;

    try {
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
          dueDate: data.dueDate || undefined,
          dueTime: data.dueTime || undefined,
          priority: data.priority,
          notes: data.notes || undefined,
          recurrence: data.recurrence || undefined,
        });
      }
      setShowEditor(false);
      await loadTasks();
    } catch {
      Alert.alert('Could not save task', 'Please try again.');
    }
  }, [db, loadTasks]);

  const confirmDelete = useCallback((task: TTask) => {
    Alert.alert(
      'Delete task',
      `Remove "${task.title ?? 'this task'}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!db) return;
            try {
              await deleteTask(db, task.id);
              await loadTasks();
            } catch {
              Alert.alert('Could not delete task', 'Please try again.');
            }
          },
        },
      ],
    );
  }, [db, loadTasks]);

  const visibleTasks = useMemo(
    () => (showCompleted ? tasks : tasks.filter((task) => !task.completed)),
    [showCompleted, tasks],
  );

  const counts = useMemo(() => {
    const summary = {
      overdue: 0,
      today: 0,
      upcoming: 0,
      inbox: 0,
    };

    for (const task of tasks) {
      if (task.completed) continue;
      const section = taskSection(task);
      if (section === 'Overdue') summary.overdue += 1;
      if (section === 'Today') summary.today += 1;
      if (section === 'Upcoming') summary.upcoming += 1;
      if (section === 'Inbox') summary.inbox += 1;
    }

    return summary;
  }, [tasks]);

  const sections = useMemo((): Array<SectionListData<TTask>> => {
    const grouped: Record<TaskSectionKey, TTask[]> = {
      Overdue: [],
      Today: [],
      Upcoming: [],
      Inbox: [],
      Completed: [],
    };

    for (const task of tasks) {
      const section = taskSection(task);
      if (section === 'Completed' && !showCompleted) continue;
      if (section !== 'Completed' && task.completed) continue;
      grouped[section].push(task);
    }

    return SECTION_ORDER
      .filter((key) => grouped[key].length > 0)
      .map((key) => ({
        title: key,
        data: grouped[key].slice().sort(compareTasks),
      }));
  }, [showCompleted, tasks]);

  const calendarSections = useMemo((): Array<SectionListData<TTask>> => {
    const dayTasks = visibleTasks
      .filter((task) => task.dueDate === calendarDate)
      .slice()
      .sort(compareTasks);

    return dayTasks.length > 0
      ? [{ title: formatLongDate(calendarDate), data: dayTasks }]
      : [];
  }, [calendarDate, visibleTasks]);

  const remainingCount = tasks.filter((task) => !task.completed).length;
  const listSections = mode === 'calendar' ? calendarSections : sections;

  return (
    <View style={[styles.screen, { backgroundColor: themeTokens.background }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + space[8],
            borderBottomColor: themeTokens.border,
            backgroundColor: themeTokens.background,
          },
        ]}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerCopy}>
            <AppText variant="title1" style={{ fontWeight: '700' }}>
              Tasks
            </AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              {remainingCount} open items across inbox and upcoming days.
            </AppText>
          </View>
          <ModeSwitch mode={mode} onChange={setMode} />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.summaryRow}
        >
          {counts.overdue > 0 ? <SummaryCard label="Overdue" value={counts.overdue} icon="alert-circle" /> : null}
          <SummaryCard label="Today" value={counts.today} icon="sun" />
          <SummaryCard label="Upcoming" value={counts.upcoming} icon="calendar" />
          <SummaryCard label="Inbox" value={counts.inbox} icon="inbox" />
        </ScrollView>

        <View style={styles.toolbar}>
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            {mode === 'calendar'
              ? 'Select a date to review scheduled tasks.'
              : 'Tap a task to edit it. Long-press to delete.'}
          </AppText>
          <Pressable
            style={[
              styles.doneToggle,
              {
                backgroundColor: showCompleted ? themeTokens.accentTint : themeTokens.surface,
                borderColor: showCompleted ? themeTokens.accent : themeTokens.border,
              },
            ]}
            onPress={() => setShowCompleted((current) => !current)}
          >
            <Feather
              name={showCompleted ? 'check-circle' : 'circle'}
              size={14}
              color={showCompleted ? themeTokens.accent : themeTokens.textSecondary}
            />
            <AppText
              variant="caption1"
              color={showCompleted ? themeTokens.accent : themeTokens.textSecondary}
              style={{ fontWeight: '700' }}
            >
              Show completed
            </AppText>
          </Pressable>
        </View>
      </View>

      {mode === 'calendar' ? (
        <View style={styles.calendarWrap}>
          <CalendarGrid tasks={visibleTasks} selectedDate={calendarDate} onSelectDate={setCalendarDate} />
        </View>
      ) : null}

      <SectionList
        sections={listSections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TaskRow
            item={item}
            onToggle={handleToggle}
            onPress={openEditor}
            onDelete={confirmDelete}
          />
        )}
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: themeTokens.background }]}>
            <AppText variant="subheadline" color={themeTokens.textSecondary} style={{ fontWeight: '700' }}>
              {(section as any).title}
            </AppText>
          </View>
        )}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: space[16], paddingBottom: insets.bottom + 120 }}
        ListEmptyComponent={(
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: themeTokens.accentTint }]}>
              <Feather name="check-square" size={18} color={themeTokens.accent} />
            </View>
            <AppText variant="headline" style={{ fontWeight: '700', textAlign: 'center' }}>
              {mode === 'calendar' ? 'No tasks on this date' : 'Nothing to work from yet'}
            </AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary} style={{ textAlign: 'center' }}>
              {mode === 'calendar'
                ? 'Pick another date or add something to the planner.'
                : 'Add a task to your inbox or give it a date so it lands in the timeline.'}
            </AppText>
          </View>
        )}
      />

      <Pressable
        style={[
          styles.fab,
          {
            backgroundColor: themeTokens.accent,
            bottom: insets.bottom + 28,
            right: space[20],
          },
        ]}
        onPress={() => {
          setEditingTask(undefined);
          setShowEditor(true);
        }}
      >
        <Feather name="plus" size={22} color="#fff" />
      </Pressable>

      <TaskEditor
        visible={showEditor}
        initial={editingTask}
        onSave={saveTask}
        onCancel={() => setShowEditor(false)}
        hidePillar
        defaultPillar="general"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: space[16],
    paddingBottom: space[12],
    gap: space[12],
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[12],
  },
  headerCopy: {
    flex: 1,
    gap: space[4],
  },
  modeSwitch: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.full,
    padding: 2,
    gap: 2,
  },
  modeButton: {
    paddingHorizontal: space[12],
    paddingVertical: space[8],
    borderRadius: radius.full,
  },
  summaryRow: {
    gap: space[8],
    paddingRight: space[4],
  },
  summaryCard: {
    minWidth: 88,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: space[12],
    paddingVertical: space[12],
    gap: space[4],
  },
  summaryIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[12],
  },
  doneToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
  },
  calendarWrap: {
    paddingHorizontal: space[16],
    paddingTop: space[16],
  },
  calendarCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[16],
    gap: space[12],
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarNav: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDowRow: {
    flexDirection: 'row',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.2857%',
    alignItems: 'center',
    paddingVertical: space[4],
  },
  calendarBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDots: {
    flexDirection: 'row',
    gap: 3,
    height: 8,
    marginTop: 2,
  },
  calendarDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  sectionHeader: {
    paddingBottom: space[8],
    paddingTop: space[16],
  },
  taskRow: {
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: space[12],
    paddingVertical: space[12],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    marginBottom: space[8],
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  taskCopy: {
    flex: 1,
    gap: space[4],
  },
  taskMeta: {
    alignItems: 'center',
    gap: space[8],
  },
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  completedText: {
    textDecorationLine: 'line-through',
  },
  emptyState: {
    alignItems: 'center',
    gap: space[8],
    paddingTop: space[48],
    paddingHorizontal: space[24],
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
