// ─── Timer Phase ────────────────────────────────────────────────

export type TimerPhase = 'idle' | 'running' | 'paused' | 'overdue' | 'completed';

// ─── Timer State ────────────────────────────────────────────────

export interface TimerState {
  phase: TimerPhase;
  /** Timestamp (ms) when current block was started */
  startedAt: number | null;
  /** Timestamp (ms) when timer was paused */
  pausedAt: number | null;
  /** Accumulated paused time in ms */
  totalPausedMs: number;
  /** Duration of the current block in ms */
  blockDurationMs: number;
  /** Current block index */
  blockIndex: number;
  /** Total number of blocks */
  totalBlocks: number;
  /** Session ID this timer belongs to */
  sessionId: string | null;
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
  };
}
