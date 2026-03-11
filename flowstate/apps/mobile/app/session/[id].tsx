import React, { useEffect, useCallback, useState, useRef } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator, FlatList } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { fontSize, spacing, borderRadius } from "../../constants/theme";
import { useTheme } from "../../constants/ThemeContext";
import { useDatabaseSafe } from "../../components/DatabaseProvider";
import { useSyncContext } from "../../components/SyncProvider";
import {
  getSession,
  getRoutine,
  getRoutineBlocks,
  updateSession,
  createSessionEvent,
  getSessions,
} from "@flowstate/core";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTimerStore } from "../../stores/timerStore";
import { stopBackgroundTimer, cancelTimerNotifications } from "../../services/notifications";

function formatTime(ms: number): string {
  const isNegative = ms < 0;
  const absMs = Math.abs(ms);
  const totalSeconds = Math.floor(absMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const prefix = isNegative ? "+" : "";
  return `${prefix}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

const RING_SIZE = 240;
const STROKE_WIDTH = 10;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface SessionBlock {
  name: string;
  durationMinutes: number;
}

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { db, isReady } = useDatabaseSafe();
  const { syncSession, syncTimerState } = useSyncContext();
  const { themeColors } = useTheme();

  const [sessionData, setSessionData] = useState<{
    routineName: string;
    blocks: SessionBlock[];
    status?: string;
    startedAt?: string | null;
    totalPausedMs?: number;
    currentBlockIndex?: number;
    dayPlanId?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // navigation list
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState<number>(0);
  const currentSessionId = allSessions[currentSessionIndex]?.id ?? id;

  // undo
  const [undoVisible, setUndoVisible] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Timer store — select only stable scalar values ──────────
  // IMPORTANT: Never select _engine getters (remaining/progress/isOverdue) here.
  // Those are computed via Date.now() which changes every ms → infinite re-render.
  // Instead select the stable numbers that the store's tick() updates once/second.
  const phase         = useTimerStore((s) => s.phase);
  const blockIndex    = useTimerStore((s) => s.blockIndex);
  const totalBlocks   = useTimerStore((s) => s.totalBlocks);
  const currentBlockName = useTimerStore((s) => s.currentBlockName);
  const pausedAt      = useTimerStore((s) => s.pausedAt);
  const blockDurationMs  = useTimerStore((s) => s.blockDurationMs);
  const elapsed       = useTimerStore((s) => s.elapsed);
  const init   = useTimerStore((s) => s.init);
  const restore = useTimerStore((s) => s.restore);
  const play   = useTimerStore((s) => s.play);
  const pause  = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const skip   = useTimerStore((s) => s.skip);
  const end    = useTimerStore((s) => s.end);

  // ─── Derive display values from stable store scalars ─────────
  // These compute once per tick (every 1 second) — NOT on every render.
  const remaining = blockDurationMs - elapsed;
  const progress  = blockDurationMs > 0 ? Math.min(elapsed / blockDurationMs, 1) : 0;
  const isOverdue = phase === 'overdue' || (phase === 'running' && remaining < 0);

  const ringColor = isOverdue ? themeColors.danger : themeColors.accent;

  // Load session + siblings
  const loadSessionData = useCallback(async (targetId: string) => {
    if (!db || !isReady || !targetId) {
      setLoading(false);
      return;
    }
    try {
      const sess = await getSession(db, targetId);
      if (!sess) {
        setSessionData(null);
        setLoading(false);
        return;
      }

      const siblings = await getSessions(db, sess.dayPlanId);
      setAllSessions((prev) => {
        const isDifferent =
          prev.length !== siblings.length ||
          siblings.some((s: any, i: number) => s.id !== prev[i]?.id);
        return isDifferent ? siblings : prev;
      });
      const idx = siblings.findIndex((s: any) => s.id === targetId);
      if (idx >= 0) setCurrentSessionIndex((prev) => (idx !== prev ? idx : prev));

      let blocks: SessionBlock[] = [];
      try {
        const routineBlockRows = await getRoutineBlocks(db, sess.routineId);
        if (routineBlockRows.length > 0) {
          blocks = routineBlockRows.map((b: any) => ({
            name: b.name,
            durationMinutes: b.durationMinutes,
          }));
        }
      } catch {}

      if (blocks.length === 0) {
        const routine = await getRoutine(db, sess.routineId);
        const dur = routine?.totalDurationMinutes ?? 25;
        blocks = [{ name: "Focus", durationMinutes: dur }];
      }

      setSessionData({
        routineName: sess.routineName,
        blocks,
        status: sess.status,
        startedAt: sess.startedAt,
        totalPausedMs: sess.totalPausedMs ?? 0,
        currentBlockIndex: sess.currentBlockIndex ?? 0,
        dayPlanId: sess.dayPlanId,
      });

      // Initialize the timer engine only if it's not already tracking this session
      const timerState = useTimerStore.getState();
      if (timerState.sessionId !== targetId && sess.status !== 'completed') {
        if (sess.status === 'in_progress' && sess.startedAt) {
          restore(targetId, blocks, sess.routineName, {
            blockIndex: sess.currentBlockIndex ?? 0,
            startedAt: new Date(sess.startedAt).getTime(),
            totalPausedMs: sess.totalPausedMs ?? 0,
          });
        } else {
          init(targetId, blocks, sess.routineName);
        }
      }

      await createSessionEvent(db, { sessionId: targetId, type: "session_opened" });
    } catch (e) {
      console.error("Failed to load session:", e);
      setSessionData(null);
    } finally {
      setLoading(false);
    }
  }, [db, isReady, init, restore]);

  useEffect(() => {
    if (id) loadSessionData(id);
  }, [id, loadSessionData]);

  useEffect(() => {
    if (sessionData && sessionData.status !== 'completed') {
      activateKeepAwakeAsync();
      return () => { deactivateKeepAwake(); };
    }
  }, [sessionData]);

  // Persist helpers (read store state imperatively — no selector needed)
  const persistTimerState = useCallback(async (status: string, extraData?: Record<string, unknown>) => {
    if (!db || !currentSessionId) return;
    try {
      const s = useTimerStore.getState();
      await updateSession(db, currentSessionId, {
        status,
        totalPausedMs: s._engine?.state?.totalPausedMs ?? 0,
        currentBlockIndex: s._engine?.state?.blockIndex ?? 0,
        ...extraData,
      });
    } catch (e) {
      console.error('Failed to persist timer state:', e);
    }
  }, [db, currentSessionId]);

  const pushTimerSync = useCallback(() => {
    const s = useTimerStore.getState();
    syncTimerState({
      phase: s.phase,
      startedAt: s._engine?.state?.startedAt ?? null,
      pausedAt: s._engine?.state?.pausedAt ?? null,
      totalPausedMs: s._engine?.state?.totalPausedMs ?? 0,
      blockDurationMs: s._engine?.state?.blockDurationMs ?? 0,
      blockIndex: s.blockIndex,
      routineId: null,
      routineName: s.routineName,
    });
  }, [syncTimerState]);

  // Navigation between sessions
  const navigateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const navigateToSession = useCallback(async (targetIndex: number) => {
    const target = allSessions[targetIndex];
    if (!target) return;
    if (navigateDebounceRef.current) clearTimeout(navigateDebounceRef.current);
    navigateDebounceRef.current = setTimeout(async () => {
      if (phase === 'running' || phase === 'paused' || phase === 'overdue') {
        await persistTimerState('in_progress');
      }
      if (typeof end === 'function') await end();
      try {
        await stopBackgroundTimer();
        await cancelTimerNotifications();
      } catch {}
      try { await AsyncStorage.removeItem('flowstate_timer_state'); } catch {}
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setCurrentSessionIndex(targetIndex);
      setLoading(true);
      await loadSessionData(target.id);
    }, 200);
  }, [allSessions, phase, persistTimerState, end, loadSessionData]);

  // Live pause duration display
  const [pauseElapsed, setPauseElapsed] = useState(0);
  useEffect(() => {
    if (phase !== 'paused' || !pausedAt) {
      setPauseElapsed(0);
      return;
    }
    setPauseElapsed(Date.now() - pausedAt);
    const iv = setInterval(() => setPauseElapsed(Date.now() - pausedAt), 250);
    return () => clearInterval(iv);
  }, [phase, pausedAt]);

  const getPauseColor = (pauseMs: number, blockMs: number) => {
    if (blockMs <= 0) return themeColors.success;
    const ratio = pauseMs / blockMs;
    if (ratio < 0.05) return themeColors.success;
    if (ratio < 0.15) return '#A3E635';
    if (ratio < 0.3)  return themeColors.warning;
    if (ratio < 0.6)  return '#F97316';
    return themeColors.danger;
  };

  // Actions
  const handlePlayPause = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (phase === "idle") {
      play();
      if (db && currentSessionId) {
        updateSession(db, currentSessionId, {
          status: "in_progress",
          startedAt: new Date().toISOString(),
        }).catch(() => {});
        createSessionEvent(db, { sessionId: currentSessionId, type: 'started' }).catch(() => {});
      }
      pushTimerSync();
    } else if (phase === "running" || phase === "overdue") {
      pause();
      persistTimerState('in_progress');
      if (db && currentSessionId)
        createSessionEvent(db, { sessionId: currentSessionId, type: 'paused' }).catch(() => {});
      pushTimerSync();
    } else if (phase === "paused") {
      resume();
      persistTimerState('in_progress');
      if (db && currentSessionId)
        createSessionEvent(db, { sessionId: currentSessionId, type: 'resumed' }).catch(() => {});
      pushTimerSync();
    } else if (phase === "completed") {
      router.replace(`/session/debrief?sessionId=${currentSessionId}`);
    }
  }, [phase, play, pause, resume, db, currentSessionId, persistTimerState, pushTimerSync, router]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    skip();
    persistTimerState('in_progress');
    if (db && currentSessionId)
      createSessionEvent(db, { sessionId: currentSessionId, type: 'block_skipped', blockIndex }).catch(() => {});
    pushTimerSync();
  }, [skip, db, currentSessionId, blockIndex, persistTimerState, pushTimerSync]);

  const handleEnd = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    end();
    if (db && currentSessionId) {
      try {
        await updateSession(db, currentSessionId, {
          status: "completed",
          endedAt: new Date().toISOString(),
        });
        await createSessionEvent(db, { sessionId: currentSessionId, type: 'ended' });
        syncSession(currentSessionId, { status: "completed", endedAt: new Date().toISOString() });
        pushTimerSync();
      } catch (e) {
        console.error("Failed to save session completion:", e);
      }
    }
    router.replace(`/session/debrief?sessionId=${currentSessionId}`);
  }, [end, router, db, currentSessionId, syncSession, pushTimerSync]);

  const handleUndoComplete = useCallback(async () => {
    if (!db || !currentSessionId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await updateSession(db, currentSessionId, { status: "in_progress", endedAt: null });
      await createSessionEvent(db, { sessionId: currentSessionId, type: "session_undone" });
      setLoading(true);
      await loadSessionData(currentSessionId);
      setUndoVisible(false);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    } catch (e) {
      console.error("Failed to undo session:", e);
    }
  }, [db, currentSessionId, loadSessionData]);

  // ─── Render ───────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.accent} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
          Loading session...
        </Text>
      </View>
    );
  }

  if (!sessionData) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Feather name="alert-circle" size={48} color={themeColors.danger} />
        <Text style={[styles.routineName, { color: themeColors.textSecondary }]}>
          Session Not Found
        </Text>
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>
          This session may have been deleted or doesn't exist.
        </Text>
        <Pressable
          style={[styles.endBtn, { backgroundColor: themeColors.accent }]}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
        >
          <Text style={[styles.endBtnText, { color: themeColors.white }]}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const session = sessionData;
  const block = session.blocks[blockIndex] ?? session.blocks[0];
  const timerProgress = Math.min(progress, 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - timerProgress);
  const isPaused = phase === "idle" || phase === "paused" || phase === "completed";
  const isCompleted = sessionData?.status === "completed" || phase === "completed";

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>

      {/* Session navigation */}
      {allSessions.length > 1 && (
        <View style={styles.sessionNav}>
          <Pressable
            onPress={() => navigateToSession(currentSessionIndex - 1)}
            disabled={currentSessionIndex <= 0}
            style={[styles.navArrow, currentSessionIndex <= 0 && { opacity: 0.3 }]}
          >
            <Feather name="chevron-left" size={22} color={themeColors.accent} />
          </Pressable>

          <FlatList
            data={allSessions}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item: any) => item.id}
            contentContainerStyle={{ gap: spacing.xs, alignItems: 'center' }}
            renderItem={({ item, index }: { item: any; index: number }) => {
              const isCurrent = index === currentSessionIndex;
              const done = item.status === 'completed';
              return (
                <Pressable
                  onPress={() => navigateToSession(index)}
                  style={[
                    styles.sessionPill,
                    { backgroundColor: isCurrent ? themeColors.accent : themeColors.surface },
                    done && !isCurrent && { backgroundColor: themeColors.success },
                  ]}
                >
                  <Text
                    style={[
                      styles.sessionPillText,
                      { color: isCurrent || done ? '#fff' : themeColors.text },
                    ]}
                    numberOfLines={1}
                  >
                    {item.routineName}
                  </Text>
                </Pressable>
              );
            }}
          />

          <Pressable
            onPress={() => navigateToSession(currentSessionIndex + 1)}
            disabled={currentSessionIndex >= allSessions.length - 1}
            style={[
              styles.navArrow,
              currentSessionIndex >= allSessions.length - 1 && { opacity: 0.3 },
            ]}
          >
            <Feather name="chevron-right" size={22} color={themeColors.accent} />
          </Pressable>
        </View>
      )}

      <Text style={[styles.routineName, { color: themeColors.textSecondary }]}>
        {session.routineName}
      </Text>

      {/* Timer Ring */}
      <View style={styles.ringContainer}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
            stroke={themeColors.surfaceBorder} strokeWidth={STROKE_WIDTH} fill="none"
          />
          <Circle
            cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
            stroke={ringColor} strokeWidth={STROKE_WIDTH} fill="none"
            strokeDasharray={CIRCUMFERENCE} strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        <View style={styles.timeOverlay}>
          <Text
            style={[
              styles.timeText,
              { color: themeColors.text },
              isOverdue && { color: themeColors.danger },
            ]}
          >
            {formatTime(remaining)}
          </Text>
        </View>
      </View>

      <Text style={[styles.blockName, { color: themeColors.text }]}>
        {currentBlockName || block?.name || "Ready"}
      </Text>
      <Text style={[styles.blockMeta, { color: themeColors.textSecondary }]}>
        Block {blockIndex + 1} of {totalBlocks || session.blocks.length}
      </Text>

      <View style={styles.chipRow}>
        {session.blocks.map((_b, i) => (
          <View
            key={i}
            style={[
              styles.chip,
              { backgroundColor: themeColors.surfaceBorder },
              i < blockIndex && { backgroundColor: themeColors.success },
              i === blockIndex && { backgroundColor: themeColors.accent },
            ]}
          />
        ))}
      </View>

      {phase === 'paused' && pausedAt !== null && pauseElapsed > 0 && (
        <View style={[styles.pauseView, { backgroundColor: themeColors.surface }]}>
          <Feather name="pause-circle" size={20} color={getPauseColor(pauseElapsed, blockDurationMs)} />
          <View style={styles.pauseInfo}>
            <Text style={[styles.pauseLabel, { color: themeColors.textSecondary }]}>Paused for</Text>
            <Text style={[styles.pauseTime, { color: getPauseColor(pauseElapsed, blockDurationMs) }]}>
              {formatTime(pauseElapsed)}
            </Text>
          </View>
          <View style={[styles.pauseBar, { backgroundColor: themeColors.surfaceBorder }]}>
            <View
              style={[
                styles.pauseBarFill,
                {
                  backgroundColor: getPauseColor(pauseElapsed, blockDurationMs),
                  width: `${Math.min((pauseElapsed / Math.max(blockDurationMs, 1)) * 100, 100)}%`,
                },
              ]}
            />
          </View>
        </View>
      )}

      {isCompleted ? (
        <View style={styles.completedControls}>
          <Pressable
            style={[styles.undoBtn, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}
            onPress={handleUndoComplete}
          >
            <Feather name="rotate-ccw" size={20} color={themeColors.warning} />
            <Text style={[styles.undoBtnText, { color: themeColors.text }]}>Undo Complete</Text>
          </Pressable>
          <Pressable
            style={[styles.endBtn, { backgroundColor: themeColors.accent }]}
            onPress={() => router.replace(`/session/debrief?sessionId=${currentSessionId}`)}
          >
            <Text style={[styles.endBtnText, { color: themeColors.white }]}>View Debrief</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.controls}>
          <Pressable
            style={[styles.controlBtn, { backgroundColor: themeColors.surface }]}
            onPress={handlePlayPause}
          >
            {isPaused
              ? <Feather name="play" size={28} color={themeColors.accent} />
              : <Feather name="pause" size={28} color={themeColors.accent} />
            }
          </Pressable>

          <Pressable
            style={[styles.controlBtn, { backgroundColor: themeColors.surface }]}
            onPress={handleSkip}
          >
            <Feather name="skip-forward" size={28} color={themeColors.textSecondary} />
          </Pressable>

          <Pressable style={styles.controlBtnDanger} onPress={handleEnd}>
            <Feather name="square" size={22} color={themeColors.danger} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  loadingText: { marginTop: spacing.md, fontSize: fontSize.md },
  routineName: { fontSize: fontSize.lg, fontWeight: "600", marginBottom: spacing.xl },
  ringContainer: {
    width: RING_SIZE, height: RING_SIZE,
    alignItems: "center", justifyContent: "center",
  },
  timeOverlay: { position: "absolute", alignItems: "center", justifyContent: "center" },
  timeText: { fontSize: fontSize.hero, fontWeight: "800" },
  blockName: { fontSize: fontSize.xl, fontWeight: "700", marginTop: spacing.lg },
  blockMeta: { fontSize: fontSize.sm, marginTop: spacing.xs },
  chipRow: {
    flexDirection: "row", gap: spacing.xs,
    marginTop: spacing.lg, marginBottom: spacing.xxl,
  },
  chip: { width: 24, height: 6, borderRadius: borderRadius.full },
  controls: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
  controlBtn: {
    width: 64, height: 64, borderRadius: borderRadius.full,
    alignItems: "center", justifyContent: "center",
  },
  controlBtnDanger: {
    width: 52, height: 52, borderRadius: borderRadius.full,
    backgroundColor: "#FEE2E2", alignItems: "center", justifyContent: "center",
  },
  completedControls: { alignItems: "center", gap: spacing.md },
  undoBtn: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    paddingHorizontal: spacing.lg, paddingVertical: spacing.md,
    borderRadius: borderRadius.lg, borderWidth: 1,
  },
  undoBtnText: { fontSize: fontSize.md, fontWeight: "600" },
  sessionNav: {
    flexDirection: "row", alignItems: "center",
    width: "100%", paddingHorizontal: spacing.sm, marginBottom: spacing.lg,
  },
  navArrow: { padding: spacing.xs },
  sessionPill: {
    paddingHorizontal: spacing.sm, paddingVertical: spacing.xs,
    borderRadius: borderRadius.md, minWidth: 60, alignItems: "center",
  },
  sessionPillText: { fontSize: fontSize.xs, fontWeight: "600", maxWidth: 80 },
  pauseView: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg, marginBottom: spacing.lg, width: '100%',
  },
  pauseInfo: { flex: 1 },
  pauseLabel: { fontSize: fontSize.xs, fontWeight: '500' },
  pauseTime: { fontSize: fontSize.lg, fontWeight: '800' },
  pauseBar: { width: 80, height: 6, borderRadius: 3, overflow: 'hidden' },
  pauseBarFill: { height: '100%', borderRadius: 3 },
  endBtn: {
    marginTop: spacing.lg, paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md, borderRadius: borderRadius.lg,
  },
  endBtnText: { fontSize: fontSize.md, fontWeight: '700' },
});