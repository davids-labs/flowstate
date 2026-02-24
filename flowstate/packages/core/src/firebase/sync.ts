import {
  getFirestore,
  collection,
  doc,
  setDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  type DocumentData,
  type Unsubscribe,
} from 'firebase/firestore';
import { app } from './config';
import { getUid } from './auth';

const firestore = getFirestore(app);

// ─── Device ID ──────────────────────────────────────────────────
// Each device generates a unique ID on first launch.
// Used to filter out own writes from Firestore snapshot listeners
// to prevent echo loops.

let _deviceId: string | null = null;

export function getDeviceId(): string {
  if (!_deviceId) {
    _deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
  return _deviceId;
}

/**
 * Set device ID from persisted storage (AsyncStorage / localStorage).
 * Call this at app startup before starting any sync.
 */
export function setDeviceId(id: string): void {
  _deviceId = id;
}

// ─── Offline Command Queue ──────────────────────────────────────
// When a Firestore write fails (offline), the command is queued
// and retried when connectivity is restored.
// Queue is persisted via a save callback to survive app kills.

interface QueuedCommand {
  id: string;
  collectionPath: string;
  docId: string;
  data: Record<string, unknown>;
  timestamp: number;
}

let _offlineQueue: QueuedCommand[] = [];
let _persistQueue: ((queue: QueuedCommand[]) => Promise<void>) | null = null;

/**
 * Set a callback to persist the offline queue (e.g. to AsyncStorage).
 * Call this at app startup.
 */
export function setQueuePersistence(opts: {
  save: (queue: QueuedCommand[]) => Promise<void>;
  load: () => Promise<QueuedCommand[]>;
}): void {
  _persistQueue = opts.save;
  // Load persisted queue on init
  opts.load().then((queue) => {
    if (queue.length > 0) {
      _offlineQueue = queue;
    }
  }).catch(() => {});
}

function enqueueCommand(cmd: Omit<QueuedCommand, 'id' | 'timestamp'>): void {
  _offlineQueue.push({
    ...cmd,
    id: `cmd_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: Date.now(),
  });
  // Persist queue
  if (_persistQueue) {
    _persistQueue(_offlineQueue).catch(() => {});
  }
}

/**
 * Flush all queued commands. Call after connectivity is restored.
 */
export async function flushOfflineQueue(): Promise<{ flushed: number; failed: number }> {
  let flushed = 0;
  let failed = 0;

  while (_offlineQueue.length > 0) {
    const cmd = _offlineQueue[0];
    try {
      const uid = getUid();
      if (!uid) break;
      const docRef = doc(firestore, cmd.collectionPath, cmd.docId);
      await setDoc(docRef, { ...cmd.data, updatedAt: serverTimestamp() }, { merge: true });
      _offlineQueue.shift();
      flushed++;
      // Persist updated queue
      if (_persistQueue) {
        _persistQueue(_offlineQueue).catch(() => {});
      }
    } catch {
      failed++;
      break; // Stop on first failure — will retry later
    }
  }

  return { flushed, failed };
}

// ─── Push to Firestore ──────────────────────────────────────────

/**
 * Push data to a Firestore document under the user's collection.
 * On failure, queues the write for later retry.
 *
 * @param collectionName - e.g. 'timerState', 'moduleValues', 'dayPlans'
 * @param docId - document ID within the collection
 * @param data - the data to write (merged with existing)
 */
export async function pushToFirestore(
  collectionName: string,
  docId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const uid = getUid();
  if (!uid) {
    console.warn('[Sync] No UID — skipping push');
    return;
  }

  const docPath = `users/${uid}/${collectionName}`;
  const payload = {
    ...data,
    deviceId: getDeviceId(),
    updatedAt: serverTimestamp(),
  };

  try {
    const docRef = doc(firestore, docPath, docId);
    await setDoc(docRef, payload, { merge: true });
  } catch (err) {
    console.warn('[Sync] Push failed, queuing for retry:', err);
    enqueueCommand({ collectionPath: docPath, docId, data: payload });
  }
}

// ─── Listen for Remote Changes ──────────────────────────────────

/**
 * Subscribe to real-time changes on a Firestore document.
 * Filters out changes from the local device (echo suppression).
 *
 * @param collectionName - e.g. 'timerState'
 * @param docId - document ID to listen to
 * @param onUpdate - callback with the new data (excluding changes from this device)
 * @returns unsubscribe function
 */
export function listenForRemoteChanges(
  collectionName: string,
  docId: string,
  onUpdate: (data: DocumentData) => void,
): Unsubscribe {
  const uid = getUid();
  if (!uid) {
    console.warn('[Sync] No UID — cannot listen');
    return () => {};
  }

  const docRef = doc(firestore, `users/${uid}/${collectionName}`, docId);

  return onSnapshot(docRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();

    // Filter out own writes to prevent echo
    if (data.deviceId === getDeviceId()) return;

    onUpdate(data);
  });
}

// ─── Timer State Sync ───────────────────────────────────────────

export interface SyncedTimerState {
  phase: string;
  startedAt: number | null;
  pausedAt: number | null;
  totalPausedMs: number;
  blockDurationMs: number;
  blockIndex: number;
  routineId: string | null;
  routineName: string | null;
}

/**
 * Push the current timer state to Firestore.
 * Call on every timer state change (play, pause, resume, skip, end).
 */
export async function pushTimerState(state: SyncedTimerState): Promise<void> {
  await pushToFirestore('timerState', 'active', state as unknown as Record<string, unknown>);
}

/**
 * Listen for remote timer state changes.
 * When the timer is paused on the phone, the desktop will receive the update.
 */
export function listenTimerState(
  onUpdate: (state: SyncedTimerState) => void,
): Unsubscribe {
  return listenForRemoteChanges('timerState', 'active', (data) => {
    onUpdate(data as unknown as SyncedTimerState);
  });
}

// ─── Module Values Sync ─────────────────────────────────────────

/**
 * Push a module value to Firestore.
 */
export async function pushModuleValue(
  date: string,
  moduleId: string,
  value: string,
): Promise<void> {
  await pushToFirestore('moduleValues', `${date}_${moduleId}`, {
    date,
    moduleId,
    value,
    loggedAt: new Date().toISOString(),
  });
}

/**
 * Push a day plan to Firestore.
 */
export async function pushDayPlan(
  date: string,
  data: Record<string, unknown>,
): Promise<void> {
  await pushToFirestore('dayPlans', date, data);
}

// ─── Collection-level Listener ──────────────────────────────────

/**
 * Listen for remote changes to an entire collection (all docs under users/{uid}/{collectionName}).
 * Filters out own-device writes.
 */
export function listenCollection(
  collectionName: string,
  onUpdate: (docs: Array<{ id: string; data: DocumentData }>) => void,
): Unsubscribe {
  const uid = getUid();
  if (!uid) {
    console.warn('[Sync] No UID — cannot listen to collection');
    return () => {};
  }

  const colRef = collection(firestore, `users/${uid}/${collectionName}`);

  return onSnapshot(colRef, (snapshot) => {
    const remoteDocs: Array<{ id: string; data: DocumentData }> = [];
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added' || change.type === 'modified') {
        const data = change.doc.data();
        // Skip own-device writes
        if (data.deviceId === getDeviceId()) return;
        remoteDocs.push({ id: change.doc.id, data });
      }
    });
    if (remoteDocs.length > 0) {
      onUpdate(remoteDocs);
    }
  });
}

// ─── Full Collection Pull ───────────────────────────────────────

/**
 * Pull all documents from a Firestore collection (one-time read).
 * Useful for initial sync on login.
 */
export async function pullCollection(
  collectionName: string,
): Promise<Array<{ id: string; data: DocumentData }>> {
  const uid = getUid();
  if (!uid) return [];

  const colRef = collection(firestore, `users/${uid}/${collectionName}`);
  const snapshot = await getDocs(colRef);

  return snapshot.docs.map((d) => ({ id: d.id, data: d.data() }));
}

// ─── Push Module Specs ──────────────────────────────────────────

/**
 * Push a module spec to Firestore.
 */
export async function pushModuleSpec(
  moduleId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await pushToFirestore('moduleSpecs', moduleId, data);
}

// ─── Push Session ───────────────────────────────────────────────

/**
 * Push a session record to Firestore.
 */
export async function pushSession(
  sessionId: string,
  data: Record<string, unknown>,
): Promise<void> {
  await pushToFirestore('sessions', sessionId, data);
}

// ─── Sync Manager ───────────────────────────────────────────────

/**
 * SyncManager coordinates bidirectional sync.
 * Call start() after auth is ready.
 */
export class SyncManager {
  private _unsubscribers: Unsubscribe[] = [];
  private _flushInterval: ReturnType<typeof setInterval> | null = null;
  private _onRemoteModuleValue?: (date: string, moduleId: string, value: string) => void;
  private _onRemoteDayPlan?: (date: string, data: DocumentData) => void;
  private _onRemoteTimerState?: (state: SyncedTimerState) => void;

  /**
   * Register callbacks for remote data.
   */
  onRemote(handlers: {
    onModuleValue?: (date: string, moduleId: string, value: string) => void;
    onDayPlan?: (date: string, data: DocumentData) => void;
    onTimerState?: (state: SyncedTimerState) => void;
  }) {
    this._onRemoteModuleValue = handlers.onModuleValue;
    this._onRemoteDayPlan = handlers.onDayPlan;
    this._onRemoteTimerState = handlers.onTimerState;
  }

  /**
   * Start listening for remote changes and flush offline queue periodically.
   */
  start() {
    this.stop(); // Clean up previous listeners

    // Listen for remote module values
    if (this._onRemoteModuleValue) {
      const cb = this._onRemoteModuleValue;
      this._unsubscribers.push(
        listenCollection('moduleValues', (docs) => {
          for (const { data } of docs) {
            if (data.date && data.moduleId && data.value) {
              cb(data.date, data.moduleId, data.value);
            }
          }
        }),
      );
    }

    // Listen for remote day plan changes
    if (this._onRemoteDayPlan) {
      const cb = this._onRemoteDayPlan;
      this._unsubscribers.push(
        listenCollection('dayPlans', (docs) => {
          for (const { id, data } of docs) {
            cb(id, data);
          }
        }),
      );
    }

    // Listen for remote timer state
    if (this._onRemoteTimerState) {
      this._unsubscribers.push(listenTimerState(this._onRemoteTimerState));
    }

    // Periodically flush offline queue (every 30s)
    this._flushInterval = setInterval(() => {
      flushOfflineQueue().catch(console.warn);
    }, 30_000);

    // Initial flush
    flushOfflineQueue().catch(console.warn);
  }

  /**
   * Stop all listeners and the flush interval.
   */
  stop() {
    for (const unsub of this._unsubscribers) {
      try { unsub(); } catch { /* ignore */ }
    }
    this._unsubscribers = [];
    if (this._flushInterval) {
      clearInterval(this._flushInterval);
      this._flushInterval = null;
    }
  }

  /**
   * Get the number of items in the offline queue.
   */
  get pendingCount(): number {
    return _offlineQueue.length;
  }
}
