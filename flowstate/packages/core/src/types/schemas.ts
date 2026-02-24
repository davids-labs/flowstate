import { z } from 'zod';

// ─── Config Schemas ─────────────────────────────────────────────

export const countdownConfigSchema = z.object({
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  displayMode: z.enum(['days', 'dhms', 'weeks', 'auto']).optional(),
  showProgressBar: z.boolean().optional(),
  alertDays: z.array(z.number().int().positive()).optional(),
  finishedLabel: z.string().optional(),
  countPastZero: z.boolean().optional(),
});

export const countupConfigSchema = z.object({
  originDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  displayMode: z.enum(['days', 'dhms', 'years_days', 'auto']).optional(),
  milestones: z.array(z.number().int().positive()).optional(),
  resetOnModuleId: z.string().optional(),
});

export const checkboxConfigSchema = z.object({
  confirmOnTap: z.boolean().optional(),
  resetDaily: z.boolean().optional(),
  streak: z.boolean().optional(),
});

export const ratingConfigSchema = z.object({
  scale: z.union([z.literal(5), z.literal(10)]).optional(),
  style: z.enum(['stars', 'dots', 'numbers', 'emoji']).optional(),
  labels: z.array(z.string()).optional(),
  resetDaily: z.boolean().optional(),
});

export const dataInputConfigSchema = z.object({
  unit: z.string(),
  target: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
  cumulativeEntry: z.boolean().optional(),
});

export const mandatorySessionConfigSchema = z.object({
  routineId: z.string(),
  durationMinutes: z.number().positive().optional(),
});

export const textNoteConfigSchema = z.object({
  maxLength: z.number().int().positive().optional(),
  prompt: z.string().optional(),
  resetDaily: z.boolean().optional(),
});

export const progressBarConfigSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  style: z.enum(['linear', 'circular', 'calendar']).optional(),
  showDaysRemaining: z.boolean().optional(),
  showPercentage: z.boolean().optional(),
});

export const streakCounterConfigSchema = z.object({
  sourceModuleId: z.string(),
  graceHours: z.number().optional(),
  showBest: z.boolean().optional(),
});

export const tallyConfigSchema = z.object({
  step: z.number().positive().optional(),
  resetDaily: z.boolean().optional(),
  target: z.number().positive().optional(),
});

export const photoLogConfigSchema = z.object({
  maxPhotosPerDay: z.number().int().positive().optional(),
  prompt: z.string().optional(),
  resetDaily: z.boolean().optional(),
});

export const timerConfigSchema = z.object({
  defaultDurationSeconds: z.number().int().positive(),
});

export const routineLauncherConfigSchema = z.object({
  routineId: z.string(),
  autoStartOnTap: z.boolean().optional(),
  showBlockPreview: z.boolean().optional(),
  accentColor: z.string().optional(),
});

// ─── Config discriminated by type ───────────────────────────────

export const moduleConfigSchemas = {
  countdown: countdownConfigSchema,
  countup: countupConfigSchema,
  checkbox: checkboxConfigSchema,
  rating: ratingConfigSchema,
  data_input: dataInputConfigSchema,
  mandatory_session: mandatorySessionConfigSchema,
  text_note: textNoteConfigSchema,
  progress_bar: progressBarConfigSchema,
  streak_counter: streakCounterConfigSchema,
  tally: tallyConfigSchema,
  photo_log: photoLogConfigSchema,
  timer: timerConfigSchema,
  routine_launcher: routineLauncherConfigSchema,
} as const;

// ─── ModuleSpec Schema ──────────────────────────────────────────

export const moduleTypeSchema = z.enum([
  'countdown',
  'countup',
  'checkbox',
  'rating',
  'data_input',
  'mandatory_session',
  'text_note',
  'progress_bar',
  'streak_counter',
  'tally',
  'photo_log',
  'timer',
  'routine_launcher',
]);

export const surfaceSchema = z.enum([
  'homescreen',
  'plan',
  'week',
  'day',
  'session',
]);

export const moduleSpecSchema = z.object({
  id: z.string().min(1),
  type: moduleTypeSchema,
  label: z.string().min(1),
  emoji: z.string().optional(),
  config: z.record(z.string(), z.unknown()), // validated per-type using moduleConfigSchemas
  placements: z.array(surfaceSchema).min(1),
  isLive: z.boolean(),
  required: z.boolean(),
  showInSummary: z.boolean().optional(),  collectionId: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),  archivedAt: z.string().nullable().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// ─── DayPlan Schema ─────────────────────────────────────────────

export const dayStatusSchema = z.enum(['planned', 'active', 'completed', 'missed', 'quiet']);

export const daySessionSchema = z.object({
  id: z.string(),
  routineId: z.string(),
  routineName: z.string(),
  durationMinutes: z.number().positive(),
  blockCount: z.number().int().nonnegative(),
  label: z.string().optional(),
  status: z.enum(['pending', 'in_progress', 'completed', 'skipped']),
});

export const dayPlanSchema = z.object({
  id: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string(),
  dayNumber: z.number().int().positive().optional(),
  totalDays: z.number().int().positive().optional(),
  status: dayStatusSchema,
  mustDo: z.array(z.string()),
  mustDoDone: z.array(z.boolean()),
  sessions: z.array(daySessionSchema),
  moduleIds: z.array(z.string()),
  notes: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// ─── Routine Schema ─────────────────────────────────────────────

export const blockTypeSchema = z.enum(['focus', 'break', 'warmup', 'cooldown', 'custom']);

export const routineBlockSchema = z.object({
  id: z.string(),
  name: z.string(),
  durationMinutes: z.number().positive(),
  type: blockTypeSchema,
  order: z.number().int().nonnegative(),
  moduleIds: z.array(z.string()).optional(),
});

export const routineSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  blocks: z.array(routineBlockSchema),
  totalDurationMinutes: z.number().positive(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  archivedAt: z.string().nullable().optional(),
});

// ─── Validation helper ──────────────────────────────────────────

export function validateModuleConfig(
  type: keyof typeof moduleConfigSchemas,
  config: unknown,
) {
  const schema = moduleConfigSchemas[type];
  return schema.safeParse(config);
}
