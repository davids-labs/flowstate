import { create } from 'zustand';
import type { DayPlan, DaySession } from '@flowstate/core';
import * as queries from '@flowstate/core';
import { saveWidgetSnapshot } from '../services/widgetData';

interface ModuleValueEntry {
  moduleId: string;
  value: string;
}

interface DayStoreState {
  // State
  date: string; // YYYY-MM-DD
  dayPlan: {
    id: string;
    date: string;
    title: string;
    dayNumber?: number;
    totalDays?: number;
    status: string;
    mustDo: string[];
    mustDoDone: boolean[];
    moduleIds: string[];
    notes?: string;
  } | null;
  moduleValues: ModuleValueEntry[];
  isLoading: boolean;

  // Actions
  loadDay: (db: any, date: string) => Promise<void>;
  toggleMustDo: (db: any, index: number, onSync?: (date: string, data: Record<string, unknown>) => void) => Promise<void>;
  setModuleValue: (db: any, moduleId: string, value: string, onSync?: (date: string, moduleId: string, value: string) => void) => Promise<void>;
  rolloverMustDos: (db: any) => Promise<void>;
}

function todayDate(): string {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}

function tomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export const useDayStore = create<DayStoreState>((set, get) => ({
  date: todayDate(),
  dayPlan: null,
  moduleValues: [],
  isLoading: false,

  loadDay: async (db: any, date: string) => {
    set({ isLoading: true, date });
    try {
      const plan = await queries.getDayPlan(db, date);
      const values = await queries.getModuleValuesForDate(db, date);
      set({
        dayPlan: plan,
        moduleValues: values.map((v: any) => ({ moduleId: v.moduleId, value: v.value })),
        isLoading: false,
      });

      // Update widget snapshot
      if (plan) {
        const doneCount = (plan.mustDoDone ?? []).filter(Boolean).length;
        const totalMustDo = (plan.mustDo ?? []).length;
        const tracked = values.length;
        const totalModules = (plan.moduleIds ?? []).length;
        saveWidgetSnapshot({
          dayTitle: plan.title ?? 'Today',
          dayNumber: plan.dayNumber,
          totalDays: plan.totalDays,
          mustDoTotal: totalMustDo,
          mustDoDone: doneCount,
          modulesTracked: tracked,
          modulesTotal: totalModules,
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Failed to load day plan:', err);
      set({ isLoading: false });
    }
  },

  toggleMustDo: async (db: any, index: number, onSync?: (date: string, data: Record<string, unknown>) => void) => {
    const { dayPlan } = get();
    if (!dayPlan) return;

    const newDone = [...dayPlan.mustDoDone];
    newDone[index] = !newDone[index];

    set({
      dayPlan: { ...dayPlan, mustDoDone: newDone },
    });

    // Update widget with new must-do state
    const doneCount = newDone.filter(Boolean).length;
    saveWidgetSnapshot({
      dayTitle: dayPlan.title ?? 'Today',
      dayNumber: dayPlan.dayNumber,
      totalDays: dayPlan.totalDays,
      mustDoTotal: dayPlan.mustDo.length,
      mustDoDone: doneCount,
      modulesTracked: get().moduleValues.length,
      modulesTotal: (dayPlan.moduleIds ?? []).length,
    }).catch(() => {});

    try {
      await queries.updateMustDoDone(db, dayPlan.id, newDone);
      // Push to cloud sync
      onSync?.(dayPlan.date, { mustDoDone: newDone, mustDo: dayPlan.mustDo });
    } catch (err) {
      console.error('Failed to update must-do:', err);
    }
  },

  setModuleValue: async (db: any, moduleId: string, value: string, onSync?: (date: string, moduleId: string, value: string) => void) => {
    const { date, moduleValues } = get();

    const existing = moduleValues.find(v => v.moduleId === moduleId);
    if (existing?.value === value) {
      return;
    }

    // Optimistic update
    if (existing) {
      set({
        moduleValues: moduleValues.map(v =>
          v.moduleId === moduleId ? { ...v, value } : v,
        ),
      });
    } else {
      set({
        moduleValues: [...moduleValues, { moduleId, value }],
      });
    }

    try {
      await queries.upsertModuleValue(db, { moduleId, date, value });
      // Push to cloud sync
      onSync?.(date, moduleId, value);
    } catch (err) {
      console.error('Failed to save module value:', err);
    }
  },

  /**
   * Auto-Rollover (Motion): At 04:00 AM, any unchecked "Must-Do" items
   * are upserted into the next day's DayPlan.
   * Call this on app launch / focus to check if rollover is needed.
   */
  rolloverMustDos: async (db: any) => {
    try {
      const now = new Date();
      const currentHour = now.getHours();

      // Only run after 4 AM
      if (currentHour < 4) return;

      // Check yesterday's plan
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      const todayStr = todayDate();

      const yesterdayPlan = await queries.getDayPlan(db, yesterdayStr);
      if (!yesterdayPlan) return;

      const mustDo: string[] = yesterdayPlan.mustDo ?? [];
      const mustDoDone: boolean[] = yesterdayPlan.mustDoDone ?? [];

      // Find unchecked must-do items
      const unchecked = mustDo.filter((_: string, i: number) => !mustDoDone[i]);
      if (unchecked.length === 0) return;

      // Get or create today's plan
      const todayPlan = await queries.getDayPlan(db, todayStr);

      if (todayPlan) {
        // Merge: add unchecked items that aren't already in today's must-do
        const existingMustDo: string[] = todayPlan.mustDo ?? [];
        const existingDone: boolean[] = todayPlan.mustDoDone ?? [];
        const newItems = unchecked.filter((item: string) => !existingMustDo.includes(item));

        if (newItems.length === 0) return;

        const mergedMustDo = [...existingMustDo, ...newItems];
        const mergedDone = [...existingDone, ...newItems.map(() => false)];

        await queries.upsertDayPlan(db, {
          date: todayStr,
          title: todayPlan.title,
          mustDo: mergedMustDo,
          mustDoDone: mergedDone,
          moduleIds: todayPlan.moduleIds,
        });
      } else {
        // Create a new day plan with rolled-over items
        await queries.upsertDayPlan(db, {
          date: todayStr,
          title: `Day Plan`,
          mustDo: unchecked,
          mustDoDone: unchecked.map(() => false),
          moduleIds: [],
        });
      }
    } catch (err) {
      console.error('Failed to rollover must-dos:', err);
    }
  },
}));
