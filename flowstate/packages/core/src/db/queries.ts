import { eq, and, desc, asc, gte, lte, inArray, sql } from 'drizzle-orm';
import type { SqliteRemoteDatabase } from 'drizzle-orm/sqlite-proxy';
import type { ParsedCSVRow } from '../csv/parser';
import {
  collections,
  routines,
  routineBlocks,
  routineBlockSets,
  plans,
  dayPlans,
  moduleSpecs,
  moduleValues,
  sessions,
  eventLog,
  homescreenLayout,
  tasks,
  taskTags,
  taggedTimeLogs,
  sessionTags,
  sessionBlockTodos,
  sessionBlockInstructions,
  courses,
  courseComponents,
  csvPlans,
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
  data: {
    routineId: string; name: string; durationMinutes: number; type: string; order: number;
    moduleIds?: string[];
    // V2 optional fields
    todos?: string; blockMode?: string; goalTarget?: number | null; liftTag?: string | null;
    blockSetId?: string | null; condition?: string | null;
  },
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
  data: Partial<{
    name: string; durationMinutes: number; type: string; order: number; moduleIds: string[];
    // V2 fields
    todos: string; blockMode: string; goalTarget: number | null; liftTag: string | null;
    blockSetId: string | null; condition: string | null;
  }>,
) {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.durationMinutes !== undefined) updateData.durationMinutes = data.durationMinutes;
  if (data.type !== undefined) updateData.type = data.type;
  if (data.order !== undefined) updateData.order = data.order;
  if (data.moduleIds !== undefined) updateData.moduleIds = JSON.stringify(data.moduleIds);
  // V2 fields
  if (data.todos !== undefined) updateData.todos = data.todos;
  if (data.blockMode !== undefined) updateData.blockMode = data.blockMode;
  if ('goalTarget' in data) updateData.goalTarget = data.goalTarget;
  if ('liftTag' in data) updateData.liftTag = data.liftTag;
  if ('blockSetId' in data) updateData.blockSetId = data.blockSetId;
  if ('condition' in data) updateData.condition = data.condition;
  await db.update(routineBlocks).set(updateData).where(eq(routineBlocks.id, id));
}

export async function deleteRoutineBlock(db: DB, id: string) {
  await db.delete(routineBlocks).where(eq(routineBlocks.id, id));
}

// ─── Routine Block Sets (Feature 3 - Variable Block Sets) ────────

export async function getRoutineBlockSets(db: DB, routineId: string) {
  return db
    .select()
    .from(routineBlockSets)
    .where(eq(routineBlockSets.routineId, routineId))
    .orderBy(asc(routineBlockSets.name));
}

export async function createRoutineBlockSet(
  db: DB,
  routineId: string,
  name: string,
  isDefault = false,
): Promise<string> {
  const id = generateId();
  await db.insert(routineBlockSets).values({
    id,
    routineId,
    name,
    isDefault: isDefault ? 1 : 0,
  });
  return id;
}

export async function updateRoutineBlockSet(
  db: DB,
  id: string,
  data: Partial<{ name: string; isDefault: boolean }>,
) {
  const u: Record<string, unknown> = {};
  if (data.name !== undefined) u.name = data.name;
  if (data.isDefault !== undefined) u.isDefault = data.isDefault ? 1 : 0;
  await db.update(routineBlockSets).set(u).where(eq(routineBlockSets.id, id));
}

export async function deleteRoutineBlockSet(db: DB, id: string) {
  // Blocks in this set revert to "all sets" (blockSetId = null)
  await db.update(routineBlocks).set({ blockSetId: null }).where(eq(routineBlocks.blockSetId, id));
  await db.delete(routineBlockSets).where(eq(routineBlockSets.id, id));
}

/** Returns blocks for a specific set.
 *  setId = null  → return all blocks for the routine (used when no sets are defined or viewing "All").
 *  setId = string → blocks assigned to that set (blockSetId === setId) OR unassigned (blockSetId IS NULL). */
export async function getRoutineBlocksForSet(db: DB, routineId: string, setId: string | null) {
  if (setId === null) {
    return db
      .select()
      .from(routineBlocks)
      .where(eq(routineBlocks.routineId, routineId))
      .orderBy(asc(routineBlocks.order));
  }
  return db
    .select()
    .from(routineBlocks)
    .where(
      and(
        eq(routineBlocks.routineId, routineId),
        sql`(${routineBlocks.blockSetId} = ${setId} OR ${routineBlocks.blockSetId} IS NULL)`,
      ),
    )
    .orderBy(asc(routineBlocks.order));
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
  data: { dayPlanId?: string; routineId?: string; routineName: string; scheduledTime?: string; moduleId?: string; tags?: string[] },
) {
  const id = generateId();
  const now = nowISO();
  await db.insert(sessions).values({
    id,
    dayPlanId: data.dayPlanId ?? null,
    routineId: data.routineId ?? null,
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

// ─── Batch / Mass-Edit Operations (Feature 13) ───────────────────────────────

/**
 * Update multiple sessions with a partial data payload.
 * Used by MassEditSheet for bulk reschedule, mark-complete, tag, etc.
 */
export async function batchUpdateSessions(
  db: DB,
  ids: string[],
  updates: Partial<{
    status: string;
    scheduledDate: string;
    scheduledTime: string | null;
    pillar: string | null;
  }>,
): Promise<void> {
  if (ids.length === 0) return;
  const ts = nowISO();
  for (const id of ids) {
    await db.update(sessions)
      .set({ ...updates, updatedAt: ts })
      .where(eq(sessions.id, id));
  }
}

/**
 * Delete multiple sessions and their event log entries.
 */
export async function batchDeleteSessions(db: DB, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  for (const id of ids) {
    await db.delete(eventLog).where(eq(eventLog.sessionId, id));
    await db.delete(sessions).where(eq(sessions.id, id));
  }
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

// BUG-01: Rewritten to query moduleValues where PhotoLogCard actually stores photos.
// PhotoLogCard stores a comma-separated list of filenames in moduleValues.value.
// Pass photoBaseDir (e.g. FileSystem.documentDirectory + 'photos/') to get full URIs.
export async function getSessionPhotos(
  db: DB,
  moduleId?: string,
  photoBaseDir = '',
): Promise<Array<{ sessionId: string; uri: string; date: string }>> {
  // Determine which photo_log modules to query
  let photoModuleIds: string[];
  if (moduleId) {
    photoModuleIds = [moduleId];
  } else {
    const specs = await db
      .select({ id: moduleSpecs.id })
      .from(moduleSpecs)
      .where(eq(moduleSpecs.type, 'photo_log'));
    photoModuleIds = specs.map((s: any) => s.id);
  }

  if (photoModuleIds.length === 0) return [];

  const rows = await db
    .select()
    .from(moduleValues)
    .where(inArray(moduleValues.moduleId, photoModuleIds));

  const results: Array<{ sessionId: string; uri: string; date: string }> = [];
  for (const row of rows) {
    // value is a comma-separated list of filenames (set by PhotoLogCard)
    const filenames = (row.value || '').split(',').filter(Boolean);
    for (const filename of filenames) {
      const uri = photoBaseDir ? `${photoBaseDir}${filename}` : filename;
      results.push({
        sessionId: row.sessionId ?? row.id,
        uri,
        date: row.loggedAt,
      });
    }
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════
// V2 QUERIES — Tasks, Tagged Time Logs, Courses, CSV Plans
// ═══════════════════════════════════════════════════════════════

// ─── Tasks (Feature 12) ─────────────────────────────────────────

export async function getTasks(
  db: DB,
  opts?: { pillar?: string; completed?: boolean },
): Promise<any[]> {
  let query = db.select().from(tasks);
  const conditions = [];
  if (opts?.pillar) conditions.push(eq(tasks.pillar, opts.pillar));
  if (opts?.completed !== undefined) {
    conditions.push(eq(tasks.completed, opts.completed ? 1 : 0));
  }
  if (conditions.length > 0) {
    query = query.where(and(...conditions));
  }
  return query.orderBy(asc(tasks.priority), asc(tasks.dueDate));
}

export async function getTask(db: DB, id: string): Promise<any | undefined> {
  const rows = await db.select().from(tasks).where(eq(tasks.id, id));
  return rows[0];
}

export async function createTask(
  db: DB,
  data: {
    title: string;
    pillar?: string;
    category?: string;
    dueDate?: string;
    dueTime?: string;
    priority?: number;
    recurrence?: string;
    notes?: string;
    tags?: string[];
  },
): Promise<string> {
  const id = generateId();
  await db.insert(tasks).values({
    id,
    title: data.title,
    pillar: data.pillar ?? 'general',
    category: data.category ?? null,
    dueDate: data.dueDate ?? null,
    dueTime: data.dueTime ?? null,
    priority: data.priority ?? 2,
    completed: 0,
    recurrence: data.recurrence ?? null,
    notes: data.notes ?? null,
    createdAt: nowISO(),
  });
  if (data.tags && data.tags.length > 0) {
    for (const tag of data.tags) {
      await db.insert(taskTags).values({ id: generateId(), taskId: id, tag });
    }
  }
  return id;
}

export async function updateTask(
  db: DB,
  id: string,
  data: Partial<{
    title: string;
    pillar: string;
    category: string | null;
    dueDate: string | null;
    dueTime: string | null;
    priority: number;
    completed: boolean;
    recurrence: string | null;
    notes: string | null;
  }>,
): Promise<void> {
  const patch: Record<string, any> = {};
  if (data.title !== undefined) patch.title = data.title;
  if (data.pillar !== undefined) patch.pillar = data.pillar;
  if ('category' in data) patch.category = data.category;
  if ('dueDate' in data) patch.dueDate = data.dueDate;
  if ('dueTime' in data) patch.dueTime = data.dueTime;
  if (data.priority !== undefined) patch.priority = data.priority;
  if (data.completed !== undefined) patch.completed = data.completed ? 1 : 0;
  if ('recurrence' in data) patch.recurrence = data.recurrence;
  if ('notes' in data) patch.notes = data.notes;
  if (Object.keys(patch).length > 0) {
    await db.update(tasks).set(patch).where(eq(tasks.id, id));
  }
}

export async function deleteTask(db: DB, id: string): Promise<void> {
  await db.delete(taskTags).where(eq(taskTags.taskId, id));
  await db.delete(tasks).where(eq(tasks.id, id));
}

export async function getTaskTags(db: DB, taskId: string): Promise<string[]> {
  const rows = await db.select().from(taskTags).where(eq(taskTags.taskId, taskId));
  return rows.map((r: any) => r.tag);
}

export async function setTaskTags(db: DB, taskId: string, newTags: string[]): Promise<void> {
  await db.delete(taskTags).where(eq(taskTags.taskId, taskId));
  for (const tag of newTags) {
    await db.insert(taskTags).values({ id: generateId(), taskId, tag });
  }
}

// ─── Tagged Time Logs (Feature 14) ──────────────────────────────

export async function getTaggedTimeLogs(db: DB, opts?: { tag?: string; pillar?: string }): Promise<any[]> {
  let query = db.select().from(taggedTimeLogs);
  const conditions = [];
  if (opts?.tag) conditions.push(eq(taggedTimeLogs.tag, opts.tag));
  if (opts?.pillar) conditions.push(eq(taggedTimeLogs.pillar, opts.pillar));
  if (conditions.length > 0) query = query.where(and(...conditions));
  return query.orderBy(desc(taggedTimeLogs.startedAt));
}

export async function startTaggedTimer(
  db: DB,
  tag: string,
  pillar = 'general',
): Promise<string> {
  const id = generateId();
  await db.insert(taggedTimeLogs).values({
    id,
    tag,
    pillar,
    startedAt: nowISO(),
    endedAt: null,
    durationSeconds: 0,
    notes: null,
  });
  return id;
}

export async function stopTaggedTimer(
  db: DB,
  id: string,
  notes?: string,
): Promise<void> {
  const rows = await db.select().from(taggedTimeLogs).where(eq(taggedTimeLogs.id, id));
  const row = rows[0];
  if (!row) return;
  const endedAt = nowISO();
  const durationSeconds = Math.floor(
    (new Date(endedAt).getTime() - new Date(row.startedAt).getTime()) / 1000,
  );
  await db.update(taggedTimeLogs).set({
    endedAt,
    durationSeconds,
    notes: notes ?? null,
  }).where(eq(taggedTimeLogs.id, id));
}

export async function getAllTaggedTimeTagNames(db: DB): Promise<string[]> {
  const rows = await db.selectDistinct({ tag: taggedTimeLogs.tag }).from(taggedTimeLogs).orderBy(asc(taggedTimeLogs.tag));
  return rows.map((r: any) => r.tag);
}

// ─── Session Tags (Part 4.1) ─────────────────────────────────────

export async function getSessionTags(db: DB, sessionId: string): Promise<string[]> {
  const rows = await db.select().from(sessionTags).where(eq(sessionTags.sessionId, sessionId));
  return rows.map((r: any) => r.tag);
}

export async function addSessionTag(db: DB, sessionId: string, tag: string): Promise<void> {
  await db.insert(sessionTags).values({
    id: generateId(),
    sessionId,
    tag,
    loggedAt: nowISO(),
  });
}

export async function removeSessionTag(db: DB, sessionId: string, tag: string): Promise<void> {
  await db.delete(sessionTags).where(
    and(eq(sessionTags.sessionId, sessionId), eq(sessionTags.tag, tag)),
  );
}

// ─── Session Block To-Dos (Feature 4) ────────────────────────────

export async function getSessionBlockTodos(
  db: DB,
  sessionId: string,
  blockIndex: number,
): Promise<Array<{ todoId: string; checked: boolean }>> {
  const rows = await db
    .select()
    .from(sessionBlockTodos)
    .where(
      and(
        eq(sessionBlockTodos.sessionId, sessionId),
        eq(sessionBlockTodos.blockIndex, blockIndex),
      ),
    );
  return rows.map((r: any) => ({ todoId: r.todoId, checked: Boolean(r.checked) }));
}

export async function upsertSessionBlockTodo(
  db: DB,
  sessionId: string,
  blockIndex: number,
  todoId: string,
  checked: boolean,
): Promise<void> {
  const existing = await db
    .select()
    .from(sessionBlockTodos)
    .where(
      and(
        eq(sessionBlockTodos.sessionId, sessionId),
        eq(sessionBlockTodos.blockIndex, blockIndex),
        eq(sessionBlockTodos.todoId, todoId),
      ),
    );
  if (existing.length > 0) {
    await db
      .update(sessionBlockTodos)
      .set({ checked: checked ? 1 : 0 })
      .where(
        and(
          eq(sessionBlockTodos.sessionId, sessionId),
          eq(sessionBlockTodos.blockIndex, blockIndex),
          eq(sessionBlockTodos.todoId, todoId),
        ),
      );
  } else {
    await db.insert(sessionBlockTodos).values({
      id: generateId(),
      sessionId,
      blockIndex,
      todoId,
      checked: checked ? 1 : 0,
    });
  }
}

// ─── Session Block Instructions (Feature 5) ──────────────────────

export async function getSessionBlockInstructions(
  db: DB,
  sessionId: string,
  blockIndex: number,
): Promise<string> {
  const rows = await db
    .select()
    .from(sessionBlockInstructions)
    .where(
      and(
        eq(sessionBlockInstructions.sessionId, sessionId),
        eq(sessionBlockInstructions.blockIndex, blockIndex),
      ),
    );
  return rows[0]?.instructions ?? '';
}

export async function upsertSessionBlockInstructions(
  db: DB,
  sessionId: string,
  blockIndex: number,
  instructions: string,
): Promise<void> {
  const existing = await db
    .select()
    .from(sessionBlockInstructions)
    .where(
      and(
        eq(sessionBlockInstructions.sessionId, sessionId),
        eq(sessionBlockInstructions.blockIndex, blockIndex),
      ),
    );
  if (existing.length > 0) {
    await db
      .update(sessionBlockInstructions)
      .set({ instructions, updatedAt: nowISO() })
      .where(
        and(
          eq(sessionBlockInstructions.sessionId, sessionId),
          eq(sessionBlockInstructions.blockIndex, blockIndex),
        ),
      );
  } else {
    await db.insert(sessionBlockInstructions).values({
      id: generateId(),
      sessionId,
      blockIndex,
      instructions,
      updatedAt: nowISO(),
    });
  }
}

// ─── Courses & Grade Tracking (Feature 11) ───────────────────────

export async function getCourses(db: DB): Promise<any[]> {
  return db.select().from(courses).orderBy(asc(courses.name));
}

export async function getCourse(db: DB, id: string): Promise<any | undefined> {
  const rows = await db.select().from(courses).where(eq(courses.id, id));
  return rows[0];
}

export async function createCourse(
  db: DB,
  data: { name: string; pillar?: string; targetGrade?: number },
): Promise<string> {
  const id = generateId();
  await db.insert(courses).values({
    id,
    name: data.name,
    pillar: data.pillar ?? 'academic',
    targetGrade: data.targetGrade ?? null,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  });
  return id;
}

export async function updateCourse(
  db: DB,
  id: string,
  data: Partial<{ name: string; targetGrade: number | null }>,
): Promise<void> {
  await db.update(courses).set({ ...data, updatedAt: nowISO() }).where(eq(courses.id, id));
}

export async function deleteCourse(db: DB, id: string): Promise<void> {
  await db.delete(courseComponents).where(eq(courseComponents.courseId, id));
  await db.delete(courses).where(eq(courses.id, id));
}

export async function getCourseComponents(db: DB, courseId: string): Promise<any[]> {
  return db.select().from(courseComponents).where(eq(courseComponents.courseId, courseId));
}

export async function upsertCourseComponent(
  db: DB,
  data: { id?: string; courseId: string; name: string; weight: number; receivedGrade?: number | null },
): Promise<string> {
  const id = data.id ?? generateId();
  const existing = await db.select().from(courseComponents).where(eq(courseComponents.id, id));
  if (existing.length > 0) {
    await db.update(courseComponents).set({
      name: data.name,
      weight: data.weight,
      receivedGrade: data.receivedGrade ?? null,
    }).where(eq(courseComponents.id, id));
  } else {
    await db.insert(courseComponents).values({
      id,
      courseId: data.courseId,
      name: data.name,
      weight: data.weight,
      receivedGrade: data.receivedGrade ?? null,
    });
  }
  return id;
}

export async function deleteCourseComponent(db: DB, id: string): Promise<void> {
  await db.delete(courseComponents).where(eq(courseComponents.id, id));
}

/**
 * Compute current weighted grade for a course.
 * Returns null if no grades have been entered yet.
 */
export function computeWeightedGrade(
  components: Array<{ weight: number; receivedGrade: number | null }>,
): number | null {
  const graded = components.filter((c) => c.receivedGrade !== null && c.receivedGrade !== undefined);
  if (graded.length === 0) return null;
  const totalWeight = graded.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return null;
  const weightedSum = graded.reduce((sum, c) => sum + c.weight * (c.receivedGrade as number), 0);
  return weightedSum / totalWeight;
}

// ─── CSV Plans (Part 7) ──────────────────────────────────────────

export async function getCsvPlans(db: DB): Promise<any[]> {
  return db.select().from(csvPlans).orderBy(desc(csvPlans.uploadedAt));
}

export async function createCsvPlan(
  db: DB,
  data: { name: string; description?: string; fileHash?: string },
): Promise<string> {
  const id = generateId();
  await db.insert(csvPlans).values({
    id,
    name: data.name,
    description: data.description ?? null,
    uploadedAt: nowISO(),
    isActive: 1,
    fileHash: data.fileHash ?? null,
  });
  return id;
}

export async function deactivateCsvPlan(db: DB, id: string): Promise<void> {
  await db.update(csvPlans).set({ isActive: 0 }).where(eq(csvPlans.id, id));
}

export async function activateCsvPlan(db: DB, id: string): Promise<void> {
  await db.update(csvPlans).set({ isActive: 1 }).where(eq(csvPlans.id, id));
}

export async function updateCsvPlan(
  db: DB,
  id: string,
  data: { name?: string; description?: string },
): Promise<void> {
  const updates: Record<string, unknown> = {};
  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (Object.keys(updates).length > 0) {
    await db.update(csvPlans).set(updates).where(eq(csvPlans.id, id));
  }
}

export async function deleteCsvPlan(db: DB, id: string): Promise<void> {
  // Delete associated sessions first
  await db.delete(sessions).where(eq(sessions.csvPlanId, id));
  // Delete associated day plan refs (set csvPlanId to null for day plans)
  await db.update(dayPlans).set({ csvPlanId: null }).where(eq(dayPlans.csvPlanId, id));
  // Delete the plan itself
  await db.delete(csvPlans).where(eq(csvPlans.id, id));
}

/**
 * Get stats for a CSV plan: session count and date range.
 */
export async function getCsvPlanStats(
  db: DB,
  planId: string,
): Promise<{ sessionCount: number; earliestDate: string | null; latestDate: string | null }> {
  const planSessions = await db
    .select({ scheduledTime: sessions.scheduledTime, createdAt: sessions.createdAt })
    .from(sessions)
    .where(eq(sessions.csvPlanId, planId));

  if (planSessions.length === 0) {
    return { sessionCount: 0, earliestDate: null, latestDate: null };
  }

  const dates = planSessions.map(s => s.createdAt).filter(Boolean).sort();
  return {
    sessionCount: planSessions.length,
    earliestDate: dates[0] ?? null,
    latestDate: dates[dates.length - 1] ?? null,
  };
}

/**
 * Check for scheduling conflicts between active CSV plans.
 * Returns count of overlapping sessions on the same day+time.
 */
export async function getCsvPlanConflicts(db: DB): Promise<number> {
  const activePlans = await db.select().from(csvPlans).where(eq(csvPlans.isActive, 1));
  if (activePlans.length < 2) return 0;

  const planIds = activePlans.map(p => p.id);
  const allSessions = await db
    .select({
      id: sessions.id,
      csvPlanId: sessions.csvPlanId,
      scheduledTime: sessions.scheduledTime,
      dayPlanId: sessions.dayPlanId,
    })
    .from(sessions)
    .where(sql`${sessions.csvPlanId} IN (${sql.raw(planIds.map(id => `'${id}'`).join(','))})`);

  // Group by dayPlanId + scheduledTime and check for multi-plan overlap
  const timeSlots: Record<string, Set<string>> = {};
  for (const s of allSessions) {
    const key = `${s.dayPlanId ?? ''}__${s.scheduledTime ?? ''}`;
    if (!timeSlots[key]) timeSlots[key] = new Set();
    if (s.csvPlanId) timeSlots[key].add(s.csvPlanId);
  }

  let conflicts = 0;
  for (const plans of Object.values(timeSlots)) {
    if (plans.size > 1) conflicts++;
  }
  return conflicts;
}

// ─── Gym Volume & PR Queries (Feature 9) ────────────────────────

/**
 * Get volume (total value logged) per data_input module grouped by date.
 * Only returns modules with a primaryLift config field.
 * Returns: Array<{ moduleId, label, primaryLift, date, totalVolume }>
 */
export async function getVolumeByLift(
  db: DB,
  opts?: { startDate?: string; endDate?: string },
): Promise<Array<{ moduleId: string; label: string; primaryLift: string; date: string; totalVolume: number }>> {
  // Get all data_input modules with primaryLift
  const specs = await db.select().from(moduleSpecs).where(eq(moduleSpecs.type, 'data_input'));
  const liftModules = specs.filter((s) => {
    const cfg = typeof s.config === 'string' ? JSON.parse(s.config) : (s.config ?? {});
    return !!cfg.primaryLift;
  });

  if (liftModules.length === 0) return [];

  const results: Array<{ moduleId: string; label: string; primaryLift: string; date: string; totalVolume: number }> = [];

  for (const mod of liftModules) {
    const cfg = typeof mod.config === 'string' ? JSON.parse(mod.config) : (mod.config ?? {});
    let query = db
      .select({
        date: moduleValues.date,
        value: moduleValues.value,
      })
      .from(moduleValues)
      .where(eq(moduleValues.moduleId, mod.id));

    const rows = await query;

    // Group by date
    const byDate: Record<string, number> = {};
    for (const row of rows) {
      const d = row.date;
      if (opts?.startDate && d < opts.startDate) continue;
      if (opts?.endDate && d > opts.endDate) continue;
      const num = parseFloat(row.value) || 0;
      byDate[d] = (byDate[d] ?? 0) + num;
    }

    for (const [date, totalVolume] of Object.entries(byDate)) {
      results.push({
        moduleId: mod.id,
        label: mod.label,
        primaryLift: cfg.primaryLift,
        date,
        totalVolume,
      });
    }
  }

  return results.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Get personal records (max value per data_input module with primaryLift).
 * Returns: Array<{ moduleId, label, primaryLift, maxValue, date }>
 */
export async function getPRsAllLifts(
  db: DB,
): Promise<Array<{ moduleId: string; label: string; primaryLift: string; maxValue: number; date: string }>> {
  const specs = await db.select().from(moduleSpecs).where(eq(moduleSpecs.type, 'data_input'));
  const liftModules = specs.filter((s) => {
    const cfg = typeof s.config === 'string' ? JSON.parse(s.config) : (s.config ?? {});
    return !!cfg.primaryLift;
  });

  if (liftModules.length === 0) return [];

  const results: Array<{ moduleId: string; label: string; primaryLift: string; maxValue: number; date: string }> = [];

  for (const mod of liftModules) {
    const cfg = typeof mod.config === 'string' ? JSON.parse(mod.config) : (mod.config ?? {});
    const rows = await db
      .select({ date: moduleValues.date, value: moduleValues.value })
      .from(moduleValues)
      .where(eq(moduleValues.moduleId, mod.id));

    let maxVal = 0;
    let maxDate = '';
    for (const row of rows) {
      const num = parseFloat(row.value) || 0;
      if (num > maxVal) {
        maxVal = num;
        maxDate = row.date;
      }
    }

    if (maxVal > 0) {
      results.push({
        moduleId: mod.id,
        label: mod.label,
        primaryLift: cfg.primaryLift,
        maxValue: maxVal,
        date: maxDate,
      });
    }
  }

  return results.sort((a, b) => b.maxValue - a.maxValue);
}

/**
 * Get gym session frequency by week.
 * Returns: Array<{ week: string (YYYY-WXX), count: number }>
 */
export async function getGymSessionFrequency(
  db: DB,
): Promise<Array<{ week: string; count: number }>> {
  const gymSessions = await db
    .select({ startedAt: sessions.startedAt })
    .from(sessions)
    .where(eq(sessions.pillar, 'gym'));

  const byWeek: Record<string, number> = {};
  for (const s of gymSessions) {
    if (!s.startedAt) continue;
    const d = new Date(s.startedAt);
    const year = d.getFullYear();
    const oneJan = new Date(year, 0, 1);
    const weekNum = Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7);
    const key = `${year}-W${String(weekNum).padStart(2, '0')}`;
    byWeek[key] = (byWeek[key] ?? 0) + 1;
  }

  return Object.entries(byWeek)
    .map(([week, count]) => ({ week, count }))
    .sort((a, b) => a.week.localeCompare(b.week));
}
