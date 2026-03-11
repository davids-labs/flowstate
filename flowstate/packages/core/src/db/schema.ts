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
  // V2: Life Pillar Architecture (Part 4)
  mode: text('mode').default('sequential'),     // 'sequential' | 'countup_list'
  pillar: text('pillar').default('general'),    // 'gym' | 'academic' | 'life' | 'general'
  category: text('category'),                   // free-text within pillar (e.g. 'Chest Day')
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
  // V2: Feature 1 - Block Conditions
  condition: text('condition'),                // JSON-serialised BlockCondition | null
  // V2: Feature 2 - Goal-Based Blocks
  blockMode: text('block_mode').default('timed'),  // 'timed' | 'goal_based' | 'countup'
  goalTarget: integer('goal_target'),          // target count for goal_based mode
  // V2: Feature 4 - Session To-Do List
  todos: text('todos').default('[]'),          // JSON array of {id, text}
  // V2: Feature 9 - Volume & PR Dashboards
  liftTag: text('lift_tag'),                   // primary lift name for gym sessions
  // V2: Feature 3 - Variable Block Sets
  blockSetId: text('block_set_id'),            // FK → routine_block_sets.id; null = applies to all sets
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
  // V2: CSV Manager (Part 7)
  csvPlanId: text('csv_plan_id'), // FK → csvPlans.id (nullable, null = manual)
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
  // V2: Life Pillar Architecture
  pillar: text('pillar').default('general'),           // 'gym' | 'academic' | 'life' | 'general'
  // V2: Feature 8 - Simple Streaks with Notifications
  streakEnabled: integer('streak_enabled').default(0),
  streakCheckInTime: text('streak_check_in_time'),     // 'HH:MM' for daily warning notification
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
  dayPlanId: text('day_plan_id').references(() => dayPlans.id), // nullable for ad-hoc sessions
  routineId: text('routine_id').references(() => routines.id), // nullable for ad-hoc timer sessions (BUG-12)
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
  // V2: Life Pillar Architecture (Part 4)
  pillar: text('pillar').default('general'),    // inherited from routine, stored for denormalised queries
  // V2: CSV Manager (Part 7)
  csvPlanId: text('csv_plan_id'),               // FK → csvPlans.id (nullable, null = manual/non-CSV)
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

// ═══════════════════════════════════════════════════════════════
// V2 NEW TABLES — added in schema version 9
// ═══════════════════════════════════════════════════════════════

// ─── Tasks (Feature 12 - Robust To-Do List) ─────────────────────

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  pillar: text('pillar').default('general'), // 'gym' | 'academic' | 'life' | 'general'
  category: text('category'),
  dueDate: text('due_date'),                 // YYYY-MM-DD, nullable = no due date
  dueTime: text('due_time'),                 // HH:MM, nullable
  priority: integer('priority').default(2), // 1=high 2=medium 3=low
  completed: integer('completed').notNull().default(0),
  recurrence: text('recurrence'),           // JSON | null: { type: 'daily'|'weekly', days?: number[] }
  notes: text('notes'),
  createdAt: text('created_at').notNull().default(''),
});

export const taskTags = sqliteTable('task_tags', {
  id: text('id').primaryKey(),
  taskId: text('task_id').notNull().references(() => tasks.id),
  tag: text('tag').notNull(),
});

// ─── Tagged Time Logs (Feature 14 - Tag-Based Count-Up Timer) ───

export const taggedTimeLogs = sqliteTable('tagged_time_logs', {
  id: text('id').primaryKey(),
  tag: text('tag').notNull(),
  pillar: text('pillar').default('general'),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  durationSeconds: integer('duration_seconds').default(0),
  notes: text('notes'),
});

// ─── Session Tags (Part 4.1 - Tag System) ───────────────────────

export const sessionTags = sqliteTable('session_tags', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  tag: text('tag').notNull(),
  loggedAt: text('logged_at').notNull(),
});

// ─── Session Block To-Dos (Feature 4) ───────────────────────────

export const sessionBlockTodos = sqliteTable('session_block_todos', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  blockIndex: integer('block_index').notNull(),
  todoId: text('todo_id').notNull(),           // matches routineBlocks.todos item id
  checked: integer('checked').notNull().default(0),
});

// ─── Session Block Instructions (Feature 5 - Session Planner) ───

export const sessionBlockInstructions = sqliteTable('session_block_instructions', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => sessions.id),
  blockIndex: integer('block_index').notNull(),
  instructions: text('instructions').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
});

// ─── Routine Block Sets (Feature 3 - Variable Block Sets) ───────

export const routineBlockSets = sqliteTable('routine_block_sets', {
  id: text('id').primaryKey(),
  routineId: text('routine_id').notNull().references(() => routines.id),
  name: text('name').notNull(),
  isDefault: integer('is_default').notNull().default(0),
});

// ─── Courses (Feature 11 - Weighted Grade Tracking) ─────────────

export const courses = sqliteTable('courses', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  pillar: text('pillar').default('academic'),
  targetGrade: real('target_grade'),           // 0–100
  createdAt: text('created_at').notNull().default(''),
  updatedAt: text('updated_at').notNull().default(''),
});

export const courseComponents = sqliteTable('course_components', {
  id: text('id').primaryKey(),
  courseId: text('course_id').notNull().references(() => courses.id),
  name: text('name').notNull(),                // e.g. 'Final Exam'
  weight: real('weight').notNull(),            // 0–100 (percentage weight)
  receivedGrade: real('received_grade'),       // nullable until graded
});

// ─── CSV Plans (Part 7 - CSV Manager Overhaul) ──────────────────

export const csvPlans = sqliteTable('csv_plans', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  uploadedAt: text('uploaded_at').notNull(),
  isActive: integer('is_active').notNull().default(1),
  fileHash: text('file_hash'),                 // SHA-256 of the source CSV for dedup detection
});