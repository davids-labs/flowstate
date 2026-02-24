// ─── Routine Block ──────────────────────────────────────────────

export type BlockType = 'focus' | 'break' | 'warmup' | 'cooldown' | 'custom';

export interface RoutineBlock {
  id: string;
  name: string;
  durationMinutes: number;
  type: BlockType;
  order: number;
  moduleIds?: string[]; // modules available during this block
}

// ─── Routine ────────────────────────────────────────────────────

export interface Routine {
  id: string;
  name: string;
  description?: string;
  blocks: RoutineBlock[];
  totalDurationMinutes: number;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string | null;
}
