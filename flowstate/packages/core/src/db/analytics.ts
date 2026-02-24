import { eq, and, asc, desc, gte, lte, inArray } from 'drizzle-orm';
import {
  moduleSpecs,
  moduleValues,
  sessions,
  dayPlans,
  plans,
} from './schema';

type DB = any;

// ─── Helper ─────────────────────────────────────────────────────

function getDatesInRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const cur = new Date(start + 'T12:00:00');
  const last = new Date(end + 'T12:00:00');
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
}

// ─── Checkbox Compliance ────────────────────────────────────────

export interface ComplianceResult {
  moduleId: string;
  label: string;
  total: number;
  completed: number;
  rate: number; // 0..1
}

/**
 * For each checkbox module, compute the % of days it was checked
 * within the given date range.
 */
export async function getCheckboxCompliance(
  db: DB,
  startDate: string,
  endDate: string,
): Promise<ComplianceResult[]> {
  const specs = await db.select().from(moduleSpecs);
  const checkboxSpecs = specs.filter((s: any) => s.type === 'checkbox' && !s.archivedAt);
  const checkboxIds = checkboxSpecs.map((s: any) => s.id);
  if (checkboxIds.length === 0) return [];
  const allValues = await db.select().from(moduleValues).where(
    and(
      inArray(moduleValues.moduleId, checkboxIds),
      gte(moduleValues.date, startDate),
      lte(moduleValues.date, endDate),
    ),
  );
  const dates = getDatesInRange(startDate, endDate);

  return checkboxSpecs.map((spec: any) => {
    const vals = allValues.filter(
      (v: any) => v.moduleId === spec.id,
    );
    const completed = vals.filter((v: any) => {
      try {
        const parsed = JSON.parse(v.value);
        return parsed === true || parsed === 'true' || parsed === 1;
      } catch {
        return v.value === 'true' || v.value === '1';
      }
    }).length;
    return {
      moduleId: spec.id,
      label: JSON.parse(spec.config || '{}').label || spec.label,
      total: dates.length,
      completed,
      rate: dates.length > 0 ? completed / dates.length : 0,
    };
  });
}

// ─── Rating Averages & Trends ───────────────────────────────────

export interface RatingTrend {
  moduleId: string;
  label: string;
  average: number;
  points: Array<{ date: string; value: number }>;
  trend: 'up' | 'down' | 'flat';
  previousAverage: number | null;
}

/**
 * For each rating module, compute the average and trend over a date range.
 */
export async function getRatingTrends(
  db: DB,
  startDate: string,
  endDate: string,
  previousStartDate?: string,
  previousEndDate?: string,
): Promise<RatingTrend[]> {
  const specs = await db.select().from(moduleSpecs);
  const ratingSpecs = specs.filter((s: any) => s.type === 'rating' && !s.archivedAt);
  const ratingIds = ratingSpecs.map((s: any) => s.id);
  if (ratingIds.length === 0) return [];
  // Load values for the current range (and optionally the previous range)
  const minDate = previousStartDate && previousStartDate < startDate ? previousStartDate : startDate;
  const maxDate = previousEndDate && previousEndDate > endDate ? previousEndDate : endDate;
  const allValues = await db.select().from(moduleValues).where(
    and(
      inArray(moduleValues.moduleId, ratingIds),
      gte(moduleValues.date, minDate),
      lte(moduleValues.date, maxDate),
    ),
  );

  return ratingSpecs.map((spec: any) => {
    const vals = allValues
      .filter((v: any) => v.moduleId === spec.id && v.date >= startDate && v.date <= endDate)
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

    const points = vals.map((v: any) => ({
      date: v.date,
      value: parseFloat(v.value) || 0,
    }));

    const sum = points.reduce((acc: number, p: any) => acc + p.value, 0);
    const average = points.length > 0 ? sum / points.length : 0;

    // Previous period average for trend
    let previousAverage: number | null = null;
    if (previousStartDate && previousEndDate) {
      const prevVals = allValues
        .filter((v: any) => v.moduleId === spec.id && v.date >= previousStartDate && v.date <= previousEndDate);
      const prevSum = prevVals.reduce((acc: number, v: any) => acc + (parseFloat(v.value) || 0), 0);
      previousAverage = prevVals.length > 0 ? prevSum / prevVals.length : null;
    }

    const trend: 'up' | 'down' | 'flat' =
      previousAverage === null ? 'flat' :
        average > previousAverage + 0.1 ? 'up' :
          average < previousAverage - 0.1 ? 'down' : 'flat';

    return {
      moduleId: spec.id,
      label: spec.label,
      average: Math.round(average * 10) / 10,
      points,
      trend,
      previousAverage: previousAverage !== null ? Math.round(previousAverage * 10) / 10 : null,
    };
  });
}

// ─── Data Input Stats ───────────────────────────────────────────

export interface DataInputStats {
  moduleId: string;
  label: string;
  unit: string;
  target: number | null;
  sum: number;
  average: number;
  points: Array<{ date: string; value: number }>;
  daysOnTarget: number;
  totalDays: number;
}

/**
 * For each data_input module, compute sum, average, and vs-target stats.
 */
export async function getDataInputStats(
  db: DB,
  startDate: string,
  endDate: string,
): Promise<DataInputStats[]> {
  const specs = await db.select().from(moduleSpecs);
  const dataSpecs = specs.filter((s: any) => s.type === 'data_input' && !s.archivedAt);
  const dataIds = dataSpecs.map((s: any) => s.id);
  if (dataIds.length === 0) return [];
  const allValues = await db.select().from(moduleValues).where(
    and(
      inArray(moduleValues.moduleId, dataIds),
      gte(moduleValues.date, startDate),
      lte(moduleValues.date, endDate),
    ),
  );
  const dates = getDatesInRange(startDate, endDate);

  return dataSpecs.map((spec: any) => {
    const config = JSON.parse(spec.config || '{}');
    const vals = allValues
      .filter((v: any) => v.moduleId === spec.id)
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

    const points = vals.map((v: any) => ({
      date: v.date,
      value: parseFloat(v.value) || 0,
    }));

    const sum = points.reduce((acc: number, p: any) => acc + p.value, 0);
    const average = points.length > 0 ? sum / points.length : 0;
    const target = config.target ?? null;
    const daysOnTarget = target !== null
      ? points.filter((p: any) => p.value >= target).length
      : 0;

    return {
      moduleId: spec.id,
      label: spec.label,
      unit: config.unit || '',
      target,
      sum: Math.round(sum * 100) / 100,
      average: Math.round(average * 100) / 100,
      points,
      daysOnTarget,
      totalDays: dates.length,
    };
  });
}

// ─── Session Completion Rates ───────────────────────────────────

export interface SessionCompletionStats {
  totalSessions: number;
  completed: number;
  abandoned: number;
  pending: number;
  completionRate: number;
  dailyBreakdown: Array<{
    date: string;
    total: number;
    completed: number;
  }>;
}

/**
 * Session completion stats over a date range.
 */
export async function getSessionCompletionStats(
  db: DB,
  startDate: string,
  endDate: string,
): Promise<SessionCompletionStats> {
  const rangePlans = await db.select().from(dayPlans).where(
    and(gte(dayPlans.date, startDate), lte(dayPlans.date, endDate)),
  );
  const dayPlanIds = rangePlans.map((d: any) => d.id);

  const rangeSessions = dayPlanIds.length > 0
    ? await db.select().from(sessions).where(inArray(sessions.dayPlanId, dayPlanIds))
    : [];

  const completed = rangeSessions.filter((s: any) => s.status === 'completed').length;
  const abandoned = rangeSessions.filter((s: any) => s.status === 'abandoned').length;
  const pending = rangeSessions.filter((s: any) => s.status === 'pending' || s.status === 'in_progress').length;

  // Daily breakdown
  const dailyMap = new Map<string, { total: number; completed: number }>();
  for (const dp of rangePlans) {
    const daySessions = rangeSessions.filter((s: any) => s.dayPlanId === dp.id);
    dailyMap.set(dp.date, {
      total: daySessions.length,
      completed: daySessions.filter((s: any) => s.status === 'completed').length,
    });
  }

  const dailyBreakdown = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, stats]) => ({ date, ...stats }));

  return {
    totalSessions: rangeSessions.length,
    completed,
    abandoned,
    pending,
    completionRate: rangeSessions.length > 0 ? completed / rangeSessions.length : 0,
    dailyBreakdown,
  };
}

// ─── Streak Calculations ────────────────────────────────────────

export interface StreakResult {
  moduleId: string;
  label: string;
  currentStreak: number;
  bestStreak: number;
  streakDates: string[];
}

/**
 * For each checkbox/streak module, compute consecutive day streaks.
 */
export async function getStreaks(db: DB): Promise<StreakResult[]> {
  const specs = await db.select().from(moduleSpecs);
  const streakSpecs = specs.filter(
    (s: any) => (s.type === 'checkbox' || s.type === 'streak_counter') && !s.archivedAt,
  );
  if (streakSpecs.length === 0) return [];
  // Collect all source module IDs we need values for
  const sourceIds = streakSpecs.map((s: any) => {
    const config = JSON.parse(s.config || '{}');
    return s.type === 'streak_counter' ? config.sourceModuleId : s.id;
  }).filter(Boolean);
  const allValues = sourceIds.length > 0
    ? await db.select().from(moduleValues).where(inArray(moduleValues.moduleId, sourceIds))
    : [];

  return streakSpecs.map((spec: any) => {
    // For streak_counter, look at the source module's values
    const config = JSON.parse(spec.config || '{}');
    const targetModuleId = spec.type === 'streak_counter' ? config.sourceModuleId : spec.id;

    const vals = allValues
      .filter((v: any) => v.moduleId === targetModuleId)
      .filter((v: any) => {
        try {
          const parsed = JSON.parse(v.value);
          return parsed === true || parsed === 'true' || parsed === 1 || (typeof parsed === 'number' && parsed > 0);
        } catch {
          return v.value === 'true' || v.value === '1';
        }
      })
      .map((v: any) => v.date)
      .sort();

    const uniqueDates = [...new Set(vals)] as string[];

    // Compute streaks
    let currentStreak = 0;
    let bestStreak = 0;
    let tempStreak = 0;
    const streakDates: string[] = [];
    const today = new Date().toISOString().slice(0, 10);

    for (let i = 0; i < uniqueDates.length; i++) {
      if (i === 0) {
        tempStreak = 1;
      } else {
        const prev = new Date(uniqueDates[i - 1] + 'T12:00:00');
        const curr = new Date(uniqueDates[i] + 'T12:00:00');
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
        tempStreak = diffDays === 1 ? tempStreak + 1 : 1;
      }
      bestStreak = Math.max(bestStreak, tempStreak);
    }

    // Current streak: count backwards from today or yesterday
    const todayIdx = uniqueDates.indexOf(today);
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().slice(0, 10);
    const yesterdayIdx = uniqueDates.indexOf(yesterdayStr);
    
    // Start from today if logged, otherwise try yesterday (streak is still alive)
    const startFrom = todayIdx >= 0 ? todayIdx : yesterdayIdx;
    
    if (startFrom >= 0) {
      currentStreak = 1;
      streakDates.push(uniqueDates[startFrom]);
      for (let i = startFrom - 1; i >= 0; i--) {
        const prev = new Date(uniqueDates[i] + 'T12:00:00');
        const curr = new Date(uniqueDates[i + 1] + 'T12:00:00');
        const diffDays = Math.round((curr.getTime() - prev.getTime()) / 86400000);
        if (diffDays === 1) {
          currentStreak++;
          streakDates.unshift(uniqueDates[i]);
        } else {
          break;
        }
      }
    }

    return {
      moduleId: spec.id,
      label: spec.label,
      currentStreak,
      bestStreak,
      streakDates,
    };
  });
}

// ─── Must-Do Completion Stats ───────────────────────────────────

export interface MustDoStats {
  totalItems: number;
  completedItems: number;
  completionRate: number;
  dailyRates: Array<{ date: string; total: number; done: number; rate: number }>;
}

export async function getMustDoStats(
  db: DB,
  startDate: string,
  endDate: string,
): Promise<MustDoStats> {
  const rangePlans = await db.select().from(dayPlans).where(
    and(gte(dayPlans.date, startDate), lte(dayPlans.date, endDate)),
  );
  rangePlans.sort((a: any, b: any) => a.date.localeCompare(b.date));

  let totalItems = 0;
  let completedItems = 0;
  const dailyRates: Array<{ date: string; total: number; done: number; rate: number }> = [];

  for (const dp of rangePlans) {
    const mustDo: string[] = JSON.parse(dp.mustDo || '[]');
    const mustDoDone: boolean[] = JSON.parse(dp.mustDoDone || '[]');
    const total = mustDo.length;
    const done = mustDoDone.filter(Boolean).length;
    totalItems += total;
    completedItems += done;
    dailyRates.push({
      date: dp.date,
      total,
      done,
      rate: total > 0 ? done / total : 0,
    });
  }

  return {
    totalItems,
    completedItems,
    completionRate: totalItems > 0 ? completedItems / totalItems : 0,
    dailyRates,
  };
}

// ─── Weekly Aggregate ───────────────────────────────────────────

export interface WeeklyAggregate {
  weekId: string;
  startDate: string;
  endDate: string;
  sessionStats: SessionCompletionStats;
  mustDoStats: MustDoStats;
  checkboxCompliance: ComplianceResult[];
  ratingTrends: RatingTrend[];
  dataInputStats: DataInputStats[];
  streaks: StreakResult[];
  quietDays: number;
}

export async function getWeeklyAggregate(
  db: DB,
  startDate: string,
  endDate: string,
  previousStartDate?: string,
  previousEndDate?: string,
): Promise<WeeklyAggregate> {
  const [sessionStats, mustDoStats, checkboxCompliance, ratingTrends, dataInputStats, streaks] =
    await Promise.all([
      getSessionCompletionStats(db, startDate, endDate),
      getMustDoStats(db, startDate, endDate),
      getCheckboxCompliance(db, startDate, endDate),
      getRatingTrends(db, startDate, endDate, previousStartDate, previousEndDate),
      getDataInputStats(db, startDate, endDate),
      getStreaks(db),
    ]);

  // Count quiet days
  const rangeDayPlans = await db.select().from(dayPlans).where(
    and(gte(dayPlans.date, startDate), lte(dayPlans.date, endDate)),
  );
  const quietDays = rangeDayPlans.filter(
    (d: any) => d.status === 'quiet',
  ).length;

  // Derive weekId from startDate
  const d = new Date(startDate + 'T12:00:00');
  const year = d.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const weekNum = Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
  const weekId = `${year}-W${String(weekNum).padStart(2, '0')}`;

  return {
    weekId,
    startDate,
    endDate,
    sessionStats,
    mustDoStats,
    checkboxCompliance,
    ratingTrends,
    dataInputStats,
    streaks,
    quietDays,
  };
}

// ─── Plan Progress ──────────────────────────────────────────────

export interface PlanProgressStats {
  planName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  completedDays: number;
  missedDays: number;
  quietDays: number;
  remainingDays: number;
  progressPercent: number;
  sessionStats: SessionCompletionStats;
  mustDoStats: MustDoStats;
  heatmapData: Array<{ date: string; level: 0 | 1 | 2 | 3 | 4 }>;
}

export async function getPlanProgress(db: DB): Promise<PlanProgressStats | null> {
  // Get most recent plan directly (avoids circular import of queries.ts)
  const plansList = await db.select().from(plans).orderBy(desc(plans.importedAt));
  const plan = plansList[0] ?? null;
  if (!plan) return null;

  const planDays = await db.select().from(dayPlans).where(eq(dayPlans.planId, plan.id));
  planDays.sort((a: any, b: any) => a.date.localeCompare(b.date));
  if (planDays.length === 0) return null;

  const today = new Date().toISOString().slice(0, 10);
  const completedDays = planDays.filter((d: any) => d.status === 'completed').length;
  const missedDays = planDays.filter((d: any) => d.status === 'missed').length;
  const quietDays = planDays.filter((d: any) => d.status === 'quiet').length;
  const pastDays = planDays.filter((d: any) => d.date <= today).length;
  const remainingDays = Math.max(0, plan.totalDays - pastDays);

  const [sessionStats, mustDoStats] = await Promise.all([
    getSessionCompletionStats(db, plan.startDate, plan.endDate),
    getMustDoStats(db, plan.startDate, plan.endDate),
  ]);

  // Build heatmap: 0=no data, 1=poor, 2=partial, 3=good, 4=complete
  const heatmapData = planDays.map((d: any) => {
    const mustDoDone: boolean[] = JSON.parse(d.mustDoDone || '[]');
    const mustDo: string[] = JSON.parse(d.mustDo || '[]');
    const doneCount = mustDoDone.filter(Boolean).length;
    const total = mustDo.length;

    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (d.status === 'quiet') level = 0;
    else if (d.date > today) level = 0;
    else if (total === 0) level = 0;
    else if (doneCount === total) level = 4;
    else if (doneCount >= total * 0.75) level = 3;
    else if (doneCount >= total * 0.25) level = 2;
    else if (doneCount > 0) level = 1;
    else level = 0; // 0/N done = missed day, distinct from partial

    return { date: d.date, level };
  });

  return {
    planName: plan.name,
    startDate: plan.startDate,
    endDate: plan.endDate,
    totalDays: plan.totalDays,
    completedDays,
    missedDays,
    quietDays,
    remainingDays,
    progressPercent: plan.totalDays > 0 ? pastDays / plan.totalDays : 0,
    sessionStats,
    mustDoStats,
    heatmapData,
  };
}

// ─── Correlation Engine ─────────────────────────────────────────

export interface CorrelationResult {
  moduleA: { id: string; label: string };
  moduleB: { id: string; label: string };
  correlation: number; // -1 to 1
  summary: string; // hard-coded template string
  windowDays: number;
}

/**
 * Correlate two modules over a 30-day window.
 * ModuleA → uses ModuleValue data (e.g. Sleep Score, rating)
 * ModuleB → uses Session duration (total minutes) linked to that module's routine
 *
 * Returns a hard-coded template string describing the relationship.
 * Zero AI/NLP — purely logical templates.
 */
export async function getCorrelation(
  db: DB,
  moduleAId: string,
  moduleBId: string,
  windowDays: number = 30,
): Promise<CorrelationResult | null> {
  const specA = (await db.select().from(moduleSpecs).where(eq(moduleSpecs.id, moduleAId)))[0];
  const specB = (await db.select().from(moduleSpecs).where(eq(moduleSpecs.id, moduleBId)))[0];
  if (!specA || !specB) return null;

  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - windowDays);
  const startStr = startDate.toISOString().slice(0, 10);
  const endStr = today.toISOString().slice(0, 10);
  const dates = getDatesInRange(startStr, endStr);

  // Module A: collect daily values (numeric)
  const aValues = await db.select().from(moduleValues).where(
    and(
      eq(moduleValues.moduleId, moduleAId),
      gte(moduleValues.date, startStr),
      lte(moduleValues.date, endStr),
    ),
  );
  const aByDate = new Map<string, number>();
  for (const v of aValues) {
    const num = parseFloat(v.value);
    if (!isNaN(num)) aByDate.set(v.date, num);
  }

  // Module B: collect daily session duration (minutes)
  const allDayPlans = await db.select().from(dayPlans).where(
    and(gte(dayPlans.date, startStr), lte(dayPlans.date, endStr)),
  );
  const dayPlanIds = allDayPlans.map((d: any) => d.id);
  const dayPlanDateMap = new Map<string, string>();
  for (const d of allDayPlans) dayPlanDateMap.set(d.id, d.date);

  const bSessions = dayPlanIds.length > 0
    ? await db.select().from(sessions).where(
        and(
          inArray(sessions.dayPlanId, dayPlanIds),
          eq(sessions.routineId, moduleBId),
        ),
      )
    : [];

  const bByDate = new Map<string, number>();
  for (const s of bSessions) {
    if (s.startedAt && s.endedAt) {
      const date = dayPlanDateMap.get(s.dayPlanId);
      if (!date) continue;
      const durationMin = (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime() - (s.totalPausedMs || 0)) / 60000;
      bByDate.set(date, (bByDate.get(date) ?? 0) + durationMin);
    }
  }

  // Build paired data points
  const pairedA: number[] = [];
  const pairedB: number[] = [];
  for (const date of dates) {
    if (aByDate.has(date) && bByDate.has(date)) {
      pairedA.push(aByDate.get(date)!);
      pairedB.push(bByDate.get(date)!);
    }
  }

  if (pairedA.length < 5) {
    return {
      moduleA: { id: specA.id, label: specA.label },
      moduleB: { id: specB.id, label: specB.label },
      correlation: 0,
      summary: `Not enough overlapping data between "${specA.label}" and "${specB.label}" (need at least 5 days, have ${pairedA.length}).`,
      windowDays,
    };
  }

  // Pearson correlation coefficient
  const n = pairedA.length;
  const meanA = pairedA.reduce((s, v) => s + v, 0) / n;
  const meanB = pairedB.reduce((s, v) => s + v, 0) / n;
  let sumAB = 0, sumA2 = 0, sumB2 = 0;
  for (let i = 0; i < n; i++) {
    const da = pairedA[i] - meanA;
    const db_ = pairedB[i] - meanB;
    sumAB += da * db_;
    sumA2 += da * da;
    sumB2 += db_ * db_;
  }
  const denom = Math.sqrt(sumA2 * sumB2);
  const r = denom === 0 ? 0 : sumAB / denom;

  // Weekly aggregation for template string
  const weeklyA: number[] = [];
  const weeklyB: number[] = [];
  for (let i = 0; i < pairedA.length; i += 7) {
    const sliceA = pairedA.slice(i, i + 7);
    const sliceB = pairedB.slice(i, i + 7);
    weeklyA.push(sliceA.reduce((s, v) => s + v, 0) / sliceA.length);
    weeklyB.push(sliceB.reduce((s, v) => s + v, 0));
  }

  const medianB = [...weeklyB].sort((a, b) => a - b)[Math.floor(weeklyB.length / 2)] ?? 0;
  const highWeeks = weeklyA.filter((_, i) => weeklyB[i] > medianB);
  const lowWeeks = weeklyA.filter((_, i) => weeklyB[i] <= medianB);
  const highAvg = highWeeks.length > 0 ? highWeeks.reduce((s, v) => s + v, 0) / highWeeks.length : 0;
  const lowAvg = lowWeeks.length > 0 ? lowWeeks.reduce((s, v) => s + v, 0) / lowWeeks.length : 0;
  const pctChange = lowAvg !== 0 ? Math.round(((highAvg - lowAvg) / Math.abs(lowAvg)) * 100) : 0;

  const bTotalHrs = Math.round(medianB / 60);
  const direction = pctChange >= 0 ? 'increased' : 'decreased';

  const summary = Math.abs(r) < 0.2
    ? `No meaningful correlation found between "${specA.label}" and "${specB.label}" over ${windowDays} days.`
    : `On weeks where ${specB.label} > ${bTotalHrs}h, ${specA.label} ${direction} by ${Math.abs(pctChange)}%.`;

  return {
    moduleA: { id: specA.id, label: specA.label },
    moduleB: { id: specB.id, label: specB.label },
    correlation: Math.round(r * 100) / 100,
    summary,
    windowDays,
  };
}
