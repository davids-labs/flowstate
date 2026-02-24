import type { TimerPhase, TimerState } from '../types/TimerState';

/**
 * Timestamp-based TimerEngine.
 * All time tracking is based on Date.now() — not counters.
 * This means the timer survives backgrounding and is frame-rate independent.
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
    if (this._state.blockDurationMs <= 0) return 0;
    return Math.max(0, this.elapsed / this._state.blockDurationMs);
  }

  get isOverdue(): boolean {
    return this.remaining < 0 && this._state.phase === 'running';
  }

  // ─── Configuration ─────────────────────────────────────────

  /** Set the callback for state changes */
  onChange(cb: (state: TimerState) => void) {
    this._onChange = cb;
  }

  /** Initialize the timer for a session */
  init(config: {
    sessionId: string;
    blocks: Array<{ durationMinutes: number }>;
    startBlockIndex?: number;
  }) {
    const blockIndex = config.startBlockIndex ?? 0;
    const block = config.blocks[blockIndex];
    if (!block) return;

    this._setState({
      phase: 'idle',
      startedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
      blockDurationMs: block.durationMinutes * 60 * 1000,
      blockIndex,
      totalBlocks: config.blocks.length,
      sessionId: config.sessionId,
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
  skip(blocks: Array<{ durationMinutes: number }>) {
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

    this._setState({
      ...s,
      phase: 'idle',
      startedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
      blockDurationMs: nextBlock.durationMinutes * 60 * 1000,
      blockIndex: nextIndex,
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
  setBlock(blockIndex: number, durationMinutes: number) {
    this._setState({
      ...this._state,
      phase: 'idle',
      startedAt: null,
      pausedAt: null,
      totalPausedMs: 0,
      blockDurationMs: durationMinutes * 60 * 1000,
      blockIndex,
    });
  }

  /** Check and update overdue state */
  tick(): TimerPhase {
    const s = this._state;
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
