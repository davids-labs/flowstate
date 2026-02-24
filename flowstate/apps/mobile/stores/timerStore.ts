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

interface TimerBlock {
  name: string;
  durationMinutes: number;
}

interface TimerStoreState {
  // State
  phase: TimerPhase;
  remaining: number; // ms
  elapsed: number; // ms
  progress: number; // 0..1
  blockIndex: number;
  totalBlocks: number;
  isOverdue: boolean;
  sessionId: string | null;
  blocks: TimerBlock[];
  currentBlockName: string;
  routineName: string;
  pausedAt: number | null; // timestamp when paused
  blockDurationMs: number; // current block total duration

  // Actions
  init: (sessionId: string, blocks: TimerBlock[], routineName?: string) => void;
  restore: (sessionId: string, blocks: TimerBlock[], routineName: string, opts: {
    blockIndex: number;
    startedAt: number;
    totalPausedMs: number;
  }) => void;
  play: () => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  end: () => void;
  tick: () => void;

  // Internal
  _engine: TimerEngine;
  _intervalId: ReturnType<typeof setInterval> | null;
  _notifCounter: number;
}

const engine = new TimerEngine();

export const useTimerStore = create<TimerStoreState>((set, get) => {
  // Sync Zustand state from engine
  const syncFromEngine = () => {
    const e = get()._engine;
    const blocks = get().blocks;
    set({
      phase: e.phase,
      remaining: e.remaining,
      elapsed: e.elapsed,
      progress: e.progress,
      blockIndex: e.state.blockIndex,
      totalBlocks: e.state.totalBlocks,
      isOverdue: e.isOverdue,
      sessionId: e.state.sessionId,
      currentBlockName: blocks[e.state.blockIndex]?.name ?? '',
      pausedAt: e.state.pausedAt,
      blockDurationMs: e.state.blockDurationMs,
    });
  };

  const updateNotification = () => {
    const state = get();
    // Only update notification every ~1 second (every 4th tick at 250ms interval)
    const counter = (state._notifCounter + 1) % 4;
    set({ _notifCounter: counter });
    if (counter !== 0) return;

    if (state.phase === 'running' || state.phase === 'overdue') {
      showTimerNotification(
        state.remaining,
        state.currentBlockName,
        state.routineName,
      ).catch(() => {});
    }
  };

  const startTicking = () => {
    const existing = get()._intervalId;
    if (existing) clearInterval(existing);
    const id = setInterval(() => {
      const e = get()._engine;
      e.tick();
      syncFromEngine();
      updateNotification();
    }, 250); // tick 4 times per second for smooth UI
    set({ _intervalId: id });
  };

  const stopTicking = () => {
    const id = get()._intervalId;
    if (id) {
      clearInterval(id);
      set({ _intervalId: null });
    }
  };

  return {
    phase: 'idle',
    remaining: 0,
    elapsed: 0,
    progress: 0,
    blockIndex: 0,
    totalBlocks: 0,
    isOverdue: false,
    sessionId: null,
    blocks: [],
    currentBlockName: '',
    routineName: '',
    pausedAt: null,
    blockDurationMs: 0,
    _engine: engine,
    _intervalId: null,
    _notifCounter: 0,

    init: (sessionId: string, blocks: TimerBlock[], routineName?: string) => {
      stopTicking();
      engine.init({ sessionId, blocks });
      set({ blocks, routineName: routineName ?? '' });
      syncFromEngine();
    },

    restore: (sessionId, blocks, routineName, opts) => {
      stopTicking();
      engine.restore({
        sessionId,
        blocks,
        blockIndex: opts.blockIndex,
        startedAt: opts.startedAt,
        totalPausedMs: opts.totalPausedMs,
      });
      set({ blocks, routineName });
      syncFromEngine();
    },

    play: () => {
      engine.play();
      startTicking();
      const s = get();
      startBackgroundTimer(s.remaining, s.currentBlockName || 'Focus', s.routineName).catch(() => {});
      syncFromEngine();
    },

    pause: () => {
      engine.pause();
      stopTicking();
      stopBackgroundTimer().catch(() => {});
      syncFromEngine();
    },

    resume: () => {
      engine.resume();
      startTicking();
      const s = get();
      startBackgroundTimer(s.remaining, s.currentBlockName || 'Focus', s.routineName).catch(() => {});
      syncFromEngine();
    },

    skip: () => {
      const blocks = get().blocks;
      engine.skip(blocks);
      syncFromEngine();
      if (engine.phase === 'completed') {
        stopTicking();
        cancelTimerNotifications().catch(() => {});
      }
    },

    end: () => {
      engine.end();
      stopTicking();
      stopBackgroundTimer().catch(() => {});
      syncFromEngine();
    },

    tick: () => {
      engine.tick();
      syncFromEngine();
    },
  };
});
