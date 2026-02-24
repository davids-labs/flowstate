/**
 * Recurring Schedules — CRUD + auto-fill logic.
 *
 * A schedule attaches to a module and says "include this module
 * on these days of the week". When a day plan is opened/created,
 * the auto-fill helper ensures scheduled modules are in moduleIds.
 */

import { eq } from 'drizzle-orm';
import { moduleSchedules, moduleSpecs, dayPlans } from './schema';

type DB = Parameters<typeof eq>[0] extends never ? any : any;
// Re-use the pattern from queries.ts
function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function nowISO(): string {
  return new Date().toISOString();
}

// ─── Types ──────────────────────────────────────────────────────

export interface ScheduleEntry {
  id: string;
  moduleId: string;
  daysOfWeek: number[];   // 0=Sun..6=Sat
  timeOfDay: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

function rowToEntry(row: any): ScheduleEntry {
  return {
    id: row.id,
    moduleId: row.moduleId,
    daysOfWeek: JSON.parse(row.daysOfWeek ?? '[]'),
    timeOfDay: row.timeOfDay ?? null,
    enabled: !!row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── CRUD ───────────────────────────────────────────────────────

export async function getSchedulesForModule(db: any, moduleId: string): Promise<ScheduleEntry[]> {
  const rows = await db.select().from(moduleSchedules).where(eq(moduleSchedules.moduleId, moduleId));
  return rows.map(rowToEntry);
}

export async function getAllSchedules(db: any): Promise<ScheduleEntry[]> {
  const rows = await db.select().from(moduleSchedules);
  return rows.map(rowToEntry);
}

export async function createSchedule(
  db: any,
  data: { moduleId: string; daysOfWeek: number[]; timeOfDay?: string },
): Promise<string> {
  const id = generateId();
  const now = nowISO();
  await db.insert(moduleSchedules).values({
    id,
    moduleId: data.moduleId,
    daysOfWeek: JSON.stringify(data.daysOfWeek),
    timeOfDay: data.timeOfDay ?? null,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateSchedule(
  db: any,
  id: string,
  data: Partial<{ daysOfWeek: number[]; timeOfDay: string | null; enabled: boolean }>,
): Promise<void> {
  const updateData: Record<string, unknown> = { updatedAt: nowISO() };
  if (data.daysOfWeek !== undefined) updateData.daysOfWeek = JSON.stringify(data.daysOfWeek);
  if (data.timeOfDay !== undefined) updateData.timeOfDay = data.timeOfDay;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  await db.update(moduleSchedules).set(updateData).where(eq(moduleSchedules.id, id));
}

export async function deleteSchedule(db: any, id: string): Promise<void> {
  await db.delete(moduleSchedules).where(eq(moduleSchedules.id, id));
}

// ─── Auto-fill Logic ────────────────────────────────────────────

/**
 * Given a date (YYYY-MM-DD), return module IDs that should be
 * auto-scheduled for that day based on their recurring schedules.
 */
export async function getScheduledModuleIds(db: any, date: string): Promise<string[]> {
  const dayOfWeek = new Date(date + 'T12:00:00').getDay(); // 0=Sun
  const allSchedules = await getAllSchedules(db);

  const matchingModuleIds: string[] = [];
  for (const s of allSchedules) {
    if (!s.enabled) continue;
    if (s.daysOfWeek.includes(dayOfWeek)) {
      matchingModuleIds.push(s.moduleId);
    }
  }

  // Deduplicate
  return [...new Set(matchingModuleIds)];
}

/**
 * Auto-fill a day plan's moduleIds with any scheduled modules
 * that aren't already present. Returns the merged array.
 */
export async function autoFillDayPlan(
  db: any,
  dayPlanId: string,
  date: string,
): Promise<string[]> {
  const scheduled = await getScheduledModuleIds(db, date);
  if (scheduled.length === 0) return [];

  const rows = await db.select().from(dayPlans).where(eq(dayPlans.id, dayPlanId));
  const plan = rows[0];
  if (!plan) return scheduled;

  const existing: string[] = JSON.parse(plan.moduleIds ?? '[]');
  const merged = [...new Set([...existing, ...scheduled])];

  if (merged.length !== existing.length) {
    await db
      .update(dayPlans)
      .set({ moduleIds: JSON.stringify(merged), updatedAt: nowISO() })
      .where(eq(dayPlans.id, dayPlanId));
  }

  return merged;
}
