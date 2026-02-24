import React, { useEffect, useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { fontSize, spacing, borderRadius } from "../../constants/theme";
import { useTheme } from "../../constants/ThemeContext";
import { useTimerStore } from "../../stores/timerStore";
import { useDatabaseSafe } from "../../components/DatabaseProvider";
import { useSyncContext } from "../../components/SyncProvider";
import {
  getSession,
  getRoutine,
  getRoutineBlocks,
  updateSession,
  createSessionEvent,
} from "@flowstate/core";

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
  } | null>(null);
  const [loading, setLoading] = useState(true);

  // Load session + routine blocks from DB
  useEffect(() => {
    if (!db || !isReady || !id) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const sess = await getSession(db, id);
        if (!sess) {
          // Session not found — show error state instead of fake data
          setSessionData(null);
          setLoading(false);
          return;
        }

        // Load routine blocks
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

        // If no blocks defined in routine, create a default based on routine duration
        if (blocks.length === 0) {
          const routine = await getRoutine(db, sess.routineId);
          const dur = routine?.totalDurationMinutes ?? 25;
          blocks = [{ name: "Focus", durationMinutes: dur }];
        }

        setSessionData({
          routineName: sess.routineName,
          blocks,
          status: sess.status,
        });

        // Log that the session screen was opened (don't change status yet)
        await createSessionEvent(db, {
          sessionId: id,
          type: "session_opened",
        });
      } catch (e) {
        console.error("Failed to load session:", e);
        setSessionData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [db, isReady, id]);

  // Keep screen awake only during active session (not while loading)
  useEffect(() => {
    if (sessionData && sessionData.status !== 'completed') {
      activateKeepAwakeAsync();
      return () => { deactivateKeepAwake(); };
    }
  }, [sessionData]);

  // Timer store
  const {
    phase,
    remaining,
    progress,
    blockIndex,
    totalBlocks,
    isOverdue,
    currentBlockName,
    init,
    play,
    pause,
    resume,
    skip,
    end,
  } = useTimerStore();

  // Initialize timer when session data loads
  useEffect(() => {
    if (sessionData) {
      init(id ?? "session", sessionData.blocks, sessionData.routineName);
    }
  }, [sessionData, id]);

  const session = sessionData ?? {
    routineName: "Loading...",
    blocks: [] as SessionBlock[],
  };
  const block = session.blocks[blockIndex] ?? session.blocks[0];
  const timerProgress = Math.min(progress, 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - timerProgress);
  const ringColor = isOverdue ? themeColors.danger : themeColors.accent;

  // Persist timer state to DB on significant events
  const persistTimerState = useCallback(async (status: string, extraData?: Record<string, unknown>) => {
    if (!db || !id) return;
    try {
      await updateSession(db, id, {
        status,
        totalPausedMs: useTimerStore.getState()._engine?.state?.totalPausedMs ?? 0,
        currentBlockIndex: useTimerStore.getState()._engine?.state?.blockIndex ?? 0,
        ...extraData,
      });
    } catch (e) {
      console.error('Failed to persist timer state:', e);
    }
  }, [db, id]);

  // Sync timer to cloud
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

  const handlePlayPause = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (phase === "idle") {
      play();
      // Mark session as in_progress on first play
      if (db && id) {
        updateSession(db, id, {
          status: "in_progress",
          startedAt: new Date().toISOString(),
        }).catch(() => {});
        createSessionEvent(db, { sessionId: id, type: "timer_started" }).catch(() => {});
      }
      pushTimerSync();
    } else if (phase === "running" || phase === "overdue") {
      pause();
      persistTimerState('in_progress');
      if (db && id) {
        createSessionEvent(db, { sessionId: id, type: "timer_paused" }).catch(() => {});
      }
      pushTimerSync();
    } else if (phase === "paused") {
      resume();
      persistTimerState('in_progress');
      if (db && id) {
        createSessionEvent(db, { sessionId: id, type: "timer_resumed" }).catch(() => {});
      }
      pushTimerSync();
    } else if (phase === "completed") {
      // Session already done, navigate to debrief
      router.replace(`/session/debrief?sessionId=${id}`);
    }
  }, [phase, play, pause, resume, db, id, persistTimerState, pushTimerSync]);

  const handleSkip = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    skip();
    persistTimerState('in_progress');
    if (db && id) {
      createSessionEvent(db, {
        sessionId: id,
        type: "block_skipped",
        blockIndex,
      }).catch(() => {});
    }
    pushTimerSync();
  }, [skip, db, id, blockIndex, persistTimerState, pushTimerSync]);

  const handleEnd = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    end();

    // Persist session completion to DB
    if (db && id) {
      try {
        await updateSession(db, id, {
          status: "completed",
          endedAt: new Date().toISOString(),
        });
        await createSessionEvent(db, {
          sessionId: id,
          type: "session_completed",
        });
        syncSession(id, { status: "completed", endedAt: new Date().toISOString() });
        pushTimerSync();
      } catch (e) {
        console.error("Failed to save session completion:", e);
      }
    }

    // Navigate to debrief screen instead of going back
    router.replace(`/session/debrief?sessionId=${id}`);
  }, [end, router, db, id, pushTimerSync]);

  const isPaused = phase === "idle" || phase === "paused" || phase === "completed";

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.accent} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading session...</Text>
      </View>
    );
  }

  if (!sessionData) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Feather name="alert-circle" size={48} color={themeColors.danger} />
        <Text style={[styles.routineName, { color: themeColors.textSecondary }]}>Session Not Found</Text>
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>This session may have been deleted or doesn't exist.</Text>
        <Pressable style={[styles.endBtn, { backgroundColor: themeColors.accent }]} onPress={() => router.back()}>
          <Text style={[styles.endBtnText, { color: themeColors.white }]}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Text style={[styles.routineName, { color: themeColors.textSecondary }]}>{session.routineName}</Text>

      {/* Timer Ring */}
      <View style={styles.ringContainer}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={themeColors.surfaceBorder}
            strokeWidth={STROKE_WIDTH}
            fill="none"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RADIUS}
            stroke={ringColor}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
          />
        </Svg>
        <View style={styles.timeOverlay}>
          <Text style={[styles.timeText, { color: themeColors.text }, isOverdue && { color: themeColors.danger }]}>
            {formatTime(remaining)}
          </Text>
        </View>
      </View>

      <Text style={[styles.blockName, { color: themeColors.text }]}>{currentBlockName || block?.name || "Ready"}</Text>
      <Text style={[styles.blockMeta, { color: themeColors.textSecondary }]}>
        Block {blockIndex + 1} of {totalBlocks || session.blocks.length}
      </Text>

      {/* Block chips */}
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

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable style={[styles.controlBtn, { backgroundColor: themeColors.surface }]} onPress={handlePlayPause}>
          {isPaused ? (
            <Feather name="play" size={28} color={themeColors.accent} />
          ) : (
            <Feather name="pause" size={28} color={themeColors.accent} />
          )}
        </Pressable>

        <Pressable style={[styles.controlBtn, { backgroundColor: themeColors.surface }]} onPress={handleSkip}>
          <Feather name="skip-forward" size={28} color={themeColors.textSecondary} />
        </Pressable>

        <Pressable style={styles.controlBtnDanger} onPress={handleEnd}>
          <Feather name="square" size={22} color={themeColors.danger} />
        </Pressable>
      </View>
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
  loadingText: {
    marginTop: spacing.md,
    fontSize: fontSize.md,
  },
  routineName: {
    fontSize: fontSize.lg,
    fontWeight: "600",
    marginBottom: spacing.xl,
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  timeOverlay: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
  },
  timeText: {
    fontSize: fontSize.hero,
    fontWeight: "800",
  },
  blockName: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    marginTop: spacing.lg,
  },
  blockMeta: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.lg,
    marginBottom: spacing.xxl,
  },
  chip: {
    width: 24,
    height: 6,
    borderRadius: borderRadius.full,
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
  },
  controlBtn: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  controlBtnDanger: {
    width: 52,
    height: 52,
    borderRadius: borderRadius.full,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  endBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  endBtnText: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});
