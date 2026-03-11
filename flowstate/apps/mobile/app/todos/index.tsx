/**
 * Todos Screen — Feature 12: Robust To-Do List
 * Displays tasks grouped by pillar with filter tabs.
 * Allows creating, completing, editing, and deleting tasks.
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { TaskCard } from '../../components/tasks/TaskCard';
import { TaskEditor, type TaskFormData } from '../../components/tasks/TaskEditor';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { useTheme } from '../../constants/ThemeContext';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import {
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getTask,
} from '@flowstate/core';

type PillarFilter = 'all' | 'general' | 'gym' | 'academic' | 'life';
type CompletionFilter = 'active' | 'completed';

const PILLAR_TABS: { key: PillarFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'gym', label: 'Gym' },
  { key: 'academic', label: 'Academic' },
  { key: 'life', label: 'Life' },
  { key: 'general', label: 'General' },
];

export default function TodosScreen() {
  const { db, isReady } = useDatabaseSafe();
  const { themeColors } = useTheme();

  const [tasks, setTasks] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pillarFilter, setPillarFilter] = useState<PillarFilter>('all');
  const [completionFilter, setCompletionFilter] = useState<CompletionFilter>('active');
  const [showEditor, setShowEditor] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskFormData | undefined>(undefined);

  const loadTasks = useCallback(async () => {
    if (!db || !isReady) return;
    try {
      const opts: { pillar?: string; completed?: boolean } = {
        completed: completionFilter === 'completed',
      };
      if (pillarFilter !== 'all') opts.pillar = pillarFilter;
      const data = await getTasks(db, opts);
      setTasks(data);
    } catch (err) {
      console.warn('Failed to load tasks:', err);
    } finally {
      setIsLoading(false);
    }
  }, [db, isReady, pillarFilter, completionFilter]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadTasks();
    }, [loadTasks]),
  );

  const handleToggle = async (id: string, completed: boolean) => {
    if (!db) return;
    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: completed ? 1 : 0 } : t)),
    );
    try {
      await updateTask(db, id, { completed });
      // Reload to enforce filter
      await loadTasks();
    } catch {
      await loadTasks();
    }
  };

  const handlePressTask = async (id: string) => {
    if (!db) return;
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
  };

  const handleDelete = async (id: string) => {
    Alert.alert('Delete Task', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!db) return;
          await deleteTask(db, id);
          await loadTasks();
        },
      },
    ]);
  };

  const handleSave = async (data: TaskFormData) => {
    if (!db) return;
    setShowEditor(false);
    try {
      if (data.id) {
        // Edit existing task
        await updateTask(db, data.id, {
          title: data.title,
          pillar: data.pillar,
          category: data.category || null,
          dueDate: data.dueDate || null,
          dueTime: data.dueTime || null,
          priority: data.priority,
          notes: data.notes || null,
          recurrence: data.recurrence || null,
        });
      } else {
        // New task
        await createTask(db, {
          title: data.title,
          pillar: data.pillar,
          category: data.category || undefined,
          dueDate: data.dueDate || undefined,
          dueTime: data.dueTime || undefined,
          priority: data.priority,
          notes: data.notes || undefined,
        });
      }
      await loadTasks();
    } catch (err) {
      console.warn('Failed to save task:', err);
    }
  };

  const openNewTask = () => {
    setEditingTask(undefined);
    setShowEditor(true);
  };

  const activeCount = tasks.length;

  return (
    <ScreenWrapper>
      {/* Pillar filter tabs */}
      <View style={styles.filterRow}>
        {PILLAR_TABS.map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.filterTab,
              {
                backgroundColor:
                  pillarFilter === tab.key ? themeColors.accent + '22' : 'transparent',
                borderColor:
                  pillarFilter === tab.key ? themeColors.accent : themeColors.surfaceBorder,
              },
            ]}
            onPress={() => setPillarFilter(tab.key)}
          >
            <Text
              style={[
                styles.filterTabText,
                {
                  color:
                    pillarFilter === tab.key ? themeColors.accent : themeColors.muted,
                },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Active / Completed toggle */}
      <View style={[styles.toggleRow, { borderColor: themeColors.surfaceBorder }]}>
        {(['active', 'completed'] as CompletionFilter[]).map((cf) => (
          <Pressable
            key={cf}
            style={[
              styles.toggleBtn,
              {
                backgroundColor:
                  completionFilter === cf ? themeColors.accent : 'transparent',
                borderRadius: borderRadius.sm,
              },
            ]}
            onPress={() => setCompletionFilter(cf)}
          >
            <Text
              style={[
                styles.toggleBtnText,
                {
                  color:
                    completionFilter === cf ? '#fff' : themeColors.muted,
                },
              ]}
            >
              {cf === 'active' ? 'Active' : 'Completed'}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Header */}
      <SectionHeader
        title={
          completionFilter === 'active'
            ? `Tasks${activeCount > 0 ? ` (${activeCount})` : ''}`
            : 'Completed'
        }
        right={
          <Pressable
            style={[styles.addBtn, { backgroundColor: themeColors.accent }]}
            onPress={openNewTask}
          >
            <Feather name="plus" size={16} color="#fff" />
          </Pressable>
        }
      />

      {/* Task List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={themeColors.accent} />
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.center}>
          <Feather name="check-square" size={40} color={themeColors.muted} />
          <Text style={[styles.emptyText, { color: themeColors.muted }]}>
            {completionFilter === 'active'
              ? 'No active tasks. Hit + to add one.'
              : 'No completed tasks yet.'}
          </Text>
        </View>
      ) : (
        <FlatList<any>
          data={tasks}
          keyExtractor={(item: any) => item.id}
          renderItem={({ item }: { item: any }) => (
            <TaskCard
              task={item}
              onToggle={handleToggle}
              onPress={handlePressTask}
              onDelete={handleDelete}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* FAB */}
      <Pressable
        style={[styles.fab, { backgroundColor: themeColors.accent }]}
        onPress={openNewTask}
      >
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>

      {/* Task Editor Modal */}
      <TaskEditor
        visible={showEditor}
        initial={editingTask}
        onSave={handleSave}
        onCancel={() => setShowEditor(false)}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  filterTab: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  filterTabText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  toggleRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
  },
  toggleBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  addBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: 60,
  },
  emptyText: {
    fontSize: fontSize.md,
    textAlign: 'center',
    maxWidth: 260,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
});
