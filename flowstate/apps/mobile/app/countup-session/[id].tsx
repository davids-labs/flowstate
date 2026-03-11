/**
 * Feature 6 - Count-Up Routine Session Screen
 *
 * Route: /countup-session/[id]   (id = moduleSpec id for a RoutineLauncher
 * module whose routine has mode='countup_list')
 *
 * Interaction model:
 * - Displays a scrollable list of blocks (tasks)
 * - Each block has its own independent count-up timer (Start / Stop)
 * - User marks a block done when they decide; moves on in any order
 * - Total elapsed time accumulates across all blocks
 * - Session is completed when the user taps "Finish Session"
 *
 * Does NOT use TimerEngine / timerStore — it runs its own per-block intervals.
 *
 * Data:
 * - Loads routine + blocks via getRoutine + getRoutineBlocks
 * - Creates a session record on Start
 * - Records per-block elapsed time in sessionBlockTodos table as a JSON value
 *   (repurposing the existing table; each block gets a synthetic todoId='elapsed')
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useTheme } from '../../constants/ThemeContext';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import {
  getModuleSpec,
  getRoutine,
  getRoutineBlocks,
  getDayPlan,
  upsertDayPlan,
  createSession,
  updateSession,
  createSessionEvent,
  upsertSessionBlockTodo,
} from '@flowstate/core';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Block {
  name: string;
  durationMinutes: number;
  type: string;
}

interface BlockState {
  running: boolean;
  doneMs: number;      // total accumulated ms when NOT running
  startedAt: number | null; // Date.now() when last started
  done: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatMs(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function totalElapsedMs(states: BlockState[]): number {
  return states.reduce((acc, bs) => {
    let ms = bs.doneMs;
    if (bs.running && bs.startedAt !== null) {
      ms += Date.now() - bs.startedAt;
    }
    return acc + ms;
  }, 0);
}

function currentBlockMs(bs: BlockState): number {
  let ms = bs.doneMs;
  if (bs.running && bs.startedAt !== null) ms += Date.now() - bs.startedAt;
  return ms;
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function CountupSessionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { themeColors } = useTheme();
  const { db, isReady } = useDatabaseSafe();

  const [loading, setLoading] = useState(true);
  const [routineName, setRoutineName] = useState('');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [blockStates, setBlockStates] = useState<BlockState[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);

  // Tick counter — forces re-render every second while running
  const [tick, setTick] = useState(0);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startGlobalTick = useCallback(() => {
    if (tickRef.current) return;
    tickRef.current = setInterval(() => setTick(t => t + 1), 1000);
  }, []);

  const stopGlobalTick = useCallback(() => {
    if (tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  // Load routine data on mount
  const load = useCallback(async () => {
    if (!db || !isReady || !id) return;
    setLoading(true);
    try {
      const spec = await getModuleSpec(db, id);
      if (!spec) { Alert.alert('Module not found'); router.back(); return; }

      const config: any = typeof spec.config === 'string'
        ? JSON.parse(spec.config)
        : spec.config;

      const routine = await getRoutine(db, config.routineId);
      if (!routine) { Alert.alert('Routine not found'); router.back(); return; }

      setRoutineName(routine.name);

      const rawBlocks = await getRoutineBlocks(db, routine.id);
      const mapped: Block[] = rawBlocks.map((b: any) => ({
        name: b.name,
        durationMinutes: b.durationMinutes ?? 0,
        type: b.type ?? 'task',
      }));
      setBlocks(mapped);
      setBlockStates(mapped.map(() => ({ running: false, doneMs: 0, startedAt: null, done: false })));
    } catch (e) {
      console.error('CountupSession load error:', e);
    } finally {
      setLoading(false);
    }
  }, [db, isReady, id]);

  React.useEffect(() => { load(); }, [load]);
  React.useEffect(() => () => { stopGlobalTick(); deactivateKeepAwake(); }, [stopGlobalTick]);

  // ── Session start ──────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    if (!db) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    activateKeepAwakeAsync();

    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      let dayPlan = await getDayPlan(db, todayStr);
      if (!dayPlan) {
        await upsertDayPlan(db, { date: todayStr, title: todayStr });
        dayPlan = await getDayPlan(db, todayStr);
      }

      const sid = await createSession(db, {
        dayPlanId: (dayPlan as any).id,
        routineName: routineName,
        routineId: undefined,
      });
      await updateSession(db, sid, {
        status: 'in_progress',
        startedAt: new Date().toISOString(),
      });
      await createSessionEvent(db, { sessionId: sid, type: 'started' });
      setSessionId(sid);
      setStarted(true);
      startGlobalTick();
    } catch (e) {
      console.error('CountupSession start error:', e);
    }
  }, [db, routineName, startGlobalTick]);

  // ── Block timer controls ───────────────────────────────────────────────────

  const handleToggleBlock = useCallback((index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setBlockStates(prev => {
      const next = [...prev];
      const bs = { ...next[index] };
      if (bs.running) {
        // Stop: accumulate elapsed
        bs.doneMs += bs.startedAt !== null ? Date.now() - bs.startedAt : 0;
        bs.startedAt = null;
        bs.running = false;
      } else {
        bs.startedAt = Date.now();
        bs.running = true;
      }
      next[index] = bs;
      return next;
    });
  }, []);

  const handleMarkDone = useCallback((index: number) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBlockStates(prev => {
      const next = [...prev];
      const bs = { ...next[index] };
      // Stop timer if running
      if (bs.running) {
        bs.doneMs += bs.startedAt !== null ? Date.now() - bs.startedAt : 0;
        bs.startedAt = null;
        bs.running = false;
      }
      bs.done = true;
      next[index] = bs;
      return next;
    });
  }, []);

  // ── Session finish ─────────────────────────────────────────────────────────

  const handleFinish = useCallback(async () => {
    if (!db || !sessionId) return;

    // Stop all running block timers
    setBlockStates(prev => prev.map(bs => {
      if (!bs.running) return bs;
      return {
        ...bs,
        doneMs: bs.doneMs + (bs.startedAt !== null ? Date.now() - bs.startedAt : 0),
        startedAt: null,
        running: false,
      };
    }));

    // Persist elapsed per block
    const snapshot = blockStates.map(bs => {
      let ms = bs.doneMs;
      if (bs.running && bs.startedAt !== null) ms += Date.now() - bs.startedAt;
      return ms;
    });

    for (let i = 0; i < snapshot.length; i++) {
      await upsertSessionBlockTodo(
        db,
        sessionId,
        i,
        'elapsed',
        blockStates[i].done,
      );
    }

    const totalMs = snapshot.reduce((a, b) => a + b, 0);
    await updateSession(db, sessionId, {
      status: 'completed',
      endedAt: new Date().toISOString(),
      totalPausedMs: 0,
    });
    await createSessionEvent(db, { sessionId, type: 'completed' });

    stopGlobalTick();
    deactivateKeepAwake();
    setFinished(true);
  }, [db, sessionId, blockStates, stopGlobalTick]);

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator color={themeColors.accent} style={{ marginTop: 80 }} />
      </View>
    );
  }

  if (finished) {
    const totalMs = totalElapsedMs(blockStates);
    const doneCount = blockStates.filter(bs => bs.done).length;
    return (
      <View style={[styles.container, styles.centred, { backgroundColor: themeColors.background }]}>
        <Text style={styles.celebrationEmoji}>🎉</Text>
        <Text style={[styles.finishTitle, { color: themeColors.text }]}>Session Complete!</Text>
        <Text style={[styles.finishSub, { color: themeColors.muted }]}>
          {doneCount} of {blocks.length} task{blocks.length !== 1 ? 's' : ''} completed
        </Text>
        <Text style={[styles.finishTime, { color: themeColors.accent }]}>{formatMs(totalMs)} total</Text>
        <Pressable
          style={[styles.doneBtn, { backgroundColor: themeColors.accent }]}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
        >
          <Text style={styles.doneBtnText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  const anyRunning = blockStates.some(bs => bs.running);
  const allDone = blockStates.length > 0 && blockStates.every(bs => bs.done);

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => {
          if (started) {
            Alert.alert('Exit session?', 'Progress will be lost.', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Exit', style: 'destructive', onPress: () => router.back() },
            ]);
          } else {
            router.back();
          }
        }}>
          <Feather name="x" size={22} color={themeColors.muted} />
        </Pressable>
        <Text style={[styles.title, { color: themeColors.text }]} numberOfLines={1}>
          {routineName}
        </Text>
        {started && (
          <Text style={[styles.totalTime, { color: themeColors.accent }]}>
            {formatMs(totalElapsedMs(blockStates))}
          </Text>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {blocks.map((block, i) => {
          const bs = blockStates[i] ?? { running: false, doneMs: 0, startedAt: null, done: false };
          const elapsed = currentBlockMs(bs);

          return (
            <View
              key={i}
              style={[
                styles.blockCard,
                {
                  backgroundColor: themeColors.surface,
                  opacity: bs.done ? 0.5 : 1,
                  borderLeftWidth: 4,
                  borderLeftColor: bs.running
                    ? themeColors.accent
                    : bs.done
                      ? '#22c55e'
                      : themeColors.surfaceBorder,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.blockName, { color: themeColors.text }]}>
                  {bs.done && '✓ '}{block.name}
                </Text>
                {started && (
                  <Text style={[styles.blockTimer, { color: bs.running ? themeColors.accent : themeColors.muted }]}>
                    {formatMs(elapsed)}
                  </Text>
                )}
              </View>
              {started && !bs.done && (
                <View style={styles.blockControls}>
                  <Pressable
                    style={[styles.toggleBtn, { backgroundColor: bs.running ? themeColors.accent : themeColors.background }]}
                    onPress={() => handleToggleBlock(i)}
                  >
                    <Feather
                      name={bs.running ? 'pause' : 'play'}
                      size={16}
                      color={bs.running ? '#fff' : themeColors.accent}
                    />
                  </Pressable>
                  <Pressable
                    style={[styles.doneMarkBtn, { backgroundColor: '#22c55e22' }]}
                    onPress={() => handleMarkDone(i)}
                  >
                    <Feather name="check" size={16} color="#22c55e" />
                  </Pressable>
                </View>
              )}
            </View>
          );
        })}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom action */}
      <View style={[styles.footer, { backgroundColor: themeColors.background }]}>
        {!started ? (
          <Pressable style={[styles.startBtn, { backgroundColor: themeColors.accent }]} onPress={handleStart}>
            <Feather name="play" size={18} color="#fff" />
            <Text style={styles.startBtnText}>Start Session</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.startBtn, { backgroundColor: allDone ? '#22c55e' : themeColors.surface, opacity: anyRunning ? 0.6 : 1 }]}
            onPress={() => {
              if (anyRunning) {
                Alert.alert('Stop all timers first', 'Please stop all running block timers before finishing.');
                return;
              }
              Alert.alert('Finish session?', `${blockStates.filter(b => b.done).length} of ${blocks.length} tasks completed.`, [
                { text: 'Keep going', style: 'cancel' },
                { text: 'Finish', onPress: handleFinish },
              ]);
            }}
          >
            <Feather name="flag" size={18} color={allDone ? '#fff' : themeColors.text} />
            <Text style={[styles.startBtnText, { color: allDone ? '#fff' : themeColors.text }]}>Finish Session</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centred: { justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 56,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  totalTime: {
    fontSize: fontSize.md,
    fontWeight: '700',
    minWidth: 52,
    textAlign: 'right',
  },
  list: { padding: spacing.md, gap: spacing.sm },
  blockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  blockName: { fontSize: fontSize.md, fontWeight: '600' },
  blockTimer: { fontSize: fontSize.xl, fontWeight: '700', marginTop: 2, fontVariant: ['tabular-nums'] },
  blockControls: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  toggleBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneMarkBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    paddingBottom: 34,
  },
  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
  },
  startBtnText: { fontSize: fontSize.md, fontWeight: '700', color: '#fff' },
  // Finished screen
  celebrationEmoji: { fontSize: 64, marginBottom: spacing.md },
  finishTitle: { fontSize: fontSize.xxl ?? 28, fontWeight: '700' },
  finishSub: { fontSize: fontSize.md, marginTop: spacing.xs },
  finishTime: { fontSize: fontSize.xl, fontWeight: '700', marginTop: spacing.sm },
  doneBtn: {
    marginTop: spacing.lg,
    paddingHorizontal: spacing.xl ?? spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: fontSize.md },
});
