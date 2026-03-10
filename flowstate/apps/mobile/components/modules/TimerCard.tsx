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
  const [isRunning, setIsRunning] = useState(false);
  const [remaining, setRemaining] = useState(defaultDurationSeconds);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const progress = defaultDurationSeconds > 0
    ? 1 - (remaining / defaultDurationSeconds)
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

  useEffect(() => {
    if (remaining <= 0 && isRunning) {
      // Timer finished
      cleanup();
      setIsRunning(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const durationMs = elapsed * 1000;
      onFinish?.(moduleId, durationMs);
    }
  }, [remaining, isRunning, elapsed, moduleId, onFinish, cleanup]);

  const handleToggle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isRunning) {
      // Stop
      cleanup();
      setIsRunning(false);
    } else {
      // Start / Resume
      if (remaining <= 0) {
        // Reset first
        setRemaining(defaultDurationSeconds);
        setElapsed(0);
      }
      startTimeRef.current = Date.now();
      setIsRunning(true);

      intervalRef.current = setInterval(() => {
        setRemaining(prev => {
          const next = prev - 1;
          return Math.max(0, next);
        });
        setElapsed(prev => prev + 1);
      }, 1000);
    }
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    cleanup();
    setIsRunning(false);
    setRemaining(defaultDurationSeconds);
    setElapsed(0);
  };

  const finished = remaining <= 0 && !isRunning && elapsed > 0;

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
