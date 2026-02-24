import { eq, and, desc, asc, gte, lte, inArray, sql } from 'drizzle-orm';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import type { ParsedCSVRow } from '../csv/parser';
import {
  collections,
  routines,
  routineBlocks,
  plans,
  dayPlans,
  moduleSpecs,
  moduleValues,
  sessions,
  eventLog,
  homescreenLayout,
} from './schema';

// We use `any` for the db type to support both expo-sqlite and better-sqlite3 drivers
type DB = any;

// ─── Helper ─────────────────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

// ─── Routines ───────────────────────────────────────────────────

export async function getRoutines(db: DB) {
  return db.select().from(routines).orderBy(asc(routines.name));
}

export async function getRoutine(db: DB, id: string) {
  const rows = await db.select().from(routines).where(eq(routines.id, id));
  return rows[0] ?? null;
}

export async function createRoutine(
  db: DB,
  data: { name: string; description?: string; totalDurationMinutes: number },
) {
  const id = generateId();
  const now = nowISO();
  await db.insert(routines).values({ id, ...data, createdAt: now, updatedAt: now });
  return id;
}

export async function updateRoutine(db: DB, id: string, data: Partial<{ name: string; description: string; totalDurationMinutes: number }>) {
  await db.update(routines).set({ ...data, updatedAt: nowISO() }).where(eq(routines.id, id));
}

export async function deleteRoutine(db: DB, id: string) {
  // Clean up routine blocks first
  await db.delete(routineBlocks).where(eq(routineBlocks.routineId, id));
  await db.delete(routines).where(eq(routines.id, id));
}

// ─── Routine Blocks ─────────────────────────────────────────────

export async function getRoutineBlocks(db: DB, routineId: string) {
  return db.select().from(routineBlocks).where(eq(routineBlocks.routineId, routineId)).orderBy(asc(routineBlocks.order));
}

export async function createRoutineBlock(
  db: DB,
  data: { routineId: string; name: string; durationMinutes: number; type: string; order: number; moduleIds?: string[] },
) {
  const id = generateId();
  await db.insert(routineBlocks).values({
    id,
    ...data,
    moduleIds: data.moduleIds ? JSON.stringify(data.moduleIds) : null,
  });
  return id;
}

export async function updateRoutineBlock(
  db: DB,
  id: string,
  data: Partial<{ name: string; durationMinutes: number; type: string; order: number; moduleIds: string[] }>,
) {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.order !== undefined) updateData.order = data.order;
  if (data.moduleIds !== undefined) updateData.moduleIds = JSON.stringify(data.moduleIds);
  await db.update(routineBlocks).set(updateData).where(eq(routineBlocks.id, id));
}

export async function deleteRoutineBlock(db: DB, id: string) {
  await db.delete(routineBlocks).where(eq(routineBlocks.id, id));
}

// ─── Plans ──────────────────────────────────────────────────────

export async function getPlans(db: DB) {
  return db.select().from(plans).orderBy(desc(plans.importedAt));
}

export async function createPlan(
  db: DB,
  data: { name: string; startDate: string; endDate: string; totalDays: number; sourceFile?: string },
) {
  const id = generateId();
  await db.insert(plans).values({ id, ...data, importedAt: nowISO() });
  return id;
}

// ─── Day Plans ──────────────────────────────────────────────────

export async function getDayPlan(db: DB, date: string) {
  const rows = await db.select().from(dayPlans).where(eq(dayPlans.date, date));
  const row = rows[0];
  if (!row) return null;
  return {
    ...row,
    mustDo: JSON.parse(row.mustDo),
    mustDoDone: JSON.parse(row.mustDoDone),
    moduleIds: JSON.parse(row.moduleIds),
  };
}

export async function getDayPlansInRange(db: DB, startDate: string, endDate: string) {
  const rows = await db
    .select()
    .from(dayPlans)
    .where(and(
      gte(dayPlans.date, startDate),
      lte(dayPlans.date, endDate),
    ))
    .orderBy(asc(dayPlans.date));

  return rows.map((row: any) => ({
    ...row,
    mustDo: JSON.parse(row.mustDo),
    mustDoDone: JSON.parse(row.mustDoDone),
    moduleIds: JSON.parse(row.moduleIds),
  }));
}

export async function upsertDayPlan(
  db: DB,
  data: {
    date: string;
    title: string;
    planId?: string;
    dayNumber?: number;
    totalDays?: number;
    status?: string;
    mustDo?: string[];
    mustDoDone?: boolean[];
    moduleIds?: string[];
    notes?: string;
  },
) {
  const existing = await getDayPlan(db, data.date);
  const now = nowISO();

  if (existing) {
    // Only update plan fields, never overwrite logged values (mustDoDone)
    await db
      .update(dayPlans)
      .set({
        title: data.title,
        planId: data.planId ?? existing.planId,
        dayNumber: data.dayNumber ?? existing.dayNumber,
        totalDays: data.totalDays ?? existing.totalDays,
        mustDo: data.mustDo ? JSON.stringify(data.mustDo) : existing.mustDo,
        moduleIds: data.moduleIds ? JSON.stringify(data.moduleIds) : JSON.stringify(existing.moduleIds),
        updatedAt: now,
      })
      .where(eq(dayPlans.id, existing.id));
    return existing.id;
  } else {
    const id = generateId();
    await db.insert(dayPlans).values({
      id,
      planId: data.planId ?? null,
      date: data.date,
      title: data.title,
      dayNumber: data.dayNumber ?? null,
      totalDays: data.totalDays ?? null,
      status: data.status ?? 'planned',
      mustDo: JSON.stringify(data.mustDo ?? []),
      mustDoDone: JSON.stringify(data.mustDoDone ?? []),
      moduleIds: JSON.stringify(data.moduleIds ?? []),
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }
}

export async function updateMustDoDone(db: DB, dayPlanId: string, mustDoDone: boolean[]) {
  await db
    .update(dayPlans)
    .set({ mustDoDone: JSON.stringify(mustDoDone), updatedAt: nowISO() })
    .where(eq(dayPlans.id, dayPlanId));
}

export async function updateDayPlanStatus(db: DB, dayPlanId: string, status: string) {
  await db
    .update(dayPlans)
    .set({ status, updatedAt: nowISO() })
    .where(eq(dayPlans.id, dayPlanId));
}

export async function importDayPlans(
  db: DB,
  planId: string,
  days: Array<{
    date: string;
    title: string;
    dayNumber: number;
    totalDays: number;
    mustDo: string[];
    moduleIds: string[];
    status?: string;
  }>,
) {
  for (const day of days) {
    await upsertDayPlan(db, { ...day, planId });
  }
}

// ─── Module Specs ───────────────────────────────────────────────

export async function getModuleSpecs(db: DB) {
  const rows = await db.select().from(moduleSpecs).orderBy(asc(moduleSpecs.label));
  return rows.map((r: any) => ({
    ...r,
    config: JSON.parse(r.config),
    placements: JSON.parse(r.placements),
    metadata: JSON.parse(r.metadata || '{}'),
  }));
}

export async function getModuleSpec(db: DB, id: string) {
  const rows = await db.select().from(moduleSpecs).where(eq(moduleSpecs.id, id));
  const r = rows[0];
  if (!r) return null;
  return {
    ...r,
    config: JSON.parse(r.config),
    placements: JSON.parse(r.placements),
    metadata: JSON.parse(r.metadata || '{}'),
  };
}

export async function createModuleSpec(
  db: DB,
  data: {
    id: string;
    type: string;
    label: string;
    emoji?: string;
    config: Record<string, unknown>;
    placements: string[];
    isLive: boolean;
    required: boolean;
    showInSummary?: boolean;
    collectionId?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  const now = nowISO();
  await db.insert(moduleSpecs).values({
    ...data,
    config: JSON.stringify(data.config),
    placements: JSON.stringify(data.placements),
    collectionId: data.collectionId ?? null,
    metadata: JSON.stringify(data.metadata ?? {}),
    createdAt: now,
    updatedAt: now,
  });
  return data.id;
}

export async function updateModuleSpec(
  db: DB,
  id: string,
  data: Partial<{
    label: string;
    emoji: string;
    config: Record<string, unknown>;
    placements: string[];
    isLive: boolean;
    required: boolean;
    showInSummary: boolean;
    collectionId: string | null;
    metadata: Record<string, unknown>;
    archivedAt: string | null;
  }>,
) {
  const updateData: Record<string, unknown> = { updatedAt: nowISO() };
  if (data.label !== undefined) updateData.label = data.label;
  if (data.emoji !== undefined) updateData.emoji = data.emoji;
  if (data.config !== undefined) updateData.config = JSON.stringify(data.config);
  if (data.placements !== undefined) updateData.placements = JSON.stringify(data.placements);
  if (data.isLive !== undefined) updateData.isLive = data.isLive;
  if (data.required !== undefined) updateData.required = data.required;
  if (data.showInSummary !== undefined) updateData.showInSummary = data.showInSummary;
  if (data.collectionId !== undefined) updateData.collectionId = data.collectionId;
  if (data.metadata !== undefined) updateData.metadata = JSON.stringify(data.metadata);
  if (data.archivedAt !== undefined) updateData.archivedAt = data.archivedAt;

  await db.update(moduleSpecs).set(updateData).where(eq(moduleSpecs.id, id));
}

export async function deleteModuleSpec(db: DB, id: string) {
  // Clean up foreign-key dependents first
  await db.delete(moduleValues).where(eq(moduleValues.moduleId, id));
  await db.delete(homescreenLayout).where(eq(homescreenLayout.moduleId, id));
  await db.delete(moduleSpecs).where(eq(moduleSpecs.id, id));
}

// ─── Module Values ──────────────────────────────────────────────

export async function getModuleValuesForDate(db: DB, date: string) {
  return db.select().from(moduleValues).where(eq(moduleValues.date, date));
}

export async function getModuleValue(db: DB, moduleId: string, date: string) {
  const rows = await db
    .select()
    .from(moduleValues)
    .where(and(eq(moduleValues.moduleId, moduleId), eq(moduleValues.date, date)));
  return rows[0] ?? null;
}

export async function upsertModuleValue(
  db: DB,
  data: { moduleId: string; date: string; value: string; sessionId?: string },
) {
  const existing = await getModuleValue(db, data.moduleId, data.date);
  const now = nowISO();

  if (existing) {
    await db
      .update(moduleValues)
      .set({ value: data.value, loggedAt: now, sessionId: data.sessionId ?? existing.sessionId })
      .where(eq(moduleValues.id, existing.id));
    return existing.id;
  } else {
    const id = generateId();
    await db.insert(moduleValues).values({
      id,
      moduleId: data.moduleId,
      date: data.date,
      value: data.value,
      loggedAt: now,
      sessionId: data.sessionId ?? null,
    });
    return id;
  }
}

// ─── Sessions ───────────────────────────────────────────────────

export async function getSessions(db: DB, dayPlanId: string) {
  return db.select().from(sessions).where(eq(sessions.dayPlanId, dayPlanId)).orderBy(asc(sessions.createdAt));
}

export async function getSession(db: DB, id: string) {
  const rows = await db.select().from(sessions).where(eq(sessions.id, id));
  return rows[0] ?? null;
}

export async function createSession(
  db: DB,
  data: { dayPlanId: string; routineId: string; routineName: string; scheduledTime?: string; moduleId?: string; tags?: string[] },
) {
  const id = generateId();
  const now = nowISO();
  await db.insert(sessions).values({
    id,
    dayPlanId: data.dayPlanId,
    routineId: data.routineId,
    routineName: data.routineName,
    moduleId: data.moduleId ?? null,
    scheduledTime: data.scheduledTime ?? null,
    status: 'pending',
    totalPausedMs: 0,
    currentBlockIndex: 0,
    tags: JSON.stringify(data.tags ?? []),
    photos: JSON.stringify([]),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateSession(
  db: DB,
  id: string,
  data: Partial<{
    status: string;
    scheduledTime: string;
    startedAt: string;
    endedAt: string | null;
    totalPausedMs: number;
    currentBlockIndex: number;
    routineId: string;
    routineName: string;
    moduleId: string;
    tags: string[];
    photos: string[];
    notes: string;
  }>,
) {
  const updateData: Record<string, unknown> = { updatedAt: nowISO() };
  if (data.status !== undefined) updateData.status = data.status;
  if (data.scheduledTime !== undefined) updateData.scheduledTime = data.scheduledTime;
  if (data.startedAt !== undefined) updateData.startedAt = data.startedAt;
  if ('endedAt' in data) updateData.endedAt = data.endedAt;
  if (data.totalPausedMs !== undefined) updateData.totalPausedMs = data.totalPausedMs;
  if (data.currentBlockIndex !== undefined) updateData.currentBlockIndex = data.currentBlockIndex;
  if (data.routineId !== undefined) updateData.routineId = data.routineId;
  if (data.routineName !== undefined) updateData.routineName = data.routineName;
  if (data.moduleId !== undefined) updateData.moduleId = data.moduleId;
  if (data.tags !== undefined) updateData.tags = JSON.stringify(data.tags);
  if (data.photos !== undefined) updateData.photos = JSON.stringify(data.photos);
  if (data.notes !== undefined) updateData.notes = data.notes;
  await db.update(sessions).set(updateData).where(eq(sessions.id, id));
}

export async function deleteSession(db: DB, id: string) {
  // Delete event log entries first (foreign key)
  await db.delete(eventLog).where(eq(eventLog.sessionId, id));
  await db.delete(sessions).where(eq(sessions.id, id));
}

// ─── Event Log ──────────────────────────────────────────────────

export async function getSessionEvents(db: DB, sessionId: string) {
  return db.select().from(eventLog).where(eq(eventLog.sessionId, sessionId)).orderBy(asc(eventLog.timestamp));
}

export async function createSessionEvent(
  db: DB,
  data: { sessionId: string; type: string; blockIndex?: number; data?: Record<string, unknown> },
) {
  const id = generateId();
  await db.insert(eventLog).values({
    id,
    sessionId: data.sessionId,
    type: data.type,
    timestamp: nowISO(),
    blockIndex: data.blockIndex ?? null,
    data: data.data ? JSON.stringify(data.data) : null,
  });
  return id;
}

// ─── Homescreen Layout ──────────────────────────────────────────

export async function getHomescreenLayout(db: DB) {
  return db.select().from(homescreenLayout).orderBy(asc(homescreenLayout.zone), asc(homescreenLayout.order));
}

export async function setHomescreenLayout(
  db: DB,
  items: Array<{ moduleId: string; zone: number; order: number; width?: number }>,
) {
  // Replace all layout entries
  await db.delete(homescreenLayout);
  for (const item of items) {
    const id = generateId();
    await db.insert(homescreenLayout).values({ id, moduleId: item.moduleId, zone: item.zone, order: item.order, width: item.width ?? 1 });
  }
}

// ─── CSV Import ─────────────────────────────────────────────────

/**
 * Import a full plan from parsed CSV rows.
 * - Creates a plan record
 * - Upserts dayPlans (plan fields only — never overwrites logged values like mustDoDone)
 * - Creates pending session records for each session in the CSV
 * - Creates missing routines as stubs
 * - Sets module targets
 */
export async function importPlan(
  db: DB,
  opts: {
    planName: string;
    sourceFile?: string;
    rows: ParsedCSVRow[];
  },
): Promise<{ planId: string; daysImported: number; routinesCreated: string[]; sessionsCreated: number }> {
  const { planName, sourceFile, rows } = opts;
  if (rows.length === 0) throw new Error('No rows to import');

  const sortedRows = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const startDate = sortedRows[0].date;
  const endDate = sortedRows[sortedRows.length - 1].date;
  const totalDays = sortedRows.length;

  // 1. Create the plan record
  const planId = await createPlan(db, {
    name: planName,
    startDate,
    endDate,
    totalDays,
    sourceFile,
  });

  // 2. Resolve routines — create stubs for any unknown routines
  const existingRoutines = await getRoutines(db);
  const existingRoutineNames = new Map(existingRoutines.map((r: any) => [r.name.toLowerCase(), r.id]));
  const routinesCreated: string[] = [];

  const routineNameToId = new Map<string, string>();

  for (const row of sortedRows) {
    for (const session of row.sessions) {
      const normalized = session.routine.toLowerCase();
      if (routineNameToId.has(normalized)) continue;

      if (existingRoutineNames.has(normalized)) {
        routineNameToId.set(normalized, existingRoutineNames.get(normalized) as string);
      } else {
        // Create stub routine
        const routineId = await createRoutine(db, {
          name: session.routine,
          totalDurationMinutes: session.durationMinutes,
        });
        routineNameToId.set(normalized, routineId);
        routinesCreated.push(session.routine);
      }
    }
  }

  // 3. Upsert day plans + create sessions
  let sessionsCreated = 0;

  for (let i = 0; i < sortedRows.length; i++) {
    const row = sortedRows[i];
    const dayNumber = i + 1;

    // Collect module IDs from targets + required
    const moduleIds = [
      ...Object.keys(row.targets),
      ...row.required.filter(id => !Object.keys(row.targets).includes(id)),
    ];

    const dayPlanId = await upsertDayPlan(db, {
      date: row.date,
      title: row.title,
      planId,
      dayNumber,
      totalDays,
      status: row.quiet ? 'quiet' : 'planned',
      mustDo: row.mustDo,
      moduleIds,
    });

    // Create sessions for this day
    for (const session of row.sessions) {
      const routineId = routineNameToId.get(session.routine.toLowerCase())!;
      await createSession(db, {
        dayPlanId,
        routineId,
        routineName: session.label ?? session.routine,
      });
      sessionsCreated++;
    }

    // Set module targets — store as a separate "target" value for the same module on this date
    for (const [moduleId, target] of Object.entries(row.targets)) {
      // Ensure the module spec exists before storing a target value
      const existingSpec = await getModuleSpec(db, moduleId);
      if (existingSpec) {
        await upsertModuleValue(db, {
          moduleId,
          date: row.date,
          value: `target:${String(target)}`,
          sessionId: undefined,
        });
      }
    }
  }

  return { planId, daysImported: sortedRows.length, routinesCreated, sessionsCreated };
}

// ─── Query Helpers for Plan/Week views ──────────────────────────

export async function getActivePlan(db: DB) {
  const plansList = await getPlans(db);
  return plansList[0] ?? null; // most recently imported plan
}

export async function getWeekDayPlans(db: DB, startDate: string, endDate: string) {
  return getDayPlansInRange(db, startDate, endDate);
}

export async function getSessionsForDay(db: DB, dayPlanId: string) {
  return getSessions(db, dayPlanId);
}

export async function getSessionCountsByDayPlanIds(db: DB, dayPlanIds: string[]): Promise<Record<string, number>> {
  if (dayPlanIds.length === 0) return {};
  const rows = await db
    .select({
      dayPlanId: sessions.dayPlanId,
      count: sql<number>`count(*)`,
    })
    .from(sessions)
    .where(inArray(sessions.dayPlanId, dayPlanIds))
    .groupBy(sessions.dayPlanId);

  const result: Record<string, number> = {};
  for (const row of rows) {
    result[row.dayPlanId] = row.count;
  }
  return result;
}

// ─── Collections ────────────────────────────────────────────────

export async function getCollections(db: DB, parentId?: string | null) {
  if (parentId === undefined) {
    return db.select().from(collections).orderBy(asc(collections.name));
  }
  if (parentId === null) {
    // Root-level collections (no parent)
    const all = await db.select().from(collections).orderBy(asc(collections.name));
    return all.filter((c: any) => !c.parentId);
  }
  return db.select().from(collections).where(eq(collections.parentId, parentId)).orderBy(asc(collections.name));
}

export async function getCollection(db: DB, id: string) {
  const rows = await db.select().from(collections).where(eq(collections.id, id));
  return rows[0] ?? null;
}

export async function createCollection(
  db: DB,
  data: { name: string; emoji?: string; parentId?: string | null; type?: 'module' | 'routine' },
) {
  const id = generateId();
  const now = nowISO();
  await db.insert(collections).values({
    id,
    name: data.name,
    emoji: data.emoji ?? null,
    parentId: data.parentId ?? null,
    type: data.type ?? 'module',
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

export async function updateCollection(
  db: DB,
  id: string,
  data: Partial<{ name: string; emoji: string; parentId: string | null; type: 'module' | 'routine' }>,
) {
  await db.update(collections).set({ ...data, updatedAt: nowISO() }).where(eq(collections.id, id));
}

export async function deleteCollection(db: DB, id: string) {
  // Unlink modules in this collection
  await db.update(moduleSpecs).set({ collectionId: null }).where(eq(moduleSpecs.collectionId, id));
  // Unlink routines in this collection
  await db.update(routines).set({ collectionId: null }).where(eq(routines.collectionId, id));
  // Re-parent child collections to root
  await db.update(collections).set({ parentId: null }).where(eq(collections.parentId, id));
  await db.delete(collections).where(eq(collections.id, id));
}

// ─── Timer Module Session Creation ──────────────────────────────

/**
 * When a timer module finishes, auto-insert a session record linked to the moduleId.
 */
export async function createTimerSession(
  db: DB,
  data: {
    dayPlanId: string;
    moduleId: string;
    moduleName: string;
    durationMs: number;
    tags?: string[];
  },
) {
  const id = generateId();
  const now = nowISO();
  const startedAt = new Date(Date.now() - data.durationMs).toISOString();
  await db.insert(sessions).values({
    id,
    dayPlanId: data.dayPlanId,
    routineId: data.moduleId, // reuse routineId field for the module reference
    routineName: data.moduleName,
    moduleId: data.moduleId,
    status: 'completed',
    startedAt,
    endedAt: now,
    totalPausedMs: 0,
    currentBlockIndex: 0,
    tags: JSON.stringify(data.tags ?? []),
    photos: JSON.stringify([]),
    createdAt: now,
    updatedAt: now,
  });
  return id;
}

// ─── Session Photos ─────────────────────────────────────────────

export async function addSessionPhoto(db: DB, sessionId: string, photoUri: string) {
  const session = await getSession(db, sessionId);
  if (!session) return;
  const photos: string[] = JSON.parse(session.photos || '[]');
  photos.push(photoUri);
  await db.update(sessions).set({ photos: JSON.stringify(photos), updatedAt: nowISO() }).where(eq(sessions.id, sessionId));
}

export async function getSessionPhotos(db: DB, moduleId?: string): Promise<Array<{ sessionId: string; uri: string; date: string }>> {
  let allSessions: any[];
  if (moduleId) {
    allSessions = await db.select().from(sessions).where(eq(sessions.moduleId, moduleId));
  } else {
    allSessions = await db.select().from(sessions);
  }
  const results: Array<{ sessionId: string; uri: string; date: string }> = [];
  for (const s of allSessions) {
    const photos: string[] = JSON.parse(s.photos || '[]');
    for (const uri of photos) {
      results.push({ sessionId: s.id, uri, date: s.startedAt ?? s.createdAt });
    }
  }
  return results;
}
