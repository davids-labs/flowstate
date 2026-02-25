import { create } from 'zustand';
import { TimerEngine } from '@flowstate/core';
import type { TimerPhase, TimerState } from '@flowstate/core';
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

export async function initializeTimerStore() {
  const persisted = await loadTimerState();
  if (persisted && persisted.sessionId && persisted.blocks && persisted.startedAt) {
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
  AppState.addEventListener('change', async (nextAppState) => {
    const timerState = useTimerStore.getState();
    if (lastAppState.match(/active|foreground/) && nextAppState.match(/inactive|background/)) {
      if (timerState.phase === 'running' || timerState.phase === 'overdue') {
        // Compute remaining from stable store values — NO dynamic import
        const remaining = timerState.blockDurationMs - timerState.elapsed;
        await startBackgroundTimer(remaining, timerState.currentBlockName, timerState.routineName);
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
}

interface TimerBlock {
  name: string;
  durationMinutes: number;
}

type TimerStoreState = TimerState & {
  // Extra state
  blocks: TimerBlock[];
  currentBlockName: string;
  routineName: string;
  elapsed: number;
  // Actions
  init: (sessionId: string, blocks: TimerBlock[], routineName?: string) => void;
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
    blocks: [],
    currentBlockName: '',
    routineName: '',
    set,
    _engine: engine,
    _intervalId: null,
    _notifCounter: 0,

    // ─── Actions ──────────────────────────────────────────────

    init: (sessionId: string, blocks: TimerBlock[], routineName?: string) => {
      engine.init({ sessionId, blocks });
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
        phase: 'paused' as TimerPhase,
        blockDurationMs: blocks[opts.blockIndex]?.durationMinutes
          ? blocks[opts.blockIndex].durationMinutes * 60 * 1000
          : 0,
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
      await startBackgroundTimer(
        engine.remaining,
        state.currentBlockName || '',
        state.sessionId || ''
      );
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
      await startBackgroundTimer(
        engine.remaining,
        state.currentBlockName || '',
        state.sessionId || ''
      );
    },

    skip: async () => {
      set((state) => {
        const nextIndex = engine.skip(state.blocks);
        let newState;
        if (nextIndex === -1) {
          stopTicking();
          newState = { ...state, phase: 'completed' as TimerPhase };
        } else {
          newState = {
            ...state,
            blockIndex: nextIndex,
            blockDurationMs: state.blocks[nextIndex]?.durationMinutes
              ? state.blocks[nextIndex].durationMinutes * 60 * 1000
              : 0,
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
      set((state) => {
        const newState = {
          ...state,
          phase: 'completed' as TimerPhase,
          pausedAt: null,
          elapsed: engine.elapsed,
        };
        saveTimerState(newState);
        return newState;
      });
      stopTicking();
      await stopBackgroundTimer();
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