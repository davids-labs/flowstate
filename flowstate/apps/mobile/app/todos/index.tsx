import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  View,
  type SectionListData,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  createTask,
  getTask,
  updateTask,
} from '@flowstate/core';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { AppText } from '../../components/primitives/Text';
import { TaskEditor, type TaskFormData } from '../../components/tasks/TaskEditor';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';
import {
  completeInboxItem,
  getInboxItems,
  snoozeInboxItem,
  type InboxItem,
} from '../../services/inbox';
import { refreshAmbientState } from '../../services/systemSync';

const SECTION_ORDER: Array<InboxItem['section']> = [
  'Overdue Tasks',
  'Inbox Tasks',
  'Upcoming Sessions',
  'Tracker Prompts',
  'Streak Alerts',
  'Reminder Queue',
  'Snoozed',
];

function iconForItem(item: InboxItem): keyof typeof Feather.glyphMap {
  if (item.kind === 'task') return 'check-square';
  if (item.kind === 'session_prompt') return 'play-circle';
  if (item.kind === 'tracker_prompt') return 'activity';
  if (item.kind === 'streak_alert') return 'zap';
  return 'bell';
}

function SummaryPill({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  const { themeTokens } = useTheme();

  return (
    <View style={[styles.summaryPill, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
      <AppText variant="headline" style={{ fontWeight: '700' }}>
        {value}
      </AppText>
      <AppText variant="caption1" color={themeTokens.textSecondary}>
        {label}
      </AppText>
    </View>
  );
}

function InboxRow({
  item,
  onOpen,
  onComplete,
  onSnooze,
}: {
  item: InboxItem;
  onOpen: (item: InboxItem) => void;
  onComplete: (item: InboxItem) => void;
  onSnooze: (item: InboxItem) => void;
}) {
  const { themeTokens } = useTheme();
  const isTask = item.kind === 'task';
  const isFallbackReminder = !isTask && item.id.includes(':fallback');

  return (
    <Pressable
      style={[styles.rowCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}
      onPress={() => onOpen(item)}
    >
      <View style={styles.rowTop}>
        <View style={[styles.rowIcon, { backgroundColor: isTask ? themeTokens.accentTint : themeTokens.surface }]}>
          <Feather
            name={iconForItem(item)}
            size={16}
            color={isTask ? themeTokens.accent : themeTokens.textSecondary}
          />
        </View>
        <View style={styles.rowCopy}>
          <AppText variant="headline" style={{ fontWeight: '700' }} numberOfLines={2}>
            {item.title}
          </AppText>
          <AppText variant="footnote" color={themeTokens.textSecondary} numberOfLines={2}>
            {item.subtitle}
          </AppText>
        </View>
        <Feather name="chevron-right" size={16} color={themeTokens.textTertiary} />
      </View>

      <View style={styles.rowActions}>
        <Pressable
          style={[styles.inlineAction, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
          onPress={(event) => {
            event.stopPropagation();
            onOpen(item);
          }}
        >
          <Feather name="arrow-up-right" size={14} color={themeTokens.textPrimary} />
          <AppText variant="caption1" style={{ fontWeight: '700' }}>
            {isTask ? 'Edit' : 'Open'}
          </AppText>
        </Pressable>

        {!isTask && !isFallbackReminder ? (
          <Pressable
            style={[styles.inlineAction, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
            onPress={(event) => {
              event.stopPropagation();
              onSnooze(item);
            }}
          >
            <Feather name="clock" size={14} color={themeTokens.textPrimary} />
            <AppText variant="caption1" style={{ fontWeight: '700' }}>
              Snooze
            </AppText>
          </Pressable>
        ) : null}

        <Pressable
          style={[
            styles.inlineAction,
            isTask
              ? { backgroundColor: themeTokens.accentTint, borderColor: themeTokens.accent }
              : { backgroundColor: `${themeTokens.success}14`, borderColor: `${themeTokens.success}45` },
          ]}
          onPress={(event) => {
            event.stopPropagation();
            onComplete(item);
          }}
        >
          <Feather
            name="check"
            size={14}
            color={isTask ? themeTokens.accent : themeTokens.success}
          />
          <AppText
            variant="caption1"
            color={isTask ? themeTokens.accent : themeTokens.success}
            style={{ fontWeight: '700' }}
          >
            {isTask ? 'Done' : isFallbackReminder ? 'Handled' : 'Clear'}
          </AppText>
        </Pressable>
      </View>
    </Pressable>
  );
}

export default function InboxScreen() {
  const router = useRouter();
  const { themeTokens } = useTheme();
  const { db, isReady } = useDatabaseSafe();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<InboxItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditor, setShowEditor] = useState(false);
  const [editingTask, setEditingTask] = useState<TaskFormData | undefined>(undefined);

  const loadInbox = useCallback(async () => {
    if (!db || !isReady) return;
    const nextItems = await getInboxItems(db);
    setItems(nextItems);
  }, [db, isReady]);

  useFocusEffect(
    useCallback(() => {
      loadInbox();
    }, [loadInbox]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInbox();
    setRefreshing(false);
  }, [loadInbox]);

  const sections = useMemo((): Array<SectionListData<InboxItem>> => {
    const grouped = new Map<InboxItem['section'], InboxItem[]>();
    for (const item of items) {
      const existing = grouped.get(item.section) ?? [];
      existing.push(item);
      grouped.set(item.section, existing);
    }
    return SECTION_ORDER
      .filter((section) => (grouped.get(section) ?? []).length > 0)
      .map((section) => ({
        title: section,
        data: grouped.get(section) ?? [],
      }));
  }, [items]);

  const stats = useMemo(() => {
    return {
      tasks: items.filter((item) => item.kind === 'task').length,
      prompts: items.filter((item) => item.kind !== 'task' && item.section !== 'Snoozed').length,
      snoozed: items.filter((item) => item.section === 'Snoozed').length,
    };
  }, [items]);

  const openItem = useCallback(async (item: InboxItem) => {
    if (item.kind === 'task') {
      if (!db) return;
      const task = await getTask(db, item.id);
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
      return;
    }

    router.push(item.deepLink as any);
  }, [db, router]);

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
        dueDate: data.dueDate || undefined,
        dueTime: data.dueTime || undefined,
        priority: data.priority,
        notes: data.notes || undefined,
        recurrence: data.recurrence || undefined,
      });
    }

    setShowEditor(false);
    await refreshAmbientState(db);
    await loadInbox();
  }, [db, loadInbox]);

  if (!isReady) {
    return (
      <View style={[styles.screen, { backgroundColor: themeTokens.background, justifyContent: 'center', alignItems: 'center' }]}>
        <AppText variant="footnote" color={themeTokens.textSecondary}>
          Loading inbox...
        </AppText>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: themeTokens.background }]}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <InboxRow
            item={item}
            onOpen={openItem}
            onComplete={async (target) => {
              if (!db) return;
              await completeInboxItem(db, target);
              await refreshAmbientState(db);
              await loadInbox();
            }}
            onSnooze={async (target) => {
              await snoozeInboxItem(target, 60);
              await loadInbox();
            }}
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={themeTokens.accent} />
        }
        contentContainerStyle={{ padding: space[16], paddingTop: insets.top + space[8], paddingBottom: insets.bottom + 120 }}
        ListHeaderComponent={
          <View style={styles.headerShell}>
            <View style={styles.hero}>
              <View style={styles.heroCopy}>
                <AppText variant="title1" style={{ fontWeight: '800' }}>
                  Inbox
                </AppText>
                <AppText variant="footnote" color={themeTokens.textSecondary}>
                  Triage what needs attention across tasks, reminders, sessions, and tracker prompts.
                </AppText>
              </View>
              <Pressable
                style={[styles.primaryButton, { backgroundColor: themeTokens.accent }]}
                onPress={() => {
                  setEditingTask(undefined);
                  setShowEditor(true);
                }}
              >
                <Feather name="plus" size={16} color="#fff" />
                <AppText variant="caption1" onAccent style={{ fontWeight: '700' }}>
                  Task
                </AppText>
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryRow}>
              <SummaryPill label="tasks" value={stats.tasks} />
              <SummaryPill label="prompts" value={stats.prompts} />
              <SummaryPill label="snoozed" value={stats.snoozed} />
            </ScrollView>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: themeTokens.accentTint }]}>
              <Feather name="inbox" size={18} color={themeTokens.accent} />
            </View>
            <AppText variant="headline" style={{ fontWeight: '700', textAlign: 'center' }}>
              Inbox at zero
            </AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary} style={{ textAlign: 'center' }}>
              No overdue tasks, no pending nudges, and no reminders waiting for you.
            </AppText>
          </View>
        }
      />

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
  headerShell: {
    gap: space[16],
    paddingBottom: space[8],
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[12],
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  summaryRow: {
    gap: space[8],
    paddingRight: space[4],
  },
  summaryPill: {
    minWidth: 96,
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: space[12],
    paddingVertical: space[12],
    gap: 4,
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
  sectionHeader: {
    paddingTop: space[16],
    paddingBottom: space[8],
  },
  rowCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[14],
    gap: space[12],
    marginBottom: space[8],
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[12],
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCopy: {
    flex: 1,
    gap: 4,
  },
  rowActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[8],
  },
  inlineAction: {
    minHeight: 38,
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: space[12],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  emptyState: {
    alignItems: 'center',
    gap: space[8],
    paddingTop: space[56],
    paddingHorizontal: space[24],
  },
  emptyIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
