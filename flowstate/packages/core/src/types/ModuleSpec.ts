// ─── Module Types ───────────────────────────────────────────────

export const MODULE_TYPES = [
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
  'routine_launcher',
  'timer',
  'reminder',
] as const;

export type ModuleType = (typeof MODULE_TYPES)[number];

// ─── Surface Enum ───────────────────────────────────────────────

export const SURFACES = [
  'homescreen',
  'plan',
  'week',
  'day',
  'session',
] as const;

export type Surface = (typeof SURFACES)[number];

// ─── Config Types per Module ────────────────────────────────────

export interface CountdownConfig {
  targetDate: string; // YYYY-MM-DD
  startDate?: string; // YYYY-MM-DD
  displayMode?: 'days' | 'dhms' | 'weeks' | 'auto';
  showProgressBar?: boolean;
  alertDays?: number[];
  finishedLabel?: string;
  countPastZero?: boolean;
}

export interface CountupConfig {
  originDate: string; // YYYY-MM-DD
  displayMode?: 'days' | 'dhms' | 'years_days' | 'auto';
  milestones?: number[];
  resetOnModuleId?: string; // for "last seen" variant
}

export interface CheckboxConfig {
  confirmOnTap?: boolean;
  resetDaily?: boolean;
  streak?: boolean;
}

export interface RatingConfig {
  scale?: 5 | 10;
  style?: 'stars' | 'dots' | 'numbers' | 'emoji';
  labels?: string[];
  resetDaily?: boolean;
}

export interface DataInputConfig {
  unit: string;
  target?: number;
  min?: number;
  max?: number;
  step?: number;
  cumulativeEntry?: boolean;
}

export interface MandatorySessionConfig {
  routineId: string;
  durationMinutes?: number;
}

export interface TextNoteConfig {
  maxLength?: number;
  prompt?: string;
  resetDaily?: boolean;
}

export interface ProgressBarConfig {
  startDate: string;
  endDate: string;
  style?: 'linear' | 'circular' | 'calendar';
  showDaysRemaining?: boolean;
  showPercentage?: boolean;
}

export interface StreakCounterConfig {
  sourceModuleId: string;
  graceHours?: number;
  showBest?: boolean;
}

export interface TallyConfig {
  step?: number; // increment/decrement step, default 1
  resetDaily?: boolean;
  target?: number; // optional daily target
}

export interface PhotoLogConfig {
  maxPhotosPerDay?: number; // default 1
  prompt?: string; // e.g. "Take a progress photo"
  resetDaily?: boolean;
}

export interface RoutineLauncherConfig {
  routineId: string;
  autoStartOnTap?: boolean; // jump straight into the timer
  showBlockPreview?: boolean; // show block list on the card
  accentColor?: string; // custom card tint
}

export interface TimerModuleConfig {
  defaultDurationSeconds: number; // e.g. 1500 for 25min pomodoro
}

export interface ReminderConfig {
  message: string;
  daysOfWeek: number[]; // 0=Sunday … 6=Saturday
  time: string; // 'HH:MM' 24-hour
  repeat: boolean;
}

export type ModuleConfig =
  | CountdownConfig
  | CountupConfig
  | CheckboxConfig
  | RatingConfig
  | DataInputConfig
  | MandatorySessionConfig
  | TextNoteConfig
  | ProgressBarConfig
  | StreakCounterConfig
  | TallyConfig
  | PhotoLogConfig
  | RoutineLauncherConfig
  | TimerModuleConfig
  | ReminderConfig;

// ─── ModuleSpec ─────────────────────────────────────────────────

export interface ModuleSpec {
  id: string;
  type: ModuleType;
  label: string;
  emoji?: string;
  config: ModuleConfig;
  placements: Surface[];
  isLive: boolean;
  required: boolean;
  showInSummary?: boolean;
  collectionId?: string | null;
  metadata?: Record<string, unknown>;
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ─── Module Value (logged data) ─────────────────────────────────

export interface ModuleValue {
  id: string;
  moduleId: string;
  date: string; // YYYY-MM-DD
  value: string; // JSON-encoded value — boolean, number, string, etc.
  loggedAt: string; // ISO timestamp
  sessionId?: string; // if logged during a session
}
