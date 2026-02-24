// ─── Session Event ──────────────────────────────────────────────

export type SessionEventType =
  | 'started'
  | 'paused'
  | 'resumed'
  | 'block_completed'
  | 'block_skipped'
  | 'ended'
  | 'abandoned'
  | 'module_logged';

export interface SessionEvent {
  id: string;
  sessionId: string;
  type: SessionEventType;
  timestamp: string; // ISO
  blockIndex?: number;
  data?: Record<string, unknown>;
}

// ─── Session ────────────────────────────────────────────────────

export type SessionStatus = 'pending' | 'in_progress' | 'completed' | 'abandoned';

export interface Session {
  id: string;
  dayPlanId: string;
  routineId: string;
  routineName: string;
  status: SessionStatus;
  startedAt?: string; // ISO
  endedAt?: string; // ISO
  totalPausedMs: number;
  currentBlockIndex: number;
  events: SessionEvent[];
  createdAt?: string;
  updatedAt?: string;
}
