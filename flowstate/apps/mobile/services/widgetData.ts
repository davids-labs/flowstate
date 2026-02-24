import AsyncStorage from '@react-native-async-storage/async-storage';

const WIDGET_DATA_KEY = '@flowstate/widget-data';

export interface WidgetSnapshot {
  dayTitle: string;
  dayNumber?: number;
  totalDays?: number;
  mustDoTotal: number;
  mustDoDone: number;
  modulesTracked: number;
  modulesTotal: number;
  planName?: string;
  updatedAt: string;
}

/** Save a snapshot of today's data for the widget to read */
export async function saveWidgetSnapshot(data: Omit<WidgetSnapshot, 'updatedAt'>): Promise<void> {
  try {
    const snapshot: WidgetSnapshot = {
      ...data,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(snapshot));
  } catch {
    // Silently fail — widget data is best-effort
  }
}

/** Read the last saved widget snapshot */
export async function readWidgetSnapshot(): Promise<WidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_DATA_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WidgetSnapshot;
  } catch {
    return null;
  }
}

// ─── Weekly Stats Widget ────────────────────────────────────────

const WEEKLY_STATS_KEY = '@flowstate/widget-weekly-stats';

export interface WeeklyStatsSnapshot {
  weekDays: { label: string; count: number }[];
  maxCount: number;
  weekTotal: number;
  streakCount: number;
  updatedAt: string;
}

export async function saveWeeklyStatsSnapshot(data: Omit<WeeklyStatsSnapshot, 'updatedAt'>): Promise<void> {
  try {
    await AsyncStorage.setItem(WEEKLY_STATS_KEY, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }));
  } catch {}
}

export async function readWeeklyStatsSnapshot(): Promise<WeeklyStatsSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(WEEKLY_STATS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ─── Quick Log Widget ───────────────────────────────────────────

const QUICK_LOG_KEY = '@flowstate/widget-quick-log';

export interface QuickLogSnapshot {
  modules: { id: string; label: string; emoji?: string; logged?: boolean }[];
  updatedAt: string;
}

export async function saveQuickLogSnapshot(data: Omit<QuickLogSnapshot, 'updatedAt'>): Promise<void> {
  try {
    await AsyncStorage.setItem(QUICK_LOG_KEY, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }));
  } catch {}
}

export async function readQuickLogSnapshot(): Promise<QuickLogSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(QUICK_LOG_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ─── Goal Progress Widget ───────────────────────────────────────

const GOAL_PROGRESS_KEY = '@flowstate/widget-goal-progress';

export interface GoalProgressSnapshot {
  goals: {
    label: string;
    emoji?: string;
    progressPercent: number;
    daysRemaining: number;
    isAhead: boolean;
  }[];
  updatedAt: string;
}

export async function saveGoalProgressSnapshot(data: Omit<GoalProgressSnapshot, 'updatedAt'>): Promise<void> {
  try {
    await AsyncStorage.setItem(GOAL_PROGRESS_KEY, JSON.stringify({ ...data, updatedAt: new Date().toISOString() }));
  } catch {}
}

export async function readGoalProgressSnapshot(): Promise<GoalProgressSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(GOAL_PROGRESS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
