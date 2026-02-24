/**
 * Goal Tracking Engine — "Linear Path" calculations.
 *
 * Pure arithmetic: no AI, no predictions, no insights.
 * Just the math of where you are vs. where you need to be.
 */

import { eq, and, gte, lte } from 'drizzle-orm';
import { moduleGoals, moduleSpecs, moduleValues } from './schema';

type DB = any;

// ─── Interfaces ─────────────────────────────────────────────────

export interface GoalMetrics {
  goalId: string;
  moduleId: string;
  label: string;
  unit: string;
  startValue: number;
  targetValue: number;
  currentValue: number | null;
  startDate: string;
  endDate: string;
  /** Total distance from start to target */
  totalDistance: number;
  /** Distance remaining from current to target */
  totalRemaining: number;
  /** Fraction complete (0..1) */
  progressFraction: number;
  /** Days elapsed since start */
  daysElapsed: number;
  /** Days remaining until deadline */
  daysRemaining: number;
  /** Total days in the goal window */
  totalDays: number;
  /** Required daily rate from day 1 (original pace) */
  requiredDailyRate: number;
  /** Your actual average daily change since start */
  actualDailyRate: number;
  /** Adjusted rate needed from today to hit the deadline */
  adjustedDailyRate: number | null;
  /** Whether actual pace is ahead of required pace */
  isAhead: boolean;
  /** Gap between current position and where you should be on the linear path */
  gapFromLinear: number;
  /** The "ghost line" data — linear path from start to target */
  targetPath: Array<{ date: string; value: number }>;
}

export interface GoalEntry {
  id: string;
  moduleId: string;
  startValue: number;
  targetValue: number;
  startDate: string;
  endDate: string;
  unit: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Helpers ────────────────────────────────────────────────────

function nowISO(): string {
  return new Date().toISOString();
}

function daysBetween(a: string, b: string): number {
  const msA = new Date(a + 'T12:00:00').getTime();
  const msB = new Date(b + 'T12:00:00').getTime();
  return Math.round((msB - msA) / 86400000);
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ─── CRUD ───────────────────────────────────────────────────────

export async function getGoalsForModule(db: DB, moduleId: string): Promise<GoalEntry[]> {
  return db.select().from(moduleGoals).where(eq(moduleGoals.moduleId, moduleId));
}

export async function getGoal(db: DB, goalId: string): Promise<GoalEntry | null> {
  const rows = await db.select().from(moduleGoals).where(eq(moduleGoals.id, goalId));
  return rows[0] ?? null;
}

export async function getAllGoals(db: DB): Promise<GoalEntry[]> {
  return db.select().from(moduleGoals);
}

export async function createGoal(
  db: DB,
  data: {
    moduleId: string;
    startValue: number;
    targetValue: number;
    startDate: string;
    endDate: string;
    unit?: string;
  },
): Promise<string> {
  const id = generateId();
  const now = nowISO();
  await db.insert(moduleGoals).values({
    id,
    moduleId: data.moduleId,
    startValue: data.startValue,
    targetValue: data.targetValue,
    startDate: data.startDate,
    endDate: data.endDate,
    unit: data.unit ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateGoal(
  db: DB,
  goalId: string,
  data: Partial<{
    startValue: number;
    targetValue: number;
    startDate: string;
    endDate: string;
    unit: string;
  }>,
): Promise<void> {
  await db.update(moduleGoals).set({ ...data, updatedAt: nowISO() }).where(eq(moduleGoals.id, goalId));
}

export async function deleteGoal(db: DB, goalId: string): Promise<void> {
  await db.delete(moduleGoals).where(eq(moduleGoals.id, goalId));
}

// ─── Core Calculation ───────────────────────────────────────────

/**
 * calculateGoalMetrics — the "Linear Path" engine.
 *
 * Takes a goal definition and the module's actual data,
 * returns every metric needed for the "Target vs. Actual" view.
 */
export async function calculateGoalMetrics(
  db: DB,
  goalId: string,
): Promise<GoalMetrics | null> {
  const goal = await getGoal(db, goalId);
  if (!goal) return null;

  const spec = (await db.select().from(moduleSpecs).where(eq(moduleSpecs.id, goal.moduleId)))[0];
  if (!spec) return null;

  const today = new Date().toISOString().slice(0, 10);

  // Fetch module values within the goal window
  const values = await db
    .select()
    .from(moduleValues)
    .where(
      and(
        eq(moduleValues.moduleId, goal.moduleId),
        gte(moduleValues.date, goal.startDate),
        lte(moduleValues.date, goal.endDate),
      ),
    );

  // Parse and sort values
  const parsed = values
    .map((v: any) => ({ date: v.date, value: parseFloat(v.value) }))
    .filter((v: any) => !isNaN(v.value))
    .sort((a: any, b: any) => a.date.localeCompare(b.date));

  // Current value = most recent entry up to today
  const entriesUpToToday = parsed.filter((p: any) => p.date <= today);
  const currentValue = entriesUpToToday.length > 0
    ? entriesUpToToday[entriesUpToToday.length - 1].value
    : null;

  // Time calculations
  const totalDays = daysBetween(goal.startDate, goal.endDate);
  const daysElapsed = Math.max(0, daysBetween(goal.startDate, today));
  const daysRemaining = Math.max(0, daysBetween(today, goal.endDate));

  // Distance calculations
  const totalDistance = goal.targetValue - goal.startValue;
  const totalRemaining = currentValue !== null
    ? goal.targetValue - currentValue
    : totalDistance;
  const progressFraction = totalDistance !== 0
    ? Math.max(0, Math.min(1, 1 - totalRemaining / totalDistance))
    : currentValue !== null && currentValue === goal.targetValue ? 1 : 0;

  // Rate calculations
  const requiredDailyRate = totalDays > 0 ? totalDistance / totalDays : 0;
  const actualDailyRate = daysElapsed > 0 && currentValue !== null
    ? (currentValue - goal.startValue) / daysElapsed
    : 0;
  const adjustedDailyRate = daysRemaining > 0
    ? totalRemaining / daysRemaining
    : null;

  // Where should you be on the linear path today?
  const expectedValueToday = goal.startValue + requiredDailyRate * Math.min(daysElapsed, totalDays);
  const gapFromLinear = currentValue !== null ? currentValue - expectedValueToday : 0;

  // Determine if ahead: direction depends on whether target > start
  const isIncreasing = totalDistance > 0;
  const isAhead = isIncreasing ? gapFromLinear >= 0 : gapFromLinear <= 0;

  // Generate target path (the "ghost line") — one point per day
  const targetPath: Array<{ date: string; value: number }> = [];
  const startMs = new Date(goal.startDate + 'T12:00:00').getTime();
  for (let d = 0; d <= totalDays; d++) {
    const date = new Date(startMs + d * 86400000).toISOString().slice(0, 10);
    targetPath.push({
      date,
      value: Math.round((goal.startValue + requiredDailyRate * d) * 1000) / 1000,
    });
  }

  return {
    goalId: goal.id,
    moduleId: goal.moduleId,
    label: spec.label,
    unit: goal.unit ?? '',
    startValue: goal.startValue,
    targetValue: goal.targetValue,
    currentValue,
    startDate: goal.startDate,
    endDate: goal.endDate,
    totalDistance,
    totalRemaining,
    progressFraction,
    daysElapsed,
    daysRemaining,
    totalDays,
    requiredDailyRate: Math.round(requiredDailyRate * 1000) / 1000,
    actualDailyRate: Math.round(actualDailyRate * 1000) / 1000,
    adjustedDailyRate: adjustedDailyRate !== null ? Math.round(adjustedDailyRate * 1000) / 1000 : null,
    isAhead,
    gapFromLinear: Math.round(gapFromLinear * 1000) / 1000,
    targetPath,
  };
}

/**
 * Calculate metrics for all active goals (endDate >= today).
 */
export async function getAllActiveGoalMetrics(db: DB): Promise<GoalMetrics[]> {
  const today = new Date().toISOString().slice(0, 10);
  const goals = await db
    .select()
    .from(moduleGoals)
    .where(gte(moduleGoals.endDate, today));

  const results: GoalMetrics[] = [];
  for (const goal of goals) {
    const metrics = await calculateGoalMetrics(db, goal.id);
    if (metrics) results.push(metrics);
  }
  return results;
}
