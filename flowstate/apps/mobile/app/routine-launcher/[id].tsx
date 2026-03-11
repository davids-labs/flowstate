import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  Animated,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import Svg, { Circle } from 'react-native-svg';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import {
  getModuleSpec,
  getRoutine,
  getRoutineBlocks,
  getRoutineBlockSets,
  getRoutineBlocksForSet,
  getDayPlan,
  upsertDayPlan,
  createSession,
  updateSession,
  createSessionEvent,
  getSessionBlockTodos,
  upsertSessionBlockTodo,
  getSessionBlockInstructions,
} from '@flowstate/core';
import { useTimerStore } from '../../stores/timerStore';

const RING_SIZE = 200;
const STROKE_WIDTH = 8;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ─── Block types ────────────────────────────────────────────────

interface TodoItem {
  id: string;
  text: string;
}

interface BlockCondition {
  type: 'module_checked' | 'count_reached' | 'min_time' | 'manual_only' | 'all_todos_checked';
  value?: number; // used for count_reached / min_time
}

interface Block {
  name: string;
  durationMinutes: number;
  type: string;
  blockMode: 'timed' | 'goal_based' | 'countup';
  goalTarget: number | null;
  todos: TodoItem[];
  condition: BlockCondition | null;
  liftTag: string;
}

function formatTime(ms: number): string {
  const isNegative = ms < 0;
  const absMs = Math.abs(ms);
  const totalSeconds = Math.floor(absMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const prefix = isNegative ? '+' : '';
  return `${prefix}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const TYPE_LABELS: Record<string, string> = {
  focus: 'Focus',
  break: 'Break',
  warmup: 'Warm Up',
  cooldown: 'Cool Down',
  custom: 'Custom',
};

export default function RoutineLauncherScreen() {
  useKeepAwake();

  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { themeColors } = useTheme();
  const { db, isReady } = useDatabaseSafe();

  const TYPE_COLORS: Record<string, string> = {
    focus: themeColors.accent,
    break: themeColors.success,
    warmup: '#F59E0B',
    cooldown: '#8B5CF6',
    custom: themeColors.muted,
  };

  const [loading, setLoading] = useState(true);
  const [moduleLabel, setModuleLabel] = useState('');
  const [moduleEmoji, setModuleEmoji] = useState('');
  const [routineName, setRoutineName] = useState('');
  const [routineMode, setRoutineMode] = useState<'sequential' | 'countup_list'>('sequential');
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [autoStart, setAutoStart] = useState(false);

  // Feature 4: per-block todo checked state { [blockIndex]: { [todoId]: boolean } }
  const [todoChecked, setTodoChecked] = useState<Record<number, Record<string, boolean>>>({});
  // Feature 5: per-block instructions { [blockIndex]: string }
  const [blockInstructions, setBlockInstructions] = useState<Record<number, string>>({});
  // Feature 2: count-up timer for goal-based / countup blocks
  const [countupMs, setCountupMs] = useState(0);
  const countupRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countupStartRef = useRef<number>(0);
  // Feature 2: goal count progress
  const [goalCount, setGoalCount] = useState(0);
  // V2: Feature 3 - Variable Block Sets
  const [blockSets, setBlockSets] = useState<Array<{ id: string; name: string; isDefault: number }>>([]);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [setPickerVisible, setSetPickerVisible] = useState(false);
  // Store routineId so set-picker can re-query blocks
  const [launcherRoutineId, setLauncherRoutineId] = useState<string | null>(null);

  // Pulse animation for active block
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (started) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.05, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [started]);

  // Timer state (select primitives individually to keep selectors stable)
  const phase = useTimerStore((s) => s.phase);
  const blockIndex = useTimerStore((s) => s.blockIndex);
  const totalBlocks = useTimerStore((s) => s.totalBlocks);
  const currentBlockName = useTimerStore((s) => s.currentBlockName);
  const init = useTimerStore((s) => s.init);
  const play = useTimerStore((s) => s.play);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const skip = useTimerStore((s) => s.skip);
  const end = useTimerStore((s) => s.end);

  const remaining = useTimerStore((s) => s._engine?.remaining ?? 0);
  const progress = useTimerStore((s) => s._engine?.progress ?? 0);
  const isOverdue = useTimerStore((s) => s._engine?.isOverdue ?? false);

  // Load module → routine → blocks
  useEffect(() => {
    if (!db || !isReady || !id) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const spec = await getModuleSpec(db, id);
        if (!spec) {
          setLoading(false);
          return;
        }
        const config = typeof spec.config === 'string' ? JSON.parse(spec.config) : spec.config;
        setModuleLabel(spec.label);
        setModuleEmoji(spec.emoji ?? '');
        setAutoStart(config.autoStartOnTap ?? false);

        const routineId = config.routineId;
        if (!routineId) {
          setLoading(false);
          return;
        }

        const routine = await getRoutine(db, routineId);
        if (!routine) {
          Alert.alert('Routine Not Found', 'The linked routine no longer exists.');
          setLoading(false);
          return;
        }
        setRoutineName(routine.name);
        setTotalMinutes(routine.totalDurationMinutes);
        setRoutineMode((routine as any).mode ?? 'sequential');
        setLauncherRoutineId(routineId);

        const blks = await getRoutineBlocks(db, routineId);
        const parsedBlocks = blks.map((b: any) => {
            let todos: TodoItem[] = [];
            try { todos = JSON.parse(b.todos ?? '[]'); } catch {}
            let condition: BlockCondition | null = null;
            try { condition = b.condition ? JSON.parse(b.condition) : null; } catch {}
            return {
              name: b.name,
              durationMinutes: b.durationMinutes,
              type: b.type ?? 'focus',
              blockMode: (b.blockMode ?? 'timed') as Block['blockMode'],
              goalTarget: b.goalTarget ? Number(b.goalTarget) : null,
              todos,
              condition,
              liftTag: b.liftTag ?? '',
            };
          });

        // V2: Feature 3 - load block sets; show picker if multiple sets exist
        const sets = await getRoutineBlockSets(db, routineId);
        setBlockSets(sets as any);
        if (sets.length > 1) {
          // Show set picker; pre-select default if any
          const defaultSet = (sets as any[]).find((s: any) => s.isDefault);
          setSelectedSetId(defaultSet?.id ?? null);
          setBlocks(parsedBlocks); // store full block list first
          setSetPickerVisible(true);
        } else {
          // No sets or single set — use all blocks directly
          setBlocks(parsedBlocks);
        }
      } catch (e) {
        console.error('Failed to load routine launcher:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [db, isReady, id]);

  // Feature 6: Redirect to count-up session screen for countup_list routines
  useEffect(() => {
    if (!loading && routineMode === 'countup_list' && id) {
      router.replace(`/countup-session/${id}`);
    }
  }, [loading, routineMode, id]);

  // V2: Feature 3 - confirm set selection and filter blocks
  const handleSelectSet = useCallback(async (setId: string | null) => {
    if (!db || !launcherRoutineId) return;
    try {
      const blks = await getRoutineBlocksForSet(db, launcherRoutineId, setId);
      const parsed = (blks as any[]).map((b: any) => {
        let todos: TodoItem[] = [];
        try { todos = JSON.parse(b.todos ?? '[]'); } catch {}
        let condition: BlockCondition | null = null;
        try { condition = b.condition ? JSON.parse(b.condition) : null; } catch {}
        return {
          name: b.name,
          durationMinutes: b.durationMinutes,
          type: b.type ?? 'focus',
          blockMode: (b.blockMode ?? 'timed') as Block['blockMode'],
          goalTarget: b.goalTarget ? Number(b.goalTarget) : null,
          todos,
          condition,
          liftTag: b.liftTag ?? '',
        };
      });
      setBlocks(parsed);
      setSelectedSetId(setId);
      setSetPickerVisible(false);
    } catch (e) {
      console.error('Failed to filter blocks for set:', e);
    }
  }, [db, launcherRoutineId]);

  // Start the routine
  const handleStart = useCallback(async () => {
    if (!db || !id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Ensure a day plan exists for today
      const todayStr = new Date().toISOString().slice(0, 10);
      let dayPlan = await getDayPlan(db, todayStr);
      if (!dayPlan) {
        const dpId = await upsertDayPlan(db, {
          date: todayStr,
          title: 'Today',
        });
        dayPlan = { id: dpId } as any;
      }

      // Get routineId from module config
      const spec = await getModuleSpec(db, id);
      const config = typeof spec.config === 'string' ? JSON.parse(spec.config) : spec.config;
      const routineId = config.routineId;

      // Create a session
      const sid = await createSession(db, {
        dayPlanId: dayPlan.id,
        routineId,
        routineName,
      });
      setSessionId(sid);

      // Feature 4: Load any existing todo checked state
      const initialChecked: Record<number, Record<string, boolean>> = {};
      for (let i = 0; i < blocks.length; i++) {
        const rows = await getSessionBlockTodos(db, sid, i);
        if (rows.length > 0) {
          initialChecked[i] = {};
          for (const row of rows) {
            initialChecked[i][row.todoId] = row.checked;
          }
        }
      }
      setTodoChecked(initialChecked);

      // Feature 5: Load block instructions
      const instrs: Record<number, string> = {};
      for (let i = 0; i < blocks.length; i++) {
        const txt = await getSessionBlockInstructions(db, sid, i);
        if (txt) instrs[i] = txt;
      }
      setBlockInstructions(instrs);

      // Mark session as in-progress
      await updateSession(db, sid, {
        status: 'in_progress',
        startedAt: new Date().toISOString(),
      });
      await createSessionEvent(db, { sessionId: sid, type: 'started' });

      // Init and start the timer
      init(sid, blocks, routineName);
      play();
      setStarted(true);
    } catch (e) {
      console.error('Failed to start routine:', e);
      Alert.alert('Error', 'Could not start the routine. Please try again.');
    }
  }, [db, id, blocks, routineName, init, play]);

  // ─── Feature 2: Count-up timer management ───────────────────────
  // Start/stop the JS-interval count-up for goal_based / countup blocks
  const startCountup = useCallback(() => {
    countupStartRef.current = Date.now() - countupMs;
    countupRef.current = setInterval(() => {
      setCountupMs(Date.now() - countupStartRef.current);
    }, 1000);
  }, [countupMs]);

  const stopCountup = useCallback(() => {
    if (countupRef.current) {
      clearInterval(countupRef.current);
      countupRef.current = null;
    }
  }, []);

  // Reset count-up state when block changes
  const prevBlockIndex = useRef(blockIndex);
  useEffect(() => {
    if (blockIndex !== prevBlockIndex.current) {
      prevBlockIndex.current = blockIndex;
      stopCountup();
      setCountupMs(0);
      setGoalCount(0);
    }
  }, [blockIndex, stopCountup]);

  // Cleanup interval on unmount
  useEffect(() => () => { stopCountup(); }, [stopCountup]);

  // ─── Feature 1: canAdvance logic ──────────────────────────────
  const canAdvance = useCallback(() => {
    const cb = blocks[blockIndex];
    if (!cb) return true;
    const cond = cb.condition;
    if (!cond) return true;
    switch (cond.type) {
      case 'min_time': {
        const minMs = (cond.value ?? 0) * 60 * 1000;
        // For countup blocks use countupMs; for timed blocks use elapsed (duration - remaining)
        const elapsed = cb.blockMode !== 'timed' ? countupMs : ((cb.durationMinutes * 60 * 1000) - remaining);
        return elapsed >= minMs;
      }
      case 'count_reached': {
        return goalCount >= (cond.value ?? 1);
      }
      case 'all_todos_checked': {
        if (cb.todos.length === 0) return true;
        const checked = todoChecked[blockIndex] ?? {};
        return cb.todos.every((t) => checked[t.id]);
      }
      case 'manual_only':
        return false; // User must long-press confirm
      default:
        return true;
    }
  }, [blocks, blockIndex, todoChecked, goalCount, countupMs, remaining]);

  const conditionReason = useCallback((): string => {
    const cb = blocks[blockIndex];
    if (!cb?.condition) return '';
    switch (cb.condition.type) {
      case 'min_time': return `Min ${cb.condition.value ?? 0} min required`;
      case 'count_reached': return `Reach ${cb.condition.value ?? 1} (current: ${goalCount})`;
      case 'all_todos_checked': return 'Complete all todos first';
      case 'manual_only': return 'Manual confirmation required';
      default: return '';
    }
  }, [blocks, blockIndex, goalCount]);

  // Feature 4: toggle todo checked
  const handleToggleTodo = useCallback(async (todoId: string) => {
    if (!sessionId || !db) return;
    const current = todoChecked[blockIndex]?.[todoId] ?? false;
    const next = !current;
    setTodoChecked((prev) => {
      const block = { ...(prev[blockIndex] ?? {}), [todoId]: next };
      return { ...prev, [blockIndex]: block };
    });
    try {
      await upsertSessionBlockTodo(db, sessionId, blockIndex, todoId, next);
    } catch (e) { console.warn('upsertSessionBlockTodo failed:', e); }
  }, [db, sessionId, blockIndex, todoChecked]);

  // Feature 2: log goal count
  const handleLogGoalCount = useCallback(async (increment: number) => {
    const cb = blocks[blockIndex];
    if (!cb) return;
    const next = goalCount + increment;
    setGoalCount(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (db && sessionId) {
      createSessionEvent(db, {
        sessionId,
        type: 'block_started', // reuse closest event type; real type would need schema ext
        blockIndex,
      }).catch(() => {});
    }
    // Auto-complete when goal reached
    if (cb.blockMode === 'goal_based' && cb.goalTarget && next >= cb.goalTarget) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (blockIndex < blocks.length - 1) {
        skip();
      } else {
        handleEndRef.current();
      }
    }
  }, [goalCount, blockIndex, blocks, db, sessionId, skip]);

  const handlePlayPause = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (phase === 'running' || phase === 'overdue') {
      pause();
    } else if (phase === 'paused') {
      resume();
    } else if (phase === 'idle' && started) {
      play();
    }
  }, [phase, pause, resume, play, started]);

  const handleSkip = useCallback(() => {
    // Feature 1: Block condition gate
    if (!canAdvance()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      Alert.alert('Cannot Advance', conditionReason());
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    skip();
    if (db && sessionId) {
      createSessionEvent(db, {
        sessionId,
        type: 'block_skipped',
        blockIndex,
      }).catch((e) => { console.warn('operation failed:', e); });
    }
  }, [skip, db, sessionId, blockIndex, canAdvance, conditionReason]);

  const handleEnd = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    end();

    if (db && sessionId) {
      try {
        await updateSession(db, sessionId, {
          status: 'completed',
          endedAt: new Date().toISOString(),
        });
        await createSessionEvent(db, { sessionId, type: 'ended' });
      } catch (e) { console.warn('operation failed:', e); }
    }

    Alert.alert(
      '✅ Routine Complete!',
      `${routineName} finished successfully.`,
      [{ text: 'Done', onPress: () => router.canGoBack() ? router.back() : router.replace('/(tabs)') }],
    );
  }, [end, db, sessionId, routineName, router]);

  const handleAbandon = useCallback(() => {
    Alert.alert('End Routine?', 'Your progress for this session will be saved.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'End',
        style: 'destructive',
        onPress: async () => {
          end();
          if (db && sessionId) {
            await updateSession(db, sessionId, {
              status: 'abandoned',
              endedAt: new Date().toISOString(),
            }).catch((e) => { console.warn('operation failed:', e); });
          }
          router.canGoBack() ? router.back() : router.replace('/(tabs)');
        },
      },
    ]);
  }, [end, db, sessionId, router]);

  // Auto-complete when timer engine says completed — use ref to avoid stale closure
  const handleEndRef = useRef(handleEnd);
  handleEndRef.current = handleEnd;

  useEffect(() => {
    if (phase === 'completed' && started) {
      handleEndRef.current();
    }
  }, [phase, started]);

  // BUG-13: Auto-complete session when last block's timer expires (enters 'overdue').
  // The engine transitions running→overdue but never auto-calls end() without user input.
  // When the last block is overdue, schedule handleEnd with a 400ms delay so the user
  // can see the final state before the debrief transition.
  const autoEndScheduled = useRef(false);
  useEffect(() => {
    if (phase === 'overdue' && started && blockIndex >= blocks.length - 1 && !autoEndScheduled.current) {
      autoEndScheduled.current = true;
      const timer = setTimeout(() => {
        handleEndRef.current();
      }, 400);
      return () => clearTimeout(timer);
    }
    if (phase !== 'overdue') {
      autoEndScheduled.current = false;
    }
  }, [phase, started, blockIndex, blocks.length]);

  const timerProgress = Math.min(progress, 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - timerProgress);
  const ringColor = isOverdue ? themeColors.danger : (TYPE_COLORS[blocks[blockIndex]?.type] ?? themeColors.accent);
  const isPaused = phase === 'paused';
  const isRunning = phase === 'running' || phase === 'overdue';
  // Feature 1: compute canAdvance for current render
  const advanceOk = canAdvance();

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.accent} />
        <Text style={[styles.loadingText, { color: themeColors.muted }]}>Loading routine...</Text>
      </View>
    );
  }

  // V2: Feature 3 - Block Set picker (shown when routine has multiple sets)
  if (setPickerVisible) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Text style={[styles.routineTitle, { color: themeColors.text }]}>Choose a Set</Text>
        <Text style={[styles.routineSubtitle, { color: themeColors.muted }]}>
          {routineName} has multiple block sets. Select which one to run today.
        </Text>
        <ScrollView style={{ width: '100%', marginTop: spacing.lg }} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}>
          {/* "All blocks" option */}
          <Pressable
            style={[
              styles.setPickerCard,
              { backgroundColor: themeColors.surface, borderColor: selectedSetId === null ? themeColors.accent : themeColors.border },
              selectedSetId === null && { borderWidth: 2 },
            ]}
            onPress={() => setSelectedSetId(null)}
          >
            <Feather name="layers" size={20} color={selectedSetId === null ? themeColors.accent : themeColors.muted} />
            <View style={{ flex: 1, marginLeft: spacing.sm }}>
              <Text style={[styles.setPickerName, { color: themeColors.text }]}>All Blocks</Text>
              <Text style={[styles.setPickerDesc, { color: themeColors.muted }]}>Run the complete routine without filtering</Text>
            </View>
            {selectedSetId === null && <Feather name="check-circle" size={20} color={themeColors.accent} />}
          </Pressable>
          {blockSets.map((set) => (
            <Pressable
              key={set.id}
              style={[
                styles.setPickerCard,
                { backgroundColor: themeColors.surface, borderColor: selectedSetId === set.id ? themeColors.accent : themeColors.border },
                selectedSetId === set.id && { borderWidth: 2 },
              ]}
              onPress={() => setSelectedSetId(set.id)}
            >
              <Feather name="bookmark" size={20} color={selectedSetId === set.id ? themeColors.accent : themeColors.muted} />
              <View style={{ flex: 1, marginLeft: spacing.sm }}>
                <Text style={[styles.setPickerName, { color: themeColors.text }]}>
                  {set.name}{set.isDefault ? '  ★ Default' : ''}
                </Text>
              </View>
              {selectedSetId === set.id && <Feather name="check-circle" size={20} color={themeColors.accent} />}
            </Pressable>
          ))}
        </ScrollView>
        <Pressable
          style={[styles.startBtn, { backgroundColor: themeColors.accent, marginTop: spacing.xl }]}
          onPress={() => handleSelectSet(selectedSetId)}
        >
          <Feather name="play" size={20} color="#fff" />
          <Text style={[styles.startBtnText, { color: '#fff' }]}>Continue with this set</Text>
        </Pressable>
        <Pressable
          style={[styles.backBtn, { backgroundColor: themeColors.surface, marginTop: spacing.sm }]}
          onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}
        >
          <Text style={[styles.backBtnText, { color: themeColors.muted }]}>Cancel</Text>
        </Pressable>
      </View>
    );
  }

  if (blocks.length === 0 && !setPickerVisible) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <Feather name="alert-circle" size={48} color={themeColors.danger} />
        <Text style={[styles.routineTitle, { color: themeColors.text }]}>No Blocks Found</Text>
        <Text style={[styles.loadingText, { color: themeColors.muted }]}>This routine has no blocks. Edit it to add blocks.</Text>
        <Pressable style={[styles.backBtn, { backgroundColor: themeColors.surface }]} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
          <Text style={[styles.backBtnText, { color: themeColors.accent }]}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Pre-start view: routine overview ───
  if (!started) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <ScrollView contentContainerStyle={styles.preStartContent} showsVerticalScrollIndicator={false}>
          <Text style={styles.preStartEmoji}>{moduleEmoji || '🚀'}</Text>
          <Text style={[styles.routineTitle, { color: themeColors.text }]}>{moduleLabel || routineName}</Text>
          <Text style={[styles.routineSubtitle, { color: themeColors.muted }]}>
            {routineMode === 'countup_list' ? 'Count-Up List' : `${totalMinutes} min`} · {blocks.length} blocks
          </Text>

          <View style={styles.blockList}>
            {blocks.map((b, i) => (
              <View key={i} style={[styles.blockCard, { backgroundColor: themeColors.surface }]}>
                <View style={[styles.blockTypeBadge, { backgroundColor: (TYPE_COLORS[b.type] ?? themeColors.muted) + '20' }]}>
                  <Text style={[styles.blockTypeText, { color: TYPE_COLORS[b.type] ?? themeColors.muted }]}>
                    {TYPE_LABELS[b.type] ?? b.type}
                  </Text>
                </View>
                <View style={styles.blockCardInfo}>
                  <Text style={[styles.blockCardName, { color: themeColors.text }]}>{b.name}</Text>
                  <Text style={[styles.blockCardDur, { color: themeColors.muted }]}>
                    {b.blockMode === 'goal_based' ? `Goal: ${b.goalTarget ?? '?'}` : b.blockMode === 'countup' ? 'Open-ended' : `${b.durationMinutes} min`}
                  </Text>
                </View>
                <View style={[styles.blockIndex, { backgroundColor: themeColors.surfaceBorder }]}>
                  <Text style={[styles.blockIndexText, { color: themeColors.muted }]}>{i + 1}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

        <Pressable style={[styles.startBtn, { backgroundColor: themeColors.accent }]} onPress={handleStart}>
          <Feather name="play" size={22} color={themeColors.white} />
          <Text style={[styles.startBtnText, { color: themeColors.white }]}>Start Routine</Text>
        </Pressable>
      </View>
    );
  }

  // ─── Active timer view ───
  const currentBlock = blocks[blockIndex];
  const isGoalBased = currentBlock?.blockMode === 'goal_based';
  const isCountup = currentBlock?.blockMode === 'countup' || routineMode === 'countup_list';
  const blockTodos = currentBlock?.todos ?? [];
  const blockChecked = todoChecked[blockIndex] ?? {};
  const instructions = blockInstructions[blockIndex] ?? '';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: themeColors.background }}
      contentContainerStyle={[styles.container, { paddingVertical: spacing.xl }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.routineTitle, { color: themeColors.text }]}>{routineName}</Text>

      {/* Timer ring — show count-up for goal/countup modes */}
      <Animated.View style={[styles.ringContainer, { transform: [{ scale: pulseAnim }] }]}>
        {isGoalBased || isCountup ? (
          // Count-up display (no progress ring fill)
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
              stroke={themeColors.surfaceBorder} strokeWidth={STROKE_WIDTH} fill="none" />
            <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
              stroke={ringColor} strokeWidth={STROKE_WIDTH} fill="none"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={isGoalBased && currentBlock.goalTarget
                ? CIRCUMFERENCE * (1 - Math.min(goalCount / currentBlock.goalTarget, 1))
                : 0}
              strokeLinecap="round"
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`} />
          </Svg>
        ) : (
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
              stroke={themeColors.surfaceBorder} strokeWidth={STROKE_WIDTH} fill="none" />
            <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
              stroke={ringColor} strokeWidth={STROKE_WIDTH} fill="none"
              strokeDasharray={CIRCUMFERENCE} strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`} />
          </Svg>
        )}
        <View style={styles.timeOverlay}>
          {isCountup ? (
            <Text style={[styles.timeText, { color: ringColor }]}>{formatTime(countupMs)}</Text>
          ) : isGoalBased ? (
            <>
              <Text style={[styles.goalCountText, { color: ringColor }]}>{goalCount}</Text>
              <Text style={[styles.goalTargetText, { color: themeColors.muted }]}>/ {currentBlock.goalTarget ?? '?'}</Text>
            </>
          ) : (
            <Text style={[styles.timeText, { color: themeColors.text }, isOverdue && { color: themeColors.danger }]}>
              {formatTime(remaining)}
            </Text>
          )}
        </View>
      </Animated.View>

      {/* Current block info */}
      <View style={[styles.currentBlockBadge, { backgroundColor: (TYPE_COLORS[currentBlock?.type] ?? themeColors.accent) + '20' }]}>
        <Text style={[styles.currentBlockType, { color: TYPE_COLORS[currentBlock?.type] ?? themeColors.accent }]}>
          {TYPE_LABELS[currentBlock?.type] ?? currentBlock?.type}
        </Text>
      </View>
      <Text style={[styles.blockNameLarge, { color: themeColors.text }]}>{currentBlockName || currentBlock?.name || 'Ready'}</Text>
      <Text style={[styles.blockMeta, { color: themeColors.muted }]}>Block {blockIndex + 1} of {totalBlocks || blocks.length}</Text>

      {/* Feature 5: Per-block instructions subtitle */}
      {!!instructions && (
        <Text style={[styles.instructionText, { color: themeColors.muted }]} numberOfLines={2}>
          {instructions}
        </Text>
      )}

      {/* Block chips */}
      <View style={styles.chipRow}>
        {blocks.map((_b, i) => (
          <View
            key={i}
            style={[
              styles.chip,
              { backgroundColor: themeColors.surfaceBorder },
              i < blockIndex && { backgroundColor: themeColors.success },
              i === blockIndex && styles.chipActive,
              i === blockIndex && { backgroundColor: TYPE_COLORS[_b.type] ?? themeColors.accent },
            ]}
          />
        ))}
      </View>

      {/* Feature 2: Goal-based counter buttons */}
      {isGoalBased && (
        <View style={[styles.goalRow, { backgroundColor: themeColors.surface }]}>
          <Pressable
            style={[styles.goalBtn, { backgroundColor: themeColors.surfaceBorder }]}
            onPress={() => setGoalCount((n) => Math.max(0, n - 1))}
          >
            <Feather name="minus" size={20} color={themeColors.text} />
          </Pressable>
          <View style={styles.goalCenter}>
            <Text style={[styles.goalBtnLabel, { color: themeColors.muted }]}>Reps / Count</Text>
            <Text style={[styles.goalCountLarge, { color: themeColors.text }]}>{goalCount}</Text>
          </View>
          <Pressable
            style={[styles.goalBtn, { backgroundColor: ringColor }]}
            onPress={() => handleLogGoalCount(1)}
          >
            <Feather name="plus" size={20} color={themeColors.white} />
          </Pressable>
        </View>
      )}

      {/* Feature 4: Block Todos checklist */}
      {blockTodos.length > 0 && (
        <View style={[styles.todosCard, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.todosSectionTitle, { color: themeColors.muted }]}>CHECKLIST</Text>
          {blockTodos.map((todo) => {
            const checked = blockChecked[todo.id] ?? false;
            return (
              <Pressable
                key={todo.id}
                style={styles.todoLaunchRow}
                onPress={() => handleToggleTodo(todo.id)}
              >
                <View style={[
                  styles.todoCheckbox,
                  { borderColor: themeColors.surfaceBorder },
                  checked && { backgroundColor: themeColors.success, borderColor: themeColors.success },
                ]}>
                  {checked && <Feather name="check" size={12} color={themeColors.white} />}
                </View>
                <Text style={[
                  styles.todoLaunchText,
                  { color: themeColors.text },
                  checked && { color: themeColors.muted, textDecorationLine: 'line-through' },
                ]}>
                  {todo.text}
                </Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Feature 1: Condition lock indicator */}
      {!advanceOk && (
        <View style={[styles.conditionBanner, { backgroundColor: themeColors.warning + '20' }]}>
          <Feather name="lock" size={14} color={themeColors.warning} />
          <Text style={[styles.conditionText, { color: themeColors.warning }]}>{conditionReason()}</Text>
        </View>
      )}

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable style={[styles.controlBtn, { backgroundColor: themeColors.surface }]} onPress={handleAbandon}>
          <Feather name="x" size={24} color={themeColors.danger} />
        </Pressable>

        <Pressable style={[styles.mainBtn, { backgroundColor: ringColor }]} onPress={handlePlayPause}>
          <Feather
            name={isRunning ? 'pause' : 'play'}
            size={32}
            color={themeColors.white}
          />
        </Pressable>

        <Pressable
          style={[
            styles.controlBtn,
            { backgroundColor: advanceOk ? themeColors.surface : themeColors.surfaceBorder },
          ]}
          onPress={blockIndex < blocks.length - 1 ? handleSkip : handleEnd}
        >
          {advanceOk ? (
            <Feather
              name={blockIndex < blocks.length - 1 ? 'skip-forward' : 'check'}
              size={24}
              color={themeColors.accent}
            />
          ) : (
            <Feather name="lock" size={24} color={themeColors.muted} />
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  loadingText: {
    marginTop: spacing.sm,
    fontSize: fontSize.md,
    textAlign: 'center',
  },
  backBtn: {
    marginTop: spacing.lg,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
  },
  backBtnText: {
    fontWeight: '600',
    fontSize: fontSize.md,
  },

  // ─── Pre-start ───
  preStartContent: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 120,
  },
  preStartEmoji: {
    fontSize: 56,
    marginBottom: spacing.md,
  },
  routineTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    textAlign: 'center',
  },
  routineSubtitle: {
    fontSize: fontSize.md,
    marginTop: 4,
    marginBottom: spacing.lg,
  },
  blockList: {
    width: '100%',
    gap: spacing.sm,
  },
  blockCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  blockTypeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    marginRight: spacing.sm,
  },
  blockTypeText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  blockCardInfo: {
    flex: 1,
  },
  blockCardName: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  blockCardDur: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  blockIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockIndexText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  startBtn: {
    position: 'absolute',
    bottom: 40,
    left: spacing.lg,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  startBtnText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },

  // ─── Active timer ───
  ringContainer: {
    marginVertical: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeOverlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 48,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  currentBlockBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    marginBottom: spacing.xs,
  },
  currentBlockType: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  blockNameLarge: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: 4,
  },
  blockMeta: {
    fontSize: fontSize.sm,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  chip: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  chipActive: {
    width: 24,
    borderRadius: 5,
  },

  // ─── Controls ───
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginTop: spacing.lg,
  },
  controlBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ─── V2 Feature styles ───
  instructionText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.lg,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.md,
    marginTop: spacing.md,
    width: '100%',
  },
  goalBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalCenter: {
    flex: 1,
    alignItems: 'center',
  },
  goalBtnLabel: {
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  goalCountLarge: {
    fontSize: 40,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  goalCountText: {
    fontSize: 48,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  goalTargetText: {
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  todosCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginTop: spacing.md,
    width: '100%',
    gap: spacing.xs,
  },
  todosSectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  todoLaunchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 6,
  },
  todoCheckbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todoLaunchText: {
    flex: 1,
    fontSize: fontSize.md,
  },
  conditionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  conditionText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  // V2: Feature 3 - Set picker
  setPickerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
  },
  setPickerName: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  setPickerDesc: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
});
