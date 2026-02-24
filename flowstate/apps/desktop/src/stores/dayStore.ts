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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadDay: (db: any, date: string) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toggleMustDo: (db: any, index: number) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setModuleValue: (db: any, moduleId: string, value: string) => Promise<void>;
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
      const plan = await queries.getDayPlan(db, date);
      const values = await queries.getModuleValuesForDate(db, date);
      set({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        dayPlan: plan as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        moduleValues: values.map((v: any) => ({ moduleId: v.moduleId, value: v.value })),
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
      await queries.updateMustDoDone(db, dayPlan.id, newDone);
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
      await queries.upsertModuleValue(db, { moduleId, date, value });
    } catch (err) {
      console.error('Failed to save module value:', err);
    }
  },
}));
