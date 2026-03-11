// ─── Timer Phase ────────────────────────────────────────────────

export type TimerPhase = 'idle' | 'running' | 'paused' | 'overdue' | 'completed' | 'pending_condition';

// ─── Block Mode ─────────────────────────────────────────────────

/** How a block's timer behaves. */
export type BlockMode = 'timed' | 'countup' | 'goal_based';

// ─── Timer State ────────────────────────────────────────────────

export interface TimerState {
  phase: TimerPhase;
  /** Timestamp (ms) when current block was started */
  startedAt: number | null;
  /** Timestamp (ms) when timer was paused */
  pausedAt: number | null;
  /** Accumulated paused time in ms */
  totalPausedMs: number;
  /** Duration of the current block in ms (0 for countup / open-ended) */
  blockDurationMs: number;
  /** Current block index */
  blockIndex: number;
  /** Total number of blocks */
  totalBlocks: number;
  /** Session ID this timer belongs to */
  sessionId: string | null;
  /** How this block runs: timed countdown, open-ended countup, or goal-based */
  blockMode: BlockMode;
}

// ─── Helpers ────────────────────────────────────────────────────

export function getRemaining(state: TimerState): number {
  if (!state.startedAt || state.phase === 'idle' || state.phase === 'completed') {
    return state.blockDurationMs;
  }

  const now = state.phase === 'paused' && state.pausedAt ? state.pausedAt : Date.now();
  const elapsed = now - state.startedAt - state.totalPausedMs;
  return state.blockDurationMs - elapsed;
}

export function createInitialTimerState(): TimerState {
  return {
    phase: 'idle',
    startedAt: null,
    pausedAt: null,
    totalPausedMs: 0,
    blockDurationMs: 0,
    blockIndex: 0,
    totalBlocks: 0,
    sessionId: null,
    blockMode: 'timed',
  };
}
