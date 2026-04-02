import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import {
  getActivePlan,
  getDayPlan,
  getModuleValuesForDate,
  getTrackers,
  getTrackerEntry,
  getTrackerSummary,
  sessions,
} from '@flowstate/core';
import { and, desc, gte, lte } from 'drizzle-orm';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { FlowStateDayWidget } from '../components/widgets/FlowStateDayWidget';
import { GoalProgressWidget } from '../components/widgets/GoalProgressWidget';
import { QuickLogWidget } from '../components/widgets/QuickLogWidget';
import { WeeklyStatsWidget } from '../components/widgets/WeeklyStatsWidget';
import {
  readGoalProgressSnapshot,
  readQuickLogSnapshot,
  readWeeklyStatsSnapshot,
  readWidgetSnapshot,
  saveGoalProgressSnapshot,
  saveQuickLogSnapshot,
  saveWeeklyStatsSnapshot,
  saveWidgetSnapshot,
} from './widgetData';

const WIDGET_CONFIG_KEY = 'flowstate_widget_preferences_v2';

export interface WidgetPreferences {
  quickLogTrackerIds: string[];
  goalTrackerIds: string[];
}

const DEFAULT_WIDGET_PREFERENCES: WidgetPreferences = {
  quickLogTrackerIds: [],
  goalTrackerIds: [],
};

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function weekRange() {
  const now = new Date();
  const day = (now.getDay() + 6) % 7;
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

export async function loadWidgetPreferences(): Promise<WidgetPreferences> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_CONFIG_KEY);
    if (!raw) return DEFAULT_WIDGET_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      quickLogTrackerIds: parsed.quickLogTrackerIds ?? [],
      goalTrackerIds: parsed.goalTrackerIds ?? [],
    };
  } catch {
    return DEFAULT_WIDGET_PREFERENCES;
  }
}

export async function saveWidgetPreferences(value: WidgetPreferences) {
  await AsyncStorage.setItem(WIDGET_CONFIG_KEY, JSON.stringify(value));
}

async function updateWidget(widgetName: string, render: () => React.ReactElement) {
  if (Platform.OS !== 'android') return;
  try {
    await requestWidgetUpdate({
      widgetName,
      renderWidget: render,
    });
  } catch {}
}

export async function syncWidgetSnapshots(db: any) {
  const date = todayIso();
  const prefs = await loadWidgetPreferences();

  const [dayPlan, activePlan, moduleValues, trackers] = await Promise.all([
    getDayPlan(db, date).catch(() => null),
    getActivePlan(db).catch(() => null),
    getModuleValuesForDate(db, date).catch(() => []),
    getTrackers(db, { includeArchived: false }).catch(() => []),
  ]);

  const daySnapshot = {
    dayTitle: dayPlan?.title ?? 'No plan loaded',
    dayNumber: dayPlan?.dayNumber ?? undefined,
    totalDays: dayPlan?.totalDays ?? undefined,
    mustDoTotal: dayPlan?.mustDo?.length ?? 0,
    mustDoDone: dayPlan?.mustDoDone?.filter(Boolean).length ?? 0,
    modulesTracked: (moduleValues as any[]).length,
    modulesTotal: dayPlan?.moduleIds?.length ?? 0,
    planName: activePlan?.name ?? 'FlowState',
  };
  await saveWidgetSnapshot(daySnapshot);

  const { start, end } = weekRange();
  const sessionRows = await db
    .select({
      startedAt: sessions.startedAt,
      status: sessions.status,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(and(gte(sessions.createdAt, start.toISOString()), lte(sessions.createdAt, end.toISOString())))
    .orderBy(desc(sessions.createdAt))
    .catch(() => []);

  const weekDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((label) => ({
    label,
    count: 0,
  }));
  for (const row of sessionRows as any[]) {
    if (row.status !== 'completed' || !row.startedAt) continue;
    const dayIndex = (new Date(row.startedAt).getDay() + 6) % 7;
    if (weekDays[dayIndex]) weekDays[dayIndex].count += 1;
  }
  const weeklySnapshot = {
    weekDays,
    maxCount: Math.max(1, ...weekDays.map((day) => day.count)),
    weekTotal: weekDays.reduce((sum, day) => sum + day.count, 0),
    streakCount: weekDays.filter((day) => day.count > 0).length,
  };
  await saveWeeklyStatsSnapshot(weeklySnapshot);

  const quickLogCandidates = prefs.quickLogTrackerIds.length
    ? (trackers as any[]).filter((tracker) => prefs.quickLogTrackerIds.includes(tracker.id))
    : (trackers as any[]).slice(0, 6);
  const quickLogSnapshot = {
    modules: await Promise.all(
      quickLogCandidates.slice(0, 6).map(async (tracker) => ({
        id: tracker.id,
        label: tracker.label,
        emoji: tracker.emoji ?? undefined,
        logged: Boolean(await getTrackerEntry(db, tracker.id, date).catch(() => null)),
      })),
    ),
  };
  await saveQuickLogSnapshot(quickLogSnapshot);

  const goalCandidates = prefs.goalTrackerIds.length
    ? (trackers as any[]).filter((tracker) => prefs.goalTrackerIds.includes(tracker.id))
    : (trackers as any[]).filter((tracker) => tracker.kind === 'progress').slice(0, 3);
  const goalSnapshot = {
    goals: await Promise.all(
      goalCandidates.slice(0, 3).map(async (tracker) => {
        const summary = await getTrackerSummary(db, tracker.id, date).catch(() => null);
        const progressPercent =
          typeof summary?.currentValue === 'number'
            ? Math.max(0, Math.min(1, summary.currentValue / 100))
            : 0;
        const endDate =
          tracker?.config && typeof tracker.config.endDate === 'string'
            ? tracker.config.endDate
            : null;
        const daysRemaining = endDate
          ? Math.max(
              0,
              Math.ceil(
                (new Date(`${endDate}T12:00:00`).getTime() -
                  new Date(`${date}T12:00:00`).getTime()) /
                  86400000,
              ),
            )
          : 0;
        return {
          label: tracker.label,
          emoji: tracker.emoji ?? undefined,
          progressPercent,
          daysRemaining,
          isAhead: progressPercent >= 0.5,
        };
      }),
    ),
  };
  await saveGoalProgressSnapshot(goalSnapshot);

  await Promise.allSettled([
    updateWidget('FlowStateDay', () => <FlowStateDayWidget {...daySnapshot} />),
    updateWidget('FlowStateWeeklyStats', () => <WeeklyStatsWidget {...weeklySnapshot} />),
    updateWidget('FlowStateQuickLog', () => <QuickLogWidget {...quickLogSnapshot} />),
    updateWidget('FlowStateGoalProgress', () => <GoalProgressWidget {...goalSnapshot} />),
  ]);
}

export async function getWidgetSnapshotSummary() {
  const [focus, weekly, quickLog, goals, prefs] = await Promise.all([
    readWidgetSnapshot(),
    readWeeklyStatsSnapshot(),
    readQuickLogSnapshot(),
    readGoalProgressSnapshot(),
    loadWidgetPreferences(),
  ]);

  return { focus, weekly, quickLog, goals, prefs };
}
