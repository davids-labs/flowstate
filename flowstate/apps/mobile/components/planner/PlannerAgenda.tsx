import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../primitives/Text';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';
import type { PlannerTimelineItem } from '../../lib/planner';

interface PlannerAgendaProps {
  items: PlannerTimelineItem[];
  onTaskToggle?: (taskId: string, completed: boolean) => void;
  onTaskPress?: (taskId: string) => void;
  onSessionPress?: (sessionId: string) => void;
  onSessionEdit?: (sessionId: string) => void;
  emptyTitle?: string;
  emptySubtitle?: string;
}

function statusLabel(status: string): string {
  if (status === 'completed') return 'Done';
  if (status === 'in_progress') return 'Active';
  if (status === 'abandoned') return 'Ended';
  return 'Planned';
}

function priorityColor(priority: number, fallback: string): string {
  if (priority <= 1) return '#EF4444';
  if (priority === 2) return '#F59E0B';
  return fallback;
}

export function PlannerAgenda({
  items,
  onTaskToggle,
  onTaskPress,
  onSessionPress,
  onSessionEdit,
  emptyTitle = 'Nothing planned yet',
  emptySubtitle = 'Add a task or session to build out the day.',
}: PlannerAgendaProps) {
  const { themeTokens } = useTheme();

  if (items.length === 0) {
    return (
      <View style={[styles.emptyCard, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}>
        <Feather name="calendar" size={20} color={themeTokens.textTertiary} />
        <View style={styles.emptyTextWrap}>
          <AppText variant="headline" style={{ fontWeight: '600' }}>
            {emptyTitle}
          </AppText>
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            {emptySubtitle}
          </AppText>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {items.map((item) =>
        item.kind === 'task' ? (
          <Pressable
            key={item.id}
            style={[styles.row, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}
            onPress={() => onTaskPress?.(item.id)}
          >
            <Pressable
              style={[
                styles.checkbox,
                {
                  borderColor: item.completed ? themeTokens.accent : themeTokens.borderStrong,
                  backgroundColor: item.completed ? themeTokens.accent : 'transparent',
                },
              ]}
              onPress={(event) => {
                event.stopPropagation();
                onTaskToggle?.(item.id, !item.completed);
              }}
              hitSlop={8}
            >
              {item.completed ? <Feather name="check" size={12} color="#fff" /> : null}
            </Pressable>
            <View style={styles.content}>
              <View style={styles.titleRow}>
                <AppText
                  variant="body"
                  color={item.completed ? themeTokens.textTertiary : themeTokens.textPrimary}
                  style={item.completed ? styles.completedText : undefined}
                  numberOfLines={2}
                >
                  {item.title}
                </AppText>
              </View>
              <AppText variant="footnote" color={themeTokens.textSecondary}>
                {item.time ? `Task · ${item.time}` : 'Task'}
              </AppText>
            </View>
            <View style={[styles.dot, { backgroundColor: priorityColor(item.priority, themeTokens.textTertiary) }]} />
          </Pressable>
        ) : (
          <Pressable
            key={item.id}
            style={[styles.row, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}
            onPress={() => onSessionPress?.(item.id)}
          >
            <View style={[styles.sessionGlyph, { backgroundColor: themeTokens.accentTint }]}>
              <Feather name="play" size={14} color={themeTokens.accent} />
            </View>
            <View style={styles.content}>
              <View style={styles.titleRow}>
                <AppText variant="body" style={{ fontWeight: '600' }} numberOfLines={2}>
                  {item.title}
                </AppText>
                <View style={[styles.badge, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}>
                  <AppText variant="caption2" color={themeTokens.textSecondary}>
                    {statusLabel(item.status)}
                  </AppText>
                </View>
              </View>
              <AppText variant="footnote" color={themeTokens.textSecondary}>
                {item.time ? `Session · ${item.time}` : 'Session'}
              </AppText>
            </View>
            {onSessionEdit ? (
              <Pressable
                style={styles.trailingButton}
                onPress={(event) => {
                  event.stopPropagation();
                  onSessionEdit(item.id);
                }}
                hitSlop={8}
              >
                <Feather name="edit-2" size={16} color={themeTokens.textSecondary} />
              </Pressable>
            ) : (
              <Feather name="chevron-right" size={16} color={themeTokens.textTertiary} />
            )}
          </Pressable>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: space[8],
  },
  row: {
    minHeight: 72,
    borderRadius: radius.lg,
    borderWidth: 1,
    paddingHorizontal: space[16],
    paddingVertical: space[12],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
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
  sessionGlyph: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    gap: space[4],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
  },
  badge: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space[8],
    paddingVertical: 2,
    marginLeft: 'auto',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  trailingButton: {
    padding: space[4],
  },
  completedText: {
    textDecorationLine: 'line-through',
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space[16],
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[12],
  },
  emptyTextWrap: {
    flex: 1,
    gap: space[4],
  },
});

export default PlannerAgenda;
