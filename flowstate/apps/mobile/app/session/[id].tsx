import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import Svg, { Circle } from "react-native-svg";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createSessionEvent, getRoutine, getRoutineBlocks, getSession, getSessionBlockTodos, getSessions, updateSession, upsertSessionBlockTodo } from "@flowstate/core";
import { borderRadius, fontSize, spacing } from "../../constants/theme";
import { useTheme } from "../../constants/ThemeContext";
import { useUserPrefsStore } from "../../stores/userPrefsStore";
import { useHaptics } from "../../hooks/useHaptics";
import { useDatabaseSafe } from "../../components/DatabaseProvider";
import { useSyncContext } from "../../components/SyncProvider";
import { useTimerStore } from "../../stores/timerStore";
import { cancelTimerNotifications, stopBackgroundTimer } from "../../services/notifications";
import { FormTextField } from "../../components/primitives/Form";

function formatTime(ms: number) {
  const negative = ms < 0;
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${negative ? "+" : ""}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
function phaseLabel(phase: string, completed: boolean) {
  if (completed || phase === "completed") return "Complete";
  if (phase === "paused") return "Paused";
  if (phase === "overdue") return "Overtime";
  if (phase === "running") return "In Session";
  return "Ready";
}
const RING_SIZE = 236;
const STROKE_WIDTH = 10;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface SessionBlock { name: string; durationMinutes: number; todos?: Array<{ id: string; text: string }>; }

export default function SessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { db, isReady } = useDatabaseSafe();
  const { syncSession, syncTimerState } = useSyncContext();
  const { themeTokens: themeColors } = useTheme();
  const keepAwakePref = useUserPrefsStore((s) => s.keepAwake);
  const autoStartPref = useUserPrefsStore((s) => s.autoStart);
  const haptic = useHaptics();

  const [sessionData, setSessionData] = useState<{ routineName: string; blocks: SessionBlock[]; status?: string; startedAt?: string | null; totalPausedMs?: number; currentBlockIndex?: number; dayPlanId?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [allSessions, setAllSessions] = useState<any[]>([]);
  const [currentSessionIndex, setCurrentSessionIndex] = useState(0);
  const [sessionNotes, setSessionNotes] = useState("");
  const [todoChecked, setTodoChecked] = useState<Record<string, boolean>>({});
  const [pauseElapsed, setPauseElapsed] = useState(0);
  const currentSessionId = allSessions[currentSessionIndex]?.id ?? id;
  const navigateDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStartFiredRef = useRef(false);

  const phase = useTimerStore((s) => s.phase);
  const blockIndex = useTimerStore((s) => s.blockIndex);
  const totalBlocks = useTimerStore((s) => s.totalBlocks);
  const currentBlockName = useTimerStore((s) => s.currentBlockName);
  const pausedAt = useTimerStore((s) => s.pausedAt);
  const blockDurationMs = useTimerStore((s) => s.blockDurationMs);
  const elapsed = useTimerStore((s) => s.elapsed);
  const init = useTimerStore((s) => s.init);
  const restore = useTimerStore((s) => s.restore);
  const play = useTimerStore((s) => s.play);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const skip = useTimerStore((s) => s.skip);
  const end = useTimerStore((s) => s.end);
  const remaining = blockDurationMs - elapsed;
  const progress = blockDurationMs > 0 ? Math.min(elapsed / blockDurationMs, 1) : 0;
  const isOverdue = phase === "overdue" || (phase === "running" && remaining < 0);
  const ringColor = isOverdue ? themeColors.danger : themeColors.accent;

  const loadSessionData = useCallback(async (targetId: string) => {
    if (!db || !isReady || !targetId) { setLoading(false); return; }
    try {
      const sess = await getSession(db, targetId);
      if (!sess) { setSessionData(null); setLoading(false); return; }
      const siblings = await getSessions(db, sess.dayPlanId);
      setAllSessions((prev) => prev.length !== siblings.length || siblings.some((s: any, i: number) => s.id !== prev[i]?.id) ? siblings : prev);
      const idx = siblings.findIndex((s: any) => s.id === targetId);
      if (idx >= 0) setCurrentSessionIndex((prev) => prev === idx ? prev : idx);
      let blocks: SessionBlock[] = [];
      try {
        const rows = await getRoutineBlocks(db, sess.routineId);
        if (rows.length > 0) blocks = rows.map((b: any) => {
          let todos: Array<{ id: string; text: string }> = [];
          try { todos = JSON.parse(b.todos ?? "[]"); } catch {}
          return { name: b.name, durationMinutes: b.durationMinutes, todos };
        });
      } catch {}
      if (blocks.length === 0) {
        const routine = await getRoutine(db, sess.routineId);
        blocks = [{ name: "Focus", durationMinutes: routine?.totalDurationMinutes ?? 25 }];
      }
      setSessionData({ routineName: sess.routineName, blocks, status: sess.status, startedAt: sess.startedAt, totalPausedMs: sess.totalPausedMs ?? 0, currentBlockIndex: sess.currentBlockIndex ?? 0, dayPlanId: sess.dayPlanId });
      setSessionNotes(sess.notes ?? "");
      try {
        const checkedMap: Record<string, boolean> = {};
        for (let i = 0; i < blocks.length; i += 1) {
          const rows = await getSessionBlockTodos(db, targetId, i);
          for (const row of rows) checkedMap[`${i}_${row.todoId}`] = row.checked;
        }
        setTodoChecked(checkedMap);
      } catch {}
      const timerState = useTimerStore.getState();
      if (timerState.sessionId !== targetId && sess.status !== "completed") {
        if (sess.status === "in_progress" && sess.startedAt) restore(targetId, blocks, sess.routineName, { blockIndex: sess.currentBlockIndex ?? 0, startedAt: new Date(sess.startedAt).getTime(), totalPausedMs: sess.totalPausedMs ?? 0 });
        else init(targetId, blocks, sess.routineName);
      }
      await createSessionEvent(db, { sessionId: targetId, type: "session_opened" });
    } catch (e) {
      console.error("Failed to load session:", e);
      setSessionData(null);
    } finally { setLoading(false); }
  }, [db, init, isReady, restore]);

  useEffect(() => { if (id) loadSessionData(id); }, [id, loadSessionData]);
  useEffect(() => { if (sessionData && sessionData.status !== "completed" && keepAwakePref) { activateKeepAwakeAsync(); return () => { deactivateKeepAwake(); }; } }, [keepAwakePref, sessionData]);
  useEffect(() => {
    if (!autoStartPref || phase !== "idle" || !sessionData || sessionData.status === "completed") { autoStartFiredRef.current = false; return; }
    if (autoStartFiredRef.current) return;
    autoStartFiredRef.current = true;
    const t = setTimeout(() => {
      play();
      if (db && currentSessionId) {
        updateSession(db, currentSessionId, { status: "in_progress", startedAt: new Date().toISOString() }).catch(() => {});
        createSessionEvent(db, { sessionId: currentSessionId, type: "started" }).catch(() => {});
      }
    }, 400);
    return () => clearTimeout(t);
  }, [autoStartPref, currentSessionId, db, phase, play, sessionData]);

  const persistTimerState = useCallback(async (status: string, extraData?: Record<string, unknown>) => {
    if (!db || !currentSessionId) return;
    try {
      const s = useTimerStore.getState();
      await updateSession(db, currentSessionId, { status, totalPausedMs: s._engine?.state?.totalPausedMs ?? 0, currentBlockIndex: s._engine?.state?.blockIndex ?? 0, ...extraData });
    } catch (e) { console.error("Failed to persist timer state:", e); }
  }, [currentSessionId, db]);
  const pushTimerSync = useCallback(() => {
    const s = useTimerStore.getState();
    syncTimerState({ phase: s.phase, startedAt: s._engine?.state?.startedAt ?? null, pausedAt: s._engine?.state?.pausedAt ?? null, totalPausedMs: s._engine?.state?.totalPausedMs ?? 0, blockDurationMs: s._engine?.state?.blockDurationMs ?? 0, blockIndex: s.blockIndex, routineId: null, routineName: s.routineName });
  }, [syncTimerState]);
  const navigateToSession = useCallback(async (targetIndex: number) => {
    const target = allSessions[targetIndex];
    if (!target) return;
    if (navigateDebounceRef.current) clearTimeout(navigateDebounceRef.current);
    navigateDebounceRef.current = setTimeout(async () => {
      if (phase === "running" || phase === "paused" || phase === "overdue") await persistTimerState("in_progress");
      if (typeof end === "function") await end();
      try { await stopBackgroundTimer(); await cancelTimerNotifications(); } catch {}
      try { await AsyncStorage.removeItem("flowstate_timer_state"); } catch {}
      haptic.impact("light");
      setCurrentSessionIndex(targetIndex); setLoading(true); await loadSessionData(target.id);
    }, 200);
  }, [allSessions, end, haptic, loadSessionData, persistTimerState, phase]);
  useEffect(() => {
    if (phase !== "paused" || !pausedAt) { setPauseElapsed(0); return; }
    setPauseElapsed(Date.now() - pausedAt);
    const iv = setInterval(() => setPauseElapsed(Date.now() - pausedAt), 250);
    return () => clearInterval(iv);
  }, [pausedAt, phase]);
  const getPauseColor = (pauseMs: number, totalMs: number) => totalMs <= 0 ? themeColors.success : pauseMs / totalMs < 0.05 ? themeColors.success : pauseMs / totalMs < 0.15 ? "#A3E635" : pauseMs / totalMs < 0.3 ? themeColors.warning : pauseMs / totalMs < 0.6 ? "#F97316" : themeColors.danger;

  const handlePlayPause = useCallback(() => {
    haptic.impact("medium");
    if (phase === "idle") {
      play();
      if (db && currentSessionId) {
        updateSession(db, currentSessionId, { status: "in_progress", startedAt: new Date().toISOString() }).catch(() => {});
        createSessionEvent(db, { sessionId: currentSessionId, type: "started" }).catch(() => {});
      }
      pushTimerSync(); return;
    }
    if (phase === "running" || phase === "overdue") {
      pause(); persistTimerState("in_progress");
      if (db && currentSessionId) createSessionEvent(db, { sessionId: currentSessionId, type: "paused" }).catch(() => {});
      pushTimerSync(); return;
    }
    if (phase === "paused") {
      resume(); persistTimerState("in_progress");
      if (db && currentSessionId) createSessionEvent(db, { sessionId: currentSessionId, type: "resumed" }).catch(() => {});
      pushTimerSync(); return;
    }
    if (phase === "completed") router.replace(`/session/debrief?sessionId=${currentSessionId}`);
  }, [currentSessionId, db, haptic, pause, persistTimerState, phase, play, pushTimerSync, resume, router]);
  const handleSkip = useCallback(() => {
    haptic.impact("light"); skip(); persistTimerState("in_progress");
    if (db && currentSessionId) createSessionEvent(db, { sessionId: currentSessionId, type: "block_skipped", blockIndex }).catch(() => {});
    pushTimerSync();
  }, [blockIndex, currentSessionId, db, haptic, persistTimerState, pushTimerSync, skip]);
  const handleEnd = useCallback(async () => {
    haptic.impact("medium"); end();
    if (db && currentSessionId) {
      try {
        const endedAt = new Date().toISOString();
        await updateSession(db, currentSessionId, { status: "completed", endedAt });
        await createSessionEvent(db, { sessionId: currentSessionId, type: "ended" });
        syncSession(currentSessionId, { status: "completed", endedAt }); pushTimerSync();
      } catch (e) { console.error("Failed to save session completion:", e); }
    }
    router.replace(`/session/debrief?sessionId=${currentSessionId}`);
  }, [currentSessionId, db, end, haptic, pushTimerSync, router, syncSession]);
  const handleUndoComplete = useCallback(async () => {
    if (!db || !currentSessionId) return;
    haptic.impact("medium");
    try {
      await updateSession(db, currentSessionId, { status: "in_progress", endedAt: null });
      await createSessionEvent(db, { sessionId: currentSessionId, type: "session_undone" });
      if (sessionData) init(currentSessionId, sessionData.blocks, sessionData.routineName);
      setLoading(true); await loadSessionData(currentSessionId);
    } catch (e) { console.error("Failed to undo session:", e); }
  }, [currentSessionId, db, haptic, init, loadSessionData, sessionData]);
  const handleToggleTodo = useCallback(async (targetBlockIndex: number, todoId: string) => {
    const key = `${targetBlockIndex}_${todoId}`, next = !(todoChecked[key] ?? false);
    setTodoChecked((prev) => ({ ...prev, [key]: next }));
    if (db && currentSessionId) { try { await upsertSessionBlockTodo(db, currentSessionId, targetBlockIndex, todoId, next); } catch {} }
  }, [currentSessionId, db, todoChecked]);
  const handleSaveNotes = useCallback((text: string) => {
    setSessionNotes(text);
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => { if (db && currentSessionId) updateSession(db, currentSessionId, { notes: text }).catch(() => {}); }, 800);
  }, [currentSessionId, db]);

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.accent} />
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>Loading session...</Text>
      </View>
    );
  }
  if (!sessionData) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: themeColors.background }]}>
        <Feather name="alert-circle" size={48} color={themeColors.danger} />
        <Text style={[styles.missingTitle, { color: themeColors.text }]}>Session Not Found</Text>
        <Text style={[styles.loadingText, { color: themeColors.textSecondary }]}>This session may have been deleted or no longer exists.</Text>
        <Pressable style={[styles.fullButton, { backgroundColor: themeColors.accent }]} onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")}>
          <Text style={[styles.fullButtonText, { color: themeColors.white }]}>Go Back</Text>
        </Pressable>
      </View>
    );
  }
  const session = sessionData;
  const block = session.blocks[blockIndex] ?? session.blocks[0];
  const strokeDashoffset = CIRCUMFERENCE * (1 - Math.min(progress, 1));
  const isPaused = phase === "idle" || phase === "paused" || phase === "completed";
  const isCompleted = session.status === "completed" || phase === "completed";
  const currentBlockTodos = session.blocks[blockIndex]?.todos ?? [];
  const totalBlockCount = totalBlocks || session.blocks.length;
  const pauseColor = getPauseColor(pauseElapsed, blockDurationMs);
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: themeColors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.container, { backgroundColor: themeColors.background }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {allSessions.length > 1 ? (
          <View style={[styles.card, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
            <View style={styles.sessionNav}>
              <Pressable onPress={() => navigateToSession(currentSessionIndex - 1)} disabled={currentSessionIndex <= 0} style={[styles.navArrow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }, currentSessionIndex <= 0 && { opacity: 0.35 }]}>
                <Feather name="chevron-left" size={18} color={themeColors.accent} />
              </Pressable>
              <FlatList data={allSessions} horizontal showsHorizontalScrollIndicator={false} keyExtractor={(item: any) => item.id} contentContainerStyle={{ gap: spacing.xs, alignItems: "center" }} renderItem={({ item, index }: { item: any; index: number }) => {
                const isCurrent = index === currentSessionIndex, done = item.status === "completed";
                return (
                  <Pressable onPress={() => navigateToSession(index)} style={[styles.sessionPill, { backgroundColor: isCurrent ? themeColors.accentTint : themeColors.surface, borderColor: isCurrent ? themeColors.accent : done ? themeColors.success : themeColors.border }]}>
                    <Text style={[styles.sessionPillText, { color: isCurrent ? themeColors.accent : done ? themeColors.success : themeColors.text }]} numberOfLines={1}>{item.routineName}</Text>
                  </Pressable>
                );
              }} />
              <Pressable onPress={() => navigateToSession(currentSessionIndex + 1)} disabled={currentSessionIndex >= allSessions.length - 1} style={[styles.navArrow, { backgroundColor: themeColors.surface, borderColor: themeColors.border }, currentSessionIndex >= allSessions.length - 1 && { opacity: 0.35 }]}>
                <Feather name="chevron-right" size={18} color={themeColors.accent} />
              </Pressable>
            </View>
          </View>
        ) : null}
        <View style={[styles.heroCard, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <Text style={[styles.kicker, { color: themeColors.textSecondary }]}>SESSION</Text>
              <Text style={[styles.routineName, { color: themeColors.text }]}>{session.routineName}</Text>
            </View>
            <View style={[styles.phaseBadge, { backgroundColor: isCompleted ? themeColors.success + "18" : phase === "paused" ? themeColors.warning + "18" : isOverdue ? themeColors.danger + "18" : themeColors.accentTint, borderColor: isCompleted ? themeColors.success : phase === "paused" ? themeColors.warning : isOverdue ? themeColors.danger : themeColors.accent }]}>
              <Text style={[styles.phaseBadgeText, { color: isCompleted ? themeColors.success : phase === "paused" ? themeColors.warning : isOverdue ? themeColors.danger : themeColors.accent }]}>{phaseLabel(phase, isCompleted)}</Text>
            </View>
          </View>
          <View style={styles.ringContainer}>
            <Svg width={RING_SIZE} height={RING_SIZE}>
              <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS} stroke={themeColors.surfaceBorder} strokeWidth={STROKE_WIDTH} fill="none" />
              <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS} stroke={ringColor} strokeWidth={STROKE_WIDTH} fill="none" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={strokeDashoffset} strokeLinecap="round" transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`} />
            </Svg>
            <View style={styles.timeOverlay}>
              <Text style={[styles.timeText, { color: isOverdue ? themeColors.danger : themeColors.text }]}>{formatTime(remaining)}</Text>
              <Text style={[styles.timeLabel, { color: themeColors.textSecondary }]}>Remaining</Text>
            </View>
          </View>
          <Text style={[styles.blockName, { color: themeColors.text }]}>{currentBlockName || block?.name || "Ready"}</Text>
          <Text style={[styles.blockMeta, { color: themeColors.textSecondary }]}>Block {blockIndex + 1} of {totalBlockCount} · {block?.durationMinutes ?? 0} min</Text>
          <View style={styles.chipRow}>{session.blocks.map((_, index) => <View key={index} style={[styles.chip, { backgroundColor: themeColors.surfaceBorder }, index < blockIndex && { backgroundColor: themeColors.success }, index === blockIndex && { backgroundColor: themeColors.accent }]} />)}</View>
          {phase === "paused" && pausedAt !== null && pauseElapsed > 0 ? <View style={[styles.pauseCard, { backgroundColor: themeColors.surface }]}>
            <Feather name="pause-circle" size={20} color={pauseColor} />
            <View style={styles.pauseInfo}>
              <Text style={[styles.pauseLabel, { color: themeColors.textSecondary }]}>Paused for</Text>
              <Text style={[styles.pauseTime, { color: pauseColor }]}>{formatTime(pauseElapsed)}</Text>
            </View>
            <View style={[styles.pauseBar, { backgroundColor: themeColors.surfaceBorder }]}><View style={[styles.pauseBarFill, { backgroundColor: pauseColor, width: `${Math.min((pauseElapsed / Math.max(blockDurationMs, 1)) * 100, 100)}%` }]} /></View>
          </View> : null}
        </View>
        {isCompleted ? <View style={[styles.card, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
          <View style={styles.completionCopy}>
            <Text style={[styles.completionTitle, { color: themeColors.text }]}>Session complete</Text>
            <Text style={[styles.completionSubtitle, { color: themeColors.textSecondary }]}>Review the debrief or reopen the timer if you finished by mistake.</Text>
          </View>
          <Pressable style={[styles.secondaryButton, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]} onPress={handleUndoComplete}>
            <Feather name="rotate-ccw" size={18} color={themeColors.warning} />
            <Text style={[styles.secondaryButtonText, { color: themeColors.text }]}>Undo Complete</Text>
          </Pressable>
          <Pressable style={[styles.fullButton, { backgroundColor: themeColors.accent }]} onPress={() => router.replace(`/session/debrief?sessionId=${currentSessionId}`)}>
            <Text style={[styles.fullButtonText, { color: themeColors.white }]}>View Debrief</Text>
          </Pressable>
        </View> : <View style={[styles.card, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
          <Pressable style={[styles.fullButton, { backgroundColor: themeColors.accent }]} onPress={handlePlayPause}>
            <Feather name={isPaused ? "play" : "pause"} size={20} color={themeColors.white} />
            <Text style={[styles.fullButtonText, { color: themeColors.white }]}>{isPaused ? "Start Session" : "Pause Session"}</Text>
          </Pressable>
          <View style={styles.actionRow}>
            <Pressable style={[styles.secondaryButton, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]} onPress={handleSkip}>
              <Feather name="skip-forward" size={18} color={themeColors.textSecondary} />
              <Text style={[styles.secondaryButtonText, { color: themeColors.textSecondary }]}>Skip</Text>
            </Pressable>
            <Pressable style={[styles.secondaryButton, { backgroundColor: themeColors.danger + "10", borderColor: themeColors.danger + "45" }]} onPress={handleEnd}>
              <Feather name="square" size={16} color={themeColors.danger} />
              <Text style={[styles.secondaryButtonText, { color: themeColors.danger }]}>End</Text>
            </Pressable>
          </View>
        </View>}
        {currentBlockTodos.length > 0 ? <View style={[styles.card, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
          <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>CHECKLIST</Text>
          <View style={styles.todosGroup}>{currentBlockTodos.map((todo) => {
            const key = `${blockIndex}_${todo.id}`, checked = todoChecked[key] ?? false;
            return <Pressable key={todo.id} style={styles.todoRow} onPress={() => handleToggleTodo(blockIndex, todo.id)}>
              <View style={[styles.todoCircle, { borderColor: checked ? themeColors.success : themeColors.surfaceBorder, backgroundColor: checked ? themeColors.success : "transparent" }]}>{checked ? <Feather name="check" size={11} color="#fff" /> : null}</View>
              <Text style={[styles.todoText, { color: checked ? themeColors.textSecondary : themeColors.text }, checked && styles.strikethrough]}>{todo.text}</Text>
            </Pressable>;
          })}</View>
        </View> : null}
        <View style={[styles.card, { backgroundColor: themeColors.surfaceElevated, borderColor: themeColors.border }]}>
          <Text style={[styles.sectionLabel, { color: themeColors.textSecondary }]}>NOTES</Text>
          <FormTextField
            placeholder="Capture what mattered in this block..."
            value={sessionNotes}
            onChangeText={handleSaveNotes}
            multiline
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md, paddingHorizontal: spacing.lg },
  container: { flexGrow: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md },
  loadingText: { fontSize: fontSize.md, textAlign: "center" },
  missingTitle: { fontSize: fontSize.xl, fontWeight: "700", textAlign: "center" },
  card: { width: "100%", borderWidth: 1, borderRadius: borderRadius.xl, padding: spacing.md, gap: spacing.sm },
  heroCard: { width: "100%", borderWidth: 1, borderRadius: borderRadius.xl, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, alignItems: "center", gap: spacing.sm },
  heroHeader: { width: "100%", flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: spacing.md },
  heroCopy: { flex: 1, gap: spacing.xs },
  kicker: { fontSize: fontSize.xs, fontWeight: "700", letterSpacing: 0.8 },
  routineName: { fontSize: fontSize.xl, fontWeight: "700" },
  phaseBadge: { borderWidth: 1, borderRadius: borderRadius.full, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  phaseBadgeText: { fontSize: fontSize.xs, fontWeight: "700" },
  ringContainer: { width: RING_SIZE, height: RING_SIZE, alignItems: "center", justifyContent: "center" },
  timeOverlay: { position: "absolute", alignItems: "center", justifyContent: "center" },
  timeText: { fontSize: fontSize.hero, fontWeight: "800" },
  timeLabel: { fontSize: fontSize.xs, fontWeight: "600", marginTop: spacing.xs, letterSpacing: 0.5 },
  blockName: { fontSize: fontSize.xl, fontWeight: "700", textAlign: "center" },
  blockMeta: { fontSize: fontSize.sm, textAlign: "center" },
  chipRow: { flexDirection: "row", gap: spacing.xs, marginTop: spacing.sm },
  chip: { width: 26, height: 6, borderRadius: borderRadius.full },
  pauseCard: { width: "100%", flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: borderRadius.lg, marginTop: spacing.sm },
  pauseInfo: { flex: 1 },
  pauseLabel: { fontSize: fontSize.xs, fontWeight: "500" },
  pauseTime: { fontSize: fontSize.lg, fontWeight: "800" },
  pauseBar: { width: 84, height: 6, borderRadius: 3, overflow: "hidden" },
  pauseBarFill: { height: "100%", borderRadius: 3 },
  sessionNav: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  navArrow: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  sessionPill: { minWidth: 76, borderRadius: borderRadius.full, borderWidth: 1, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, alignItems: "center" },
  sessionPillText: { fontSize: fontSize.xs, fontWeight: "600", maxWidth: 84 },
  actionRow: { flexDirection: "row", gap: spacing.sm },
  fullButton: { minHeight: 56, borderRadius: borderRadius.lg, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.sm, paddingHorizontal: spacing.md },
  fullButtonText: { fontSize: fontSize.md, fontWeight: "700" },
  secondaryButton: { flex: 1, minHeight: 50, borderRadius: borderRadius.lg, borderWidth: 1, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.xs, paddingHorizontal: spacing.md },
  secondaryButtonText: { fontSize: fontSize.sm, fontWeight: "700" },
  completionCopy: { gap: spacing.xs },
  completionTitle: { fontSize: fontSize.lg, fontWeight: "700" },
  completionSubtitle: { fontSize: fontSize.sm },
  sectionLabel: { fontSize: fontSize.xs, fontWeight: "700", letterSpacing: 0.6 },
  todosGroup: { gap: spacing.xs },
  todoRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xs },
  todoCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  todoText: { flex: 1, fontSize: fontSize.md },
  strikethrough: { textDecorationLine: "line-through" },
});
