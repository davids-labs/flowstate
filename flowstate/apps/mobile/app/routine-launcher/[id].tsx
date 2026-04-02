/**
 * Routine Launcher — V2 spec §3
 *
 * Immersive full-bleed canvas. Layout:
 *   • Session progress bar (absolute top, 4pt, pillarX)
 *   • Centre canvas: routine name · block name · timer ring (220pt) · block chips
 *   • Fixed control bar: Pause · Skip · End
 *   • Bottom drawer: todos · instructions · notes (animated, draggable)
 *
 * Business logic is preserved from V1:
 *   Feature 1 – Block condition locks
 *   Feature 2 – Count-up / goal-based timers
 *   Feature 3 – Variable block sets
 *   Feature 4 – Block todo checklists
 *   Feature 5 – Per-block instructions
 *   Feature 6 – countup_list → countup-session redirect
 */
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Alert,
  ScrollView,
  Animated,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import Svg, { Circle } from 'react-native-svg';
import { space, radius, typography } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';
import { AppText } from '../../components/primitives/Text';
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
import { useUserPrefsStore, type Pillar } from '../../stores/userPrefsStore';

// ─── Ring constants ───────────────────────────────────────────────────────────
const RING_SIZE = 220;
const STROKE_WIDTH = 10;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// ─── Drawer constants ─────────────────────────────────────────────────────────
const DRAWER_PEEK = 72;    // collapsed height: handle bar + icon row
const DRAWER_FULL = 0.62;  // fraction of screen height when expanded

// ─── Block types ──────────────────────────────────────────────────────────────
interface TodoItem { id: string; text: string; }
interface BlockCondition {
  type: 'module_checked' | 'count_reached' | 'min_time' | 'manual_only' | 'all_todos_checked';
  value?: number;
}
interface Block {
  name: string; durationMinutes: number; type: string;
  blockMode: 'timed' | 'goal_based' | 'countup';
  goalTarget: number | null; todos: TodoItem[];
  condition: BlockCondition | null; liftTag: string;
}

function formatTime(ms: number): string {
  const isNeg = ms < 0;
  const abs = Math.abs(ms);
  const s = Math.floor(abs / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const ss = s % 60;
  const prefix = isNeg ? '+' : '';
  if (h > 0) return `${prefix}${h}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  return `${prefix}${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}

const TYPE_LABEL: Record<string, string> = {
  focus: 'Focus', break: 'Break', warmup: 'Warm Up', cooldown: 'Cool Down', custom: 'Custom',
};

// ─── BottomDrawer ─────────────────────────────────────────────────────────────
interface DrawerProps {
  isOpen: boolean; onToggle: () => void;
  todos: TodoItem[]; todoChecked: Record<string, boolean>;
  onToggleTodo: (id: string) => void;
  instructions: string;
  sessionNotes: string; onNotesChange: (t: string) => void;
  isGym: boolean;
  screenHeight: number;
  pillarColor: string;
}

function BottomDrawer({ isOpen, onToggle, todos, todoChecked, onToggleTodo, instructions, sessionNotes, onNotesChange, isGym, screenHeight, pillarColor }: DrawerProps) {
  const { themeTokens } = useTheme();
  const heightAnim = useRef(new Animated.Value(DRAWER_PEEK)).current;
  const pendoCount = todos.filter(t => !todoChecked[t.id]).length;
  const drawerMax = screenHeight * DRAWER_FULL;

  useEffect(() => {
    Animated.spring(heightAnim, {
      toValue: isOpen ? drawerMax : DRAWER_PEEK,
      damping: 26, stiffness: 400, useNativeDriver: false,
    }).start();
  }, [isOpen, drawerMax]);

  return (
    <Animated.View style={[S.drawer, { height: heightAnim, backgroundColor: themeTokens.surfaceElevated, borderTopColor: themeTokens.border }]}>
      {/* Handle */}
      <Pressable style={S.drawerHandle} onPress={onToggle} hitSlop={16}>
        <View style={[S.handleBar, { backgroundColor: themeTokens.textTertiary }]} />
      </Pressable>

      {/* Icon row (always visible) */}
      <View style={S.iconRow}>
        <Pressable style={S.iconBtn} onPress={onToggle}>
          <View style={{ position: 'relative' }}>
            <Feather name="check-square" size={20} color={pendoCount > 0 ? pillarColor : themeTokens.textSecondary} />
            {pendoCount > 0 && (
              <View style={[S.iconBadge, { backgroundColor: pillarColor }]}>
                <AppText variant="caption2" onAccent>{pendoCount}</AppText>
              </View>
            )}
          </View>
        </Pressable>
        <Pressable style={S.iconBtn} onPress={onToggle}>
          <Feather name="file-text" size={20} color={instructions ? pillarColor : themeTokens.textSecondary} />
        </Pressable>
        {isGym && (
          <Pressable style={S.iconBtn} onPress={onToggle}>
            <Feather name="tool" size={20} color={themeTokens.textSecondary} />
          </Pressable>
        )}
        <Pressable style={S.iconBtn} onPress={onToggle}>
          <Feather name="tag" size={20} color={themeTokens.textSecondary} />
        </Pressable>
        <Pressable style={S.iconBtn} onPress={onToggle}>
          <Feather name="clock" size={20} color={themeTokens.textSecondary} />
        </Pressable>
      </View>

      {/* Expanded content */}
      {isOpen && (
        <ScrollView style={S.drawerScroll} contentContainerStyle={S.drawerContent} keyboardShouldPersistTaps="handled">
          {/* Todos */}
          {todos.length > 0 && (
            <View style={S.drawerSection}>
              <AppText variant="caption1" color={themeTokens.textTertiary} style={S.drawerSectionLabel}>CHECKLIST</AppText>
              {todos.map(todo => {
                const checked = todoChecked[todo.id] ?? false;
                return (
                  <Pressable key={todo.id} style={S.todoRow} onPress={() => onToggleTodo(todo.id)}>
                    <View style={[S.todoCircle, { borderColor: checked ? pillarColor : themeTokens.borderStrong, backgroundColor: checked ? pillarColor : 'transparent' }]}>
                      {checked && <Feather name="check" size={11} color="#fff" />}
                    </View>
                    <AppText variant="body" color={checked ? themeTokens.textTertiary : themeTokens.textPrimary} style={checked ? S.strikethrough : undefined}>{todo.text}</AppText>
                  </Pressable>
                );
              })}
            </View>
          )}

          {/* Instructions */}
          {!!instructions && (
            <View style={S.drawerSection}>
              <AppText variant="caption1" color={themeTokens.textTertiary} style={S.drawerSectionLabel}>INSTRUCTIONS</AppText>
              <AppText variant="body" color={themeTokens.textSecondary}>{instructions}</AppText>
            </View>
          )}

          {/* Notes */}
          <View style={S.drawerSection}>
            <AppText variant="caption1" color={themeTokens.textTertiary} style={S.drawerSectionLabel}>SESSION NOTES</AppText>
            <TextInput
              style={[S.notesInput, { color: themeTokens.textPrimary, borderColor: themeTokens.border, backgroundColor: themeTokens.surfaceInput }]}
              placeholder="Add notes..."
              placeholderTextColor={themeTokens.textPlaceholder}
              multiline
              value={sessionNotes}
              onChangeText={onNotesChange}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>
      )}
    </Animated.View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function RoutineLauncherScreen() {
  useKeepAwake();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { themeTokens } = useTheme();
  const { db, isReady } = useDatabaseSafe();
  const insets = useSafeAreaInsets();
  const getPillarColour = useUserPrefsStore(s => s.getPillarColour);

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
  const [routinePillar, setRoutinePillar] = useState<string>('general'); // V2: track pillar for ring colour

  // Feature 4: per-block todo state
  const [todoChecked, setTodoChecked] = useState<Record<number, Record<string, boolean>>>({});
  // Feature 5: per-block instructions
  const [blockInstructions, setBlockInstructions] = useState<Record<number, string>>({});
  // Feature 2: count-up
  const [countupMs, setCountupMs] = useState(0);
  const countupRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countupStartRef = useRef<number>(0);
  // Feature 2: goal count
  const [goalCount, setGoalCount] = useState(0);
  // Feature 3: block sets
  const [blockSets, setBlockSets] = useState<Array<{ id: string; name: string; isDefault: number }>>([]);
  const [selectedSetId, setSelectedSetId] = useState<string | null>(null);
  const [setPickerVisible, setSetPickerVisible] = useState(false);
  const [launcherRoutineId, setLauncherRoutineId] = useState<string | null>(null);
  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sessionNotes, setSessionNotes] = useState('');
  // Screen dimensions for drawer height calc
  const { height: screenHeight } = useWindowDimensions();

  // Pulse animation
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (started) {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    }
  }, [started]);

  // Timer state
  const phase = useTimerStore(s => s.phase);
  const blockIndex = useTimerStore(s => s.blockIndex);
  const totalBlocks = useTimerStore(s => s.totalBlocks);
  const currentBlockName = useTimerStore(s => s.currentBlockName);
  const init = useTimerStore(s => s.init);
  const setPillar = useTimerStore(s => s.setPillar);
  const play = useTimerStore(s => s.play);
  const pause = useTimerStore(s => s.pause);
  const resume = useTimerStore(s => s.resume);
  const skip = useTimerStore(s => s.skip);
  const end = useTimerStore(s => s.end);
  // IMPORTANT: Never select _engine getters here — they compute Date.now() every call
  // and always return a new value, causing an infinite re-render loop.
  // Use stable scalar fields (elapsed, blockDurationMs) updated once/second by tick().
  const elapsed = useTimerStore(s => s.elapsed);
  const blockDurationMs = useTimerStore(s => s.blockDurationMs);
  const remaining = blockDurationMs - elapsed;
  const progress = blockDurationMs > 0 ? Math.min(elapsed / blockDurationMs, 1) : 0;
  const isOverdue = phase === 'overdue' || (phase === 'running' && remaining < 0);

  // Load module → routine → blocks
  useEffect(() => {
    if (!db || !isReady || !id) { setLoading(false); return; }
    (async () => {
      try {
        const spec = await getModuleSpec(db, id);
        if (!spec) { setLoading(false); return; }
        const config = typeof spec.config === 'string' ? JSON.parse(spec.config) : spec.config;
        setModuleLabel(spec.label);
        setModuleEmoji(spec.emoji ?? '');
        setAutoStart(config.autoStartOnTap ?? false);
        const routineId = config.routineId;
        if (!routineId) { setLoading(false); return; }
        const routine = await getRoutine(db, routineId);
        if (!routine) { Alert.alert('Routine Not Found'); setLoading(false); return; }
        setRoutineName(routine.name);
        setTotalMinutes(routine.totalDurationMinutes);
        setRoutineMode((routine as any).mode ?? 'sequential');
        setLauncherRoutineId(routineId);
        const rPillar = (routine as any).pillar ?? spec.pillar ?? 'general';
        setRoutinePillar(rPillar);
        const blks = await getRoutineBlocks(db, routineId);
        const parsed = blks.map((b: any) => {
          let todos: TodoItem[] = [];
          try { todos = JSON.parse(b.todos ?? '[]'); } catch {}
          let condition: BlockCondition | null = null;
          try { condition = b.condition ? JSON.parse(b.condition) : null; } catch {}
          return { name: b.name, durationMinutes: b.durationMinutes, type: b.type ?? 'focus', blockMode: (b.blockMode ?? 'timed') as Block['blockMode'], goalTarget: b.goalTarget ? Number(b.goalTarget) : null, todos, condition, liftTag: b.liftTag ?? '' };
        });
        const sets = await getRoutineBlockSets(db, routineId);
        setBlockSets(sets as any);
        if (sets.length > 1) {
          const def = (sets as any[]).find(s => s.isDefault);
          setSelectedSetId(def?.id ?? null);
          setBlocks(parsed);
          setSetPickerVisible(true);
        } else {
          setBlocks(parsed);
        }
      } catch (e) { console.error('Failed to load routine launcher:', e); } finally { setLoading(false); }
    })();
  }, [db, isReady, id]);

  // Feature 6: countup_list redirect
  useEffect(() => {
    if (!loading && routineMode === 'countup_list' && id) router.replace(`/countup-session/${id}`);
  }, [loading, routineMode, id]);

  // Feature 3: confirm set
  const handleSelectSet = useCallback(async (setId: string | null) => {
    if (!db || !launcherRoutineId) return;
    try {
      const blks = await getRoutineBlocksForSet(db, launcherRoutineId, setId);
      const parsed = (blks as any[]).map((b: any) => {
        let todos: TodoItem[] = [];
        try { todos = JSON.parse(b.todos ?? '[]'); } catch {}
        let condition: BlockCondition | null = null;
        try { condition = b.condition ? JSON.parse(b.condition) : null; } catch {}
        return { name: b.name, durationMinutes: b.durationMinutes, type: b.type ?? 'focus', blockMode: (b.blockMode ?? 'timed') as Block['blockMode'], goalTarget: b.goalTarget ? Number(b.goalTarget) : null, todos, condition, liftTag: b.liftTag ?? '' };
      });
      setBlocks(parsed);
      setSelectedSetId(setId);
      setSetPickerVisible(false);
    } catch (e) { console.error('Failed to filter blocks for set:', e); }
  }, [db, launcherRoutineId]);

  // Start
  const handleStart = useCallback(async () => {
    if (!db || !id) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const todayStr = new Date().toISOString().slice(0, 10);
      let dayPlan = await getDayPlan(db, todayStr);
      if (!dayPlan) {
        const dpId = await upsertDayPlan(db, { date: todayStr, title: 'Today' });
        dayPlan = { id: dpId } as any;
      }
      const spec = await getModuleSpec(db, id);
      const config = typeof spec.config === 'string' ? JSON.parse(spec.config) : spec.config;
      const routineId = config.routineId;
      const sid = await createSession(db, { dayPlanId: dayPlan.id, routineId, routineName });
      setSessionId(sid);
      const initialChecked: Record<number, Record<string, boolean>> = {};
      for (let i = 0; i < blocks.length; i++) {
        const rows = await getSessionBlockTodos(db, sid, i);
        if (rows.length > 0) {
          initialChecked[i] = {};
          for (const row of rows) initialChecked[i][row.todoId] = row.checked;
        }
      }
      setTodoChecked(initialChecked);
      const instrs: Record<number, string> = {};
      for (let i = 0; i < blocks.length; i++) {
        const txt = await getSessionBlockInstructions(db, sid, i);
        if (txt) instrs[i] = txt;
      }
      setBlockInstructions(instrs);
      await updateSession(db, sid, { status: 'in_progress', startedAt: new Date().toISOString() });
      await createSessionEvent(db, { sessionId: sid, type: 'started' });
      init(sid, blocks, routineName);
      setPillar(routinePillar); // V2: set pillar for FloatingActiveBlockWidget
      play();
      setStarted(true);
    } catch (e) { console.error('Failed to start routine:', e); Alert.alert('Error', 'Could not start the routine. Please try again.'); }
  }, [db, id, blocks, routineName, routinePillar, init, setPillar, play]);

  // Feature 2: count-up management
  const startCountup = useCallback(() => {
    countupStartRef.current = Date.now() - countupMs;
    countupRef.current = setInterval(() => { setCountupMs(Date.now() - countupStartRef.current); }, 1000);
  }, [countupMs]);
  const stopCountup = useCallback(() => {
    if (countupRef.current) { clearInterval(countupRef.current); countupRef.current = null; }
  }, []);
  const prevBlockIndex = useRef(blockIndex);
  useEffect(() => {
    if (blockIndex !== prevBlockIndex.current) { prevBlockIndex.current = blockIndex; stopCountup(); setCountupMs(0); setGoalCount(0); }
  }, [blockIndex, stopCountup]);
  useEffect(() => () => { stopCountup(); }, [stopCountup]);

  // Feature 1: canAdvance
  const canAdvance = useCallback(() => {
    const cb = blocks[blockIndex];
    if (!cb?.condition) return true;
    switch (cb.condition.type) {
      case 'min_time': {
        const minMs = (cb.condition.value ?? 0) * 60 * 1000;
        const elapsed = cb.blockMode !== 'timed' ? countupMs : (cb.durationMinutes * 60 * 1000 - remaining);
        return elapsed >= minMs;
      }
      case 'count_reached': return goalCount >= (cb.condition.value ?? 1);
      case 'all_todos_checked': return cb.todos.length > 0 ? cb.todos.every(t => todoChecked[blockIndex]?.[t.id]) : true;
      case 'manual_only': return false;
      default: return true;
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

  // Feature 4: toggle todo
  const handleToggleTodo = useCallback(async (todoId: string) => {
    if (!sessionId || !db) return;
    const current = todoChecked[blockIndex]?.[todoId] ?? false;
    const next = !current;
    setTodoChecked(prev => ({ ...prev, [blockIndex]: { ...(prev[blockIndex] ?? {}), [todoId]: next } }));
    try { await upsertSessionBlockTodo(db, sessionId, blockIndex, todoId, next); } catch {}
  }, [db, sessionId, blockIndex, todoChecked]);

  // Feature 2: goal count
  const handleLogGoalCount = useCallback(async (increment: number) => {
    const cb = blocks[blockIndex];
    if (!cb) return;
    const next = goalCount + increment;
    setGoalCount(next);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (cb.blockMode === 'goal_based' && cb.goalTarget && next >= cb.goalTarget) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (blockIndex < blocks.length - 1) skip(); else handleEndRef.current();
    }
  }, [goalCount, blockIndex, blocks, skip]);

  const handlePlayPause = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (phase === 'running' || phase === 'overdue') pause();
    else if (phase === 'paused') resume();
    else if (phase === 'idle' && started) play();
  }, [phase, pause, resume, play, started]);

  const handleSkip = useCallback(() => {
    if (!canAdvance()) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); Alert.alert('Cannot Advance', conditionReason()); return; }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    skip();
    if (db && sessionId) createSessionEvent(db, { sessionId, type: 'block_skipped', blockIndex }).catch(() => {});
  }, [skip, db, sessionId, blockIndex, canAdvance, conditionReason]);

  const handleEnd = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    end();
    if (db && sessionId) {
      try { await updateSession(db, sessionId, { status: 'completed', endedAt: new Date().toISOString() }); await createSessionEvent(db, { sessionId, type: 'ended' }); } catch {}
    }
    Alert.alert('\u2705 Routine Complete!', `${routineName} finished successfully.`, [{ text: 'Done', onPress: () => router.canGoBack() ? router.back() : router.replace('/(tabs)') }]);
  }, [end, db, sessionId, routineName, router]);

  const handleAbandon = useCallback(() => {
    Alert.alert('End Routine?', 'Your progress for this session will be saved.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'End', style: 'destructive', onPress: async () => {
        end();
        if (db && sessionId) await updateSession(db, sessionId, { status: 'abandoned', endedAt: new Date().toISOString() }).catch(() => {});
        router.canGoBack() ? router.back() : router.replace('/(tabs)');
      }},
    ]);
  }, [end, db, sessionId, router]);

  const handleEndRef = useRef(handleEnd);
  handleEndRef.current = handleEnd;

  useEffect(() => { if (phase === 'completed' && started) handleEndRef.current(); }, [phase, started]);

  const autoEndScheduled = useRef(false);
  useEffect(() => {
    if (phase === 'overdue' && started && blockIndex >= blocks.length - 1 && !autoEndScheduled.current) {
      autoEndScheduled.current = true;
      const t = setTimeout(() => { handleEndRef.current(); }, 400);
      return () => clearTimeout(t);
    }
    if (phase !== 'overdue') autoEndScheduled.current = false;
  }, [phase, started, blockIndex, blocks.length]);

  // Derived
  const timerProgress = Math.min(progress, 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - timerProgress);
  const pillarColor = getPillarColour(routinePillar as Pillar);
  const ringColor = isOverdue ? themeTokens.destructive : pillarColor;
  const isPaused = phase === 'paused';
  const isRunning = phase === 'running' || phase === 'overdue';
  const advanceOk = canAdvance();
  const currentBlock = blocks[blockIndex];
  const isGoalBased = currentBlock?.blockMode === 'goal_based';
  const isCountup = currentBlock?.blockMode === 'countup';
  const blockTodos = currentBlock?.todos ?? [];
  const blockChecked = todoChecked[blockIndex] ?? {};
  const instructions = blockInstructions[blockIndex] ?? '';
  const isGym = routinePillar === 'gym';

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <View style={[S.fill, { backgroundColor: themeTokens.background, justifyContent: 'center', alignItems: 'center' }]}>
      <Feather name="loader" size={32} color={themeTokens.textTertiary} />
      <AppText variant="body" color={themeTokens.textTertiary} style={{ marginTop: space[16] }}>Loading routine…</AppText>
    </View>
  );

  // ─── Feature 3: Block Set picker ─────────────────────────────────────────────
  if (setPickerVisible) return (
    <View style={[S.fill, { backgroundColor: themeTokens.background, paddingTop: insets.top + space[24], paddingHorizontal: space[16] }]}>
      <AppText variant="title1" style={{ fontWeight: '700', textAlign: 'center' }}>Choose a Set</AppText>
      <AppText variant="body" color={themeTokens.textSecondary} style={{ textAlign: 'center', marginTop: space[8], marginBottom: space[24] }}>
        {routineName} has multiple block sets.
      </AppText>
      <ScrollView contentContainerStyle={{ gap: space[12] }}>
        <Pressable style={[S.setCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: selectedSetId === null ? themeTokens.accent : themeTokens.border, borderWidth: selectedSetId === null ? 2 : 1 }]} onPress={() => setSelectedSetId(null)}>
          <Feather name="layers" size={20} color={selectedSetId === null ? themeTokens.accent : themeTokens.textSecondary} />
          <View style={{ flex: 1, marginLeft: space[12] }}>
            <AppText variant="headline" style={{ fontWeight: '600' }}>All Blocks</AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary}>Run the complete routine</AppText>
          </View>
          {selectedSetId === null && <Feather name="check-circle" size={20} color={themeTokens.accent} />}
        </Pressable>
        {blockSets.map(set => (
          <Pressable key={set.id} style={[S.setCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: selectedSetId === set.id ? themeTokens.accent : themeTokens.border, borderWidth: selectedSetId === set.id ? 2 : 1 }]} onPress={() => setSelectedSetId(set.id)}>
            <Feather name="bookmark" size={20} color={selectedSetId === set.id ? themeTokens.accent : themeTokens.textSecondary} />
            <AppText variant="headline" style={{ flex: 1, marginLeft: space[12], fontWeight: '600' }}>{set.name}{set.isDefault ? '  ★' : ''}</AppText>
            {selectedSetId === set.id && <Feather name="check-circle" size={20} color={themeTokens.accent} />}
          </Pressable>
        ))}
      </ScrollView>
      <Pressable style={[S.filledBtn, { backgroundColor: themeTokens.accent, marginTop: space[24], marginBottom: insets.bottom + space[16] }]} onPress={() => handleSelectSet(selectedSetId)}>
        <Feather name="play" size={20} color="#fff" />
        <AppText variant="headline" onAccent style={{ fontWeight: '600' }}>Continue</AppText>
      </Pressable>
    </View>
  );

  // ─── Empty blocks ─────────────────────────────────────────────────────────────
  if (blocks.length === 0) return (
    <View style={[S.fill, { backgroundColor: themeTokens.background, justifyContent: 'center', alignItems: 'center', padding: space[24] }]}>
      <Feather name="alert-circle" size={48} color={themeTokens.destructive} />
      <AppText variant="title2" style={{ fontWeight: '700', marginTop: space[16], textAlign: 'center' }}>No Blocks Found</AppText>
      <AppText variant="body" color={themeTokens.textSecondary} style={{ textAlign: 'center', marginTop: space[8] }}>Edit this routine to add blocks.</AppText>
      <Pressable style={[S.ghostBtn, { borderColor: themeTokens.border, marginTop: space[24] }]} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
        <AppText variant="subheadline" color={themeTokens.textSecondary}>Go Back</AppText>
      </Pressable>
    </View>
  );

  // ─── Pre-start overview ───────────────────────────────────────────────────────
  if (!started) return (
    <View style={[S.fill, { backgroundColor: themeTokens.background }]}>
      {/* Pillar accent bar at top */}
      <View style={[S.topAccentBar, { backgroundColor: pillarColor }]} />
      <ScrollView contentContainerStyle={[S.preStartScroll, { paddingTop: insets.top + space[32] }]}>
        <AppText style={S.emoji}>{moduleEmoji || '🚀'}</AppText>
        <AppText variant="title1" style={{ fontWeight: '700', textAlign: 'center' }}>{moduleLabel || routineName}</AppText>
        <AppText variant="footnote" color={themeTokens.textSecondary} style={{ marginTop: space[4], marginBottom: space[24], textAlign: 'center' }}>
          {totalMinutes > 0 ? `${totalMinutes} min · ` : ''}{blocks.length} blocks
        </AppText>
        <View style={S.blockList}>
          {blocks.map((b, i) => (
            <View key={i} style={[S.preStartBlockRow, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
              <View style={[S.preStartStripe, { backgroundColor: pillarColor }]} />
              <View style={{ flex: 1, paddingHorizontal: space[12], paddingVertical: space[12] }}>
                <AppText variant="headline" style={{ fontWeight: '600' }} numberOfLines={1}>{b.name}</AppText>
                <AppText variant="footnote" color={themeTokens.textSecondary}>
                  {b.blockMode === 'goal_based' ? `Goal: ${b.goalTarget ?? '?'}` : b.blockMode === 'countup' ? 'Open-ended' : `${b.durationMinutes} min`}
                  {b.type !== 'focus' ? `  ·  ${TYPE_LABEL[b.type] ?? b.type}` : ''}
                </AppText>
              </View>
              <AppText variant="caption2" color={themeTokens.textTertiary} style={{ paddingRight: space[12], paddingTop: space[12] }}>{i + 1}</AppText>
            </View>
          ))}
        </View>
        <View style={{ height: 120 }} />
      </ScrollView>
      <Pressable style={[S.filledBtn, { backgroundColor: pillarColor, position: 'absolute', bottom: insets.bottom + space[24], left: space[16], right: space[16] }]} onPress={handleStart}>
        <Feather name="play" size={22} color="#fff" />
        <AppText variant="headline" onAccent style={{ fontWeight: '700' }}>Start Routine</AppText>
      </Pressable>
    </View>
  );

  // ─── Active timer canvas ──────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView style={S.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={[S.fill, { backgroundColor: themeTokens.background }]}>

        {/* Session progress bar — absolute top */}
        <View style={[S.sessionProgressTrack, { top: insets.top + 15, backgroundColor: themeTokens.accentTint }]}>
          <View style={[S.sessionProgressFill, { width: `${(blockIndex / Math.max(blocks.length, 1)) * 100}%` as any, backgroundColor: pillarColor }]} />
        </View>

        {/* Back / abandon — top-left */}
        <Pressable style={[S.abandonBtn, { top: insets.top + space[8] }]} onPress={handleAbandon}>
          <Feather name="x" size={22} color={themeTokens.textTertiary} />
        </Pressable>

        {/* Centre canvas (scrollable) */}
        <ScrollView
          contentContainerStyle={[S.canvasScroll, { paddingTop: insets.top + space[48] }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Routine name */}
          <AppText variant="footnote" color={themeTokens.textSecondary} style={{ textAlign: 'center' }}>{routineName}</AppText>

          {/* Block name */}
          <AppText variant="title1" style={{ fontWeight: '700', textAlign: 'center', marginTop: space[8] }} numberOfLines={2}>
            {currentBlockName || currentBlock?.name || 'Ready'}
          </AppText>

          {/* Block position */}
          <AppText variant="caption1" color={themeTokens.textTertiary} style={{ textAlign: 'center', marginTop: space[4] }}>
            Block {blockIndex + 1} of {totalBlocks || blocks.length}
          </AppText>

          {/* Timer ring */}
          <View style={S.ringWrap}>
            {/* Pulse glow ring */}
            <Animated.View
              style={[S.pulseGlow, { borderColor: ringColor, transform: [{ scale: pulseAnim }] }]}
              pointerEvents="none"
            />
            <Svg width={RING_SIZE} height={RING_SIZE} style={{ transform: [{ rotate: '-90deg' }] }}>
              {/* Track */}
              <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS} stroke={themeTokens.accentTint} strokeWidth={STROKE_WIDTH} fill="none" />
              {/* Progress */}
              {isGoalBased ? (
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS} stroke={ringColor} strokeWidth={STROKE_WIDTH} fill="none"
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={currentBlock.goalTarget ? CIRCUMFERENCE * (1 - Math.min(goalCount / currentBlock.goalTarget, 1)) : 0}
                  strokeLinecap="round" />
              ) : isCountup ? (
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS} stroke={ringColor} strokeWidth={STROKE_WIDTH} fill="none"
                  strokeDasharray={CIRCUMFERENCE} strokeDashoffset={0} strokeLinecap="round" />
              ) : (
                <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS} stroke={ringColor} strokeWidth={STROKE_WIDTH} fill="none"
                  strokeDasharray={CIRCUMFERENCE} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
              )}
            </Svg>
            {/* Timer text inside ring */}
            <View style={S.timerOverlay}>
              {isCountup ? (
                <AppText variant="display" style={[S.timerFont, { color: ringColor }]}>{formatTime(countupMs)}</AppText>
              ) : isGoalBased ? (
                <>
                  <AppText variant="display" style={[S.timerFont, { color: ringColor }]}>{goalCount}</AppText>
                  <AppText variant="footnote" color={themeTokens.textTertiary}>/ {currentBlock.goalTarget ?? '?'}</AppText>
                </>
              ) : (
                <AppText variant="display" style={[S.timerFont, { color: isOverdue ? themeTokens.destructive : themeTokens.textPrimary }]}>
                  {formatTime(remaining)}
                </AppText>
              )}
            </View>
          </View>

          {/* Block chips (progress dots) */}
          <View style={S.chipRow}>
            {blocks.map((_, i) => (
              <View key={i} style={[S.chip, i < blockIndex && { backgroundColor: ringColor }, i === blockIndex && { backgroundColor: ringColor, width: 20 }, i > blockIndex && { backgroundColor: themeTokens.accentTint }]} />
            ))}
          </View>

          {/* Feature 2: Goal counter */}
          {isGoalBased && (
            <View style={[S.goalRow, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
              <Pressable style={[S.goalBtn, { backgroundColor: themeTokens.surface }]} onPress={() => setGoalCount(n => Math.max(0, n - 1))}>
                <Feather name="minus" size={20} color={themeTokens.textPrimary} />
              </Pressable>
              <View style={S.goalCenter}>
                <AppText variant="footnote" color={themeTokens.textSecondary}>Reps / Count</AppText>
                <AppText variant="display" style={[S.timerFont, { color: themeTokens.textPrimary }]}>{goalCount}</AppText>
              </View>
              <Pressable style={[S.goalBtn, { backgroundColor: ringColor }]} onPress={() => handleLogGoalCount(1)}>
                <Feather name="plus" size={20} color="#fff" />
              </Pressable>
            </View>
          )}

          {/* Condition lock indicator */}
          {!advanceOk && (
            <View style={[S.conditionBanner, { backgroundColor: themeTokens.warning + '20', borderColor: themeTokens.warning }]}>
              <Feather name="lock" size={14} color={themeTokens.warning} />
              <AppText variant="footnote" color={themeTokens.warning}>{conditionReason()}</AppText>
            </View>
          )}

          <View style={{ height: DRAWER_PEEK + space[24] }} />
        </ScrollView>

        {/* Fixed control bar */}
        <View style={[S.controlBar, { paddingBottom: space[12] }]}>
          {/* Skip Block — ghost left */}
          <Pressable
            style={[S.ghostBtn, { flex: 1, borderColor: advanceOk ? themeTokens.border : themeTokens.accentTint, opacity: advanceOk ? 1 : 0.5 }]}
            onPress={blockIndex < blocks.length - 1 ? handleSkip : handleEnd}
            disabled={!advanceOk}
          >
            <Feather name={advanceOk ? (blockIndex < blocks.length - 1 ? 'skip-forward' : 'check') : 'lock'} size={16} color={themeTokens.textSecondary} />
            <AppText variant="subheadline" color={themeTokens.textSecondary}>{blockIndex < blocks.length - 1 ? 'Skip' : 'Finish'}</AppText>
          </Pressable>

          {/* Pause/Resume — filled accent centre */}
          <Pressable
            style={[S.pauseBtn, { backgroundColor: themeTokens.accent }]}
            onPress={handlePlayPause}
          >
            <Feather name={isRunning ? 'pause' : 'play'} size={24} color="#fff" />
            <AppText variant="headline" onAccent style={{ fontWeight: '600' }}>{isRunning ? 'Pause' : 'Resume'}</AppText>
          </Pressable>

          {/* End — ghost destructive right */}
          <Pressable
            style={[S.ghostBtn, { flex: 1, borderColor: themeTokens.destructive + '40' }]}
            onPress={handleAbandon}
          >
            <Feather name="x-circle" size={16} color={themeTokens.destructive} />
            <AppText variant="subheadline" color={themeTokens.destructive}>End</AppText>
          </Pressable>
        </View>

        {/* Bottom drawer */}
        <BottomDrawer
          isOpen={drawerOpen}
          onToggle={() => setDrawerOpen(v => !v)}
          todos={blockTodos}
          todoChecked={blockChecked}
          onToggleTodo={handleToggleTodo}
          instructions={instructions}
          sessionNotes={sessionNotes}
          onNotesChange={setSessionNotes}
          isGym={isGym}
          screenHeight={screenHeight}
          pillarColor={pillarColor}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  fill: { flex: 1 },
  emoji: { fontSize: 56, textAlign: 'center', marginBottom: space[16] },

  topAccentBar: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, zIndex: 10 },
  sessionProgressTrack: { position: 'absolute', left: 0, right: 0, height: 4, zIndex: 10 },
  sessionProgressFill: { height: '100%' },
  abandonBtn: { position: 'absolute', left: space[16], zIndex: 20, padding: space[8] },

  preStartScroll: { alignItems: 'center', paddingHorizontal: space[16], paddingBottom: 120 },
  blockList: { width: '100%', gap: space[8] },
  preStartBlockRow: { flexDirection: 'row', alignItems: 'stretch', borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  preStartStripe: { width: 3 },

  canvasScroll: { alignItems: 'center', paddingHorizontal: space[16] },

  ringWrap: { marginTop: space[24], marginBottom: space[16], width: RING_SIZE, height: RING_SIZE, alignItems: 'center', justifyContent: 'center' },
  pulseGlow: { position: 'absolute', width: RING_SIZE - 24, height: RING_SIZE - 24, borderRadius: (RING_SIZE - 24) / 2, borderWidth: 2, opacity: 0.25 },
  timerOverlay: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  timerFont: { fontWeight: '800', fontVariant: ['tabular-nums'] as any },

  chipRow: { flexDirection: 'row', gap: space[4], marginBottom: space[16] },
  chip: { height: 4, width: 8, borderRadius: radius.full },

  goalRow: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, borderWidth: 1, overflow: 'hidden', marginBottom: space[16], width: '100%', maxWidth: 280 },
  goalBtn: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  goalCenter: { flex: 1, alignItems: 'center', gap: space[2] },

  conditionBanner: { flexDirection: 'row', alignItems: 'center', gap: space[8], paddingHorizontal: space[12], paddingVertical: space[8], borderRadius: radius.sm, borderWidth: 1, marginBottom: space[16] },

  controlBar: { paddingHorizontal: space[16], paddingTop: space[12], flexDirection: 'row', alignItems: 'center', gap: space[8] },
  pauseBtn: { flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[8], height: 56, borderRadius: radius.full },
  ghostBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[4], height: 44, borderRadius: radius.md, borderWidth: 1 },
  filledBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[12], height: 56, borderRadius: radius.lg },

  setCard: { flexDirection: 'row', alignItems: 'center', padding: space[16], borderRadius: radius.md },

  // Drawer
  drawer: { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopWidth: 1, borderRadius: radius.lg, overflow: 'hidden' },
  drawerHandle: { alignItems: 'center', paddingTop: space[8], paddingBottom: space[4] },
  handleBar: { width: 32, height: 4, borderRadius: radius.full },
  iconRow: { flexDirection: 'row', justifyContent: 'center', gap: space[24], paddingHorizontal: space[16], paddingBottom: space[8] },
  iconBtn: { padding: space[8] },
  iconBadge: { position: 'absolute', top: -4, right: -4, width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  drawerScroll: { flex: 1 },
  drawerContent: { padding: space[16], gap: space[20] },
  drawerSection: { gap: space[8] },
  drawerSectionLabel: { letterSpacing: 0.5 },
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: space[12], paddingVertical: space[4] },
  todoCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  strikethrough: { textDecorationLine: 'line-through' },
  notesInput: { borderWidth: 1, borderRadius: radius.md, padding: space[12], minHeight: 80, fontSize: typography.body.fontSize },
});
