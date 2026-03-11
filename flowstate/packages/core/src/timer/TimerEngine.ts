import type { TimerPhase, TimerState, BlockMode } from '../types/TimerState';

/**
 * Timestamp-based TimerEngine.
 * All time tracking is based on Date.now() — not counters.
 * This means the timer survives backgrounding and is frame-rate independent.
 *
 * Supports three block modes:
 *   - 'timed': classic countdown. Transitions to 'overdue' when time expires.
 *   - 'countup': open-ended count-up. User decides when done. Never goes overdue.
 *   - 'goal_based': counts up toward a goal target. Caller signals completion.
 *
 * Also supports 'pending_condition' phase: block timer expired but a
 * condition (Feature 1) is not yet met. Advance/skip is locked.
 */
export class TimerEngine {
  private _state: TimerState;
  private _onChange: ((state: TimerState) => void) | null = null;

  constructor() {
    this._state = {
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

  // ─── Getters ────────────────────────────────────────────────

  get state(): TimerState {
    return { ...this._state };
  }

  get phase(): TimerPhase {
    return this._state.phase;
  }

  /** Remaining time in ms. Negative = overdue. */
  get remaining(): number {
    const s = this._state;
    if (!s.startedAt || s.phase === 'idle' || s.phase === 'completed') {
      return s.blockDurationMs;
    }

    const now = s.phase === 'paused' && s.pausedAt ? s.pausedAt : Date.now();
    const elapsed = now - s.startedAt - s.totalPausedMs;
    return s.blockDurationMs - elapsed;
  }

  /** Elapsed time in ms for current block */
  get elapsed(): number {
    const s = this._state;
    if (!s.startedAt) return 0;
    const now = s.phase === 'paused' && s.pausedAt ? s.pausedAt : Date.now();
    return now - s.startedAt - s.totalPausedMs;
  }

  /** Progress fraction 0..1 (can exceed 1 if overdue) */
  get progress(): number {
    if (this._state.blockMode === 'countup') {
      // For countup blocks, progress is meaningless — return 0
      return 0;
    }
    if (this._state.blockDurationMs <= 0) return 0;
    return Math.max(0, this.elapsed / this._state.blockDurationMs);
  }

  get isOverdue(): boolean {
    return this.remaining < 0 && this._state.phase === 'running' && this._state.blockMode === 'timed';
  }

  /** Whether this block is open-ended (countup or goal_based). */
  get isOpenEnded(): boolean {
    return this._state.blockMode === 'countup' || this._state.blockMode === 'goal_based';
  }

  // ─── Configuration ─────────────────────────────────────────

  /** Set the callback for state changes */
  onChange(cb: (state: TimerState) => void) {
    this._onChange = cb;
  }

  /** Initialize the timer for a session */
  init(config: {
    sessionId: string;
    blocks: Array<{ durationMinutes: number; mode?: BlockMode }>;
    startBlockIndex?: number;
  }) {
    const blockIndex = config.startBlockIndex ?? 0;
    const block = config.blocks[blockIndex];
    if (!block) return;

    const mode: BlockMode = block.mode ?? (block.durationMinutes === 0 ? 'countup' : 'timed');
    this._setState({
      phase: 'idle',
      startedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
      blockDurationMs: block.durationMinutes * 60 * 1000,
      blockIndex,
      totalBlocks: config.blocks.length,
      sessionId: config.sessionId,
      blockMode: mode,
    });
  }

  /**
   * Restore a timer that was previously running.
   * Resumes from the persisted startedAt / totalPausedMs / blockIndex
   * so the timer picks up exactly where it left off.
   * The timer is restored in a **paused** state — caller can resume().
   */
  restore(config: {
    sessionId: string;
    blocks: Array<{ durationMinutes: number; mode?: BlockMode }>;
    blockIndex: number;
    startedAt: number;
    totalPausedMs: number;
    pausedAt?: number | null;
  }) {
    const block = config.blocks[config.blockIndex];
    if (!block) return;

    const mode: BlockMode = block.mode ?? (block.durationMinutes === 0 ? 'countup' : 'timed');
    this._setState({
      phase: 'paused',
      startedAt: config.startedAt,
      pausedAt: config.pausedAt ?? Date.now(),
      totalPausedMs: config.totalPausedMs,
      blockDurationMs: block.durationMinutes * 60 * 1000,
      blockIndex: config.blockIndex,
      totalBlocks: config.blocks.length,
      sessionId: config.sessionId,
      blockMode: mode,
    });
  }

  // ─── Controls ──────────────────────────────────────────────

  play() {
    const s = this._state;
    if (s.phase !== 'idle') return;

    this._setState({
      ...s,
      phase: 'running',
      startedAt: Date.now(),
      pausedAt: null,
      totalPausedMs: 0,
    });
  }

  pause() {
    const s = this._state;
    if (s.phase !== 'running' && s.phase !== 'overdue') return;

    this._setState({
      ...s,
      phase: 'paused',
      pausedAt: Date.now(),
    });
  }

  resume() {
    const s = this._state;
    if (s.phase !== 'paused' || !s.pausedAt) return;

    const additionalPause = Date.now() - s.pausedAt;
    this._setState({
      ...s,
      phase: 'running',
      pausedAt: null,
      totalPausedMs: s.totalPausedMs + additionalPause,
    });
  }

  /**
   * Skip to the next block.
   * Returns the new block index, or -1 if no more blocks.
   */
  skip(blocks: Array<{ durationMinutes: number; mode?: BlockMode }>) {
    const s = this._state;
    const nextIndex = s.blockIndex + 1;

    if (nextIndex >= s.totalBlocks) {
      this.end();
      return -1;
    }

    const nextBlock = blocks[nextIndex];
    if (!nextBlock) {
      this.end();
      return -1;
    }

    const mode: BlockMode = nextBlock.mode ?? (nextBlock.durationMinutes === 0 ? 'countup' : 'timed');
    this._setState({
      ...s,
      phase: 'idle',
      startedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
      blockDurationMs: nextBlock.durationMinutes * 60 * 1000,
      blockIndex: nextIndex,
      blockMode: mode,
    });

    return nextIndex;
  }

  end() {
    this._setState({
      ...this._state,
      phase: 'completed',
      pausedAt: null,
    });
  }

  /** Set block duration (used when switching blocks externally) */
  setBlock(blockIndex: number, durationMinutes: number, mode?: BlockMode) {
    const resolvedMode: BlockMode = mode ?? (durationMinutes === 0 ? 'countup' : 'timed');
    this._setState({
      ...this._state,
      phase: 'idle',
      startedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
      blockDurationMs: durationMinutes * 60 * 1000,
      blockIndex,
      blockMode: resolvedMode,
    });
  }

  /**
   * Transition to pending_condition phase.
   * Called when a block's time expires but its condition is not yet met (Feature 1).
   * Timer stops ticking but remains "alive" — skip/advance are locked.
   */
  setPendingCondition() {
    if (this._state.phase !== 'running' && this._state.phase !== 'overdue') return;
    this._setState({ ...this._state, phase: 'pending_condition' });
  }

  /**
   * Clear pending_condition and allow advance.
   * Called when the user satisfies the block condition externally.
   */
  clearCondition() {
    if (this._state.phase !== 'pending_condition') return;
    this._setState({ ...this._state, phase: 'overdue' });
  }

  /** Check and update overdue state */
  tick(): TimerPhase {
    const s = this._state;
    // Countup and goal_based blocks never expire — they just keep counting
    if (s.blockMode === 'countup' || s.blockMode === 'goal_based') {
      return s.phase;
    }
    if (s.phase === 'running' && this.remaining < 0) {
      this._setState({ ...s, phase: 'overdue' });
      return 'overdue';
    }
    return s.phase;
  }

  // ─── Private ───────────────────────────────────────────────

  private _setState(newState: TimerState) {
    this._state = newState;
    this._onChange?.(this.state);
  }
}
