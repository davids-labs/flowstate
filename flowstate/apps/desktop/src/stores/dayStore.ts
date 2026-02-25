import { create } from 'zustand';
import * as queries from '@flowstate/core';

interface ModuleValueEntry {
  moduleId: string;
  value: string;
}

interface DayPlanData {
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
}

interface DayStoreState {
  date: string;
  dayPlan: DayPlanData | null;
  moduleValues: ModuleValueEntry[];
  isLoading: boolean;

  loadDay: (db: unknown, date: string) => Promise<void>;
  toggleMustDo: (db: unknown, index: number) => Promise<void>;
  setModuleValue: (db: unknown, moduleId: string, value: string) => Promise<void>;
  rolloverMustDos: (db: unknown) => Promise<void>;
}

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export const useDayStore = create<DayStoreState>((set, get) => ({
  date: todayDate(),
  dayPlan: null,
  moduleValues: [],
  isLoading: false,

  loadDay: async (db, date) => {
    set({ isLoading: true, date });
    try {
      const plan = (await queries.getDayPlan(db as unknown, date)) as DayPlanData | null;
      const values = (await queries.getModuleValuesForDate(db as unknown, date)) as Array<{ moduleId: string; value: string }>;
      set({
        dayPlan: plan,
        moduleValues: values.map((v) => ({ moduleId: v.moduleId, value: v.value })),
        isLoading: false,
      });
    } catch (err) {
      console.error('Failed to load day plan:', err);
      set({ isLoading: false });
    }
  },

  toggleMustDo: async (db, index) => {
    const { dayPlan } = get();
    if (!dayPlan) return;

    const newDone = [...dayPlan.mustDoDone];
    newDone[index] = !newDone[index];
    set({ dayPlan: { ...dayPlan, mustDoDone: newDone } });

    try {
      await queries.updateMustDoDone(db as unknown, dayPlan.id, newDone);
    } catch (err) {
      console.error('Failed to update must-do:', err);
    }
  },

  setModuleValue: async (db, moduleId, value) => {
    const { date, moduleValues } = get();
    const existing = moduleValues.find((v) => v.moduleId === moduleId);
    if (existing) {
      set({ moduleValues: moduleValues.map((v) => (v.moduleId === moduleId ? { ...v, value } : v)) });
    } else {
      set({ moduleValues: [...moduleValues, { moduleId, value }] });
    }
    try {
      await queries.upsertModuleValue(db as unknown, { moduleId, date, value });
    } catch (err) {
      console.error('Failed to save module value:', err);
    }
  },

  /**
   * Auto-Rollover: At 04:00 AM, any unchecked "Must-Do" items
   * are upserted into the next day's DayPlan.
   */
  rolloverMustDos: async (db) => {
    try {
      const now = new Date();
      if (now.getHours() < 4) return;

      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().slice(0, 10);
      const today = todayDate();

      const yesterdayPlan = (await queries.getDayPlan(db as unknown, yesterdayStr)) as DayPlanData | null;
      if (!yesterdayPlan) return;

      const mustDo: string[] = (yesterdayPlan as DayPlanData).mustDo ?? [];
      const mustDoDone: boolean[] = (yesterdayPlan as DayPlanData).mustDoDone ?? [];
      const unchecked = mustDo.filter((_: string, i: number) => !mustDoDone[i]);
      if (unchecked.length === 0) return;

      const todayPlan = (await queries.getDayPlan(db as unknown, today)) as DayPlanData | null;

      if (todayPlan) {
        const existingMustDo: string[] = (todayPlan as DayPlanData).mustDo ?? [];
        const existingDone: boolean[] = (todayPlan as DayPlanData).mustDoDone ?? [];
        const newItems = unchecked.filter((item: string) => !existingMustDo.includes(item));
        if (newItems.length === 0) return;

        await queries.upsertDayPlan(db as unknown, {
          date: today,
          title: (todayPlan as DayPlanData).title,
          mustDo: [...existingMustDo, ...newItems],
          mustDoDone: [...existingDone, ...newItems.map(() => false)],
          moduleIds: (todayPlan as DayPlanData).moduleIds,
        });
      } else {
        await queries.upsertDayPlan(db as unknown, {
          date: today,
          title: 'Day Plan',
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
