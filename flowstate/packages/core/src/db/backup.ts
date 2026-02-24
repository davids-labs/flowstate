/**
 * Full Backup / Restore — exports all DB data as a JSON bundle.
 *
 * Each table is dumped to a JSON array. Photos are referenced by URI
 * and must be handled separately by the platform layer (ZIP packaging).
 */

import {
  routines, routineBlocks, plans, dayPlans,
  moduleSpecs, moduleValues, sessions, eventLog,
  homescreenLayout, collections, moduleGoals,
  moduleSchedules, moduleReminders,
} from './schema';

const ALL_TABLES = [
  { name: 'collections', table: collections },
  { name: 'routines', table: routines },
  { name: 'routine_blocks', table: routineBlocks },
  { name: 'plans', table: plans },
  { name: 'day_plans', table: dayPlans },
  { name: 'module_specs', table: moduleSpecs },
  { name: 'module_values', table: moduleValues },
  { name: 'sessions', table: sessions },
  { name: 'event_log', table: eventLog },
  { name: 'homescreen_layout', table: homescreenLayout },
  { name: 'module_goals', table: moduleGoals },
  { name: 'module_schedules', table: moduleSchedules },
  { name: 'module_reminders', table: moduleReminders },
];

export interface BackupData {
  version: number;
  exportedAt: string;
  tables: Record<string, any[]>;
  /** URIs of session photos (platform layer adds actual files to ZIP) */
  photoUris: string[];
}

/**
 * Export all DB data as a BackupData object.
 */
export async function exportBackup(db: any): Promise<BackupData> {
  const tables: Record<string, any[]> = {};

  for (const { name, table } of ALL_TABLES) {
    try {
      const rows = await db.select().from(table);
      tables[name] = rows;
    } catch {
      tables[name] = [];
    }
  }

  // Collect photo URIs from sessions
  const photoUris: string[] = [];
  for (const session of tables.sessions ?? []) {
    try {
      const photos = JSON.parse(session.photos ?? '[]');
      photoUris.push(...photos);
    } catch {}
  }

  return {
    version: 7,
    exportedAt: new Date().toISOString(),
    tables,
    photoUris: [...new Set(photoUris)],
  };
}

/**
 * Import backup data, replacing all existing data.
 * WARNING: This clears all existing tables first!
 */
export async function importBackup(db: any, data: BackupData): Promise<{ tablesRestored: number; rowsRestored: number }> {
  let tablesRestored = 0;
  let rowsRestored = 0;

  // Delete in reverse order to respect foreign keys
  const deleteOrder = [...ALL_TABLES].reverse();
  for (const { table } of deleteOrder) {
    try {
      await db.delete(table);
    } catch {}
  }

  // Insert in forward order
  for (const { name, table } of ALL_TABLES) {
    const rows = data.tables[name];
    if (!rows || rows.length === 0) continue;

    try {
      // Insert in batches of 100 to avoid SQLite limits
      for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100);
        await db.insert(table).values(batch);
      }
      tablesRestored++;
      rowsRestored += rows.length;
    } catch (err) {
      console.warn(`Failed to restore table ${name}:`, err);
    }
  }

  return { tablesRestored, rowsRestored };
}
