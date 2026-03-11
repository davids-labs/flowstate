import React, { createContext, useContext, useEffect, useState } from 'react';
import { Text, View, ActivityIndicator, StyleSheet, Platform, Pressable } from 'react-native';
import * as SQLite from 'expo-sqlite';
import { drizzle } from 'drizzle-orm/expo-sqlite';
// NOTE: DatabaseProvider renders ABOVE ThemeProvider in the component tree,
// so useTheme() is not available here. Static colors are used intentionally.
import { colors } from '../constants/theme';

const DB_NAME = 'flowstate.db';

// ─── True singleton: survive hot-reloads, re-mounts, and Hermes GC ───
// Store on globalThis so even if the JS module re-executes, we reuse the same handle.
function getOrCreateSqliteDb(): ReturnType<typeof SQLite.openDatabaseSync> {
  const g = globalThis as any;
  // If we already have a handle, verify it's still alive
  if (g.__flowstate_sqliteDb) {
    try {
      g.__flowstate_sqliteDb.execSync('SELECT 1');
      return g.__flowstate_sqliteDb;
    } catch {
      // Handle is dead — fall through to re-create
      console.warn('SQLite handle was stale, reopening...');
      g.__flowstate_sqliteDb = null;
      g.__flowstate_drizzleDb = null;
    }
  }
  const sqliteDb = SQLite.openDatabaseSync(DB_NAME);
  g.__flowstate_sqliteDb = sqliteDb;
  return sqliteDb;
}

function getOrCreateDrizzleDb(sqliteDb: ReturnType<typeof SQLite.openDatabaseSync>): any {
  const g = globalThis as any;
  if (g.__flowstate_drizzleDb) return g.__flowstate_drizzleDb;
  const database = drizzle(sqliteDb);
  g.__flowstate_drizzleDb = database;
  return database;
}

interface DatabaseContextType {
  db: any;
  isReady: boolean;
}

const DatabaseContext = createContext<DatabaseContextType | null>(null);

export function useDatabase() {
  const ctx = useContext(DatabaseContext);
  if (!ctx || !ctx.db) return null;
  return ctx.db;
}

export function useDatabaseReady(): boolean {
  const ctx = useContext(DatabaseContext);
  return ctx?.isReady ?? false;
}

export function useDatabaseSafe(): { db: any | null; isReady: boolean } {
  const ctx = useContext(DatabaseContext);
  return { db: ctx?.db ?? null, isReady: ctx?.isReady ?? false };
}

// SQL migration statements — run in order
const MIGRATIONS = [
  // ─── Tables ─────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS routines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    total_duration_minutes INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    archived_at TEXT,
    collection_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS routine_blocks (
    id TEXT PRIMARY KEY,
    routine_id TEXT NOT NULL REFERENCES routines(id),
    name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'focus',
    "order" INTEGER NOT NULL DEFAULT 0,
    module_ids TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    total_days INTEGER NOT NULL,
    imported_at TEXT NOT NULL,
    source_file TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS day_plans (
    id TEXT PRIMARY KEY,
    plan_id TEXT REFERENCES plans(id),
    date TEXT NOT NULL,
    title TEXT NOT NULL,
    day_number INTEGER,
    total_days INTEGER,
    status TEXT NOT NULL DEFAULT 'planned',
    must_do TEXT NOT NULL DEFAULT '[]',
    must_do_done TEXT NOT NULL DEFAULT '[]',
    module_ids TEXT NOT NULL DEFAULT '[]',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS module_specs (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    label TEXT NOT NULL,
    emoji TEXT,
    config TEXT NOT NULL DEFAULT '{}',
    placements TEXT NOT NULL DEFAULT '[]',
    is_live INTEGER NOT NULL DEFAULT 0,
    required INTEGER NOT NULL DEFAULT 0,
    show_in_summary INTEGER DEFAULT 0,
    archived_at TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    collection_id TEXT,
    metadata TEXT NOT NULL DEFAULT '{}'
  )`,
  `CREATE TABLE IF NOT EXISTS module_values (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL REFERENCES module_specs(id),
    date TEXT NOT NULL,
    value TEXT NOT NULL,
    logged_at TEXT NOT NULL,
    session_id TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    day_plan_id TEXT NOT NULL REFERENCES day_plans(id),
    routine_id TEXT NOT NULL REFERENCES routines(id),
    routine_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    scheduled_time TEXT,
    started_at TEXT,
    ended_at TEXT,
    total_paused_ms INTEGER NOT NULL DEFAULT 0,
    current_block_index INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    module_id TEXT,
    tags TEXT NOT NULL DEFAULT '[]',
    photos TEXT NOT NULL DEFAULT '[]'
  )`,
  `CREATE TABLE IF NOT EXISTS event_log (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    type TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    block_index INTEGER,
    data TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS homescreen_layout (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL REFERENCES module_specs(id),
    zone INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    width INTEGER NOT NULL DEFAULT 1
  )`,
  // ─── Indexes ────────────────────────────────────────────
  `CREATE INDEX IF NOT EXISTS idx_day_plans_date ON day_plans(date)`,
  `CREATE INDEX IF NOT EXISTS idx_module_values_date ON module_values(date)`,
  `CREATE INDEX IF NOT EXISTS idx_module_values_module_date ON module_values(module_id, date)`,
  `CREATE INDEX IF NOT EXISTS idx_sessions_day_plan ON sessions(day_plan_id)`,
  `CREATE INDEX IF NOT EXISTS idx_event_log_session ON event_log(session_id)`,

  // ─── Revision 5 tables ─────────────────────────────────
  `CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT,
    parent_id TEXT,
    type TEXT NOT NULL DEFAULT 'module',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS module_goals (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL REFERENCES module_specs(id),
    start_value REAL NOT NULL,
    target_value REAL NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    unit TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS module_schedules (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL REFERENCES module_specs(id),
    days_of_week TEXT NOT NULL DEFAULT '[]',
    time_of_day TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS module_reminders (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL REFERENCES module_specs(id),
    days_of_week TEXT NOT NULL DEFAULT '[]',
    time TEXT NOT NULL,
    message TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`,
];

// Schema version — increment when adding new migrations below
const CURRENT_SCHEMA_VERSION = 10;

// Version-based migrations: each entry runs only once when upgrading from a previous version
const VERSION_MIGRATIONS: Record<number, string[]> = {
  // Version 2: add settings table and ensure routines.archived_at exists
  2: [
    `CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`,
  ],
  // Version 3: add scheduled_time column to sessions for timeline view
  3: [
    `ALTER TABLE sessions ADD COLUMN scheduled_time TEXT`,
  ],
  // Version 4: add width column to homescreen_layout for grid sizing
  4: [
    `ALTER TABLE homescreen_layout ADD COLUMN width INTEGER NOT NULL DEFAULT 1`,
  ],
  // Version 5: collections, timer module, metadata, tags, photos
  5: [
    `CREATE TABLE IF NOT EXISTS collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      emoji TEXT,
      parent_id TEXT,
      type TEXT NOT NULL DEFAULT 'module',
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    )`,
    `ALTER TABLE routines ADD COLUMN collection_id TEXT`,
    `ALTER TABLE module_specs ADD COLUMN collection_id TEXT`,
    `ALTER TABLE module_specs ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE sessions ADD COLUMN module_id TEXT`,
    `ALTER TABLE sessions ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE sessions ADD COLUMN photos TEXT NOT NULL DEFAULT '[]'`,
  ],
  // Version 6: module goals (linear path tracking)
  6: [
    `CREATE TABLE IF NOT EXISTS module_goals (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL REFERENCES module_specs(id),
      start_value REAL NOT NULL,
      target_value REAL NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      unit TEXT,
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    )`,
  ],
  // Version 7: recurring schedules, per-module reminders, session notes
  7: [
    `CREATE TABLE IF NOT EXISTS module_schedules (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL REFERENCES module_specs(id),
      days_of_week TEXT NOT NULL DEFAULT '[]',
      time_of_day TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS module_reminders (
      id TEXT PRIMARY KEY,
      module_id TEXT NOT NULL REFERENCES module_specs(id),
      days_of_week TEXT NOT NULL DEFAULT '[]',
      time TEXT NOT NULL,
      message TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    )`,
    `ALTER TABLE sessions ADD COLUMN notes TEXT`,
  ],
  // Version 8: make sessions.routine_id and sessions.day_plan_id nullable for ad-hoc timer sessions (BUG-12)
  // SQLite cannot ALTER COLUMN constraints, so we recreate the table.
  8: [
    `PRAGMA foreign_keys = OFF`,
    `CREATE TABLE IF NOT EXISTS sessions_v8 (
      id TEXT PRIMARY KEY,
      day_plan_id TEXT REFERENCES day_plans(id),
      routine_id TEXT REFERENCES routines(id),
      routine_name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      scheduled_time TEXT,
      started_at TEXT,
      ended_at TEXT,
      total_paused_ms INTEGER NOT NULL DEFAULT 0,
      current_block_index INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT '',
      module_id TEXT,
      tags TEXT NOT NULL DEFAULT '[]',
      photos TEXT NOT NULL DEFAULT '[]',
      notes TEXT
    )`,
    `INSERT INTO sessions_v8 SELECT id, day_plan_id, routine_id, routine_name, status, scheduled_time, started_at, ended_at, total_paused_ms, current_block_index, created_at, updated_at, module_id, tags, photos, notes FROM sessions`,
    `DROP TABLE sessions`,
    `ALTER TABLE sessions_v8 RENAME TO sessions`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_day_plan ON sessions(day_plan_id)`,
    `PRAGMA foreign_keys = ON`,
  ],
  // Version 9: V2 schema additions — Life Pillar columns, block enhancements, 10 new tables
  9: [
    // ── Existing table: ALTER TABLE additions ──────────────────────
    // routines: Pillar architecture + routine mode
    `ALTER TABLE routines ADD COLUMN mode TEXT DEFAULT 'sequential'`,
    `ALTER TABLE routines ADD COLUMN pillar TEXT DEFAULT 'general'`,
    `ALTER TABLE routines ADD COLUMN category TEXT`,
    // routine_blocks: Feature 1 (conditions), 2 (goal-based), 4 (todos), 9 (lift tag)
    `ALTER TABLE routine_blocks ADD COLUMN condition TEXT`,
    `ALTER TABLE routine_blocks ADD COLUMN block_mode TEXT DEFAULT 'timed'`,
    `ALTER TABLE routine_blocks ADD COLUMN goal_target INTEGER`,
    `ALTER TABLE routine_blocks ADD COLUMN todos TEXT DEFAULT '[]'`,
    `ALTER TABLE routine_blocks ADD COLUMN lift_tag TEXT`,
    // module_specs: Pillar + Feature 8 (Streaks)
    `ALTER TABLE module_specs ADD COLUMN pillar TEXT DEFAULT 'general'`,
    `ALTER TABLE module_specs ADD COLUMN streak_enabled INTEGER DEFAULT 0`,
    `ALTER TABLE module_specs ADD COLUMN streak_check_in_time TEXT`,
    // sessions: Pillar column + CSV plan FK
    `ALTER TABLE sessions ADD COLUMN pillar TEXT DEFAULT 'general'`,
    `ALTER TABLE sessions ADD COLUMN csv_plan_id TEXT`,
    // day_plans: CSV plan FK
    `ALTER TABLE day_plans ADD COLUMN csv_plan_id TEXT`,
    // ── New tables ─────────────────────────────────────────────────
    // Feature 12: Robust To-Do List
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      pillar TEXT DEFAULT 'general',
      category TEXT,
      due_date TEXT,
      due_time TEXT,
      priority INTEGER DEFAULT 2,
      completed INTEGER NOT NULL DEFAULT 0,
      recurrence TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS task_tags (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      tag TEXT NOT NULL
    )`,
    // Feature 14: Tag-Based Count-Up Timer
    `CREATE TABLE IF NOT EXISTS tagged_time_logs (
      id TEXT PRIMARY KEY,
      tag TEXT NOT NULL,
      pillar TEXT DEFAULT 'general',
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_seconds INTEGER DEFAULT 0,
      notes TEXT
    )`,
    // Part 4.1: Session Tag System
    `CREATE TABLE IF NOT EXISTS session_tags (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      tag TEXT NOT NULL,
      logged_at TEXT NOT NULL
    )`,
    // Feature 4: Session Block To-Do completion state
    `CREATE TABLE IF NOT EXISTS session_block_todos (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      block_index INTEGER NOT NULL,
      todo_id TEXT NOT NULL,
      checked INTEGER NOT NULL DEFAULT 0
    )`,
    // Feature 5: Per-block session instructions
    `CREATE TABLE IF NOT EXISTS session_block_instructions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      block_index INTEGER NOT NULL,
      instructions TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    )`,
    // Feature 3: Variable Block Sets
    `CREATE TABLE IF NOT EXISTS routine_block_sets (
      id TEXT PRIMARY KEY,
      routine_id TEXT NOT NULL REFERENCES routines(id),
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0
    )`,
    // Feature 11: Weighted Grade Tracking
    `CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      pillar TEXT DEFAULT 'academic',
      target_grade REAL,
      created_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT ''
    )`,
    `CREATE TABLE IF NOT EXISTS course_components (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id),
      name TEXT NOT NULL,
      weight REAL NOT NULL,
      received_grade REAL
    )`,
    // Part 7: CSV Manager
    `CREATE TABLE IF NOT EXISTS csv_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      uploaded_at TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      file_hash TEXT
    )`,
    // Useful indices for new tables
    `CREATE INDEX IF NOT EXISTS idx_tasks_pillar ON tasks(pillar)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date)`,
    `CREATE INDEX IF NOT EXISTS idx_tagged_time_logs_tag ON tagged_time_logs(tag)`,
    `CREATE INDEX IF NOT EXISTS idx_session_tags_session ON session_tags(session_id)`,
    `CREATE INDEX IF NOT EXISTS idx_session_block_todos_session ON session_block_todos(session_id)`,
  ],
  // Version 10: Feature 3 - Variable Block Sets — add block_set_id FK to routine_blocks
  10: [
    `ALTER TABLE routine_blocks ADD COLUMN block_set_id TEXT`,
  ],
};

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<any | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const handleRetry = () => {
    setError(null);
    setIsReady(false);
    setRetryCount((c) => c + 1);
  };

  useEffect(() => {
    console.log('Initializing DatabaseProvider...');

    let mounted = true;

    function initDb() {
      console.log('Starting database initialization...');

      if (Platform.OS === 'web') {
        console.warn('SQLite not available on web');
        if (mounted) setError('FlowState requires a native device. Web is not supported.');
        return;
      }

      try {
        const sqliteDb = getOrCreateSqliteDb();
        console.log('SQLite database handle created:', sqliteDb);

        const database = getOrCreateDrizzleDb(sqliteDb);
        console.log('Drizzle ORM database initialized:', database);

        // Ensure schema exists: run all CREATE TABLE IF NOT EXISTS migrations
        try {
          for (const sql of MIGRATIONS) {
            try {
              sqliteDb.execSync(sql);
            } catch (e) {
              // Non-fatal: log and continue so partial schemas don't block startup
              console.warn('Migration statement failed:', e, sql);
            }
          }
          // Apply versioned migrations (ALTER TABLE, new tables) safely.
          // These statements may fail if already applied; failures are non-fatal.
          const versionKeys = Object.keys(VERSION_MIGRATIONS).map((k) => Number(k)).sort((a, b) => a - b);
          for (const ver of versionKeys) {
            const stmts = VERSION_MIGRATIONS[ver] ?? [];
            for (const stmt of stmts) {
              try {
                sqliteDb.execSync(stmt);
              } catch (e) {
                console.warn(`Version migration failed (ver ${ver}):`, e, stmt);
              }
            }
          }
          // Record current schema version so future migrations can be applied
          try {
            sqliteDb.execSync(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`);
          } catch (e) {
            console.warn('Failed to set PRAGMA user_version:', e);
          }
        } catch (e) {
          console.warn('Schema migration step failed:', e);
        }

        if (mounted) {
          setDb(database);
          setIsReady(true);
          console.log('DatabaseProvider is ready.');
        }
      } catch (err) {
        console.error('Database initialization failed:', err);
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Database initialization failed');
        }
      }
    }

    initDb();

    return () => {
      mounted = false;
    };
  }, [retryCount]);

  const contextValue = React.useMemo(() => ({ db, isReady }), [db, isReady]);

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Database Error</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={handleRetry}>
          <Text style={styles.retryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <DatabaseContext.Provider value={contextValue}>
      {children}
    </DatabaseContext.Provider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    paddingBottom: 40,
  },
  loadingText: {
    color: colors.textSecondary,
    marginTop: 16,
    fontSize: 14,
  },
  errorText: {
    color: colors.danger,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  errorDetail: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  retryBtn: {
    marginTop: 20,
    backgroundColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
