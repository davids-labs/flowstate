import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TIMER_TASK = 'FLOWSTATE_TIMER_NOTIFICATION';
const TIMER_NOTIFICATION_ID = 'flowstate-timer';

// Configure notification handler — wrapped in try/catch for Expo Go compatibility
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch (e) {
  console.warn('Notifications handler setup skipped:', e);
}

/**
 * Check if notifications are enabled by the user in settings.
 */
async function areNotificationsEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem('setting_notifications');
    return val !== 'false'; // default to true
  } catch {
    return true;
  }
}

/**
 * Request notification permissions.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

/**
 * Show or update the persistent timer notification.
 * Respects the user's notification setting.
 */
export async function showTimerNotification(
  remaining: number,
  blockName: string,
  routineName: string,
) {
  // Check user preference
  const enabled = await areNotificationsEnabled();
  if (!enabled) return;

  const isOverdue = remaining < 0;
  const absMs = Math.abs(remaining);
  const totalSeconds = Math.floor(absMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const timeStr = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const title = isOverdue ? `⏰ ${routineName} — Overdue` : `⏱ ${routineName}`;
  const body = isOverdue
    ? `${blockName} — +${timeStr} over time`
    : `${blockName} — ${timeStr} remaining`;

  await Notifications.scheduleNotificationAsync({
    identifier: TIMER_NOTIFICATION_ID,
    content: {
      title,
      body,
      sticky: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      ...(Platform.OS === 'android' && {
        autoDismiss: false,
      }),
    },
    trigger: null, // Show immediately
  });
}

/**
 * Dismiss the timer notification.
 */
export async function dismissTimerNotification() {
  await Notifications.dismissNotificationAsync(TIMER_NOTIFICATION_ID);
}

/**
 * Cancel all scheduled timer notifications.
 */
export async function cancelTimerNotifications() {
  await Notifications.cancelScheduledNotificationAsync(TIMER_NOTIFICATION_ID);
  await dismissTimerNotification();
}

// ─── Background Task ────────────────────────────────────────────

// Store active timer info so the background task can build a notification
const TIMER_STATE_KEY = 'flowstate_bg_timer_state';

/**
 * Save timer state to AsyncStorage so the background task can read it.
 */
export async function saveBackgroundTimerState(data: {
  remaining: number;
  blockName: string;
  routineName: string;
  endTimeMs: number; // Date.now() + remaining
  isRunning: boolean;
}) {
  await AsyncStorage.setItem(TIMER_STATE_KEY, JSON.stringify(data));
}

export async function clearBackgroundTimerState() {
  await AsyncStorage.removeItem(TIMER_STATE_KEY);
}

// Define background task (must be at module level for TaskManager)
// This task fires periodically (minimum ~15 min) via BackgroundFetch.
// For more frequent updates, the foreground notification approach is used.
try {
  TaskManager.defineTask(TIMER_TASK, async () => {
    try {
      const raw = await AsyncStorage.getItem(TIMER_STATE_KEY);
      if (!raw) return;

      const state = JSON.parse(raw);
      if (!state.isRunning) return;

      // Compute remaining time from saved endTime
      const remaining = state.endTimeMs - Date.now();

      await showTimerNotification(remaining, state.blockName, state.routineName);
    } catch (e) {
      console.error('Timer background task error:', e);
    }
  });
} catch (e) {
  console.warn('Background task setup skipped:', e);
}

/**
 * Start the background timer task.
 * Requests permissions and shows an initial notification.
 *
 * BUG-15: Only call for timed countdown blocks. For countup / goal_based
 * blocks (where remaining is 0, negative, or Infinity), this is a no-op.
 */
export async function startBackgroundTimer(
  remaining: number,
  blockName: string,
  routineName: string,
) {
  // Guard: don't schedule background countdown for open-ended blocks
  if (!isFinite(remaining) || remaining <= 0) return;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    console.warn('Notification permissions not granted');
    return;
  }

  // Save state for background task
  await saveBackgroundTimerState({
    remaining,
    blockName,
    routineName,
    endTimeMs: Date.now() + remaining,
    isRunning: true,
  });

  // Show immediate notification
  await showTimerNotification(remaining, blockName, routineName);
}

export async function stopBackgroundTimer() {
  await clearBackgroundTimerState();
  await cancelTimerNotifications();
}

// ─── Scheduled Daily Reminders ──────────────────────────────────

const MORNING_REMINDER_ID = 'flowstate-morning-reminder';
const EVENING_REMINDER_ID = 'flowstate-evening-reminder';

/**
 * Schedule daily reminder notifications.
 * Morning: 8:00 AM — "Plan your day and track your modules"
 * Evening: 8:00 PM — "Don't forget to log today's progress"
 */
export async function scheduleDailyReminders() {
  const enabled = await areNotificationsEnabled();
  if (!enabled) return;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  // Cancel existing reminders first to avoid duplicates
  await cancelDailyReminders();

  // Morning reminder at 8:00 AM daily
  await Notifications.scheduleNotificationAsync({
    identifier: MORNING_REMINDER_ID,
    content: {
      title: '☀️ Good morning',
      body: 'Plan your day — check your modules and start a session.',
      sound: true,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 8,
      minute: 0,
    },
  });

  // Evening reminder at 8:00 PM daily
  await Notifications.scheduleNotificationAsync({
    identifier: EVENING_REMINDER_ID,
    content: {
      title: '🌙 Evening check-in',
      body: "Don't forget to log today's progress before bed.",
      sound: true,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 20,
      minute: 0,
    },
  });
}

/**
 * Cancel all daily reminders.
 */
export async function cancelDailyReminders() {
  try {
    await Notifications.cancelScheduledNotificationAsync(MORNING_REMINDER_ID);
    await Notifications.cancelScheduledNotificationAsync(EVENING_REMINDER_ID);
  } catch {}
}

/**
 * Sync reminder state with user's notification preference.
 * Call this when the notification toggle changes in settings.
 */
export async function syncReminderPreference(enabled: boolean) {
  if (enabled) {
    await scheduleDailyReminders();
  } else {
    await cancelDailyReminders();
  }
}

// ─── Per-Module Reminders ───────────────────────────────────────

const MODULE_REMINDER_PREFIX = 'flowstate-module-reminder-';

/**
 * Schedule notifications for a single module reminder.
 * Creates one notification per scheduled day-of-week.
 */
export async function scheduleModuleReminder(
  reminderId: string,
  moduleLabel: string,
  moduleEmoji: string | null,
  time: string,         // "HH:MM"
  daysOfWeek: number[], // 0=Sun..6=Sat
  message?: string | null,
) {
  const enabled = await areNotificationsEnabled();
  if (!enabled) return;

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  // Cancel any existing notifications for this reminder
  await cancelModuleReminder(reminderId);

  const [hourStr, minStr] = time.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minStr, 10);
  const prefix = moduleEmoji ? `${moduleEmoji} ` : '';
  const body = message || `Time to log ${moduleLabel}`;

  for (const weekday of daysOfWeek) {
    const identifier = `${MODULE_REMINDER_PREFIX}${reminderId}-${weekday}`;
    await Notifications.scheduleNotificationAsync({
      identifier,
      content: {
        title: `${prefix}${moduleLabel}`,
        body,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.DEFAULT,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: weekday + 1, // expo uses 1=Sun..7=Sat
        hour,
        minute,
      },
    });
  }
}

/**
 * Cancel all notifications for a specific module reminder.
 */
export async function cancelModuleReminder(reminderId: string) {
  // Cancel for all 7 possible weekdays
  for (let d = 0; d < 7; d++) {
    try {
      await Notifications.cancelScheduledNotificationAsync(
        `${MODULE_REMINDER_PREFIX}${reminderId}-${d}`,
      );
    } catch {}
  }
}

/**
 * Sync all module reminders from the DB.
 * Call this on app start and whenever reminders are modified.
 */
export async function syncAllModuleReminders(
  reminders: Array<{
    id: string;
    moduleLabel: string;
    moduleEmoji: string | null;
    time: string;
    daysOfWeek: number[];
    message: string | null;
    enabled: boolean;
  }>,
) {
  for (const r of reminders) {
    if (r.enabled) {
      await scheduleModuleReminder(r.id, r.moduleLabel, r.moduleEmoji, r.time, r.daysOfWeek, r.message);
    } else {
      await cancelModuleReminder(r.id);
    }
  }
}

// ─── Streak Check-In Notifications (Feature 8) ─────────────────

const STREAK_REMINDER_PREFIX = 'flowstate-streak-';

/**
 * Schedule a daily streak check-in notification for a module.
 * Fires every day at the configured time to warn the user to log
 * before their streak resets at midnight.
 *
 * @param moduleId     - unique module id (used as notification key)
 * @param moduleLabel  - display label e.g. "Push-ups"
 * @param moduleEmoji  - optional emoji prefix
 * @param checkInTime  - "HH:MM" string from moduleSpecs.streakCheckInTime
 */
export async function scheduleStreakReminder(
  moduleId: string,
  moduleLabel: string,
  moduleEmoji: string | null,
  checkInTime: string,
): Promise<void> {
  const enabled = await areNotificationsEnabled();
  if (!enabled) return;
  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) return;

  await cancelStreakReminder(moduleId);

  const [hourStr, minStr] = checkInTime.split(':');
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minStr, 10);
  if (isNaN(hour) || isNaN(minute)) return;

  const prefix = moduleEmoji ? `${moduleEmoji} ` : '🔥 ';
  await Notifications.scheduleNotificationAsync({
    identifier: `${STREAK_REMINDER_PREFIX}${moduleId}`,
    content: {
      title: `${prefix}Streak reminder — ${moduleLabel}`,
      body: `Log ${moduleLabel} today to keep your streak going!`,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });
}

/**
 * Cancel the streak reminder for a specific module.
 */
export async function cancelStreakReminder(moduleId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(`${STREAK_REMINDER_PREFIX}${moduleId}`);
  } catch {}
}

/**
 * Sync all streak reminders from module specs.
 * Call this on app start and when a module is updated.
 */
export async function syncAllStreakReminders(
  modules: Array<{
    id: string;
    label: string;
    emoji: string | null;
    streakEnabled: number | boolean;
    streakCheckInTime: string | null;
  }>,
): Promise<void> {
  for (const m of modules) {
    const enabled = Boolean(m.streakEnabled);
    const time = m.streakCheckInTime;
    if (enabled && time) {
      await scheduleStreakReminder(m.id, m.label, m.emoji, time);
    } else {
      await cancelStreakReminder(m.id);
    }
  }
}
