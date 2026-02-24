import type { ModuleSpec } from './ModuleSpec';

// ─── Session within a DayPlan ───────────────────────────────────

export interface DaySession {
  id: string;
  routineId: string;
  routineName: string;
  durationMinutes: number;
  blockCount: number;
  label?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

// ─── Day Plan ───────────────────────────────────────────────────

export type DayStatus = 'planned' | 'active' | 'completed' | 'missed' | 'quiet';

export interface DayPlan {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  dayNumber?: number; // e.g. Day 14 of 136
  totalDays?: number;
  status: DayStatus;
  mustDo: string[];
  mustDoDone: boolean[];
  sessions: DaySession[];
  moduleIds: string[]; // references to ModuleSpec.id
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Week Plan ──────────────────────────────────────────────────

export interface WeekPlan {
  id: string;
  weekId: string; // e.g. "2026-W09"
  startDate: string; // Monday YYYY-MM-DD
  endDate: string; // Sunday YYYY-MM-DD
  days: DayPlan[];
  weekNumber: number;
  year: number;
}

// ─── Plan (top-level import) ────────────────────────────────────

export interface Plan {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  importedAt: string;
  sourceFile?: string;
}
