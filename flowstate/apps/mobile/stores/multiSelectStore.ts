import { create } from 'zustand';

// ─── multiSelectStore ─────────────────────────────────────────────────────────
// Manages the long-press multi-select mode on timeline rows.
// §1.7 Multi-Select Action Bar
// ─────────────────────────────────────────────────────────────────────────────

interface MultiSelectState {
  isActive: boolean;
  selected: Set<string>;
  /** Enter multi-select mode and optionally pre-select an id */
  enter: (initialId?: string) => void;
  /** Exit multi-select mode and clear all selections */
  exit: () => void;
  /** Toggle an item's selected state */
  toggle: (id: string) => void;
  /** Count of currently selected items */
  count: () => number;
}

export const useMultiSelectStore = create<MultiSelectState>((set, get) => ({
  isActive: false,
  selected: new Set<string>(),

  enter(initialId) {
    const selected = new Set<string>();
    if (initialId) selected.add(initialId);
    set({ isActive: true, selected });
  },

  exit() {
    set({ isActive: false, selected: new Set<string>() });
  },

  toggle(id) {
    set(s => {
      const next = new Set(s.selected);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selected: next };
    });
  },

  count: () => get().selected.size,
}));
