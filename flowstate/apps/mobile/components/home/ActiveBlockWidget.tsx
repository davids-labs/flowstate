/**
 * ActiveBlockWidget (Feature: Homescreen Overhaul - Zone 2)
 *
 * The centrepiece of the My Day homescreen. Visible only when a session is
 * actively running. Shows a pulsing ring, block name, routine name, optional
 * instructions, and three controls: Pause, Skip Block, End Session.
 *
 * When no session is active, renders a "Start a Session" prompt card.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';
import { useTimerStore } from '../../stores/timerStore';

const RING_SIZE = 140;
const STROKE_WIDTH = 6;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const PILLAR_COLORS: Record<string, string> = {
  gym: '#ef4444',
  academic: '#3b82f6',
  life: '#22c55e',
  general: '#a855f7',
};

interface Props {
  pillar?: 'gym' | 'academic' | 'life' | 'general';
  instructions?: string;
  /** Next scheduled session info for the "no active session" state */
  nextSession?: {
    sessionId: string;
    routineName: string;
    scheduledTime?: string;
    pillar?: string;
  } | null;
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

export function ActiveBlockWidget({ pillar = 'general', instructions, nextSession }: Props) {
  const { themeColors } = useTheme();
  const router = useRouter();

  const phase = useTimerStore((s) => s.phase);
  const blockIndex = useTimerStore((s) => s.blockIndex);
  const totalBlocks = useTimerStore((s) => s.totalBlocks);
  const currentBlockName = useTimerStore((s) => s.currentBlockName);
  const sessionId = useTimerStore((s) => s.sessionId);
  const routineName = useTimerStore((s) => s.routineName);
  const remaining = useTimerStore((s) => s._engine?.remaining ?? 0);
  const progress = useTimerStore((s) => s._engine?.progress ?? 0);
  const isOverdue = useTimerStore((s) => s._engine?.isOverdue ?? false);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const skip = useTimerStore((s) => s.skip);
  const end = useTimerStore((s) => s.end);

  const isActive = phase === 'running' || phase === 'overdue' || phase === 'paused' || phase === 'pending_condition';
  const accentColor = PILLAR_COLORS[pillar] ?? themeColors.accent;

  // Pulse animation  
  const pulseAnim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (phase === 'running') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.06, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ]),
      );
      loop.start();
      return () => loop.stop();
    } else {
      pulseAnim.setValue(1);
    }
  }, [phase]);

  // ─── No active session ───────────────────────────────────────
  if (!isActive) {
    return (
      <View style={[styles.promptCard, { backgroundColor: themeColors.surface }]}>
        <View style={styles.promptLeft}>
          <Text style={[styles.promptTitle, { color: themeColors.text }]}>
            {nextSession ? nextSession.routineName : 'No Session Planned'}
          </Text>
          <Text style={[styles.promptMeta, { color: themeColors.muted }]}>
            {nextSession?.scheduledTime ?? 'Tap to start an ad-hoc session'}
          </Text>
        </View>
        {nextSession ? (
          <Pressable
            style={[styles.promptStartBtn, { backgroundColor: PILLAR_COLORS[nextSession.pillar ?? 'general'] }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push(`/session/${nextSession.sessionId}`);
            }}
          >
            <Feather name="play" size={18} color="#fff" />
            <Text style={styles.promptStartText}>Start</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.promptStartBtn, { backgroundColor: themeColors.accent }]}
            onPress={() => router.push('/(tabs)/today')}
          >
            <Text style={styles.promptStartText}>Today →</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // ─── Active session ───────────────────────────────────────────
  const timerProgress = Math.min(progress, 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - timerProgress);
  const ringColor = isOverdue ? themeColors.danger : accentColor;

  return (
    <View style={[styles.activeCard, { backgroundColor: themeColors.surface }]}>
      {/* Pillar accent strip */}
      <View style={[styles.pillarStrip, { backgroundColor: accentColor }]} />

      <View style={styles.activeContent}>
        {/* Timer ring */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
              stroke={themeColors.surfaceBorder} strokeWidth={STROKE_WIDTH} fill="none" />
            <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
              stroke={ringColor} strokeWidth={STROKE_WIDTH} fill="none"
              strokeDasharray={CIRCUMFERENCE} strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`} />
          </Svg>
          <View style={styles.timeOverlay}>
            <Text style={[styles.timeText, { color: isOverdue ? themeColors.danger : themeColors.text }]}>
              {formatTime(remaining)}
            </Text>
            <Text style={[styles.blockProgress, { color: themeColors.muted }]}>
              {blockIndex + 1}/{totalBlocks}
            </Text>
          </View>
        </Animated.View>

        {/* Block info */}
        <View style={styles.blockInfo}>
          <Text style={[styles.routineNameText, { color: themeColors.muted }]} numberOfLines={1}>
            {routineName}
          </Text>
          <Text style={[styles.blockNameText, { color: themeColors.text }]} numberOfLines={2}>
            {currentBlockName}
          </Text>
          {!!instructions && (
            <Text style={[styles.instructionText, { color: themeColors.muted }]} numberOfLines={1}>
              {instructions}
            </Text>
          )}

          {/* Controls */}
          <View style={styles.controls}>
            <Pressable
              style={[styles.controlBtn, { backgroundColor: themeColors.background }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                phase === 'running' ? pause() : resume();
              }}
            >
              <Feather
                name={phase === 'running' ? 'pause' : 'play'}
                size={16}
                color={themeColors.text}
              />
            </Pressable>
            <Pressable
              style={[styles.controlBtn, { backgroundColor: themeColors.background }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                skip();
              }}
            >
              <Feather name="skip-forward" size={16} color={themeColors.text} />
            </Pressable>
            <Pressable
              style={[styles.controlBtn, { backgroundColor: themeColors.danger + '20' }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (sessionId) {
                  router.push(`/routine-launcher/${sessionId}`);
                }
              }}
            >
              <Feather name="maximize-2" size={16} color={themeColors.danger} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Session progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: themeColors.surfaceBorder }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: accentColor, width: `${timerProgress * 100}%` },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // ─── No session state ───────────────────────────────────────
  promptCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  promptLeft: {
    flex: 1,
  },
  promptTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  promptMeta: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  promptStartBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.lg,
  },
  promptStartText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: fontSize.sm,
  },

  // ─── Active session state ────────────────────────────────────
  activeCard: {
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  pillarStrip: {
    height: 3,
    width: '100%',
  },
  activeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  timeOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeText: {
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  blockProgress: {
    fontSize: 10,
    marginTop: 2,
  },
  blockInfo: {
    flex: 1,
    gap: 4,
  },
  routineNameText: {
    fontSize: fontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  blockNameText: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    lineHeight: 22,
  },
  instructionText: {
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  controls: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  controlBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressTrack: {
    height: 3,
    width: '100%',
  },
  progressFill: {
    height: '100%',
  },
});
