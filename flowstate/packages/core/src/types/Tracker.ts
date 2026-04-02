export const TRACKER_KINDS = [
  'countdown',
  'countup',
  'habit',
  'rating',
  'metric',
  'counter',
  'note',
  'photo',
  'progress',
  'streak',
  'session',
  'prompt',
  'aggregate',
] as const;

export type TrackerKind = (typeof TRACKER_KINDS)[number];

export const TRACKER_SURFACES = ['today', 'session', 'widget'] as const;

export type TrackerSurface = (typeof TRACKER_SURFACES)[number];

export const TRACKER_LAYOUT_SIZES = ['compact', 'wide', 'full'] as const;

export type TrackerLayoutSize = (typeof TRACKER_LAYOUT_SIZES)[number];

export type TrackerQuickActionType =
  | 'toggle'
  | 'increment'
  | 'decrement'
  | 'set_number'
  | 'set_text'
  | 'set_boolean';

export interface TrackerQuickAction {
  type: TrackerQuickActionType;
  label?: string;
  amount?: number;
  value?: number | string | boolean;
}

export interface TrackerPinRule {
  enabled: boolean;
  order?: number;
  size?: TrackerLayoutSize;
  quickAction?: TrackerQuickAction | null;
}

export type TrackerPinRules = Partial<Record<TrackerSurface, TrackerPinRule>>;

export interface CountdownTrackerConfig {
  targetDate: string;
  startDate?: string;
  displayMode?: 'days' | 'dhms' | 'weeks' | 'auto';
  showProgressBar?: boolean;
  alertDays?: number[];
  finishedLabel?: string;
  countPastZero?: boolean;
  milestones?: number[];
}

export interface CountupTrackerConfig {
  originDate: string;
  mode?: 'since_date' | 'since_event';
  displayMode?: 'days' | 'dhms' | 'years_days' | 'auto';
  milestones?: number[];
  resetSourceTrackerId?: string;
}

export interface HabitTrackerConfig {
  cadence?: 'daily' | 'weekdays' | 'custom';
  daysOfWeek?: number[];
  allowSkip?: boolean;
  confirmOnTap?: boolean;
  streakEnabled?: boolean;
  prompt?: string;
}

export interface RatingTrackerConfig {
  scale?: 5 | 10;
  style?: 'stars' | 'dots' | 'numbers' | 'emoji';
  labels?: string[];
}

export interface MetricTrackerConfig {
  unit: string;
  target?: number;
  min?: number;
  max?: number;
  step?: number;
  mode?: 'set' | 'cumulative';
  presetValues?: number[];
  prMode?: boolean;
}

export interface CounterTrackerConfig {
  step?: number;
  target?: number;
  presets?: number[];
  allowNegative?: boolean;
}

export interface NoteTrackerConfig {
  prompt?: string;
  template?: string;
  maxLength?: number;
}

export interface PhotoTrackerConfig {
  prompt?: string;
  maxPhotosPerDay?: number;
  allowCaptions?: boolean;
  compareMode?: boolean;
}

export interface ProgressTrackerConfig {
  mode?: 'date' | 'metric';
  startDate?: string;
  endDate?: string;
  sourceTrackerId?: string;
  startValue?: number;
  targetValue?: number;
  showDaysRemaining?: boolean;
  showPercentage?: boolean;
}

export interface StreakTrackerConfig {
  sourceTrackerId: string;
  graceHours?: number;
  showBest?: boolean;
}

export interface SessionTrackerConfig {
  variant: 'timer' | 'routine_launcher' | 'required_session';
  routineId?: string;
  defaultDurationSeconds?: number;
  autoStartOnTap?: boolean;
  showBlockPreview?: boolean;
}

export interface PromptTrackerConfig {
  prompt: string;
  helperText?: string;
  responseMode?: 'note' | 'rating' | 'habit';
  rotationMode?: 'fixed' | 'daily';
}

export interface AggregateTrackerInput {
  trackerId: string;
  weight: number;
  valueMode?: 'numeric' | 'boolean' | 'rating' | 'completion';
}

export interface AggregateTrackerConfig {
  mode?: 'weighted_average';
  inputs: AggregateTrackerInput[];
  precision?: number;
  maxValue?: number;
  labelLow?: string;
  labelHigh?: string;
}

export type TrackerConfig =
  | CountdownTrackerConfig
  | CountupTrackerConfig
  | HabitTrackerConfig
  | RatingTrackerConfig
  | MetricTrackerConfig
  | CounterTrackerConfig
  | NoteTrackerConfig
  | PhotoTrackerConfig
  | ProgressTrackerConfig
  | StreakTrackerConfig
  | SessionTrackerConfig
  | PromptTrackerConfig
  | AggregateTrackerConfig;

export interface TrackerSpec {
  id: string;
  kind: TrackerKind;
  label: string;
  emoji?: string | null;
  config: Record<string, unknown>;
  collectionId?: string | null;
  pinRules?: TrackerPinRules;
  metadata?: Record<string, unknown>;
  archivedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface TrackerEntry {
  id: string;
  trackerId: string;
  date: string;
  valueJson: string;
  numericValue?: number | null;
  booleanValue?: boolean | null;
  textValue?: string | null;
  mediaCount?: number | null;
  loggedAt: string;
  sessionId?: string | null;
}

export interface TrackerSchedule {
  id: string;
  trackerId: string;
  daysOfWeek: number[];
  timeOfDay?: string | null;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TrackerReminder {
  id: string;
  trackerId: string;
  daysOfWeek: number[];
  time: string;
  message?: string | null;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface TrackerLayout {
  id: string;
  trackerId: string;
  surface: TrackerSurface;
  zone?: string | null;
  order: number;
  size: TrackerLayoutSize;
}

export interface TrackerSeriesPoint {
  date: string;
  value: number;
}

export interface TrackerComparisonPoint {
  date: string;
  leftValue: number | null;
  rightValue: number | null;
}

export interface TrackerSummary {
  trackerId: string;
  label: string;
  kind: TrackerKind;
  currentValue: number | string | boolean | null;
  currentDisplay: string;
  lastLoggedAt?: string | null;
  lastLoggedDate?: string | null;
  nextReminderAt?: string | null;
  currentStreak?: number | null;
  bestValue?: number | null;
  comparisonReady?: boolean;
}
