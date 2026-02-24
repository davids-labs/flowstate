import { create } from 'zustand';
import { TimerEngine } from '@flowstate/core';
import type { TimerPhase, TimerState } from '@flowstate/core';
import {
  showTimerNotification,
  cancelTimerNotifications,
  startBackgroundTimer,
  stopBackgroundTimer,
  saveBackgroundTimerState,
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
    // Restore timer state
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

  // Set up AppState event listener for background/foreground handling
  let lastAppState = AppState.currentState;
  AppState.addEventListener('change', async (nextAppState) => {
    const timerState = useTimerStore.getState();
    console.log('[TimerStore] AppState changed:', lastAppState, '->', nextAppState, 'phase:', timerState.phase);
    // If moving to background, update notification and background timer
    if (lastAppState.match(/active|foreground/) && nextAppState.match(/inactive|background/)) {
      if (timerState.phase === 'running' || timerState.phase === 'overdue') {
        console.log('[TimerStore] App going to background, starting background timer/notification');
        // TimerState does not have 'remaining', use getRemaining
        const { getRemaining } = await import('@flowstate/core/src/types/TimerState');
        const remaining = getRemaining(timerState);
        await startBackgroundTimer(remaining, timerState.currentBlockName, timerState.routineName);
      }
    }
    // If returning to foreground, clear notification and sync state
    if (lastAppState.match(/inactive|background/) && nextAppState.match(/active|foreground/)) {
      console.log('[TimerStore] App returning to foreground, stopping background timer/notification');
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
  // State
  blocks: TimerBlock[];
  currentBlockName: string;
  routineName: string;
  // Actions
  init: (sessionId: string, blocks: TimerBlock[], routineName?: string) => void;
  restore: (
    sessionId: string,
    blocks: TimerBlock[],
    routineName: string,
    opts: {
      blockIndex: number;
      startedAt: number;
      totalPausedMs: number;
    }
  ) => void;
  play: () => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  end: () => void;
  tick: () => void;
  set: (partial: Partial<TimerStoreState>) => void;
  // Internal
  _engine: TimerEngine;
  _intervalId: ReturnType<typeof setInterval> | null;
  _notifCounter: number;
};


const engine = new TimerEngine();
let intervalId: ReturnType<typeof setInterval> | null = null;

// Sync Zustand state with TimerEngine on every state change
function subscribeToEngine(set: any) {
  engine.onChange((engineState) => {
    set((state: any) => ({
      ...state,
      phase: engine.phase,
      startedAt: engineState.startedAt,
      pausedAt: engineState.pausedAt,
      totalPausedMs: engineState.totalPausedMs,
      blockDurationMs: engineState.blockDurationMs,
      blockIndex: engineState.blockIndex,
      totalBlocks: engineState.totalBlocks,
      elapsed: engine.elapsed,
    }));
  });
}

function startTicking(set: any) {
  if (intervalId) clearInterval(intervalId);
  intervalId = setInterval(() => {
    engine.tick();
    set((state: any) => ({
      ...state,
      phase: engine.phase,
      elapsed: engine.elapsed,
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
  // Subscribe Zustand to TimerEngine changes
  subscribeToEngine(set);
  return {
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
    // Timer actions (empty implementations for now)
    init: (sessionId: string, blocks: TimerBlock[], routineName?: string) => {
      console.log('[TimerStore] init', { sessionId, blocks, routineName });
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
        blockDurationMs: blocks[0]?.durationMinutes ? blocks[0].durationMinutes * 60 * 1000 : 0,
        phase: 'idle' as TimerPhase,
        elapsed: 0,
        currentBlockName: blocks[0]?.name || '',
      }));
    },
  restore: (
    sessionId: string,
    blocks: TimerBlock[],
    routineName: string,
    opts: {
      blockIndex: number;
      startedAt: number;
      totalPausedMs: number;
    }
  ) => {
    console.log('[TimerStore] restore', { sessionId, blocks, routineName, opts });
    set((state) => ({
      sessionId,
      blocks,
      routineName,
      blockIndex: opts.blockIndex,
      startedAt: opts.startedAt,
      totalPausedMs: opts.totalPausedMs,
      pausedAt: null,
      phase: 'paused',
    }));

    engine.restore({
      sessionId,
      blocks,
      blockIndex: opts.blockIndex,
      startedAt: opts.startedAt,
      totalPausedMs: opts.totalPausedMs,
    });
  },
  play: async () => {
    console.log('[TimerStore] play');
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
    // Notifications and persistence
    const state = useTimerStore.getState();
    await startBackgroundTimer(engine.remaining, state.currentBlockName || '', state.sessionId || '');
  },
  pause: async () => {
    console.log('[TimerStore] pause');
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
    // Notifications and persistence
    await stopBackgroundTimer();
  },
  resume: async () => {
    console.log('[TimerStore] resume');
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
    // Notifications and persistence
    const state = useTimerStore.getState();
    await startBackgroundTimer(engine.remaining, state.currentBlockName || '', state.sessionId || '');
  },
  skip: async () => {
    console.log('[TimerStore] skip');
    set((state) => {
      const nextIndex = engine.skip(state.blocks);
      let newState;
      if (nextIndex === -1) {
        stopTicking();
        newState = {
          ...state,
          phase: 'completed' as TimerPhase,
        };
      } else {
        newState = {
          ...state,
          blockIndex: nextIndex,
          blockDurationMs: state.blocks[nextIndex]?.durationMinutes ? state.blocks[nextIndex].durationMinutes * 60 * 1000 : 0,
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
    // Notifications and persistence
    await stopBackgroundTimer();
  },
  end: async () => {
    console.log('[TimerStore] end');
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
    // Notifications and persistence
    await stopBackgroundTimer();
  },
  tick: () => {
    console.log('[TimerStore] tick');
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

// Example usage of derived values in a component or selector
const useDerivedTimerValues = () => {
  const engine = useTimerStore((state) => state._engine);
  return {
    remaining: engine.remaining,
    progress: engine.progress,
    isOverdue: engine.isOverdue,
  };
};
