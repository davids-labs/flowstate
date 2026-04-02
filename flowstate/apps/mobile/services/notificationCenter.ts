import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import {
  getAllReminders,
  getDayPlansInRange,
  getModuleSpecs,
  getModuleValuesForDate,
  getRemindersForTracker,
  getSessions,
  getTrackers,
} from '@flowstate/core';

const PREFS_KEY = 'flowstate_notification_preferences_v2';
const RECORDS_KEY = 'flowstate_reminder_records_v2';

const MORNING_BRIEF_ID = 'flowstate-brief-morning';
const EVENING_REVIEW_ID = 'flowstate-review-evening';
const SESSION_PREFIX = 'flowstate-session-prompt-';
const TRACKER_PREFIX = 'flowstate-tracker-prompt-';
const MODULE_PREFIX = 'flowstate-module-reminder-';
const STREAK_PREFIX = 'flowstate-streak-alert-';

const MANAGED_PREFIXES = [
  MORNING_BRIEF_ID,
  EVENING_REVIEW_ID,
  SESSION_PREFIX,
  TRACKER_PREFIX,
  MODULE_PREFIX,
  STREAK_PREFIX,
];

export type ReminderRecordStatus =
  | 'scheduled'
  | 'delivered'
  | 'done'
  | 'dismissed'
  | 'snoozed'
  | 'cancelled';

export interface ReminderRecord {
  id: string;
  kind: 'reminder' | 'session_prompt' | 'tracker_prompt' | 'streak_alert';
  sourceId: string;
  deepLink: string;
  scheduledFor: string;
  lastTriggeredAt: string | null;
  snoozedUntil: string | null;
  status: ReminderRecordStatus;
  message: string;
  title: string;
  notificationIds: string[];
}

export interface DailyAutomationPreference {
  enabled: boolean;
  time: string;
}

export interface SessionReminderPreference {
  enabled: boolean;
  leadMinutes: number;
}

export interface NotificationPreferences {
  enabled: boolean;
  morningBrief: DailyAutomationPreference;
  eveningReview: DailyAutomationPreference;
  sessionReminder: SessionReminderPreference;
  trackerReminder: {
    enabled: boolean;
  };
  badgeCounts: {
    enabled: boolean;
  };
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  enabled: true,
  morningBrief: {
    enabled: true,
    time: '08:00',
  },
  eveningReview: {
    enabled: true,
    time: '20:00',
  },
  sessionReminder: {
    enabled: false,
    leadMinutes: 30,
  },
  trackerReminder: {
    enabled: true,
  },
  badgeCounts: {
    enabled: true,
  },
};

try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Unsupported environment or Expo Go.
}

function isValidTime(value: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value.trim());
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function atLocalDateTime(date: string, time: string) {
  return new Date(`${date}T${time}:00`);
}

function toTriggerDate(date: Date) {
  return new Date(date.getTime() + 1000);
}

function nextDailyOccurrence(time: string, now = new Date()) {
  const [hour, minute] = time.split(':').map(Number);
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1);
  return next;
}

function nextWeeklyOccurrence(weekday: number, time: string, now = new Date()) {
  const [hour, minute] = time.split(':').map(Number);
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  const currentWeekday = next.getDay();
  let delta = weekday - currentWeekday;
  if (delta < 0 || (delta === 0 && next.getTime() <= now.getTime())) delta += 7;
  next.setDate(next.getDate() + delta);
  return next;
}

async function cancelNotification(identifier: string) {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
  } catch {}
}

async function requestPermissions() {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

async function cancelManagedNotifications() {
  try {
    const scheduled = await Notifications.getAllScheduledNotificationsAsync();
    await Promise.all(
      scheduled
        .filter((notification) =>
          MANAGED_PREFIXES.some((prefix) => notification.identifier.startsWith(prefix)),
        )
        .map((notification) => cancelNotification(notification.identifier)),
    );
  } catch {}
}

function normalizePreferences(
  value: Partial<NotificationPreferences> | null | undefined,
): NotificationPreferences {
  const prefs = value ?? {};
  return {
    enabled: prefs.enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.enabled,
    morningBrief: {
      enabled: prefs.morningBrief?.enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.morningBrief.enabled,
      time:
        prefs.morningBrief?.time && isValidTime(prefs.morningBrief.time)
          ? prefs.morningBrief.time
          : DEFAULT_NOTIFICATION_PREFERENCES.morningBrief.time,
    },
    eveningReview: {
      enabled: prefs.eveningReview?.enabled ?? DEFAULT_NOTIFICATION_PREFERENCES.eveningReview.enabled,
      time:
        prefs.eveningReview?.time && isValidTime(prefs.eveningReview.time)
          ? prefs.eveningReview.time
          : DEFAULT_NOTIFICATION_PREFERENCES.eveningReview.time,
    },
    sessionReminder: {
      enabled:
        prefs.sessionReminder?.enabled ??
        DEFAULT_NOTIFICATION_PREFERENCES.sessionReminder.enabled,
      leadMinutes:
        typeof prefs.sessionReminder?.leadMinutes === 'number'
          ? Math.max(0, Math.round(prefs.sessionReminder.leadMinutes))
          : DEFAULT_NOTIFICATION_PREFERENCES.sessionReminder.leadMinutes,
    },
    trackerReminder: {
      enabled:
        prefs.trackerReminder?.enabled ??
        DEFAULT_NOTIFICATION_PREFERENCES.trackerReminder.enabled,
    },
    badgeCounts: {
      enabled:
        prefs.badgeCounts?.enabled ??
        DEFAULT_NOTIFICATION_PREFERENCES.badgeCounts.enabled,
    },
  };
}

export async function loadNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const raw = await AsyncStorage.getItem(PREFS_KEY);
    if (raw) {
      return normalizePreferences(JSON.parse(raw));
    }
  } catch {}

  const legacyNotifications = await AsyncStorage.getItem('setting_notifications').catch(() => null);
  return normalizePreferences({
    enabled: legacyNotifications == null ? true : legacyNotifications !== 'false',
  });
}

export async function saveNotificationPreferences(
  value: NotificationPreferences,
): Promise<NotificationPreferences> {
  const normalized = normalizePreferences(value);
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(normalized));
  await AsyncStorage.setItem('setting_notifications', String(normalized.enabled)).catch(() => {});
  return normalized;
}

export async function getReminderRecords(): Promise<ReminderRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(RECORDS_KEY);
    return raw ? (JSON.parse(raw) as ReminderRecord[]) : [];
  } catch {
    return [];
  }
}

async function saveReminderRecords(records: ReminderRecord[]) {
  await AsyncStorage.setItem(RECORDS_KEY, JSON.stringify(records));
}

export async function updateReminderRecord(
  id: string,
  updater: (record: ReminderRecord) => ReminderRecord,
) {
  const current = await getReminderRecords();
  let changed = false;
  const next = current.map((record) => {
    if (record.id !== id) return record;
    changed = true;
    return updater(record);
  });
  if (changed) await saveReminderRecords(next);
}

export async function markReminderRecordStatus(
  id: string,
  status: ReminderRecordStatus,
) {
  await updateReminderRecord(id, (record) => ({
    ...record,
    status,
    snoozedUntil: status === 'snoozed' ? record.snoozedUntil : null,
    lastTriggeredAt:
      status === 'delivered' || status === 'done' || status === 'dismissed'
        ? new Date().toISOString()
        : record.lastTriggeredAt,
  }));
}

export async function snoozeReminderRecord(id: string, minutes = 60) {
  const snoozedUntil = new Date(Date.now() + minutes * 60_000).toISOString();
  await updateReminderRecord(id, (record) => ({
    ...record,
    status: 'snoozed',
    snoozedUntil,
  }));
}

function mergeReminderRecord(
  existing: ReminderRecord | undefined,
  next: ReminderRecord,
): ReminderRecord {
  if (!existing) return next;
  return {
    ...next,
    status:
      existing.status === 'done' || existing.status === 'dismissed'
        ? existing.status
        : existing.snoozedUntil && new Date(existing.snoozedUntil) > new Date()
          ? 'snoozed'
          : next.status,
    snoozedUntil: existing.snoozedUntil,
    lastTriggeredAt: existing.lastTriggeredAt,
  };
}

async function scheduleDailyAutomation(
  identifier: string,
  title: string,
  body: string,
  time: string,
) {
  await cancelNotification(identifier);
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: Number(time.split(':')[0]),
      minute: Number(time.split(':')[1]),
    },
  });
}

async function scheduleWeeklyReminder(
  identifier: string,
  title: string,
  body: string,
  time: string,
  weekday: number,
) {
  await cancelNotification(identifier);
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
      weekday: weekday + 1,
      hour: Number(time.split(':')[0]),
      minute: Number(time.split(':')[1]),
    },
  });
}

async function scheduleOneShotReminder(
  identifier: string,
  title: string,
  body: string,
  date: Date,
) {
  await cancelNotification(identifier);
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title,
      body,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
    },
    trigger: toTriggerDate(date) as any,
  });
}

function sortRecords(records: ReminderRecord[]) {
  return [...records].sort((left, right) => left.scheduledFor.localeCompare(right.scheduledFor));
}

export async function syncNotificationCenter(db: any) {
  const prefs = await loadNotificationPreferences();
  const existingRecords = await getReminderRecords();
  const existingById = new Map(existingRecords.map((record) => [record.id, record]));

  if (!prefs.enabled) {
    await cancelManagedNotifications();
    await saveReminderRecords(
      existingRecords.map((record) => ({
        ...record,
        status: 'cancelled',
      })),
    );
    return;
  }

  const hasPermission = await requestPermissions();
  if (!hasPermission) return;

  await cancelManagedNotifications();

  const nextRecords: ReminderRecord[] = [];
  const now = new Date();

  if (prefs.morningBrief.enabled) {
    await scheduleDailyAutomation(
      MORNING_BRIEF_ID,
      'Morning Brief',
      'Open FlowState and set the tone for the day.',
      prefs.morningBrief.time,
    );
    nextRecords.push(
      mergeReminderRecord(existingById.get('reminder:morning-brief'), {
        id: 'reminder:morning-brief',
        kind: 'reminder',
        sourceId: 'morning-brief',
        deepLink: '/(tabs)',
        scheduledFor: nextDailyOccurrence(prefs.morningBrief.time, now).toISOString(),
        lastTriggeredAt: null,
        snoozedUntil: null,
        status: 'scheduled',
        message: 'Open FlowState and set the tone for the day.',
        title: 'Morning Brief',
        notificationIds: [MORNING_BRIEF_ID],
      }),
    );
  }

  if (prefs.eveningReview.enabled) {
    await scheduleDailyAutomation(
      EVENING_REVIEW_ID,
      'Evening Review',
      'Wrap the day, log what happened, and tidy tomorrow.',
      prefs.eveningReview.time,
    );
    nextRecords.push(
      mergeReminderRecord(existingById.get('reminder:evening-review'), {
        id: 'reminder:evening-review',
        kind: 'reminder',
        sourceId: 'evening-review',
        deepLink: '/inbox',
        scheduledFor: nextDailyOccurrence(prefs.eveningReview.time, now).toISOString(),
        lastTriggeredAt: null,
        snoozedUntil: null,
        status: 'scheduled',
        message: 'Wrap the day, log what happened, and tidy tomorrow.',
        title: 'Evening Review',
        notificationIds: [EVENING_REVIEW_ID],
      }),
    );
  }

  const startDate = todayIso();
  const endDate = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  const futureDays = await getDayPlansInRange(db, startDate, endDate).catch(() => []);

  if (prefs.sessionReminder.enabled) {
    for (const day of futureDays as any[]) {
      const daySessions = await getSessions(db, day.id).catch(() => []);
      for (const session of daySessions as any[]) {
        if (!session.scheduledTime || session.status === 'completed' || session.status === 'abandoned') {
          continue;
        }
        const sessionAt = atLocalDateTime(day.date, session.scheduledTime);
        const reminderAt = new Date(
          sessionAt.getTime() - prefs.sessionReminder.leadMinutes * 60_000,
        );
        if (reminderAt.getTime() <= Date.now()) continue;
        const identifier = `${SESSION_PREFIX}${session.id}`;
        await scheduleOneShotReminder(
          identifier,
          'Upcoming Session',
          `${session.routineName} starts at ${session.scheduledTime}.`,
          reminderAt,
        );
        nextRecords.push(
          mergeReminderRecord(existingById.get(`session_prompt:${session.id}`), {
            id: `session_prompt:${session.id}`,
            kind: 'session_prompt',
            sourceId: session.id,
            deepLink: `/session/${session.id}`,
            scheduledFor: reminderAt.toISOString(),
            lastTriggeredAt: null,
            snoozedUntil: null,
            status: 'scheduled',
            message: `${session.routineName} starts at ${session.scheduledTime}.`,
            title: 'Upcoming Session',
            notificationIds: [identifier],
          }),
        );
      }
    }
  }

  if (prefs.trackerReminder.enabled) {
    const trackers = await getTrackers(db, { includeArchived: false }).catch(() => []);
    const moduleReminderRows = await getAllReminders(db).catch(() => []);
    const moduleSpecs = await getModuleSpecs(db).catch(() => []);
    const todayValues = await getModuleValuesForDate(db, todayIso()).catch(() => []);
    const loggedModuleIds = new Set((todayValues as any[]).map((row) => row.moduleId));

    for (const tracker of trackers as any[]) {
      const reminders = await getRemindersForTracker(db, tracker.id).catch(() => []);
      for (const reminder of reminders as any[]) {
        if (!reminder.enabled) continue;
        const notificationIds: string[] = [];
        for (const dayOfWeek of reminder.daysOfWeek ?? []) {
          const identifier = `${TRACKER_PREFIX}${reminder.id}-${dayOfWeek}`;
          notificationIds.push(identifier);
          await scheduleWeeklyReminder(
            identifier,
            tracker.label,
            reminder.message ?? `Log ${tracker.label}`,
            reminder.time,
            dayOfWeek,
          );
        }

        const nextAt = (reminder.daysOfWeek ?? [])
          .map((dayOfWeek: number) => nextWeeklyOccurrence(dayOfWeek, reminder.time, now))
          .sort((left: Date, right: Date) => left.getTime() - right.getTime())[0];

        if (!nextAt) continue;
        nextRecords.push(
          mergeReminderRecord(existingById.get(`tracker_prompt:${reminder.id}`), {
            id: `tracker_prompt:${reminder.id}`,
            kind: 'tracker_prompt',
            sourceId: tracker.id,
            deepLink: `/trackers/${tracker.id}`,
            scheduledFor: nextAt.toISOString(),
            lastTriggeredAt: null,
            snoozedUntil: null,
            status: 'scheduled',
            message: reminder.message ?? `Log ${tracker.label}`,
            title: tracker.label,
            notificationIds,
          }),
        );
      }
    }

    for (const reminder of moduleReminderRows as any[]) {
      if (!reminder.enabled) continue;
      const module = (moduleSpecs as any[]).find((entry) => entry.id === reminder.moduleId);
      const label = module?.label ?? 'Legacy tracker';
      const notificationIds: string[] = [];
      for (const dayOfWeek of reminder.daysOfWeek ?? []) {
        const identifier = `${MODULE_PREFIX}${reminder.id}-${dayOfWeek}`;
        notificationIds.push(identifier);
        await scheduleWeeklyReminder(
          identifier,
          label,
          reminder.message ?? `Log ${label}`,
          reminder.time,
          dayOfWeek,
        );
      }

      const nextAt = (reminder.daysOfWeek ?? [])
        .map((dayOfWeek: number) => nextWeeklyOccurrence(dayOfWeek, reminder.time, now))
        .sort((left: Date, right: Date) => left.getTime() - right.getTime())[0];

      if (!nextAt) continue;
      nextRecords.push(
        mergeReminderRecord(existingById.get(`reminder:${reminder.id}`), {
          id: `reminder:${reminder.id}`,
          kind: 'reminder',
          sourceId: reminder.moduleId,
          deepLink: '/track',
          scheduledFor: nextAt.toISOString(),
          lastTriggeredAt: null,
          snoozedUntil: null,
          status: 'scheduled',
          message: reminder.message ?? `Log ${label}`,
          title: label,
          notificationIds,
        }),
      );
    }

    for (const module of moduleSpecs as any[]) {
      if (!module.streakEnabled || !module.streakCheckInTime) continue;
      const identifier = `${STREAK_PREFIX}${module.id}`;
      await scheduleDailyAutomation(
        identifier,
        `Keep ${module.label} alive`,
        `Log ${module.label} today so the streak survives.`,
        module.streakCheckInTime,
      );
      nextRecords.push(
        mergeReminderRecord(existingById.get(`streak_alert:${module.id}`), {
          id: `streak_alert:${module.id}`,
          kind: 'streak_alert',
          sourceId: module.id,
          deepLink: '/track',
          scheduledFor: nextDailyOccurrence(module.streakCheckInTime, now).toISOString(),
          lastTriggeredAt: null,
          snoozedUntil: null,
          status: loggedModuleIds.has(module.id) ? 'done' : 'scheduled',
          message: `Log ${module.label} today so the streak survives.`,
          title: `Keep ${module.label} alive`,
          notificationIds: [identifier],
        }),
      );
    }
  }

  const nextById = new Map(nextRecords.map((record) => [record.id, record]));
  const cancelledRecords = existingRecords
    .filter((record) => !nextById.has(record.id))
    .map((record) => ({ ...record, status: 'cancelled' as const }));

  await saveReminderRecords(sortRecords([...nextRecords, ...cancelledRecords]));
}

export async function getNotificationBadgeEnabled() {
  const prefs = await loadNotificationPreferences();
  return prefs.enabled && prefs.badgeCounts.enabled;
}
