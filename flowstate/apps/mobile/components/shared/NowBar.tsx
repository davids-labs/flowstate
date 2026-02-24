import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTimerStore } from '../../stores/timerStore';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

function formatTimeCompact(ms: number): string {
  const isNegative = ms < 0;
  const absMs = Math.abs(ms);
  const totalSeconds = Math.floor(absMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const prefix = isNegative ? '+' : '';
  return `${prefix}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * NowBar — persistent floating bar shown globally when a session timer is active.
 * Samsung One UI 8 style: pill-shaped, minimal, shows block name + remaining time.
 * Tapping navigates back to the active session screen.
 */
export function NowBar() {
  const router = useRouter();
  const phase = useTimerStore(s => s.phase);
  const remaining = useTimerStore(s => s.remaining);
  const currentBlockName = useTimerStore(s => s.currentBlockName);
  const routineName = useTimerStore(s => s.routineName);
  const isOverdue = useTimerStore(s => s.isOverdue);
  const sessionId = useTimerStore(s => s.sessionId);

  // Only show when timer is actively running, paused, or overdue
  const isActive = phase === 'running' || phase === 'paused' || phase === 'overdue';
  if (!isActive) return null;

  const { themeColors } = useTheme();
  const isPaused = phase === 'paused';

  return (
    <Pressable
      style={[
        styles.container,
        isOverdue && styles.containerOverdue,
        isPaused && styles.containerPaused,
      ]}
      onPress={() => {
        if (sessionId) {
          router.push(`/session/${sessionId}`);
        }
      }}
    >
      {/* Pulsing dot indicator */}
      <View style={[styles.dot, isPaused ? styles.dotPaused : styles.dotLive]} />

      {/* Block/routine name */}
      <View style={styles.info}>
        <Text style={styles.blockName} numberOfLines={1}>
          {currentBlockName || 'Focus'}
        </Text>
        {routineName ? (
          <Text style={styles.routineName} numberOfLines={1}>{routineName}</Text>
        ) : null}
      </View>

      {/* Time remaining */}
      <Text style={[styles.time, isOverdue && styles.timeOverdue]}>
        {formatTimeCompact(remaining)}
      </Text>

      {/* Status icon */}
      <Feather
        name={isPaused ? 'pause' : 'play'}
        size={14}
        color={isOverdue ? themeColors.danger : themeColors.white}
        style={styles.icon}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 90,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B0F14',
    borderRadius: borderRadius.xl,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  containerOverdue: {
    backgroundColor: '#7F1D1D', // dark red
  },
  containerPaused: {
    backgroundColor: '#1E293B', // slate-800
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotLive: {
    backgroundColor: '#16A34A',
  },
  dotPaused: {
    backgroundColor: '#D97706',
  },
  info: {
    flex: 1,
  },
  blockName: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  routineName: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 1,
  },
  time: {
    fontSize: fontSize.md,
    fontWeight: '800',
    color: '#FFFFFF',
    fontVariant: ['tabular-nums'],
  },
  timeOverdue: {
    color: '#FCA5A5', // red-300
  },
  icon: {
    marginLeft: spacing.xs,
  },
});
