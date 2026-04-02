import { and, asc, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { sessions, trackerEntries, trackerLayouts, trackerReminders, trackers, trackerSchedules } from './schema';
import type {
  AggregateTrackerConfig,
  TrackerComparisonPoint,
  TrackerKind,
  TrackerPinRules,
  TrackerQuickAction,
  TrackerReminder,
  TrackerSchedule,
  TrackerSeriesPoint,
  TrackerSpec,
  TrackerSummary,
  TrackerSurface,
} from '../types/Tracker';
import {
  getDefaultTrackerPinRules,
  getTrackerRegistryItem,
  normalizeTrackerQuickAction,
  parseTrackerValue,
  serializeTrackerValue,
  supportsTrackerComparison,
  validateTrackerConfig,
} from '../trackers';

type DB = any;

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function formatDate(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function toWeekKey(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  const year = d.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const weekNum = Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

function dateDiffInDays(fromDate: string, toDate: string): number {
  const from = new Date(`${fromDate}T12:00:00`).getTime();
  const to = new Date(`${toDate}T12:00:00`).getTime();
  return Math.round((to - from) / 86400000);
}

function trackerRowToSpec(row: any): TrackerSpec {
  return {
    ...row,
    config: safeJsonParse(row.config, {}),
    pinRules: safeJsonParse(row.pinRules, {}),
    metadata: safeJsonParse(row.metadata, {}),
    collectionId: row.collectionId ?? null,
    emoji: row.emoji ?? null,
    archivedAt: row.archivedAt ?? null,
  };
}

function trackerEntryRowToValue(row: any, kind: TrackerKind) {
  return {
    ...row,
    value: parseTrackerValue(kind, row.valueJson),
    booleanValue: row.booleanValue == null ? null : Boolean(row.booleanValue),
  };
}

function getPinRule(pinRules: TrackerPinRules | undefined, surface: TrackerSurface) {
  return pinRules?.[surface];
}

function isPinnedToSurface(pinRules: TrackerPinRules | undefined, surface: TrackerSurface): boolean {
  return Boolean(getPinRule(pinRules, surface)?.enabled);
}

async function getTrackerRow(db: DB, trackerId: string) {
  const rows = await db.select().from(trackers).where(eq(trackers.id, trackerId));
  return rows[0] ?? null;
}

async function computeProgressValue(db: DB, tracker: TrackerSpec, date: string): Promise<number | null> {
  const config = tracker.config as any;
  if (config.mode === 'metric' && config.sourceTrackerId) {
    const sourceEntry = await getTrackerEntry(db, config.sourceTrackerId, date);
    if (!sourceEntry) return null;
    const sourceValue = Number(sourceEntry.numericValue ?? 0);
    const startValue = Number(config.startValue ?? 0);
    const targetValue = Number(config.targetValue ?? 0);
    const denominator = targetValue - startValue;
    if (denominator === 0) return 0;
    return Math.max(0, Math.min(100, ((sourceValue - startValue) / denominator) * 100));
  }
  if (config.startDate && config.endDate) {
    const total = Math.max(1, dateDiffInDays(config.startDate, config.endDate));
    const elapsed = Math.max(0, dateDiffInDays(config.startDate, date));
    return Math.max(0, Math.min(100, (elapsed / total) * 100));
  }
  return null;
}

async function computeStreakValue(db: DB, tracker: TrackerSpec, date: string): Promise<{ current: number; best: number }> {
  const sourceTrackerId = String((tracker.config as any).sourceTrackerId ?? '');
  if (!sourceTrackerId) return { current: 0, best: 0 };
  const rows = await db
    .select({ date: trackerEntries.date, numericValue: trackerEntries.numericValue, booleanValue: trackerEntries.booleanValue })
    .from(trackerEntries)
    .where(eq(trackerEntries.trackerId, sourceTrackerId))
    .orderBy(desc(trackerEntries.date));
  const validDates = ([...new Set(rows.filter((row: any) => {
    if (row.booleanValue != null) return Boolean(row.booleanValue);
    if (row.numericValue != null) return Number(row.numericValue) > 0;
    return false;
  }).map((row: any) => row.date))] as string[]).sort((left, right) => right.localeCompare(left));

  if (validDates.length === 0) return { current: 0, best: 0 };

  let best = 0;
  let current = 0;
  let run = 0;
  let previous: string | null = null;
  for (const currentDate of validDates) {
    if (!previous) {
      run = 1;
    } else {
      const diff = dateDiffInDays(currentDate, previous);
      run = diff === 1 ? run + 1 : 1;
    }
    best = Math.max(best, run);
    previous = currentDate;
  }

  const lastLoggedDate = validDates[0];
  const yesterday = formatDate(new Date(Date.now() - 86400000));
  if (lastLoggedDate === date || lastLoggedDate === yesterday) {
    current = 1;
    for (let index = 1; index < validDates.length; index += 1) {
      const diff = dateDiffInDays(validDates[index], validDates[index - 1]);
      if (diff === 1) current += 1;
      else break;
    }
  }
  return { current, best };
}

async function computeSessionValue(db: DB, tracker: TrackerSpec, date: string): Promise<number> {
  const config = tracker.config as any;
  const rows = await db
    .select({ routineId: sessions.routineId, startedAt: sessions.startedAt, endedAt: sessions.endedAt, totalPausedMs: sessions.totalPausedMs, moduleId: sessions.moduleId })
    .from(sessions)
    .where(eq(sessions.status, 'completed'));

  return rows.reduce((sum: number, row: any) => {
    if (config.routineId && row.routineId !== config.routineId) return sum;
    if (!row.startedAt || !row.endedAt) return sum;
    const isoDate = String(row.startedAt).slice(0, 10);
    if (isoDate !== date) return sum;
    return sum + Math.max(0, (new Date(row.endedAt).getTime() - new Date(row.startedAt).getTime() - (row.totalPausedMs ?? 0)) / 60000);
  }, 0);
}

async function getAggregateInputValue(db: DB, trackerId: string, date: string): Promise<number | null> {
  const sourceTracker = await getTracker(db, trackerId);
  if (!sourceTracker) return null;
  const summary = await getTrackerSummary(db, trackerId, date);
  const value = summary.currentValue;
  if (typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  return null;
}

async function computeAggregateValue(db: DB, tracker: TrackerSpec, date: string): Promise<number | null> {
  const config = tracker.config as unknown as AggregateTrackerConfig;
  const inputs = config.inputs ?? [];
  if (inputs.length === 0) return null;
  let totalWeight = 0;
  let weightedTotal = 0;
  for (const input of inputs) {
    const value = await getAggregateInputValue(db, input.trackerId, date);
    if (value == null) continue;
    totalWeight += input.weight;
    weightedTotal += value * input.weight;
  }
  if (totalWeight === 0) return null;
  const precision = Number(config.precision ?? 2);
  return Number((weightedTotal / totalWeight).toFixed(precision));
}

export async function getTrackers(
  db: DB,
  opts?: {
    collectionId?: string | null;
    surface?: TrackerSurface;
    includeArchived?: boolean;
  },
): Promise<TrackerSpec[]> {
  const rows = await db.select().from(trackers).orderBy(asc(trackers.label));
  return rows
    .map(trackerRowToSpec)
    .filter((row: TrackerSpec) => {
      if (!opts?.includeArchived && row.archivedAt) return false;
      if (opts?.collectionId !== undefined && row.collectionId !== opts.collectionId) return false;
      if (opts?.surface && !isPinnedToSurface(row.pinRules, opts.surface)) return false;
      return true;
    });
}

export async function getTracker(db: DB, id: string): Promise<TrackerSpec | null> {
  const row = await getTrackerRow(db, id);
  return row ? trackerRowToSpec(row) : null;
}

export async function createTracker(
  db: DB,
  data: {
    id?: string;
    kind: TrackerKind;
    label: string;
    emoji?: string | null;
    config?: Record<string, unknown>;
    collectionId?: string | null;
    pinRules?: TrackerPinRules;
    metadata?: Record<string, unknown>;
  },
): Promise<string> {
  const id = data.id ?? generateId();
  const kind = data.kind;
  const config = data.config ?? getTrackerRegistryItem(kind).defaultConfig;
  const validation = validateTrackerConfig(kind, config);
  if (!validation.success) {
    throw new Error(`Invalid tracker config for ${kind}`);
  }

  const now = nowISO();
  await db.insert(trackers).values({
    id,
    kind,
    label: data.label,
    emoji: data.emoji ?? null,
    config: JSON.stringify(validation.data),
    collectionId: data.collectionId ?? null,
    pinRules: JSON.stringify(data.pinRules ?? getDefaultTrackerPinRules(kind)),
    metadata: JSON.stringify(data.metadata ?? {}),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateTracker(
  db: DB,
  id: string,
  data: Partial<{
    label: string;
    emoji: string | null;
    config: Record<string, unknown>;
    collectionId: string | null;
    pinRules: TrackerPinRules;
    metadata: Record<string, unknown>;
    archivedAt: string | null;
  }>,
): Promise<void> {
  const existing = await getTracker(db, id);
  if (!existing) throw new Error(`Tracker not found: ${id}`);

  const patch: Record<string, unknown> = { updatedAt: nowISO() };
  if (data.label !== undefined) patch.label = data.label;
  if (data.emoji !== undefined) patch.emoji = data.emoji;
  if (data.collectionId !== undefined) patch.collectionId = data.collectionId;
  if (data.pinRules !== undefined) patch.pinRules = JSON.stringify(data.pinRules);
  if (data.metadata !== undefined) patch.metadata = JSON.stringify(data.metadata);
  if (data.archivedAt !== undefined) patch.archivedAt = data.archivedAt;
  if (data.config !== undefined) {
    const validation = validateTrackerConfig(existing.kind, data.config);
    if (!validation.success) throw new Error(`Invalid tracker config for ${existing.kind}`);
    patch.config = JSON.stringify(validation.data);
  }
  await db.update(trackers).set(patch).where(eq(trackers.id, id));
}

export async function deleteTracker(db: DB, id: string): Promise<void> {
  await db.delete(trackerEntries).where(eq(trackerEntries.trackerId, id));
  await db.delete(trackerLayouts).where(eq(trackerLayouts.trackerId, id));
  await db.delete(trackerSchedules).where(eq(trackerSchedules.trackerId, id));
  await db.delete(trackerReminders).where(eq(trackerReminders.trackerId, id));
  await db.delete(trackers).where(eq(trackers.id, id));
}

export async function getTrackersForSurface(db: DB, surface: TrackerSurface): Promise<TrackerSpec[]> {
  const all = await getTrackers(db, { includeArchived: false });
  return all
    .filter((tracker) => isPinnedToSurface(tracker.pinRules, surface))
    .sort((left, right) => {
      const leftOrder = getPinRule(left.pinRules, surface)?.order ?? 9999;
      const rightOrder = getPinRule(right.pinRules, surface)?.order ?? 9999;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.label.localeCompare(right.label);
    });
}

export async function getTrackerEntry(db: DB, trackerId: string, date: string) {
  const rows = await db
    .select()
    .from(trackerEntries)
    .where(and(eq(trackerEntries.trackerId, trackerId), eq(trackerEntries.date, date)));
  const tracker = await getTracker(db, trackerId);
  if (!tracker || rows.length === 0) return null;
  return trackerEntryRowToValue(rows[0], tracker.kind);
}

export async function getLatestTrackerEntry(db: DB, trackerId: string) {
  const rows = await db
    .select()
    .from(trackerEntries)
    .where(eq(trackerEntries.trackerId, trackerId))
    .orderBy(desc(trackerEntries.date), desc(trackerEntries.loggedAt));
  const tracker = await getTracker(db, trackerId);
  if (!tracker || rows.length === 0) return null;
  return trackerEntryRowToValue(rows[0], tracker.kind);
}

export async function getTrackerEntries(
  db: DB,
  trackerId: string,
  opts?: { startDate?: string; endDate?: string; limit?: number },
) {
  const tracker = await getTracker(db, trackerId);
  if (!tracker) return [];

  const conditions: any[] = [eq(trackerEntries.trackerId, trackerId)];
  if (opts?.startDate) conditions.push(gte(trackerEntries.date, opts.startDate));
  if (opts?.endDate) conditions.push(lte(trackerEntries.date, opts.endDate));

  const rows = await db
    .select()
    .from(trackerEntries)
    .where(and(...conditions))
    .orderBy(desc(trackerEntries.date), desc(trackerEntries.loggedAt));

  const limitedRows = typeof opts?.limit === 'number' ? rows.slice(0, opts.limit) : rows;
  return limitedRows.map((row: any) => trackerEntryRowToValue(row, tracker.kind));
}

export async function getTrackerEntriesForDate(db: DB, date: string, trackerIds?: string[]) {
  const conditions: any[] = [eq(trackerEntries.date, date)];
  if (trackerIds && trackerIds.length > 0) conditions.push(inArray(trackerEntries.trackerId, trackerIds));
  return db.select().from(trackerEntries).where(and(...conditions));
}

export async function upsertTrackerEntry(
  db: DB,
  data: {
    trackerId: string;
    date: string;
    value: unknown;
    sessionId?: string | null;
  },
): Promise<string> {
  const tracker = await getTracker(db, data.trackerId);
  if (!tracker) throw new Error(`Tracker not found: ${data.trackerId}`);
  const registry = getTrackerRegistryItem(tracker.kind);
  if (!registry.capabilities.loggable) {
    throw new Error(`Tracker kind ${tracker.kind} is derived and cannot store raw entries`);
  }

  const serialized = serializeTrackerValue(tracker.kind, data.value);
  const existing = await getTrackerEntry(db, data.trackerId, data.date);
  const now = nowISO();
  if (existing) {
    await db
      .update(trackerEntries)
      .set({
        valueJson: serialized.valueJson,
        numericValue: serialized.numericValue ?? null,
        booleanValue: serialized.booleanValue == null ? null : serialized.booleanValue ? 1 : 0,
        textValue: serialized.textValue ?? null,
        mediaCount: serialized.mediaCount ?? 0,
        sessionId: data.sessionId ?? existing.sessionId ?? null,
        loggedAt: now,
      })
      .where(eq(trackerEntries.id, existing.id));
    return existing.id;
  }

  const id = generateId();
  await db.insert(trackerEntries).values({
    id,
    trackerId: data.trackerId,
    date: data.date,
    valueJson: serialized.valueJson,
    numericValue: serialized.numericValue ?? null,
    booleanValue: serialized.booleanValue == null ? null : serialized.booleanValue ? 1 : 0,
    textValue: serialized.textValue ?? null,
    mediaCount: serialized.mediaCount ?? 0,
    loggedAt: now,
    sessionId: data.sessionId ?? null,
  });
  return id;
}

async function getScheduleReminderRows<T extends TrackerReminder | TrackerSchedule>(
  db: DB,
  table: any,
  trackerId: string,
): Promise<T[]> {
  const rows = await db.select().from(table).where(eq(table.trackerId, trackerId));
  return rows.map((row: any) => ({
    ...row,
    trackerId: row.trackerId,
    daysOfWeek: safeJsonParse(row.daysOfWeek, []),
    enabled: Boolean(row.enabled),
  }));
}

export async function getSchedulesForTracker(db: DB, trackerId: string): Promise<TrackerSchedule[]> {
  return getScheduleReminderRows(db, trackerSchedules, trackerId);
}

export async function createTrackerSchedule(
  db: DB,
  data: { trackerId: string; daysOfWeek: number[]; timeOfDay?: string | null; enabled?: boolean },
): Promise<string> {
  const id = generateId();
  const now = nowISO();
  await db.insert(trackerSchedules).values({
    id,
    trackerId: data.trackerId,
    daysOfWeek: JSON.stringify(data.daysOfWeek ?? []),
    timeOfDay: data.timeOfDay ?? null,
    enabled: data.enabled === false ? 0 : 1,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateTrackerSchedule(
  db: DB,
  id: string,
  data: Partial<{ daysOfWeek: number[]; timeOfDay: string | null; enabled: boolean }>,
): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: nowISO() };
  if (data.daysOfWeek !== undefined) patch.daysOfWeek = JSON.stringify(data.daysOfWeek);
  if ('timeOfDay' in data) patch.timeOfDay = data.timeOfDay;
  if (data.enabled !== undefined) patch.enabled = data.enabled ? 1 : 0;
  await db.update(trackerSchedules).set(patch).where(eq(trackerSchedules.id, id));
}

export async function deleteTrackerSchedule(db: DB, id: string): Promise<void> {
  await db.delete(trackerSchedules).where(eq(trackerSchedules.id, id));
}

export async function getRemindersForTracker(db: DB, trackerId: string): Promise<TrackerReminder[]> {
  return getScheduleReminderRows(db, trackerReminders, trackerId);
}

export async function createTrackerReminder(
  db: DB,
  data: { trackerId: string; daysOfWeek: number[]; time: string; message?: string | null; enabled?: boolean },
): Promise<string> {
  const id = generateId();
  const now = nowISO();
  await db.insert(trackerReminders).values({
    id,
    trackerId: data.trackerId,
    daysOfWeek: JSON.stringify(data.daysOfWeek ?? []),
    time: data.time,
    message: data.message ?? null,
    enabled: data.enabled === false ? 0 : 1,
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateTrackerReminder(
  db: DB,
  id: string,
  data: Partial<{ daysOfWeek: number[]; time: string; message: string | null; enabled: boolean }>,
): Promise<void> {
  const patch: Record<string, unknown> = { updatedAt: nowISO() };
  if (data.daysOfWeek !== undefined) patch.daysOfWeek = JSON.stringify(data.daysOfWeek);
  if (data.time !== undefined) patch.time = data.time;
  if ('message' in data) patch.message = data.message;
  if (data.enabled !== undefined) patch.enabled = data.enabled ? 1 : 0;
  await db.update(trackerReminders).set(patch).where(eq(trackerReminders.id, id));
}

export async function deleteTrackerReminder(db: DB, id: string): Promise<void> {
  await db.delete(trackerReminders).where(eq(trackerReminders.id, id));
}

export async function getTrackerSummary(db: DB, trackerId: string, date = formatDate()): Promise<TrackerSummary> {
  const tracker = await getTracker(db, trackerId);
  if (!tracker) throw new Error(`Tracker not found: ${trackerId}`);

  const latest = await getLatestTrackerEntry(db, trackerId);
  const reminders = await getRemindersForTracker(db, trackerId);
  const nextReminder = reminders
    .filter((reminder) => reminder.enabled)
    .sort((left, right) => left.time.localeCompare(right.time))[0];
  let currentValue: number | string | boolean | null = latest?.value ?? null;
  let currentDisplay = currentValue == null ? 'Not logged' : String(currentValue);
  let currentStreak: number | null = null;
  let bestValue: number | null = latest?.numericValue ?? null;

  if (tracker.kind === 'countdown') {
    currentValue = Math.max(0, dateDiffInDays(date, (tracker.config as any).targetDate));
    currentDisplay = `${currentValue} days`;
  } else if (tracker.kind === 'countup') {
    currentValue = Math.max(0, dateDiffInDays((tracker.config as any).originDate, date));
    currentDisplay = `${currentValue} days`;
  } else if (tracker.kind === 'progress') {
    currentValue = await computeProgressValue(db, tracker, date);
    currentDisplay = currentValue == null ? 'No source' : `${Math.round(Number(currentValue))}%`;
  } else if (tracker.kind === 'streak') {
    const streak = await computeStreakValue(db, tracker, date);
    currentValue = streak.current;
    currentStreak = streak.current;
    bestValue = streak.best;
    currentDisplay = `${streak.current} day streak`;
  } else if (tracker.kind === 'session') {
    currentValue = await computeSessionValue(db, tracker, date);
    currentDisplay = `${Math.round(Number(currentValue))} min`;
  } else if (tracker.kind === 'aggregate') {
    currentValue = await computeAggregateValue(db, tracker, date);
    currentDisplay = currentValue == null ? 'Not enough data' : String(currentValue);
  } else if (tracker.kind === 'photo') {
    const parsed = Array.isArray(currentValue) ? currentValue : [];
    currentDisplay = `${parsed.length} photos`;
  } else if (tracker.kind === 'habit' && typeof currentValue === 'boolean') {
    currentDisplay = currentValue ? 'Done' : 'Open';
  }

  return {
    trackerId: tracker.id,
    label: tracker.label,
    kind: tracker.kind,
    currentValue,
    currentDisplay,
    lastLoggedAt: latest?.loggedAt ?? null,
    lastLoggedDate: latest?.date ?? null,
    nextReminderAt: nextReminder ? `${date}T${nextReminder.time}:00.000Z` : null,
    currentStreak,
    bestValue,
    comparisonReady: supportsTrackerComparison(tracker.kind),
  };
}

export async function getTrackerSeries(
  db: DB,
  trackerId: string,
  opts?: { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' },
): Promise<TrackerSeriesPoint[]> {
  const tracker = await getTracker(db, trackerId);
  if (!tracker) return [];
  const startDate = opts?.startDate ?? formatDate(new Date(Date.now() - 29 * 86400000));
  const endDate = opts?.endDate ?? formatDate();

  if (tracker.kind === 'aggregate' || tracker.kind === 'countdown' || tracker.kind === 'countup' || tracker.kind === 'progress' || tracker.kind === 'streak' || tracker.kind === 'session') {
    const points: TrackerSeriesPoint[] = [];
    const cursor = new Date(`${startDate}T12:00:00`);
    const last = new Date(`${endDate}T12:00:00`);
    while (cursor <= last) {
      const date = formatDate(cursor);
      const summary = await getTrackerSummary(db, trackerId, date);
      if (typeof summary.currentValue === 'number') points.push({ date, value: summary.currentValue });
      cursor.setDate(cursor.getDate() + 1);
    }
    return points;
  }

  const rows = await db
    .select({
      date: trackerEntries.date,
      numericValue: trackerEntries.numericValue,
      booleanValue: trackerEntries.booleanValue,
    })
    .from(trackerEntries)
    .where(and(eq(trackerEntries.trackerId, trackerId), gte(trackerEntries.date, startDate), lte(trackerEntries.date, endDate)))
    .orderBy(asc(trackerEntries.date), asc(trackerEntries.loggedAt));

  const points = rows
    .map((row: any) => {
      if (row.numericValue != null) return { date: row.date, value: Number(row.numericValue) };
      if (row.booleanValue != null) return { date: row.date, value: row.booleanValue ? 1 : 0 };
      return null;
    })
    .filter(Boolean) as TrackerSeriesPoint[];

  if (opts?.groupBy === 'week') {
    const weekly = new Map<string, number[]>();
    for (const point of points) {
      const key = toWeekKey(point.date);
      if (!weekly.has(key)) weekly.set(key, []);
      weekly.get(key)?.push(point.value);
    }
    return [...weekly.entries()].map(([date, values]) => ({
      date,
      value: values.reduce((sum, value) => sum + value, 0) / values.length,
    }));
  }

  return points;
}

export async function getTrackerComparison(
  db: DB,
  leftTrackerId: string,
  rightTrackerId: string,
  opts?: { startDate?: string; endDate?: string; groupBy?: 'day' | 'week' },
): Promise<TrackerComparisonPoint[]> {
  const [left, right] = await Promise.all([
    getTrackerSeries(db, leftTrackerId, opts),
    getTrackerSeries(db, rightTrackerId, opts),
  ]);

  const leftMap = new Map(left.map((point) => [point.date, point.value]));
  const rightMap = new Map(right.map((point) => [point.date, point.value]));
  const dates = [...new Set([...leftMap.keys(), ...rightMap.keys()])].sort();
  return dates.map((date) => ({
    date,
    leftValue: leftMap.get(date) ?? null,
    rightValue: rightMap.get(date) ?? null,
  }));
}

export async function getTrackerQuickAction(
  db: DB,
  trackerId: string,
  surface: TrackerSurface,
): Promise<TrackerQuickAction | null> {
  const tracker = await getTracker(db, trackerId);
  if (!tracker) return null;
  return normalizeTrackerQuickAction(getPinRule(tracker.pinRules, surface)?.quickAction, getPinRule(tracker.pinRules, surface)?.size);
}

export async function applyTrackerQuickAction(
  db: DB,
  trackerId: string,
  surface: TrackerSurface,
  opts?: { date?: string; sessionId?: string | null },
): Promise<string | null> {
  const tracker = await getTracker(db, trackerId);
  if (!tracker) return null;
  const quickAction = await getTrackerQuickAction(db, trackerId, surface);
  if (!quickAction) return null;
  const date = opts?.date ?? formatDate();
  const entry = await getTrackerEntry(db, trackerId, date);
  let nextValue: unknown = entry?.value ?? null;

  switch (quickAction.type) {
    case 'toggle':
      nextValue = !(entry?.booleanValue ?? false);
      break;
    case 'increment':
      nextValue = Number(entry?.numericValue ?? 0) + Number(quickAction.amount ?? 1);
      break;
    case 'decrement':
      nextValue = Number(entry?.numericValue ?? 0) - Number(quickAction.amount ?? 1);
      break;
    case 'set_number':
    case 'set_text':
    case 'set_boolean':
      nextValue = quickAction.value ?? null;
      break;
    default:
      nextValue = entry?.value ?? null;
      break;
  }

  return upsertTrackerEntry(db, {
    trackerId,
    date,
    value: nextValue,
    sessionId: opts?.sessionId ?? null,
  });
}
