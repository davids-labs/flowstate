import { create } from 'zustand';
import { TimerEngine } from '@flowstate/core';
import type { TimerPhase } from '@flowstate/core';

// Electron IPC bridge (available when running in Electron, undefined in browser dev)
declare global {
  interface Window {
    electronAPI?: {
      updateTimerState: (state: {
        phase: string;
        remaining: number;
        blockName: string;
        routineName: string;
        isOverdue: boolean;
      }) => void;
      setTimerActive: (isActive: boolean) => void;
    };
  }
}

function pushToTray(state: Partial<TimerStoreState>) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    window.electronAPI.updateTimerState({
      phase: state.phase ?? 'idle',
      remaining: state.remaining ?? 0,
      blockName: state.currentBlockName ?? '',
      routineName: state.routineName ?? '',
      isOverdue: state.isOverdue ?? false,
    });
  }
}

function notifyTimerActive(isActive: boolean) {
  if (typeof window !== 'undefined' && window.electronAPI) {
    window.electronAPI.setTimerActive(isActive);
  }
}

interface TimerBlock {
  name: string;
  durationMinutes: number;
}

interface TimerStoreState {
  phase: TimerPhase;
  remaining: number;
  elapsed: number;
  progress: number;
  blockIndex: number;
  totalBlocks: number;
  isOverdue: boolean;
  sessionId: string | null;
  blocks: TimerBlock[];
  currentBlockName: string;
  routineName: string;

  init: (sessionId: string, blocks: TimerBlock[], routineName?: string) => void;
  play: () => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  end: () => void;
  tick: () => void;

  _engine: TimerEngine;
  _intervalId: ReturnType<typeof setInterval> | null;
}

const engine = new TimerEngine();

export const useTimerStore = create<TimerStoreState>((set, get) => {
  const syncFromEngine = () => {
    const e = get()._engine;
    const blocks = get().blocks;
    const newState = {
      phase: e.phase,
      remaining: e.remaining,
      elapsed: e.elapsed,
      progress: e.progress,
      blockIndex: e.state.blockIndex,
      totalBlocks: e.state.totalBlocks,
      isOverdue: e.isOverdue,
      sessionId: e.state.sessionId,
      currentBlockName: blocks[e.state.blockIndex]?.name ?? '',
    };
    set(newState);
    // Push to system tray
    pushToTray({ ...newState, routineName: get().routineName });
  };

  const startTicking = () => {
    const prev = get()._intervalId;
    if (prev) clearInterval(prev);
    const id = setInterval(() => {
      get()._engine.tick();
      syncFromEngine();
    }, 250);
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
    phase: 'idle' as TimerPhase,
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
    _engine: engine,
    _intervalId: null,

    init: (sessionId, blocks, routineName) => {
      stopTicking();
      set({ blocks, routineName: routineName ?? '' });
      get()._engine.init({
        sessionId,
        blocks: blocks.map((b) => ({ durationMinutes: b.durationMinutes })),
      });
      syncFromEngine();
    },

    play: () => {
      get()._engine.play();
      syncFromEngine();
      startTicking();
      notifyTimerActive(true);
    },

    pause: () => {
      get()._engine.pause();
      syncFromEngine();
      stopTicking();
      notifyTimerActive(false);
    },

    resume: () => {
      get()._engine.resume();
      syncFromEngine();
      startTicking();
      notifyTimerActive(true);
    },

    skip: () => {
      const blocks = get().blocks;
      get()._engine.skip(blocks.map((b) => ({ durationMinutes: b.durationMinutes })));
      syncFromEngine();
    },

    end: () => {
      get()._engine.end();
      syncFromEngine();
      stopTicking();
      notifyTimerActive(false);
    },

    tick: () => {
      get()._engine.tick();
      syncFromEngine();
    },
  };
});
