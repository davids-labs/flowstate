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
  getDayPlan,
  upsertDayPlan,
  createSession,
  updateSession,
  createSessionEvent,
} from '@flowstate/core';
import { useTimerStore } from '../../stores/timerStore';

const RING_SIZE = 200;
const STROKE_WIDTH = 8;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface Block {
  name: string;
  durationMinutes: number;
  type: string;
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
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [autoStart, setAutoStart] = useState(false);

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

  // Timer state
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

        const blks = await getRoutineBlocks(db, routineId);
        setBlocks(
          blks.map((b: any) => ({
            name: b.name,
            durationMinutes: b.durationMinutes,
            type: b.type ?? 'focus',
          })),
        );
      } catch (e) {
        console.error('Failed to load routine launcher:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [db, isReady, id]);

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

      // Mark session as in-progress
      await updateSession(db, sid, {
        status: 'in_progress',
        startedAt: new Date().toISOString(),
      });
      await createSessionEvent(db, { sessionId: sid, type: 'timer_started' });

      // Init and start the timer
      init(sid, blocks, routineName);
      play();
      setStarted(true);
    } catch (e) {
      console.error('Failed to start routine:', e);
      Alert.alert('Error', 'Could not start the routine. Please try again.');
    }
  }, [db, id, blocks, routineName, init, play]);

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
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    skip();
    if (db && sessionId) {
      createSessionEvent(db, {
        sessionId,
        type: 'block_skipped',
        blockIndex,
      }).catch((e) => { console.warn('operation failed:', e); });
    }
  }, [skip, db, sessionId, blockIndex]);

  const handleEnd = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    end();

    if (db && sessionId) {
      try {
        await updateSession(db, sessionId, {
          status: 'completed',
          endedAt: new Date().toISOString(),
        });
        await createSessionEvent(db, { sessionId, type: 'session_completed' });
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

  const timerProgress = Math.min(progress, 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - timerProgress);
  const ringColor = isOverdue ? themeColors.danger : (TYPE_COLORS[blocks[blockIndex]?.type] ?? themeColors.accent);
  const isPaused = phase === 'paused';
  const isRunning = phase === 'running' || phase === 'overdue';

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.background }]}>
        <ActivityIndicator size="large" color={themeColors.accent} />
        <Text style={[styles.loadingText, { color: themeColors.muted }]}>Loading routine...</Text>
      </View>
    );
  }

  if (blocks.length === 0) {
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
          <Text style={[styles.routineSubtitle, { color: themeColors.muted }]}>{totalMinutes} min · {blocks.length} blocks</Text>

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
                  <Text style={[styles.blockCardDur, { color: themeColors.muted }]}>{b.durationMinutes} min</Text>
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

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      <Text style={[styles.routineTitle, { color: themeColors.text }]}>{routineName}</Text>

      {/* Timer ring */}
      <Animated.View style={[styles.ringContainer, { transform: [{ scale: pulseAnim }] }]}>
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
      </Animated.View>

      {/* Current block info */}
      <View style={[styles.currentBlockBadge, { backgroundColor: (TYPE_COLORS[currentBlock?.type] ?? themeColors.accent) + '20' }]}>
        <Text style={[styles.currentBlockType, { color: TYPE_COLORS[currentBlock?.type] ?? themeColors.accent }]}>
          {TYPE_LABELS[currentBlock?.type] ?? currentBlock?.type}
        </Text>
      </View>
      <Text style={[styles.blockNameLarge, { color: themeColors.text }]}>{currentBlockName || currentBlock?.name || 'Ready'}</Text>
      <Text style={[styles.blockMeta, { color: themeColors.muted }]}>Block {blockIndex + 1} of {totalBlocks || blocks.length}</Text>

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
          style={[styles.controlBtn, { backgroundColor: themeColors.surface }]}
          onPress={blockIndex < blocks.length - 1 ? handleSkip : handleEnd}
        >
          <Feather
            name={blockIndex < blocks.length - 1 ? 'skip-forward' : 'check'}
            size={24}
            color={themeColors.accent}
          />
        </Pressable>
      </View>
    </View>
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
});
