import {
  getAllReminders,
  getDayPlansInRange,
  getModuleSpecs,
  getModuleValuesForDate,
  getRemindersForTracker,
  getSessions,
  getTasks,
  getTrackerEntry,
  getTrackerSummary,
  getTrackers,
  updateTask,
} from '@flowstate/core';
import {
  getReminderRecords,
  markReminderRecordStatus,
  snoozeReminderRecord,
  type ReminderRecord,
} from './notificationCenter';

export type InboxItem =
  | {
      id: string;
      kind: 'task';
      title: string;
      subtitle: string;
      deepLink: string;
      section: 'Overdue Tasks' | 'Inbox Tasks';
      priority: number;
      completed: boolean;
    }
  | {
      id: string;
      kind: 'reminder' | 'session_prompt' | 'tracker_prompt' | 'streak_alert';
      title: string;
      subtitle: string;
      deepLink: string;
      section:
        | 'Upcoming Sessions'
        | 'Tracker Prompts'
        | 'Streak Alerts'
        | 'Reminder Queue'
        | 'Snoozed';
      scheduledFor: string;
      status: ReminderRecord['status'];
      sourceId: string;
    };

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowIso() {
  return new Date(Date.now() + 86400000).toISOString().slice(0, 10);
}

function readableDateLabel(value: string) {
  const today = todayIso();
  const tomorrow = tomorrowIso();
  if (value === today) return 'Today';
  if (value === tomorrow) return 'Tomorrow';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function readableReminderTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function isReminderInboxItem(
  item: InboxItem,
): item is Extract<InboxItem, { kind: 'reminder' | 'session_prompt' | 'tracker_prompt' | 'streak_alert' }> {
  return item.kind !== 'task';
}

function recordSection(
  record: ReminderRecord,
): 'Upcoming Sessions' | 'Tracker Prompts' | 'Streak Alerts' | 'Reminder Queue' | 'Snoozed' {
  if (record.status === 'snoozed' && record.snoozedUntil && new Date(record.snoozedUntil) > new Date()) {
    return 'Snoozed';
  }
  if (record.kind === 'session_prompt') return 'Upcoming Sessions';
  if (record.kind === 'tracker_prompt') return 'Tracker Prompts';
  if (record.kind === 'streak_alert') return 'Streak Alerts';
  return 'Reminder Queue';
}

export async function getInboxItems(db: any): Promise<InboxItem[]> {
  const now = new Date();
  const today = todayIso();

  const [tasks, reminderRecords, futureDays, trackers, modules, todayValues, moduleReminderRows] =
    await Promise.all([
      getTasks(db).catch(() => []),
      getReminderRecords(),
      getDayPlansInRange(
        db,
        today,
        new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
      ).catch(() => []),
      getTrackers(db, { includeArchived: false }).catch(() => []),
      getModuleSpecs(db).catch(() => []),
      getModuleValuesForDate(db, today).catch(() => []),
      getAllReminders(db).catch(() => []),
    ]);

  const openTasks = (tasks as any[])
    .filter((task) => !task.completed)
    .filter((task) => !task.dueDate || task.dueDate <= today)
    .map((task) => ({
      id: task.id,
      kind: 'task' as const,
      title: task.title,
      subtitle: task.dueDate
        ? `${task.dueDate < today ? 'Overdue' : 'Due'}${task.dueTime ? ` · ${task.dueTime}` : ''}`
        : 'No date assigned',
      deepLink: '/inbox',
      section: (task.dueDate && task.dueDate < today ? 'Overdue Tasks' : 'Inbox Tasks') as
        | 'Overdue Tasks'
        | 'Inbox Tasks',
      priority: task.priority ?? 2,
      completed: false,
    }));

  const loggedModuleIds = new Set((todayValues as any[]).map((row) => row.moduleId));

  const reminderItems: InboxItem[] = reminderRecords
    .filter((record) => record.status !== 'done' && record.status !== 'dismissed' && record.status !== 'cancelled')
    .map((record) => ({
      id: record.id,
      kind: record.kind,
      title: record.title,
      subtitle:
        record.status === 'snoozed' && record.snoozedUntil
          ? `Snoozed until ${readableReminderTime(record.snoozedUntil)}`
          : `${record.message} · ${readableReminderTime(record.scheduledFor)}`,
      deepLink: record.deepLink,
      section: recordSection(record),
      scheduledFor: record.scheduledFor,
      status: record.status,
      sourceId: record.sourceId,
    }));

  const sessionItems: InboxItem[] = [];
  const existingSessionIds = new Set(
    reminderItems.filter(isReminderInboxItem).filter((item) => item.kind === 'session_prompt').map((item) => item.sourceId),
  );
  for (const day of futureDays as any[]) {
    const sessions = await getSessions(db, day.id).catch(() => []);
    for (const session of sessions as any[]) {
      if (!session.scheduledTime || session.status === 'completed' || session.status === 'abandoned') continue;
      if (existingSessionIds.has(session.id)) continue;
      sessionItems.push({
        id: `session_prompt:${session.id}:fallback`,
        kind: 'session_prompt',
        title: session.routineName,
        subtitle: `${readableDateLabel(day.date)} · ${session.scheduledTime}`,
        deepLink: `/session/${session.id}`,
        section: 'Upcoming Sessions',
        scheduledFor: new Date(`${day.date}T${session.scheduledTime}:00`).toISOString(),
        status: 'scheduled',
        sourceId: session.id,
      });
    }
  }

  const trackerItems: InboxItem[] = [];
  const todayWeekday = new Date().getDay();
  const existingTrackerIds = new Set(
    reminderItems.filter(isReminderInboxItem).filter((item) => item.kind === 'tracker_prompt').map((item) => item.sourceId),
  );

  for (const tracker of trackers as any[]) {
    if (existingTrackerIds.has(tracker.id)) continue;
    const reminders = await getRemindersForTracker(db, tracker.id).catch(() => []);
    const dueToday = (reminders as any[]).some(
      (reminder) => reminder.enabled && (reminder.daysOfWeek ?? []).includes(todayWeekday),
    );
    if (!dueToday) continue;
    const entry = await getTrackerEntry(db, tracker.id, today).catch(() => null);
    if (entry) continue;
    const summary = await getTrackerSummary(db, tracker.id, today).catch(() => null);
    trackerItems.push({
      id: `tracker_prompt:fallback:${tracker.id}`,
      kind: 'tracker_prompt',
      title: tracker.label,
      subtitle: summary?.currentDisplay
        ? `Ready to log · ${summary.currentDisplay}`
        : 'Scheduled to log today',
      deepLink: `/trackers/${tracker.id}`,
      section: 'Tracker Prompts',
      scheduledFor: now.toISOString(),
      status: 'scheduled',
      sourceId: tracker.id,
    });
  }

  const streakItems: InboxItem[] = (modules as any[])
    .filter((module) => module.streakEnabled && module.streakCheckInTime && !loggedModuleIds.has(module.id))
    .map((module) => ({
      id: `streak_alert:fallback:${module.id}`,
      kind: 'streak_alert' as const,
      title: module.label,
      subtitle: `Still needs a check-in today · ${module.streakCheckInTime}`,
      deepLink: '/track',
      section: 'Streak Alerts' as const,
      scheduledFor: new Date(`${today}T${module.streakCheckInTime}:00`).toISOString(),
      status: 'scheduled' as const,
      sourceId: module.id,
    }));

  const legacyReminderItems: InboxItem[] = (moduleReminderRows as any[])
    .filter((reminder) => reminder.enabled && (reminder.daysOfWeek ?? []).includes(todayWeekday))
    .map((reminder) => {
      const module = (modules as any[]).find((entry) => entry.id === reminder.moduleId);
      return {
        id: `reminder:fallback:${reminder.id}`,
        kind: 'reminder' as const,
        title: module?.label ?? 'Legacy tracker',
        subtitle: `${reminder.message ?? 'Reminder ready'} · ${reminder.time}`,
        deepLink: '/track',
        section: 'Reminder Queue' as const,
        scheduledFor: new Date(`${today}T${reminder.time}:00`).toISOString(),
        status: 'scheduled' as const,
        sourceId: reminder.moduleId,
      };
    });

  return [
    ...openTasks,
    ...reminderItems,
    ...sessionItems,
    ...trackerItems,
    ...streakItems,
    ...legacyReminderItems,
  ].sort((left, right) => {
    const leftValue = 'scheduledFor' in left ? left.scheduledFor : '';
    const rightValue = 'scheduledFor' in right ? right.scheduledFor : '';
    if (left.section !== right.section) return left.section.localeCompare(right.section);
    if (leftValue !== rightValue) return leftValue.localeCompare(rightValue);
    return left.title.localeCompare(right.title);
  });
}

export async function getInboxBadgeCount(db: any): Promise<number> {
  const items = await getInboxItems(db);
  return items.filter((item) => item.section !== 'Snoozed').length;
}

export async function snoozeInboxItem(item: InboxItem, minutes = 60) {
  if (item.kind === 'task') return;
  const recordId = item.id.replace(':fallback', '');
  await snoozeReminderRecord(recordId, minutes);
}

export async function completeInboxItem(db: any, item: InboxItem) {
  if (item.kind === 'task') {
    await updateTask(db, item.id, { completed: true });
    return;
  }
  const recordId = item.id.replace(':fallback', '');
  await markReminderRecordStatus(recordId, 'done');
}
