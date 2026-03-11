/**
 * TaskCard — compact row for a single task in the To-Do list.
 * Pressing the checkbox circle marks the task complete/incomplete.
 * Pressing the row body opens the TaskEditor.
 */
import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../constants/ThemeContext';
import { fontSize, spacing, borderRadius } from '../../constants/theme';

const PILLAR_COLORS: Record<string, string> = {
  gym: '#ef4444',
  academic: '#3b82f6',
  life: '#22c55e',
  general: '#a855f7',
};

const PRIORITY_LABELS = ['', 'High', 'Medium', 'Low'];
const PRIORITY_COLORS = ['', '#ef4444', '#f59e0b', '#6b7280'];

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    pillar?: string | null;
    category?: string | null;
    dueDate?: string | null;
    dueTime?: string | null;
    priority?: number | null;
    completed: number | boolean;
  };
  onToggle: (id: string, completed: boolean) => void;
  onPress: (id: string) => void;
  onDelete?: (id: string) => void;
}

export function TaskCard({ task, onToggle, onPress, onDelete }: TaskCardProps) {
  const { themeColors } = useTheme();
  const isCompleted = Boolean(task.completed);
  const pillar = task.pillar ?? 'general';
  const pillarColor = PILLAR_COLORS[pillar] ?? PILLAR_COLORS.general;
  const priority = task.priority ?? 2;

  const dueDateStr = task.dueDate
    ? formatDueDate(task.dueDate, task.dueTime)
    : null;

  return (
    <Pressable
      style={[styles.row, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}
      onPress={() => onPress(task.id)}
      android_ripple={{ color: themeColors.surfaceBorder }}
    >
      {/* Checkbox */}
      <Pressable
        style={[
          styles.checkbox,
          {
            borderColor: isCompleted ? pillarColor : themeColors.muted,
            backgroundColor: isCompleted ? pillarColor : 'transparent',
          },
        ]}
        onPress={() => onToggle(task.id, !isCompleted)}
        hitSlop={8}
      >
        {isCompleted && <Feather name="check" size={12} color="#fff" />}
      </Pressable>

      {/* Content */}
      <View style={styles.content}>
        <Text
          style={[
            styles.title,
            { color: themeColors.text },
            isCompleted && { textDecorationLine: 'line-through', color: themeColors.muted },
          ]}
          numberOfLines={2}
        >
          {task.title}
        </Text>

        <View style={styles.meta}>
          {/* Pillar dot */}
          <View style={[styles.pillarDot, { backgroundColor: pillarColor }]} />
          <Text style={[styles.metaText, { color: themeColors.muted }]}>
            {pillar.charAt(0).toUpperCase() + pillar.slice(1)}
          </Text>

          {task.category ? (
            <>
              <Text style={[styles.separator, { color: themeColors.muted }]}>·</Text>
              <Text style={[styles.metaText, { color: themeColors.muted }]}>{task.category}</Text>
            </>
          ) : null}

          {dueDateStr ? (
            <>
              <Text style={[styles.separator, { color: themeColors.muted }]}>·</Text>
              <Feather name="calendar" size={11} color={themeColors.muted} />
              <Text style={[styles.metaText, { color: themeColors.muted }]}> {dueDateStr}</Text>
            </>
          ) : null}
        </View>
      </View>

      {/* Priority badge */}
      {priority !== 2 && (
        <View style={[styles.priorityBadge, { backgroundColor: PRIORITY_COLORS[priority] + '22' }]}>
          <Text style={[styles.priorityText, { color: PRIORITY_COLORS[priority] }]}>
            {PRIORITY_LABELS[priority]}
          </Text>
        </View>
      )}

      {/* Delete button */}
      {onDelete && (
        <Pressable
          onPress={() => onDelete(task.id)}
          hitSlop={8}
          style={styles.deleteBtn}
        >
          <Feather name="trash-2" size={15} color={themeColors.muted} />
        </Pressable>
      )}
    </Pressable>
  );
}

function formatDueDate(date: string, time?: string | null): string {
  const today = new Date().toISOString().slice(0, 10);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  let label: string;
  if (date === today) label = 'Today';
  else if (date === tomorrow) label = 'Tomorrow';
  else {
    const d = new Date(date + 'T00:00:00');
    label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  if (time) label += ` ${time}`;
  return label;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flexWrap: 'wrap',
  },
  pillarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  metaText: {
    fontSize: fontSize.xs,
  },
  separator: {
    fontSize: fontSize.xs,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  deleteBtn: {
    padding: 4,
  },
});
