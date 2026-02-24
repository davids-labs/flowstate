import initSqlJs, { type Database } from 'sql.js';
import { drizzle } from 'drizzle-orm/sql-js';
import * as schema from '@flowstate/core';

const DB_NAME = 'flowstate_desktop';
const IDB_STORE = 'databases';

// ─── IndexedDB persistence helpers ──────────────────────────────

function openIDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function loadFromIDB(): Promise<Uint8Array | null> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readonly');
    const store = tx.objectStore(IDB_STORE);
    const req = store.get('main');
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error);
  });
}

async function saveToIDB(data: Uint8Array): Promise<void> {
  const idb = await openIDB();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const req = store.put(data, 'main');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ─── SQL.js + Drizzle setup ─────────────────────────────────────

let _sqlDb: Database | null = null;
let _drizzleDb: ReturnType<typeof drizzle> | null = null;
let _saveTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Persist current DB state to IndexedDB (debounced).
 */
function scheduleSave() {
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    if (_sqlDb) {
      const data = _sqlDb.export();
      saveToIDB(data).catch(console.error);
    }
  }, 500);
}

/**
 * Create tables if they don't exist.
 */
function ensureTables(db: Database) {
  db.run(`CREATE TABLE IF NOT EXISTS routines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    total_duration_minutes INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT '',
    archived_at TEXT,
    collection_id TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS routine_blocks (
    id TEXT PRIMARY KEY,
    routine_id TEXT NOT NULL REFERENCES routines(id),
    name TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL,
    type TEXT NOT NULL DEFAULT 'focus',
    "order" INTEGER NOT NULL DEFAULT 0,
    module_ids TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS plans (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    total_days INTEGER NOT NULL,
    imported_at TEXT NOT NULL,
    source_file TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS day_plans (
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
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS module_specs (
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
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS module_values (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL REFERENCES module_specs(id),
    date TEXT NOT NULL,
    value TEXT NOT NULL,
    logged_at TEXT NOT NULL,
    session_id TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sessions (
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
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS event_log (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    type TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    block_index INTEGER,
    data TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS homescreen_layout (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL REFERENCES module_specs(id),
    zone INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS collections (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    emoji TEXT,
    parent_id TEXT,
    type TEXT NOT NULL DEFAULT 'module',
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS module_goals (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL REFERENCES module_specs(id),
    start_value REAL NOT NULL,
    target_value REAL NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    unit TEXT,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS module_schedules (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL REFERENCES module_specs(id),
    days_of_week TEXT NOT NULL DEFAULT '[]',
    time_of_day TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS module_reminders (
    id TEXT PRIMARY KEY,
    module_id TEXT NOT NULL REFERENCES module_specs(id),
    days_of_week TEXT NOT NULL DEFAULT '[]',
    time TEXT NOT NULL,
    message TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`);

  // ─── Version-based column additions ─────────────────────
  // These use ALTER TABLE which will fail if column already exists,
  // so we wrap each in a try/catch.
  const alterations = [
    `ALTER TABLE sessions ADD COLUMN scheduled_time TEXT`,
    `ALTER TABLE homescreen_layout ADD COLUMN width INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE routines ADD COLUMN collection_id TEXT`,
    `ALTER TABLE module_specs ADD COLUMN collection_id TEXT`,
    `ALTER TABLE module_specs ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}'`,
    `ALTER TABLE sessions ADD COLUMN module_id TEXT`,
    `ALTER TABLE sessions ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE sessions ADD COLUMN photos TEXT NOT NULL DEFAULT '[]'`,
    `ALTER TABLE sessions ADD COLUMN notes TEXT`,
  ];
  for (const stmt of alterations) {
    try { db.run(stmt); } catch { /* column already exists */ }
  }
}

/**
 * Initialize the database. Call once at app startup.
 * Returns the drizzle-wrapped DB instance.
 */
export async function initDatabase(): Promise<ReturnType<typeof drizzle>> {
  if (_drizzleDb) return _drizzleDb;

  const SQL = await initSqlJs({
    locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
  });

  const saved = await loadFromIDB();
  _sqlDb = saved ? new SQL.Database(saved) : new SQL.Database();

  ensureTables(_sqlDb);

  _drizzleDb = drizzle(_sqlDb, { schema: schema as any });

  // Auto-save after every query via proxy
  const originalDb = _drizzleDb;
  const handler: ProxyHandler<typeof originalDb> = {
    get(target, prop, receiver) {
      const val = Reflect.get(target, prop, receiver);
      if (typeof val === 'function') {
        return (...args: unknown[]) => {
          const result = (val as Function).apply(target, args);
          // Schedule save after mutations (insert, update, delete)
          if (['insert', 'update', 'delete'].includes(prop as string)) {
            scheduleSave();
          }
          if (result && typeof result === 'object' && 'then' in result) {
            (result as Promise<unknown>).then(() => scheduleSave());
          }
          return result;
        };
      }
      return val;
    },
  };

  _drizzleDb = new Proxy(originalDb, handler);

  // Initial save
  scheduleSave();

  return _drizzleDb;
}

/**
 * Force-save to IndexedDB immediately.
 */
export async function saveDatabase(): Promise<void> {
  if (_sqlDb) {
    const data = _sqlDb.export();
    await saveToIDB(data);
  }
}

/**
 * Get the current drizzle DB instance (throws if not initialized).
 */
export function getDatabase(): ReturnType<typeof drizzle> {
  if (!_drizzleDb) throw new Error('Database not initialized. Call initDatabase() first.');
  return _drizzleDb;
}
