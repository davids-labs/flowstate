import { create } from 'zustand';

// ─── homeStore ────────────────────────────────────────────────────────────────
// Manages the Switchboard filter state for the My Day screen.
// State persists across tab navigation but resets at midnight.
// §1.3 Multi-Select callout
// ─────────────────────────────────────────────────────────────────────────────

export type Pillar = 'gym' | 'academic' | 'life' | 'general';
export const ALL_PILLARS = new Set<Pillar>(['gym', 'academic', 'life']);

interface HomeState {
  /** Currently active switchboard pillars (additive filter) */
  switchboard: Set<Pillar>;
  /** Toggle a pillar on/off. All three CAN all be off. */
  togglePillar: (p: Pillar) => void;
  /** Reset all three pillars to active */
  resetSwitchboard: () => void;
  /** Returns true when ALL three main pillars are active */
  allActive: () => boolean;
}

export const useHomeStore = create<HomeState>((set, get) => ({
  switchboard: new Set<Pillar>(ALL_PILLARS),

  togglePillar(p) {
    set(s => {
      const next = new Set(s.switchboard);
      if (next.has(p)) {
        next.delete(p);
      } else {
        next.add(p);
      }
      return { switchboard: next };
    });
  },

  resetSwitchboard() {
    set({ switchboard: new Set<Pillar>(ALL_PILLARS) });
  },

  allActive() {
    const sw = get().switchboard;
    return sw.has('gym') && sw.has('academic') && sw.has('life');
  },
}));
