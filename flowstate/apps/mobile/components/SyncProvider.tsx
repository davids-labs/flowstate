import React, { useEffect, useRef, useState, createContext, useContext } from "react";
import {
  SyncManager,
  signInAnon,
  listenAuthState,
  setDeviceId,
  setQueuePersistence,
  pushModuleValue,
  pushDayPlan,
  pushTimerState,
  pushSession,
  pullCollection,
  getUid,
  type SyncedTimerState,
} from "@flowstate/core";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useDatabaseSafe } from "./DatabaseProvider";
import { upsertModuleValue, upsertDayPlan } from "@flowstate/core";

const DEVICE_ID_KEY = "flowstate_device_id";
const SYNC_QUEUE_KEY = "flowstate_sync_queue";
const INITIAL_PULL_DONE_KEY = "flowstate_initial_pull_done";

interface SyncContextValue {
  isAuthenticated: boolean;
  isSyncing: boolean;
  uid: string | null;
  pendingCount: number;
  /** Push a module value change to the cloud */
  syncModuleValue: (date: string, moduleId: string, value: string) => void;
  /** Push a day plan update to the cloud */
  syncDayPlan: (date: string, data: Record<string, unknown>) => void;
  /** Push timer state to the cloud */
  syncTimerState: (state: SyncedTimerState) => void;
  /** Push a session record to the cloud */
  syncSession: (sessionId: string, data: Record<string, unknown>) => void;
}

const SyncContext = createContext<SyncContextValue>({
  isAuthenticated: false,
  isSyncing: false,
  uid: null,
  pendingCount: 0,
  syncModuleValue: () => {},
  syncDayPlan: () => {},
  syncTimerState: () => {},
  syncSession: () => {},
});

export function useSyncContext() {
  return useContext(SyncContext);
}

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const { db, isReady } = useDatabaseSafe();
  const managerRef = useRef<SyncManager | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [uid, setUid] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  // Initialize device ID and auth
  useEffect(() => {
    let unsubAuth: (() => void) | null = null;

    (async () => {
      try {
        // Restore or create device ID
        let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (!deviceId) {
          deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
          await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
        }
        setDeviceId(deviceId);

        // Set up persistent offline queue
        setQueuePersistence({
          save: async (queue) => {
            await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
          },
          load: async () => {
            const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
            return raw ? JSON.parse(raw) : [];
          },
        });

        // Listen for auth state
        unsubAuth = listenAuthState((user) => {
          setIsAuthenticated(!!user);
          setUid(user?.uid ?? null);
        });

        // Attempt anonymous sign-in
        const userUid = await signInAnon();
        setUid(userUid);
        setIsAuthenticated(true);
      } catch (err) {
        // Firebase not configured or network issue — sync just won't work
        console.warn("[SyncProvider] Auth init failed (sync disabled):", err);
      }
    })();

    return () => {
      if (unsubAuth) unsubAuth();
    };
  }, []);

  // Start/stop SyncManager based on auth + db readiness
  useEffect(() => {
    if (!isAuthenticated || !db || !isReady) return;

    try {
      const manager = new SyncManager();
      managerRef.current = manager;

      manager.onRemote({
        onModuleValue: async (date, moduleId, value) => {
          try {
            await upsertModuleValue(db, { moduleId, date, value });
          } catch (e) {
            console.warn("[Sync] Failed to apply remote module value:", e);
          }
        },
        onDayPlan: async (date, data) => {
          try {
            await upsertDayPlan(db, {
              date,
              title: data.title ?? "",
              mustDo: data.mustDo,
              mustDoDone: data.mustDoDone,
              moduleIds: data.moduleIds,
              notes: data.notes,
            });
          } catch (e) {
            console.warn("[Sync] Failed to apply remote day plan:", e);
          }
        },
        onTimerState: (state) => {
          // Import and apply remote timer state to the timer store
          try {
            const { useTimerStore } = require('../stores/timerStore');
            const store = useTimerStore.getState();
            // Only apply if we're not actively running a session locally
            if (store.phase === 'idle' || store.phase === 'completed') {
              console.log('[Sync] Received remote timer state:', state.phase);
            }
          } catch (e) {
            console.warn('[Sync] Failed to apply remote timer state:', e);
          }
        },
      });

      manager.start();
      setIsSyncing(true);

      // Perform initial data pull on first login
      (async () => {
        try {
          const pulled = await AsyncStorage.getItem(INITIAL_PULL_DONE_KEY);
          if (!pulled) {
            console.log('[Sync] Performing initial data pull...');
            const moduleValueDocs = await pullCollection('moduleValues');
            for (const { data } of moduleValueDocs) {
              if (data.date && data.moduleId && data.value) {
                try {
                  await upsertModuleValue(db, {
                    moduleId: data.moduleId,
                    date: data.date,
                    value: data.value,
                  });
                } catch {}
              }
            }
            const dayPlanDocs = await pullCollection('dayPlans');
            for (const { id: docId, data } of dayPlanDocs) {
              try {
                await upsertDayPlan(db, {
                  date: docId,
                  title: data.title ?? '',
                  mustDo: data.mustDo,
                  mustDoDone: data.mustDoDone,
                  moduleIds: data.moduleIds,
                  notes: data.notes,
                });
              } catch {}
            }
            await AsyncStorage.setItem(INITIAL_PULL_DONE_KEY, 'true');
            console.log('[Sync] Initial pull complete.');
          }
        } catch (e) {
          console.warn('[Sync] Initial pull failed:', e);
        }
      })();

      // Track pending queue, throttle updates
      let lastCount = manager.pendingCount;
      setPendingCount(lastCount);
      const interval = setInterval(() => {
        const newCount = manager.pendingCount;
        if (newCount !== lastCount) {
          setPendingCount(newCount);
          lastCount = newCount;
        }
      }, 10_000);

      return () => {
        clearInterval(interval);
        manager.stop();
        managerRef.current = null;
        setIsSyncing(false);
      };
    } catch (err) {
      console.warn("[SyncProvider] Manager start failed:", err);
    }
  }, [isAuthenticated, db, isReady]);

  const value: SyncContextValue = React.useMemo(() => ({
    isAuthenticated,
    isSyncing,
    uid,
    pendingCount,
    syncModuleValue: (date, moduleId, val) => {
      pushModuleValue(date, moduleId, val).catch(() => {});
    },
    syncDayPlan: (date, data) => {
      pushDayPlan(date, data).catch(() => {});
    },
    syncTimerState: (state) => {
      pushTimerState(state).catch(() => {});
    },
    syncSession: (sessionId, data) => {
      pushSession(sessionId, data).catch(() => {});
    },
  }), [isAuthenticated, isSyncing, uid, pendingCount]);

  return (
    <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
  );
}
