/**
 * Module Reminders — CRUD for per-module notification schedules.
 */

import { eq } from 'drizzle-orm';
import { moduleReminders } from './schema';

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function nowISO(): string {
  return new Date().toISOString();
}

export interface ReminderEntry {
  id: string;
  moduleId: string;
  daysOfWeek: number[];   // 0=Sun..6=Sat
  time: string;           // HH:MM
  message: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

function rowToEntry(row: any): ReminderEntry {
  return {
    id: row.id,
    moduleId: row.moduleId,
    daysOfWeek: JSON.parse(row.daysOfWeek ?? '[]'),
    time: row.time,
    message: row.message ?? null,
    enabled: !!row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function getRemindersForModule(db: any, moduleId: string): Promise<ReminderEntry[]> {
  const rows = await db.select().from(moduleReminders).where(eq(moduleReminders.moduleId, moduleId));
  return rows.map(rowToEntry);
}

export async function getAllReminders(db: any): Promise<ReminderEntry[]> {
  const rows = await db.select().from(moduleReminders);
  return rows.map(rowToEntry);
}

export async function createReminder(
  db: any,
  data: { moduleId: string; daysOfWeek: number[]; time: string; message?: string },
): Promise<string> {
  const id = generateId();
  const now = nowISO();
  await db.insert(moduleReminders).values({
    id,
    moduleId: data.moduleId,
    daysOfWeek: JSON.stringify(data.daysOfWeek),
    time: data.time,
    message: data.message ?? null,
    enabled: true,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateReminder(
  db: any,
  id: string,
  data: Partial<{ daysOfWeek: number[]; time: string; message: string | null; enabled: boolean }>,
): Promise<void> {
  const updateData: Record<string, unknown> = { updatedAt: nowISO() };
  if (data.daysOfWeek !== undefined) updateData.daysOfWeek = JSON.stringify(data.daysOfWeek);
  if (data.time !== undefined) updateData.time = data.time;
  if (data.message !== undefined) updateData.message = data.message;
  if (data.enabled !== undefined) updateData.enabled = data.enabled;
  await db.update(moduleReminders).set(updateData).where(eq(moduleReminders.id, id));
}

export async function deleteReminder(db: any, id: string): Promise<void> {
  await db.delete(moduleReminders).where(eq(moduleReminders.id, id));
}
