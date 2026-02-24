/**
 * Data Mirror — raw visibility queries for the Statistics screen.
 *
 * No insights, no scores, no AI. Just data retrieval
 * shaped for the 6 visualisation panels.
 */

import { eq, and, asc, desc, gte, lte, inArray, like } from 'drizzle-orm';
import { moduleSpecs, moduleValues, sessions, dayPlans } from './schema';

type DB = any;

// ─── 1. Total Volume (Bar Chart) ────────────────────────────────

export interface VolumeBar {
  /** Date or week label for X-axis */
  period: string;
  /** Duration in minutes (sessions) or count of entries (module values) */
  volume: number;
}

export interface VolumeData {
  moduleId: string;
  label: string;
  unit: 'minutes' | 'count';
  bars: VolumeBar[];
  totalVolume: number;
}

/**
 * Get volume data for a module, grouped by day or week.
 * For session-based modules: sums duration minutes.
 * For value-based modules: counts entries per period.
 */
export async function getModuleVolume(
  db: DB,
  moduleId: string,
  startDate: string,
  endDate: string,
  groupBy: 'day' | 'week' = 'day',
): Promise<VolumeData> {
  const spec = (await db.select().from(moduleSpecs).where(eq(moduleSpecs.id, moduleId)))[0];
  const label = spec?.label ?? 'Unknown';

  // Try session-based volume first (for routines / timer modules)
  const dayPlanRows = await db
    .select()
    .from(dayPlans)
    .where(and(gte(dayPlans.date, startDate), lte(dayPlans.date, endDate)));
  const dpIds = dayPlanRows.map((d: any) => d.id);
  const dpDateMap = new Map<string, string>();
  for (const d of dayPlanRows) dpDateMap.set(d.id, d.date);

  // Check if this module has sessions (moduleId on sessions or routineId match)
  const moduleSessions = dpIds.length > 0
    ? await db
        .select()
        .from(sessions)
        .where(
          and(
            inArray(sessions.dayPlanId, dpIds),
            eq(sessions.status, 'completed'),
          ),
        )
    : [];

  const relevantSessions = moduleSessions.filter(
    (s: any) => s.moduleId === moduleId || s.routineId === moduleId,
  );

  if (relevantSessions.length > 0) {
    // Session-based: sum duration in minutes
    const periodMap = new Map<string, number>();
    for (const s of relevantSessions) {
      if (!s.startedAt || !s.endedAt) continue;
      const durationMin =
        (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime() - (s.totalPausedMs || 0)) / 60000;
      const date = dpDateMap.get(s.dayPlanId) ?? '';
      const key = groupBy === 'week' ? toWeekKey(date) : date;
      periodMap.set(key, (periodMap.get(key) ?? 0) + durationMin);
    }

    const bars = [...periodMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, volume]) => ({ period, volume: Math.round(volume * 10) / 10 }));

    return {
      moduleId,
      label,
      unit: 'minutes',
      bars,
      totalVolume: bars.reduce((s, b) => s + b.volume, 0),
    };
  }

  // Value-based: count entries per period
  const vals = await db
    .select()
    .from(moduleValues)
    .where(
      and(
        eq(moduleValues.moduleId, moduleId),
        gte(moduleValues.date, startDate),
        lte(moduleValues.date, endDate),
      ),
    );

  const periodMap = new Map<string, number>();
  for (const v of vals) {
    const key = groupBy === 'week' ? toWeekKey(v.date) : v.date;
    periodMap.set(key, (periodMap.get(key) ?? 0) + 1);
  }

  const bars = [...periodMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, volume]) => ({ period, volume }));

  return {
    moduleId,
    label,
    unit: 'count',
    bars,
    totalVolume: bars.reduce((s, b) => s + b.volume, 0),
  };
}

// ─── 2. Metric Trend (Line Graph) ──────────────────────────────

export interface TrendPoint {
  date: string;
  value: number;
  loggedAt: string;
  sessionId: string | null;
}

export interface MetricTrendData {
  moduleId: string;
  label: string;
  unit: string;
  points: TrendPoint[];
}

/**
 * Get raw value timeline for a module.
 * Returns every data point with its exact timestamp for "Data Peeking".
 */
export async function getMetricTrend(
  db: DB,
  moduleId: string,
  startDate: string,
  endDate: string,
): Promise<MetricTrendData> {
  const spec = (await db.select().from(moduleSpecs).where(eq(moduleSpecs.id, moduleId)))[0];
  const config = spec ? JSON.parse(spec.config || '{}') : {};

  const vals = await db
    .select()
    .from(moduleValues)
    .where(
      and(
        eq(moduleValues.moduleId, moduleId),
        gte(moduleValues.date, startDate),
        lte(moduleValues.date, endDate),
      ),
    );

  const points: TrendPoint[] = vals
    .map((v: any) => ({
      date: v.date,
      value: parseFloat(v.value),
      loggedAt: v.loggedAt,
      sessionId: v.sessionId ?? null,
    }))
    .filter((p: TrendPoint) => !isNaN(p.value))
    .sort((a: TrendPoint, b: TrendPoint) => a.date.localeCompare(b.date));

  return {
    moduleId,
    label: spec?.label ?? 'Unknown',
    unit: config.unit ?? '',
    points,
  };
}

// ─── 3. Consistency Grid (365-day Heatmap) ──────────────────────

export interface ConsistencyDay {
  date: string;
  logged: boolean;
}

export interface ConsistencyData {
  moduleId: string;
  label: string;
  days: ConsistencyDay[];
  totalLogged: number;
  totalDays: number;
}

/**
 * Build a 365-day boolean grid: did you log anything for this module each day?
 */
export async function getConsistencyGrid(
  db: DB,
  moduleId: string,
  endDate?: string,
): Promise<ConsistencyData> {
  const spec = (await db.select().from(moduleSpecs).where(eq(moduleSpecs.id, moduleId)))[0];
  const end = endDate ?? new Date().toISOString().slice(0, 10);
  const endMs = new Date(end + 'T12:00:00').getTime();
  const startMs = endMs - 364 * 86400000;
  const start = new Date(startMs).toISOString().slice(0, 10);

  const vals = await db
    .select()
    .from(moduleValues)
    .where(
      and(
        eq(moduleValues.moduleId, moduleId),
        gte(moduleValues.date, start),
        lte(moduleValues.date, end),
      ),
    );

  const loggedDates = new Set(vals.map((v: any) => v.date));

  const days: ConsistencyDay[] = [];
  for (let d = 0; d <= 364; d++) {
    const date = new Date(startMs + d * 86400000).toISOString().slice(0, 10);
    days.push({ date, logged: loggedDates.has(date) });
  }

  const totalLogged = days.filter((d) => d.logged).length;

  return {
    moduleId,
    label: spec?.label ?? 'Unknown',
    days,
    totalLogged,
    totalDays: 365,
  };
}

// ─── 4. Circadian Distribution (24h Clock) ──────────────────────

export interface HourBucket {
  hour: number; // 0-23
  count: number;
  totalMinutes: number;
}

export interface CircadianData {
  moduleId: string | null;
  label: string;
  buckets: HourBucket[];
  peakHour: number;
  totalSessions: number;
}

/**
 * Map all sessions to a 24-hour scale. Optionally filter by module.
 * Returns density per hour.
 */
export async function getCircadianDistribution(
  db: DB,
  startDate: string,
  endDate: string,
  moduleId?: string,
): Promise<CircadianData> {
  const dayPlanRows = await db
    .select()
    .from(dayPlans)
    .where(and(gte(dayPlans.date, startDate), lte(dayPlans.date, endDate)));
  const dpIds = dayPlanRows.map((d: any) => d.id);

  let allSessions: any[] = [];
  if (dpIds.length > 0) {
    allSessions = await db
      .select()
      .from(sessions)
      .where(
        and(
          inArray(sessions.dayPlanId, dpIds),
          eq(sessions.status, 'completed'),
        ),
      );
  }

  if (moduleId) {
    allSessions = allSessions.filter(
      (s: any) => s.moduleId === moduleId || s.routineId === moduleId,
    );
  }

  // initialise 24 buckets
  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    count: 0,
    totalMinutes: 0,
  }));

  for (const s of allSessions) {
    if (!s.startedAt) continue;
    const startHour = new Date(s.startedAt).getHours();
    const durationMin = s.endedAt
      ? (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime() - (s.totalPausedMs || 0)) / 60000
      : 0;
    buckets[startHour].count++;
    buckets[startHour].totalMinutes += Math.max(0, durationMin);
  }

  // Round minutes
  for (const b of buckets) {
    b.totalMinutes = Math.round(b.totalMinutes * 10) / 10;
  }

  const peakHour = buckets.reduce((max, b) => (b.count > max.count ? b : max), buckets[0]).hour;

  let label = 'All Activities';
  if (moduleId) {
    const spec = (await db.select().from(moduleSpecs).where(eq(moduleSpecs.id, moduleId)))[0];
    label = spec?.label ?? 'Unknown';
  }

  return {
    moduleId: moduleId ?? null,
    label,
    buckets,
    peakHour,
    totalSessions: allSessions.length,
  };
}

// ─── 5. Photo Stream ────────────────────────────────────────────
// (Already implemented via getSessionPhotos in queries.ts)

// ─── 6. Searchable Ledger (Raw Table) ───────────────────────────

export interface LedgerEntry {
  id: string;
  date: string;
  value: string;
  loggedAt: string;
  sessionId: string | null;
}

export interface LedgerPage {
  entries: LedgerEntry[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Paginated raw log of every entry for a module.
 * Supports search by value content.
 */
export async function getRawLedger(
  db: DB,
  moduleId: string,
  opts: {
    page?: number;
    pageSize?: number;
    search?: string;
    startDate?: string;
    endDate?: string;
  } = {},
): Promise<LedgerPage> {
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 50;

  // Build conditions
  const conditions: any[] = [eq(moduleValues.moduleId, moduleId)];
  if (opts.startDate) conditions.push(gte(moduleValues.date, opts.startDate));
  if (opts.endDate) conditions.push(lte(moduleValues.date, opts.endDate));
  if (opts.search) conditions.push(like(moduleValues.value, `%${opts.search}%`));

  const allRows = await db
    .select()
    .from(moduleValues)
    .where(and(...conditions))
    .orderBy(desc(moduleValues.date));

  const total = allRows.length;
  const offset = (page - 1) * pageSize;
  const entries: LedgerEntry[] = allRows.slice(offset, offset + pageSize).map((v: any) => ({
    id: v.id,
    date: v.date,
    value: v.value,
    loggedAt: v.loggedAt,
    sessionId: v.sessionId ?? null,
  }));

  return {
    entries,
    total,
    page,
    pageSize,
    hasMore: offset + pageSize < total,
  };
}

// ─── Helpers ────────────────────────────────────────────────────

function toWeekKey(date: string): string {
  const d = new Date(date + 'T12:00:00');
  const year = d.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const weekNum = Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}
