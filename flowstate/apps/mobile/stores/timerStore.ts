import { create } from 'zustand';
import { TimerEngine } from '@flowstate/core';
import type { TimerPhase, TimerState, BlockMode } from '@flowstate/core';
import {
  startBackgroundTimer,
  stopBackgroundTimer,
} from '../services/notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

const TIMER_STATE_KEY = 'flowstate_timer_state';

async function saveTimerState(state: any) {
  try {
    await AsyncStorage.setItem(TIMER_STATE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save timer state:', error);
  }
}

async function loadTimerState() {
  try {
    const value = await AsyncStorage.getItem(TIMER_STATE_KEY);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error('Failed to load timer state:', error);
    return null;
  }
}

export async function initializeTimerStore(): Promise<() => void> {
  const persisted = await loadTimerState();
  if (
    persisted &&
    persisted.sessionId &&
    persisted.blocks &&
    persisted.startedAt &&
    persisted.phase !== 'completed' &&
    persisted.phase !== 'idle'
  ) {
    useTimerStore.getState().restore(
      persisted.sessionId,
      persisted.blocks,
      persisted.routineName || '',
      {
        blockIndex: persisted.blockIndex || 0,
        startedAt: persisted.startedAt,
        totalPausedMs: persisted.totalPausedMs || 0,
      }
    );
  }

  let lastAppState = AppState.currentState;
  const subscription = AppState.addEventListener('change', async (nextAppState) => {
    const timerState = useTimerStore.getState();
    if (lastAppState.match(/active|foreground/) && nextAppState.match(/inactive|background/)) {
      if (timerState.phase === 'running' || timerState.phase === 'overdue') {
        // BUG-15: Only send countdown notification for timed blocks
        if (timerState.blockMode === 'timed') {
          const remaining = timerState.blockDurationMs - timerState.elapsed;
          await startBackgroundTimer(remaining, timerState.currentBlockName, timerState.routineName);
        }
      }
    }
    if (lastAppState.match(/inactive|background/) && nextAppState.match(/active|foreground/)) {
      await stopBackgroundTimer();
      if (timerState.phase === 'running' || timerState.phase === 'overdue') {
        useTimerStore.getState().tick();
      }
    }
    lastAppState = nextAppState;
  });

  // Return cleanup so callers can remove the listener (prevents duplicate subscriptions on hot reload)
  return () => subscription.remove();
}

interface TimerBlock {
  name: string;
  durationMinutes: number;
  mode?: BlockMode;
}

type TimerStoreState = TimerState & {
  // Extra state
  blocks: TimerBlock[];
  currentBlockName: string;
  routineName: string;
  pillar: string; // active session pillar (for FloatingActiveBlockWidget accent colour)
  elapsed: number;
  // Actions
  init: (sessionId: string, blocks: TimerBlock[], routineName?: string) => void;
  setPillar: (pillar: string) => void;
  restore: (
    sessionId: string,
    blocks: TimerBlock[],
    routineName: string,
    opts: { blockIndex: number; startedAt: number; totalPausedMs: number }
  ) => void;
  play: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  skip: () => Promise<void>;
  end: () => Promise<void>;
  tick: () => void;
  set: (partial: Partial<TimerStoreState>) => void;
  // Internal — exposed for getState() reads in session screen persist helpers
  _engine: TimerEngine;
  _intervalId: ReturnType<typeof setInterval> | null;
  _notifCounter: number;
};

// ─── Module-level singletons ────────────────────────────────────
// These live outside the Zustand store so they survive re-renders
// and store re-subscriptions.
const engine = new TimerEngine();
let intervalId: ReturnType<typeof setInterval> | null = null;

// NOTE: subscribeToEngine has been intentionally removed.
// It called set() inside an engine onChange callback which fired
// during Zustand's own set() chain → infinite re-render loop.
// The startTicking interval handles all store updates instead.

function startTicking(set: (fn: (s: any) => any) => void) {
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(() => {
    engine.tick(); // transitions running → overdue when timer expires
    set((state: any) => ({
      ...state,
      phase: engine.phase,
      elapsed: engine.elapsed, // stable number — safe for Zustand selectors
    }));
  }, 1000);
}

function stopTicking() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export const useTimerStore = create<TimerStoreState>((set) => {
  // DO NOT call subscribeToEngine here — see note above
  return {
    // ─── Initial state ────────────────────────────────────────
    phase: 'idle' as TimerPhase,
    pausedAt: null,
    startedAt: null,
    totalPausedMs: 0,
    blockDurationMs: 0,
    blockIndex: 0,
    totalBlocks: 0,
    elapsed: 0,
    sessionId: null,
    blockMode: 'timed' as BlockMode,
    blocks: [],
    currentBlockName: '',
    routineName: '',
    pillar: 'general',
    set,
    _engine: engine,
    _intervalId: null,
    _notifCounter: 0,

    setPillar: (pillar: string) => set((state) => ({ ...state, pillar })),

    // ─── Actions ──────────────────────────────────────────────

    init: (sessionId: string, blocks: TimerBlock[], routineName?: string) => {
      engine.init({ sessionId, blocks });
      const firstMode: BlockMode = blocks[0]?.mode ?? (blocks[0]?.durationMinutes === 0 ? 'countup' : 'timed');
      set((state) => ({
        ...state,
        sessionId,
        blocks,
        routineName: routineName || '',
        blockIndex: 0,
        totalBlocks: blocks.length,
        startedAt: null,
        pausedAt: null,
        totalPausedMs: 0,
        blockDurationMs: blocks[0]?.durationMinutes
          ? blocks[0].durationMinutes * 60 * 1000
          : 0,
        blockMode: firstMode,
        phase: 'idle' as TimerPhase,
        elapsed: 0,
        currentBlockName: blocks[0]?.name || '',
      }));
    },

    restore: (
      sessionId: string,
      blocks: TimerBlock[],
      routineName: string,
      opts: { blockIndex: number; startedAt: number; totalPausedMs: number }
    ) => {
      engine.restore({
        sessionId,
        blocks,
        blockIndex: opts.blockIndex,
        startedAt: opts.startedAt,
        totalPausedMs: opts.totalPausedMs,
      });
      // BUG-10: Compute actual phase from timestamps rather than blindly setting 'paused'.
      // If the block should have already expired based on wall-clock time, restore as 'overdue'.
      const block = blocks[opts.blockIndex];
      const blockDurationMs = block?.durationMinutes ? block.durationMinutes * 60 * 1000 : 0;
      const blockMode: BlockMode = block?.mode ?? (block?.durationMinutes === 0 ? 'countup' : 'timed');
      const elapsedMs = Date.now() - opts.startedAt - opts.totalPausedMs;
      // Countup / goal_based blocks never go overdue
      const restoredPhase: TimerPhase = (blockMode !== 'timed')
        ? 'paused'
        : (elapsedMs >= blockDurationMs ? 'overdue' : 'paused');
      // When overdue, transition the engine from 'paused' to 'running' so that engine.tick()
      // will correctly emit 'overdue' on the next interval tick.
      if (restoredPhase === 'overdue') engine.resume();
      // Compute elapsed from the restored engine so the display is
      // immediately correct without waiting for the first tick.
      set((state) => ({
        ...state,
        sessionId,
        blocks,
        routineName,
        blockIndex: opts.blockIndex,
        totalBlocks: blocks.length,
        startedAt: opts.startedAt,
        totalPausedMs: opts.totalPausedMs,
        pausedAt: null,
        phase: restoredPhase,  // BUG-10: computed from timestamps, not hardcoded 'paused'
        blockDurationMs: blocks[opts.blockIndex]?.durationMinutes
          ? blocks[opts.blockIndex].durationMinutes * 60 * 1000
          : 0,
        blockMode,
        elapsed: engine.elapsed,
        currentBlockName: blocks[opts.blockIndex]?.name || '',
      }));
    },

    play: async () => {
      engine.play();
      set((state) => {
        const newState = {
          ...state,
          phase: engine.phase,
          startedAt: engine.state.startedAt,
          pausedAt: null,
          totalPausedMs: 0,
          elapsed: engine.elapsed,
        };
        saveTimerState(newState);
        return newState;
      });
      startTicking(set);
      const state = useTimerStore.getState();
      // BUG-15: Only send countdown notification for timed blocks.
      // Countup / goal_based blocks have no end time.
      if (state.blockMode === 'timed' && engine.remaining > 0) {
        await startBackgroundTimer(
          engine.remaining,
          state.currentBlockName || '',
          state.routineName || '',
        );
      }
    },

    pause: async () => {
      engine.pause();
      set((state) => {
        const newState = {
          ...state,
          phase: engine.phase,
          pausedAt: engine.state.pausedAt,
          elapsed: engine.elapsed,
        };
        saveTimerState(newState);
        return newState;
      });
      stopTicking();
      await stopBackgroundTimer();
    },

    resume: async () => {
      engine.resume();
      set((state) => {
        const newState = {
          ...state,
          phase: engine.phase,
          pausedAt: null,
          totalPausedMs: engine.state.totalPausedMs,
          elapsed: engine.elapsed,
        };
        saveTimerState(newState);
        return newState;
      });
      startTicking(set);
      const state = useTimerStore.getState();
      // BUG-15: Only send countdown notification for timed blocks
      if (state.blockMode === 'timed' && engine.remaining > 0) {
        await startBackgroundTimer(
          engine.remaining,
          state.currentBlockName || '',
          state.routineName || '',
        );
      }
    },

    skip: async () => {
      set((state) => {
        const nextIndex = engine.skip(state.blocks);
        let newState;
        if (nextIndex === -1) {
          stopTicking();
          newState = { ...state, phase: 'completed' as TimerPhase };
        } else {
          const nextBlock = state.blocks[nextIndex];
          const nextMode: BlockMode = nextBlock?.mode ?? (nextBlock?.durationMinutes === 0 ? 'countup' : 'timed');
          newState = {
            ...state,
            blockIndex: nextIndex,
            blockDurationMs: state.blocks[nextIndex]?.durationMinutes
              ? state.blocks[nextIndex].durationMinutes * 60 * 1000
              : 0,
            blockMode: nextMode,
            phase: 'idle' as TimerPhase,
            startedAt: null,
            pausedAt: null,
            totalPausedMs: 0,
            elapsed: 0,
            currentBlockName: state.blocks[nextIndex]?.name || '',
          };
        }
        saveTimerState(newState);
        return newState;
      });
      stopTicking();
      await stopBackgroundTimer();
    },

    end: async () => {
      engine.end();
      set((state) => ({
        ...state,
        phase: 'completed' as TimerPhase,
        pausedAt: null,
        elapsed: engine.elapsed,
      }));
      stopTicking();
      await stopBackgroundTimer();
      // Clear persisted state so a reopen never restores a finished session
      try { await AsyncStorage.removeItem(TIMER_STATE_KEY); } catch {}
    },

    tick: () => {
      const phase = engine.tick();
      set((state) => ({
        ...state,
        phase,
        elapsed: engine.elapsed,
      }));
    },
  };
});

export default useTimerStore;