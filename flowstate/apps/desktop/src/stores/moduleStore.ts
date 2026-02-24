import { create } from 'zustand';
import * as queries from '@flowstate/core';

interface ModuleSpecEntry {
  id: string;
  type: string;
  label: string;
  emoji?: string;
  config: Record<string, unknown>;
  placements: string[];
  isLive: boolean;
  required: boolean;
  showInSummary?: boolean;
  collectionId?: string | null;
  metadata?: Record<string, unknown>;
  archivedAt?: string | null;
}

interface ModuleStoreState {
  modules: ModuleSpecEntry[];
  isLoading: boolean;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  loadModules: (db: any) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createModule: (db: any, module: ModuleSpecEntry) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateModule: (db: any, id: string, data: Partial<ModuleSpecEntry>) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  archiveModule: (db: any, id: string) => Promise<void>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  deleteModule: (db: any, id: string) => Promise<void>;
  getByPlacement: (placement: string) => ModuleSpecEntry[];
  getLiveModules: () => ModuleSpecEntry[];
}

export const useModuleStore = create<ModuleStoreState>((set, get) => ({
  modules: [],
  isLoading: false,

  loadModules: async (db) => {
    set({ isLoading: true });
    try {
      const specs = await queries.getModuleSpecs(db);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      set({ modules: specs.filter((m: any) => !m.archivedAt), isLoading: false });
    } catch (err) {
      console.error('Failed to load modules:', err);
      set({ isLoading: false });
    }
  },

  createModule: async (db, module) => {
    try {
      await queries.createModuleSpec(db, module);
      set((state) => ({ modules: [...state.modules, module] }));
    } catch (err) {
      console.error('Failed to create module:', err);
    }
  },

  updateModule: async (db, id, data) => {
    set((state) => ({
      modules: state.modules.map((m) => (m.id === id ? { ...m, ...data } : m)),
    }));
    try {
      await queries.updateModuleSpec(db, id, data);
    } catch (err) {
      console.error('Failed to update module:', err);
    }
  },

  archiveModule: async (db, id) => {
    set((state) => ({ modules: state.modules.filter((m) => m.id !== id) }));
    try {
      await queries.updateModuleSpec(db, id, { archivedAt: new Date().toISOString() });
    } catch (err) {
      console.error('Failed to archive module:', err);
    }
  },

  deleteModule: async (db, id) => {
    set((state) => ({ modules: state.modules.filter((m) => m.id !== id) }));
    try {
      await queries.deleteModuleSpec(db, id);
    } catch (err) {
      console.error('Failed to delete module:', err);
    }
  },

  getByPlacement: (placement) => get().modules.filter((m) => m.placements.includes(placement)),
  getLiveModules: () => get().modules.filter((m) => m.isLive),
}));
