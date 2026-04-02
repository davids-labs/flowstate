import { z } from 'zod';
import type {
  AggregateTrackerConfig,
  CountdownTrackerConfig,
  CountupTrackerConfig,
  CounterTrackerConfig,
  HabitTrackerConfig,
  MetricTrackerConfig,
  NoteTrackerConfig,
  PhotoTrackerConfig,
  ProgressTrackerConfig,
  PromptTrackerConfig,
  RatingTrackerConfig,
  SessionTrackerConfig,
  StreakTrackerConfig,
  TrackerKind,
  TrackerLayoutSize,
  TrackerPinRules,
  TrackerQuickAction,
} from '../types/Tracker';
import { TRACKER_KINDS } from '../types/Tracker';

export interface SerializedTrackerValue {
  valueJson: string;
  numericValue?: number | null;
  booleanValue?: boolean | null;
  textValue?: string | null;
  mediaCount?: number | null;
}

export interface TrackerRegistryItem<TConfig = Record<string, unknown>, TValue = unknown> {
  kind: TrackerKind;
  label: string;
  description: string;
  entryMode: 'none' | 'boolean' | 'number' | 'text' | 'media';
  statsProfile: 'countdown' | 'countup' | 'habit' | 'rating' | 'metric' | 'counter' | 'note' | 'photo' | 'progress' | 'streak' | 'session' | 'prompt' | 'aggregate';
  capabilities: {
    loggable: boolean;
    derived: boolean;
    supportsComparison: boolean;
    supportsQuickAction: boolean;
    supportsSchedules: boolean;
    supportsReminders: boolean;
  };
  schema: z.ZodType<TConfig>;
  defaultConfig: TConfig;
  defaultPinRules?: TrackerPinRules;
  parseValue: (valueJson: string | null) => TValue;
  serializeValue: (value: TValue) => SerializedTrackerValue;
}

const booleanFromString = (value: string | null) => value === 'true' || value === '1';

const numberFromString = (value: string | null) => {
  if (value === null || value === '') return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const trackerPinRuleSchema = z.object({
  enabled: z.boolean(),
  order: z.number().int().optional(),
  size: z.enum(['compact', 'wide', 'full']).optional(),
  quickAction: z.object({
    type: z.enum(['toggle', 'increment', 'decrement', 'set_number', 'set_text', 'set_boolean']),
    label: z.string().optional(),
    amount: z.number().optional(),
    value: z.union([z.number(), z.string(), z.boolean()]).optional(),
  }).nullable().optional(),
});

export const trackerPinRulesSchema = z.object({
  today: trackerPinRuleSchema.optional(),
  session: trackerPinRuleSchema.optional(),
  widget: trackerPinRuleSchema.optional(),
});

export const countdownTrackerConfigSchema = z.object({
  targetDate: dateString,
  startDate: dateString.optional(),
  displayMode: z.enum(['days', 'dhms', 'weeks', 'auto']).optional(),
  showProgressBar: z.boolean().optional(),
  alertDays: z.array(z.number().int().nonnegative()).optional(),
  finishedLabel: z.string().optional(),
  countPastZero: z.boolean().optional(),
  milestones: z.array(z.number().int().positive()).optional(),
});

export const countupTrackerConfigSchema = z.object({
  originDate: dateString,
  mode: z.enum(['since_date', 'since_event']).optional(),
  displayMode: z.enum(['days', 'dhms', 'years_days', 'auto']).optional(),
  milestones: z.array(z.number().int().positive()).optional(),
  resetSourceTrackerId: z.string().optional(),
});

export const habitTrackerConfigSchema = z.object({
  cadence: z.enum(['daily', 'weekdays', 'custom']).optional(),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).optional(),
  allowSkip: z.boolean().optional(),
  confirmOnTap: z.boolean().optional(),
  streakEnabled: z.boolean().optional(),
  prompt: z.string().optional(),
});

export const ratingTrackerConfigSchema = z.object({
  scale: z.union([z.literal(5), z.literal(10)]).optional(),
  style: z.enum(['stars', 'dots', 'numbers', 'emoji']).optional(),
  labels: z.array(z.string()).optional(),
});

export const metricTrackerConfigSchema = z.object({
  unit: z.string(),
  target: z.number().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
  mode: z.enum(['set', 'cumulative']).optional(),
  presetValues: z.array(z.number()).optional(),
  prMode: z.boolean().optional(),
});

export const counterTrackerConfigSchema = z.object({
  step: z.number().positive().optional(),
  target: z.number().optional(),
  presets: z.array(z.number()).optional(),
  allowNegative: z.boolean().optional(),
});

export const noteTrackerConfigSchema = z.object({
  prompt: z.string().optional(),
  template: z.string().optional(),
  maxLength: z.number().int().positive().optional(),
});

export const photoTrackerConfigSchema = z.object({
  prompt: z.string().optional(),
  maxPhotosPerDay: z.number().int().positive().optional(),
  allowCaptions: z.boolean().optional(),
  compareMode: z.boolean().optional(),
});

export const progressTrackerConfigSchema = z.object({
  mode: z.enum(['date', 'metric']).optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  sourceTrackerId: z.string().optional(),
  startValue: z.number().optional(),
  targetValue: z.number().optional(),
  showDaysRemaining: z.boolean().optional(),
  showPercentage: z.boolean().optional(),
});

export const streakTrackerConfigSchema = z.object({
  sourceTrackerId: z.string(),
  graceHours: z.number().nonnegative().optional(),
  showBest: z.boolean().optional(),
});

export const sessionTrackerConfigSchema = z.object({
  variant: z.enum(['timer', 'routine_launcher', 'required_session']),
  routineId: z.string().optional(),
  defaultDurationSeconds: z.number().int().positive().optional(),
  autoStartOnTap: z.boolean().optional(),
  showBlockPreview: z.boolean().optional(),
});

export const promptTrackerConfigSchema = z.object({
  prompt: z.string(),
  helperText: z.string().optional(),
  responseMode: z.enum(['note', 'rating', 'habit']).optional(),
  rotationMode: z.enum(['fixed', 'daily']).optional(),
});

export const aggregateTrackerConfigSchema = z.object({
  mode: z.enum(['weighted_average']).optional(),
  inputs: z.array(z.object({
    trackerId: z.string(),
    weight: z.number().positive(),
    valueMode: z.enum(['numeric', 'boolean', 'rating', 'completion']).optional(),
  })).min(1),
  precision: z.number().int().min(0).max(6).optional(),
  maxValue: z.number().positive().optional(),
  labelLow: z.string().optional(),
  labelHigh: z.string().optional(),
});

function serializeJsonValue(value: unknown): SerializedTrackerValue {
  return { valueJson: JSON.stringify(value ?? null) };
}

function serializeBooleanValue(value: boolean): SerializedTrackerValue {
  return {
    valueJson: JSON.stringify(value),
    booleanValue: value,
    numericValue: value ? 1 : 0,
    textValue: value ? 'true' : 'false',
  };
}

function serializeNumberValue(value: number): SerializedTrackerValue {
  return {
    valueJson: JSON.stringify(value),
    numericValue: value,
    textValue: String(value),
  };
}

function serializeTextValue(value: string): SerializedTrackerValue {
  return {
    valueJson: JSON.stringify(value),
    textValue: value,
  };
}

type PhotoValue = Array<{ uri: string; caption?: string }> | string[];

function serializePhotoValue(value: PhotoValue): SerializedTrackerValue {
  const normalized = (value ?? []).map((item) => {
    if (typeof item === 'string') return { uri: item };
    return { uri: item.uri, caption: item.caption };
  });
  return {
    valueJson: JSON.stringify(normalized),
    mediaCount: normalized.length,
    textValue: normalized.map((item) => item.uri).join(','),
  };
}

function parsePhotoValue(valueJson: string | null): PhotoValue {
  if (!valueJson) return [];
  try {
    const parsed = JSON.parse(valueJson);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through
  }
  return valueJson.split(',').filter(Boolean);
}

export const TRACKER_REGISTRY: Record<TrackerKind, TrackerRegistryItem<any, any>> = {
  countdown: {
    kind: 'countdown',
    label: 'Countdown',
    description: 'Count down to a target date with milestones and alerts.',
    entryMode: 'none',
    statsProfile: 'countdown',
    capabilities: { loggable: false, derived: true, supportsComparison: true, supportsQuickAction: false, supportsSchedules: false, supportsReminders: true },
    schema: countdownTrackerConfigSchema,
    defaultConfig: { targetDate: new Date().toISOString().slice(0, 10), displayMode: 'auto', showProgressBar: true } as CountdownTrackerConfig,
    defaultPinRules: { today: { enabled: true, size: 'wide' }, widget: { enabled: true, size: 'wide' } },
    parseValue: () => null,
    serializeValue: serializeJsonValue,
  },
  countup: {
    kind: 'countup',
    label: 'Countup',
    description: 'Track elapsed time from a date or event reset.',
    entryMode: 'none',
    statsProfile: 'countup',
    capabilities: { loggable: false, derived: true, supportsComparison: true, supportsQuickAction: false, supportsSchedules: false, supportsReminders: true },
    schema: countupTrackerConfigSchema,
    defaultConfig: { originDate: new Date().toISOString().slice(0, 10), mode: 'since_date', displayMode: 'auto' } as CountupTrackerConfig,
    defaultPinRules: { today: { enabled: true, size: 'wide' }, widget: { enabled: true, size: 'wide' } },
    parseValue: () => null,
    serializeValue: serializeJsonValue,
  },
  habit: {
    kind: 'habit',
    label: 'Habit',
    description: 'A daily or scheduled completion tracker with skip support.',
    entryMode: 'boolean',
    statsProfile: 'habit',
    capabilities: { loggable: true, derived: false, supportsComparison: true, supportsQuickAction: true, supportsSchedules: true, supportsReminders: true },
    schema: habitTrackerConfigSchema,
    defaultConfig: { cadence: 'daily', allowSkip: true, streakEnabled: true } as HabitTrackerConfig,
    defaultPinRules: { today: { enabled: true, size: 'compact', quickAction: { type: 'toggle' } }, widget: { enabled: true, size: 'compact', quickAction: { type: 'toggle' } } },
    parseValue: booleanFromString,
    serializeValue: serializeBooleanValue,
  },
  rating: {
    kind: 'rating',
    label: 'Rating',
    description: 'Rate a signal on a fixed scale.',
    entryMode: 'number',
    statsProfile: 'rating',
    capabilities: { loggable: true, derived: false, supportsComparison: true, supportsQuickAction: true, supportsSchedules: true, supportsReminders: true },
    schema: ratingTrackerConfigSchema,
    defaultConfig: { scale: 5, style: 'stars' } as RatingTrackerConfig,
    defaultPinRules: { today: { enabled: true, size: 'compact' }, widget: { enabled: true, size: 'compact' } },
    parseValue: numberFromString,
    serializeValue: serializeNumberValue,
  },
  metric: {
    kind: 'metric',
    label: 'Metric',
    description: 'Log a measured numeric value with units and targets.',
    entryMode: 'number',
    statsProfile: 'metric',
    capabilities: { loggable: true, derived: false, supportsComparison: true, supportsQuickAction: true, supportsSchedules: true, supportsReminders: true },
    schema: metricTrackerConfigSchema,
    defaultConfig: { unit: 'units', mode: 'set', step: 1 } as MetricTrackerConfig,
    defaultPinRules: { today: { enabled: true, size: 'wide' }, widget: { enabled: true, size: 'compact' } },
    parseValue: numberFromString,
    serializeValue: serializeNumberValue,
  },
  counter: {
    kind: 'counter',
    label: 'Counter',
    description: 'High-frequency incremental logging.',
    entryMode: 'number',
    statsProfile: 'counter',
    capabilities: { loggable: true, derived: false, supportsComparison: true, supportsQuickAction: true, supportsSchedules: true, supportsReminders: true },
    schema: counterTrackerConfigSchema,
    defaultConfig: { step: 1, allowNegative: false } as CounterTrackerConfig,
    defaultPinRules: { today: { enabled: true, size: 'compact', quickAction: { type: 'increment', amount: 1 } }, widget: { enabled: true, size: 'compact', quickAction: { type: 'increment', amount: 1 } } },
    parseValue: numberFromString,
    serializeValue: serializeNumberValue,
  },
  note: {
    kind: 'note',
    label: 'Note',
    description: 'Capture a short or long text entry.',
    entryMode: 'text',
    statsProfile: 'note',
    capabilities: { loggable: true, derived: false, supportsComparison: false, supportsQuickAction: false, supportsSchedules: true, supportsReminders: true },
    schema: noteTrackerConfigSchema,
    defaultConfig: { maxLength: 500 } as NoteTrackerConfig,
    defaultPinRules: { today: { enabled: true, size: 'wide' } },
    parseValue: (valueJson: string | null) => {
      if (!valueJson) return '';
      try {
        return JSON.parse(valueJson);
      } catch {
        return valueJson;
      }
    },
    serializeValue: serializeTextValue,
  },
  photo: {
    kind: 'photo',
    label: 'Photo',
    description: 'Store a photo log with captions and gallery support.',
    entryMode: 'media',
    statsProfile: 'photo',
    capabilities: { loggable: true, derived: false, supportsComparison: false, supportsQuickAction: false, supportsSchedules: true, supportsReminders: true },
    schema: photoTrackerConfigSchema,
    defaultConfig: { maxPhotosPerDay: 3, allowCaptions: true, compareMode: true } as PhotoTrackerConfig,
    defaultPinRules: { today: { enabled: true, size: 'wide' } },
    parseValue: parsePhotoValue,
    serializeValue: serializePhotoValue,
  },
  progress: {
    kind: 'progress',
    label: 'Progress',
    description: 'Show date or metric-based progress toward a goal.',
    entryMode: 'none',
    statsProfile: 'progress',
    capabilities: { loggable: false, derived: true, supportsComparison: true, supportsQuickAction: false, supportsSchedules: false, supportsReminders: true },
    schema: progressTrackerConfigSchema,
    defaultConfig: { mode: 'date', showDaysRemaining: true, showPercentage: true } as ProgressTrackerConfig,
    defaultPinRules: { today: { enabled: true, size: 'wide' }, widget: { enabled: true, size: 'wide' } },
    parseValue: () => null,
    serializeValue: serializeJsonValue,
  },
  streak: {
    kind: 'streak',
    label: 'Streak',
    description: 'Derived streak tracker sourced from another tracker.',
    entryMode: 'none',
    statsProfile: 'streak',
    capabilities: { loggable: false, derived: true, supportsComparison: true, supportsQuickAction: false, supportsSchedules: false, supportsReminders: true },
    schema: streakTrackerConfigSchema,
    defaultConfig: { sourceTrackerId: '', graceHours: 4, showBest: true } as StreakTrackerConfig,
    defaultPinRules: { today: { enabled: true, size: 'compact' }, widget: { enabled: true, size: 'compact' } },
    parseValue: () => null,
    serializeValue: serializeJsonValue,
  },
  session: {
    kind: 'session',
    label: 'Session',
    description: 'Launch or require a session from a tracker tile.',
    entryMode: 'none',
    statsProfile: 'session',
    capabilities: { loggable: false, derived: true, supportsComparison: true, supportsQuickAction: true, supportsSchedules: true, supportsReminders: true },
    schema: sessionTrackerConfigSchema,
    defaultConfig: { variant: 'routine_launcher', autoStartOnTap: false, showBlockPreview: true } as SessionTrackerConfig,
    defaultPinRules: { today: { enabled: true, size: 'wide' }, widget: { enabled: true, size: 'compact' } },
    parseValue: () => null,
    serializeValue: serializeJsonValue,
  },
  prompt: {
    kind: 'prompt',
    label: 'Prompt',
    description: 'Display a prompt or quote and optionally capture a response.',
    entryMode: 'text',
    statsProfile: 'prompt',
    capabilities: { loggable: true, derived: false, supportsComparison: false, supportsQuickAction: false, supportsSchedules: true, supportsReminders: true },
    schema: promptTrackerConfigSchema,
    defaultConfig: { prompt: 'What matters most today?', responseMode: 'note', rotationMode: 'fixed' } as PromptTrackerConfig,
    defaultPinRules: { today: { enabled: true, size: 'wide' }, widget: { enabled: true, size: 'wide' } },
    parseValue: (valueJson: string | null) => {
      if (!valueJson) return '';
      try {
        return JSON.parse(valueJson);
      } catch {
        return valueJson;
      }
    },
    serializeValue: serializeTextValue,
  },
  aggregate: {
    kind: 'aggregate',
    label: 'Aggregate',
    description: 'Derived meta-tracker calculated from weighted inputs.',
    entryMode: 'none',
    statsProfile: 'aggregate',
    capabilities: { loggable: false, derived: true, supportsComparison: true, supportsQuickAction: false, supportsSchedules: false, supportsReminders: false },
    schema: aggregateTrackerConfigSchema,
    defaultConfig: { mode: 'weighted_average', inputs: [], precision: 2, maxValue: 100 } as AggregateTrackerConfig,
    defaultPinRules: { today: { enabled: true, size: 'wide' }, widget: { enabled: true, size: 'wide' } },
    parseValue: () => null,
    serializeValue: serializeJsonValue,
  },
};

export function isTrackerKind(value: string): value is TrackerKind {
  return (TRACKER_KINDS as readonly string[]).includes(value);
}

export function getTrackerRegistryItem(kind: TrackerKind): TrackerRegistryItem<any, any> {
  return TRACKER_REGISTRY[kind];
}

export function getDefaultTrackerConfig(kind: TrackerKind): Record<string, unknown> {
  return { ...TRACKER_REGISTRY[kind].defaultConfig } as Record<string, unknown>;
}

export function getDefaultTrackerPinRules(kind: TrackerKind): TrackerPinRules {
  return { ...(TRACKER_REGISTRY[kind].defaultPinRules ?? {}) };
}

export function validateTrackerConfig(kind: TrackerKind, config: unknown) {
  return TRACKER_REGISTRY[kind].schema.safeParse(config);
}

export function parseTrackerValue(kind: TrackerKind, valueJson: string | null): unknown {
  return TRACKER_REGISTRY[kind].parseValue(valueJson);
}

export function serializeTrackerValue(kind: TrackerKind, value: unknown): SerializedTrackerValue {
  return TRACKER_REGISTRY[kind].serializeValue(value);
}

export function supportsTrackerQuickAction(kind: TrackerKind): boolean {
  return TRACKER_REGISTRY[kind].capabilities.supportsQuickAction;
}

export function supportsTrackerComparison(kind: TrackerKind): boolean {
  return TRACKER_REGISTRY[kind].capabilities.supportsComparison;
}

export function normalizeTrackerQuickAction(action: TrackerQuickAction | null | undefined, size?: TrackerLayoutSize): TrackerQuickAction | null {
  if (!action) return null;
  if (action.type === 'increment' && typeof action.amount !== 'number') {
    return { ...action, amount: 1, label: action.label ?? 'Quick add' };
  }
  if (action.type === 'decrement' && typeof action.amount !== 'number') {
    return { ...action, amount: 1, label: action.label ?? 'Quick remove' };
  }
  return { ...action, label: action.label ?? (size === 'compact' ? 'Quick log' : 'Quick action') };
}
