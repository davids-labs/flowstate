import { useCallback } from 'react';
import { useDayStore } from '../stores/dayStore';
import { useDatabaseSafe } from '../components/DatabaseProvider';
import { useSyncContext } from '../components/SyncProvider';

/**
 * Hook to get and set module values from SQLite for today's date.
 * Falls back gracefully when the database is not ready.
 */
export function useModuleValue(moduleId: string) {
  const { db, isReady } = useDatabaseSafe();
  const { moduleValues, setModuleValue } = useDayStore();
  const { syncModuleValue } = useSyncContext();

  const entry = moduleValues.find(v => v.moduleId === moduleId);
  const value = entry?.value ?? null;

  const setValue = useCallback(
    async (newValue: string) => {
      if (db && isReady) {
        await setModuleValue(db, moduleId, newValue, syncModuleValue);
      }
    },
    [db, isReady, moduleId, setModuleValue, syncModuleValue],
  );

  return { value, setValue, isReady };
}

/**
 * Parse a stored value to its typed form.
 */
export function parseBoolean(value: string | null): boolean {
  if (!value) return false;
  return value === 'true' || value === '1';
}

export function parseNumber(value: string | null): number {
  if (!value) return 0;
  const n = parseFloat(value);
  return isNaN(n) ? 0 : n;
}
