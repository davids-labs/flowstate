import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface TimerCardProps {
  label: string;
  emoji?: string;
  moduleId: string;
  defaultDurationSeconds: number;
  compact?: boolean;
  /** Called when the timer finishes — should create a session record */
  onFinish?: (moduleId: string, durationMs: number) => void;
}

function formatTime(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function TimerCard({
  label,
  emoji,
  moduleId,
  defaultDurationSeconds,
  compact,
  onFinish,
}: TimerCardProps) {
  const { themeColors } = useTheme();

  // ─── BUG-04 fix: use timestamps, not a counter ───────────────
  // startedAtMs: wall-clock ms when timer was first started (or last resumed)
  // pausedDurationMs: accumulated ms spent paused
  // pausedAtMs: wall-clock ms when the current pause began (null if not paused)
  const startedAtMs = useRef<number | null>(null);
  const pausedDurationMs = useRef<number>(0);
  const pausedAtMs = useRef<number | null>(null);

  const [isRunning, setIsRunning] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  // Display state: updated by interval tick, computed from timestamps
  const [displayRemaining, setDisplayRemaining] = useState(defaultDurationSeconds);
  const [displayElapsed, setDisplayElapsed] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const progress = defaultDurationSeconds > 0
    ? 1 - (displayRemaining / defaultDurationSeconds)
    : 0;

  const cleanup = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // Compute remaining/elapsed from absolute timestamps — immune to interval drift
  const computeValues = useCallback((): { remaining: number; elapsedSeconds: number } => {
    if (!startedAtMs.current) {
      return { remaining: defaultDurationSeconds, elapsedSeconds: 0 };
    }
    const now = pausedAtMs.current ?? Date.now();
    const totalElapsedMs = now - startedAtMs.current - pausedDurationMs.current;
    const elapsedSeconds = Math.max(0, Math.floor(totalElapsedMs / 1000));
    const remaining = Math.max(0, defaultDurationSeconds - elapsedSeconds);
    return { remaining, elapsedSeconds };
  }, [defaultDurationSeconds]);

  const startTicking = useCallback(() => {
    cleanup();
    intervalRef.current = setInterval(() => {
      const { remaining, elapsedSeconds } = computeValues();
      setDisplayRemaining(remaining);
      setDisplayElapsed(elapsedSeconds);
      if (remaining <= 0) {
        cleanup();
        setIsRunning(false);
        setIsFinished(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onFinish?.(moduleId, elapsedSeconds * 1000);
      }
    }, 1000);
  }, [cleanup, computeValues, moduleId, onFinish]);

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isRunning) {
      // Pause — record when pause started
      cleanup();
      pausedAtMs.current = Date.now();
      setIsRunning(false);
    } else {
      if (isFinished || displayRemaining <= 0) {
        // Restart from zero
        startedAtMs.current = Date.now();
        pausedDurationMs.current = 0;
        pausedAtMs.current = null;
        setDisplayRemaining(defaultDurationSeconds);
        setDisplayElapsed(0);
        setIsFinished(false);
      } else if (pausedAtMs.current !== null) {
        // Resume from pause — add pause duration to accumulator
        pausedDurationMs.current += Date.now() - pausedAtMs.current;
        pausedAtMs.current = null;
      } else {
        // First start
        startedAtMs.current = Date.now();
        pausedDurationMs.current = 0;
      }
      setIsRunning(true);
      startTicking();
    }
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cleanup();
    startedAtMs.current = null;
    pausedDurationMs.current = 0;
    pausedAtMs.current = null;
    setIsRunning(false);
    setIsFinished(false);
    setDisplayRemaining(defaultDurationSeconds);
    setDisplayElapsed(0);
  };

  const finished = isFinished;
  const remaining = displayRemaining;
  const elapsed = displayElapsed;

  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface }, compact && styles.cardCompact]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Feather name="clock" size={14} color={themeColors.textSecondary} style={styles.icon} />
        <Text style={[styles.label, { color: themeColors.textSecondary }]}>{label}</Text>
      </View>

      <Text
        style={[
          styles.time,
          { color: isRunning ? themeColors.accent : finished ? themeColors.success : themeColors.text },
          compact && styles.timeCompact,
        ]}
      >
        {formatTime(remaining)}
      </Text>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: themeColors.surfaceBorder }]}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${Math.min(progress * 100, 100)}%`,
              backgroundColor: finished ? themeColors.success : themeColors.accent,
            },
          ]}
        />
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <Pressable
          style={[
            styles.mainBtn,
            { backgroundColor: isRunning ? themeColors.danger : themeColors.accent },
          ]}
          onPress={handleToggle}
        >
          <Feather
            name={isRunning ? 'square' : 'play'}
            size={18}
            color={themeColors.white}
          />
          <Text style={[styles.btnText, { color: themeColors.white }]}>
            {isRunning ? 'Stop' : finished ? 'Restart' : 'Start'}
          </Text>
        </Pressable>

        {(isRunning || elapsed > 0) && (
          <Pressable
            style={[styles.resetBtn, { borderColor: themeColors.surfaceBorder }]}
            onPress={handleReset}
          >
            <Feather name="rotate-ccw" size={16} color={themeColors.muted} />
          </Pressable>
        )}
      </View>

      {finished && (
        <Text style={[styles.doneText, { color: themeColors.success }]}>
          Session logged
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  cardCompact: {
    padding: spacing.sm,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  time: {
    fontSize: fontSize.hero,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  timeCompact: {
    fontSize: fontSize.xxl,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    marginTop: spacing.sm,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  mainBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
  },
  btnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  resetBtn: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  doneText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    marginTop: spacing.xs,
  },
  icon: { marginRight: 8 },
});
