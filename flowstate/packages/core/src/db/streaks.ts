/**
 * Streak Calculator — pure arithmetic, no opinions.
 *
 * Given a module ID, compute current streak and longest streak
 * from the module_values table. A "day logged" is any day with
 * a non-null, non-empty value.
 */

import { eq, desc } from 'drizzle-orm';
import { moduleValues } from './schema';

export interface StreakInfo {
  currentStreak: number;   // consecutive days ending today (or yesterday)
  longestStreak: number;
  lastLoggedDate: string | null;
}

/**
 * Calculate streak data for a module.
 */
export async function getStreakInfo(db: any, moduleId: string): Promise<StreakInfo> {
  // Get all distinct dates that have a value, sorted descending
  const rows = await db
    .select({ date: moduleValues.date })
    .from(moduleValues)
    .where(eq(moduleValues.moduleId, moduleId))
    .orderBy(desc(moduleValues.date));

  if (rows.length === 0) {
    return { currentStreak: 0, longestStreak: 0, lastLoggedDate: null };
  }

  // Build unique sorted dates descending
  const dates = ([...new Set(rows.map((r: any) => r.date))] as string[]).sort(
    (a, b) => b.localeCompare(a),
  );

  const lastLoggedDate = dates[0] as string;

  // Check if current streak includes today (or yesterday)
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const streakIncludesToday = lastLoggedDate === today || lastLoggedDate === yesterday;

  let currentStreak = 0;
  let longestStreak = 0;
  let runningStreak = 0;
  let prevDate: string | null = null;

  for (const dateStr of dates as string[]) {
    if (prevDate === null) {
      runningStreak = 1;
    } else {
      const prev = new Date(prevDate + 'T12:00:00');
      const curr = new Date(dateStr + 'T12:00:00');
      const diffDays = Math.round((prev.getTime() - curr.getTime()) / 86400000);

      if (diffDays === 1) {
        runningStreak++;
      } else {
        // Streak broken — record and reset
        if (longestStreak < runningStreak) longestStreak = runningStreak;
        runningStreak = 1;
      }
    }
    prevDate = dateStr;
  }
  if (longestStreak < runningStreak) longestStreak = runningStreak;

  // Current streak: walk from most recent date backward
  if (streakIncludesToday) {
    currentStreak = 1;
    for (let i = 1; i < dates.length; i++) {
      const prev = new Date((dates[i - 1] as string) + 'T12:00:00');
      const curr = new Date((dates[i] as string) + 'T12:00:00');
      const diff = Math.round((prev.getTime() - curr.getTime()) / 86400000);
      if (diff === 1) {
        currentStreak++;
      } else {
        break;
      }
    }
  }

  return { currentStreak, longestStreak, lastLoggedDate };
}

/**
 * Get streaks for all active (non-archived) modules at once.
 */
export async function getAllStreaks(
  db: any,
  moduleIds: string[],
): Promise<Record<string, StreakInfo>> {
  const result: Record<string, StreakInfo> = {};
  // Run in parallel for speed
  await Promise.all(
    moduleIds.map(async (id) => {
      result[id] = await getStreakInfo(db, id);
    }),
  );
  return result;
}
