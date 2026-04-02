import {
  getDayPlan,
  getSessionsForDay,
  getTasks,
  getTrackersForSurface,
  getTrackerEntry,
  getTrackerQuickAction,
  getTrackerSummary,
  type DayPlan,
  type TrackerKind,
  type TrackerQuickAction,
  type TrackerSummary,
} from '@flowstate/core';

export type PlannerTimelineItem =
  | {
      id: string;
      kind: 'session';
      title: string;
      time: string | null;
      status: string;
      routineId: string | null;
      routineName: string;
    }
  | {
      id: string;
      kind: 'task';
      title: string;
      time: string | null;
      completed: boolean;
      priority: number;
      pillar: string | null;
    };

export interface PlannerTracker {
  id: string;
  kind: TrackerKind;
  label: string;
  emoji?: string | null;
  config: Record<string, unknown>;
  collectionId?: string | null;
  pinRules?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  summary: TrackerSummary;
  entry: any;
  quickAction: TrackerQuickAction | null;
  archivedAt?: string | null;
}

export interface PlannerDayBundle {
  dayPlan: DayPlan | null;
  agenda: PlannerTimelineItem[];
  trackers: PlannerTracker[];
  nextSession: {
    sessionId: string;
    routineName: string;
    scheduledTime?: string;
    pillar?: string;
  } | null;
}

function timeValue(value: string | null | undefined): string {
  return value ?? '99:99';
}

export function sortPlannerTimeline(items: PlannerTimelineItem[]): PlannerTimelineItem[] {
  return [...items].sort((left, right) => {
    const leftTime = timeValue(left.time);
    const rightTime = timeValue(right.time);

    if (leftTime !== rightTime) return leftTime.localeCompare(rightTime);
    if (left.kind !== right.kind) return left.kind === 'session' ? -1 : 1;
    return left.title.localeCompare(right.title);
  });
}

export async function loadPlannerDayBundle(db: any, date: string): Promise<PlannerDayBundle> {
  const dayPlan = await getDayPlan(db, date);
  const allTasks = await getTasks(db);
  const tasksForDate = (allTasks as any[]).filter((task) => task.dueDate === date);

  let sessionRows: any[] = [];
  if (dayPlan?.id) {
    sessionRows = await getSessionsForDay(db, dayPlan.id);
  }

  const trackerSpecs = await getTrackersForSurface(db, 'today');
  const trackers = await Promise.all(
    (trackerSpecs as any[]).map(async (tracker) => ({
      id: tracker.id,
      kind: tracker.kind,
      label: tracker.label,
      emoji: tracker.emoji ?? null,
      config: tracker.config ?? {},
      collectionId: tracker.collectionId ?? null,
      pinRules: tracker.pinRules ?? {},
      metadata: tracker.metadata ?? {},
      summary: await getTrackerSummary(db, tracker.id, date),
      entry: await getTrackerEntry(db, tracker.id, date),
      quickAction: await getTrackerQuickAction(db, tracker.id, 'today'),
      archivedAt: tracker.archivedAt ?? null,
    })),
  );

  const agenda = sortPlannerTimeline([
    ...sessionRows.map((session) => ({
      id: session.id,
      kind: 'session' as const,
      title: session.routineName,
      time: session.scheduledTime ?? null,
      status: session.status,
      routineId: session.routineId ?? null,
      routineName: session.routineName,
    })),
    ...tasksForDate.map((task) => ({
      id: task.id,
      kind: 'task' as const,
      title: task.title,
      time: task.dueTime ?? null,
      completed: !!task.completed,
      priority: task.priority ?? 2,
      pillar: task.pillar ?? null,
    })),
  ]);

  const nextSessionRow = sessionRows.find((session) =>
    session.status === 'pending' || session.status === 'scheduled' || session.status === 'in_progress',
  );

  return {
    dayPlan,
    agenda,
    trackers,
    nextSession: nextSessionRow
      ? {
          sessionId: nextSessionRow.id,
          routineName: nextSessionRow.routineName,
          scheduledTime: nextSessionRow.scheduledTime ?? undefined,
          pillar: nextSessionRow.pillar ?? 'general',
        }
      : null,
  };
}
