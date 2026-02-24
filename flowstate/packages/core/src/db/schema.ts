import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// ─── Collections (Folders) ──────────────────────────────────────

export const collections = sqliteTable('collections', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  emoji: text('emoji'),
  parentId: text('parent_id'), // self-referencing for nesting
  type: text('type').notNull().default('module'), // 'module' | 'routine'
  createdAt: text('created_at').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
});

// ─── Routines ───────────────────────────────────────────────────

export const routines = sqliteTable('routines', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  totalDurationMinutes: integer('total_duration_minutes').notNull(),
  collectionId: text('collection_id'), // FK → collections.id
  createdAt: text('created_at').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
  archivedAt: text('archived_at'),
});

// ─── Routine Blocks ─────────────────────────────────────────────

export const routineBlocks = sqliteTable('routine_blocks', {
  id: text('id').primaryKey(),
  routineId: text('routine_id').notNull().references(() => routines.id),
  name: text('name').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  type: text('type').notNull().default('focus'), // focus | break | warmup | cooldown | custom
  order: integer('order').notNull().default(0),
  moduleIds: text('module_ids'), // JSON array of module IDs
});

// ─── Plans ──────────────────────────────────────────────────────

export const plans = sqliteTable('plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  totalDays: integer('total_days').notNull(),
  importedAt: text('imported_at').notNull(),
  sourceFile: text('source_file'),
});

// ─── Day Plans ──────────────────────────────────────────────────

export const dayPlans = sqliteTable('day_plans', {
  id: text('id').primaryKey(),
  planId: text('plan_id').references(() => plans.id),
  date: text('date').notNull(), // YYYY-MM-DD
  title: text('title').notNull(),
  dayNumber: integer('day_number'),
  totalDays: integer('total_days'),
  status: text('status').notNull().default('planned'), // planned | active | completed | missed | quiet
  mustDo: text('must_do').notNull().default('[]'), // JSON array of strings
  mustDoDone: text('must_do_done').notNull().default('[]'), // JSON array of bools
  moduleIds: text('module_ids').notNull().default('[]'), // JSON array of module IDs
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
});

// ─── Module Specs ───────────────────────────────────────────────

export const moduleSpecs = sqliteTable('module_specs', {
  id: text('id').primaryKey(),
  type: text('type').notNull(), // ModuleType enum value
  label: text('label').notNull(),
  emoji: text('emoji'),
  config: text('config').notNull().default('{}'), // JSON config object
  placements: text('placements').notNull().default('[]'), // JSON array of Surface values
  isLive: integer('is_live', { mode: 'boolean' }).notNull().default(false),
  required: integer('required', { mode: 'boolean' }).notNull().default(false),
  showInSummary: integer('show_in_summary', { mode: 'boolean' }).default(false),
  collectionId: text('collection_id'), // FK → collections.id
  metadata: text('metadata').notNull().default('{}'), // JSONB for arbitrary user-defined properties
  archivedAt: text('archived_at'),
  createdAt: text('created_at').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
});

// ─── Module Values (logged data) ────────────────────────────────

export const moduleValues = sqliteTable('module_values', {
  id: text('id').primaryKey(),
  moduleId: text('module_id').notNull().references(() => moduleSpecs.id),
  date: text('date').notNull(), // YYYY-MM-DD
  value: text('value').notNull(), // JSON-encoded value
  loggedAt: text('logged_at').notNull(),
  sessionId: text('session_id'),
});

// ─── Sessions ───────────────────────────────────────────────────

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  dayPlanId: text('day_plan_id').notNull().references(() => dayPlans.id),
  routineId: text('routine_id').notNull().references(() => routines.id),
  routineName: text('routine_name').notNull(),
  moduleId: text('module_id'), // optional FK → moduleSpecs.id (for timer-module sessions)
  status: text('status').notNull().default('pending'), // pending | in_progress | completed | abandoned
  scheduledTime: text('scheduled_time'), // HH:MM for timeline positioning
  startedAt: text('started_at'),
  endedAt: text('ended_at'),
  totalPausedMs: integer('total_paused_ms').notNull().default(0),
  currentBlockIndex: integer('current_block_index').notNull().default(0),
  tags: text('tags').notNull().default('[]'), // JSON string array for session tagging
  photos: text('photos').notNull().default('[]'), // JSON array of local URIs
  notes: text('notes'),                             // free-text session debrief notes
  createdAt: text('created_at').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
});

// ─── Event Log ──────────────────────────────────────────────────

export const eventLog = sqliteTable('event_log', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  type: text('type').notNull(), // SessionEventType
  timestamp: text('timestamp').notNull(),
  blockIndex: integer('block_index'),
  data: text('data'), // JSON
});

// ─── Homescreen Layout ──────────────────────────────────────────

export const homescreenLayout = sqliteTable('homescreen_layout', {
  id: text('id').primaryKey(),
  moduleId: text('module_id').notNull().references(() => moduleSpecs.id),
  zone: integer('zone').notNull(), // 1 = Live, 2 = Today, 3 = Logged
  order: integer('order').notNull().default(0),
  width: integer('width').notNull().default(1), // 1 = half-width, 2 = full-width
});
// ─── Module Goals (Linear Path Tracking) ────────────────────────

export const moduleGoals = sqliteTable('module_goals', {
  id: text('id').primaryKey(),
  moduleId: text('module_id').notNull().references(() => moduleSpecs.id),
  startValue: real('start_value').notNull(),
  targetValue: real('target_value').notNull(),
  startDate: text('start_date').notNull(),  // YYYY-MM-DD
  endDate: text('end_date').notNull(),      // YYYY-MM-DD
  unit: text('unit'),                       // optional, e.g. 'kg', '$', 'hrs'
  createdAt: text('created_at').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
});

// ─── Module Schedules (Recurring Day-plan Auto-fill) ────────────

export const moduleSchedules = sqliteTable('module_schedules', {
  id: text('id').primaryKey(),
  moduleId: text('module_id').notNull().references(() => moduleSpecs.id),
  daysOfWeek: text('days_of_week').notNull().default('[]'), // JSON array: [0=Sun..6=Sat]
  timeOfDay: text('time_of_day'),                            // HH:MM or null
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
});

// ─── Module Reminders (Per-module Notifications) ────────────────

export const moduleReminders = sqliteTable('module_reminders', {
  id: text('id').primaryKey(),
  moduleId: text('module_id').notNull().references(() => moduleSpecs.id),
  daysOfWeek: text('days_of_week').notNull().default('[]'), // JSON array: [0=Sun..6=Sat]
  time: text('time').notNull(),                              // HH:MM
  message: text('message'),                                  // optional custom text
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
});