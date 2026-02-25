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

  loadModules: (db: unknown) => Promise<void>;
  createModule: (db: unknown, module: ModuleSpecEntry) => Promise<void>;
  updateModule: (db: unknown, id: string, data: Partial<ModuleSpecEntry>) => Promise<void>;
  archiveModule: (db: unknown, id: string) => Promise<void>;
  deleteModule: (db: unknown, id: string) => Promise<void>;
  getByPlacement: (placement: string) => ModuleSpecEntry[];
  getLiveModules: () => ModuleSpecEntry[];
}

export const useModuleStore = create<ModuleStoreState>((set, get) => ({
  modules: [],
  isLoading: false,

  loadModules: async (db) => {
    set({ isLoading: true });
    try {
      const specs = (await queries.getModuleSpecs(db as unknown)) as ModuleSpecEntry[];
      set({ modules: specs.filter((m) => !m.archivedAt), isLoading: false });
    } catch (err) {
      console.error('Failed to load modules:', err);
      set({ isLoading: false });
    }
  },

  createModule: async (db, module) => {
    try {
      await queries.createModuleSpec(db as unknown, module);
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
      await queries.updateModuleSpec(db as unknown, id, data);
    } catch (err) {
      console.error('Failed to update module:', err);
    }
  },

  archiveModule: async (db, id) => {
    set((state) => ({ modules: state.modules.filter((m) => m.id !== id) }));
    try {
      await queries.updateModuleSpec(db as unknown, id, { archivedAt: new Date().toISOString() });
    } catch (err) {
      console.error('Failed to archive module:', err);
    }
  },

  deleteModule: async (db, id) => {
    set((state) => ({ modules: state.modules.filter((m) => m.id !== id) }));
    try {
      await queries.deleteModuleSpec(db as unknown, id);
    } catch (err) {
      console.error('Failed to delete module:', err);
    }
  },

  getByPlacement: (placement) => get().modules.filter((m) => m.placements.includes(placement)),
  getLiveModules: () => get().modules.filter((m) => m.isLive),
}));
