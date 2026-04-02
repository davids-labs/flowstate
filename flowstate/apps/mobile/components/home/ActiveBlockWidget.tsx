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
  Pressable,
  StyleSheet,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';
import { useRouter } from 'expo-router';
import { spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';
import { useTimerStore } from '../../stores/timerStore';
import { useUserPrefsStore, type Pillar } from '../../stores/userPrefsStore';
import { AppText } from '../primitives/Text';

const RING_SIZE = 140;
const STROKE_WIDTH = 6;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;


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
  emptyActionLabel?: string;
  onEmptyActionPress?: () => void;
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

export function ActiveBlockWidget({
  pillar = 'general',
  instructions,
  nextSession,
  emptyActionLabel = 'Add Session',
  onEmptyActionPress,
}: Props) {
  const { themeTokens } = useTheme();
  const router = useRouter();
  const getPillarColour = useUserPrefsStore(s => s.getPillarColour);

  const phase = useTimerStore((s) => s.phase);
  const blockIndex = useTimerStore((s) => s.blockIndex);
  const totalBlocks = useTimerStore((s) => s.totalBlocks);
  const currentBlockName = useTimerStore((s) => s.currentBlockName);
  const sessionId = useTimerStore((s) => s.sessionId);
  const routineName = useTimerStore((s) => s.routineName);
  const elapsed = useTimerStore((s) => s.elapsed);
  const blockDurationMs = useTimerStore((s) => s.blockDurationMs);
  const blockMode = useTimerStore((s) => s.blockMode);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const skip = useTimerStore((s) => s.skip);
  const end = useTimerStore((s) => s.end);

  const isActive = phase === 'running' || phase === 'overdue' || phase === 'paused' || phase === 'pending_condition';
  const accentColor = getPillarColour(pillar as Pillar);

  // Derive display values from stable Zustand primitives — never read Date.now() inside a selector
  const isOverdue = phase === 'overdue';
  const remaining = blockDurationMs > 0 ? blockDurationMs - elapsed : -elapsed;
  const progress = blockMode !== 'timed' ? 0 : (blockDurationMs > 0 ? Math.min(elapsed / blockDurationMs, 1) : 0);

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
    const nextPillarColor = nextSession?.pillar
      ? getPillarColour(nextSession.pillar as Pillar)
      : themeTokens.accent;
    return (
      <View style={[styles.promptCard, { backgroundColor: themeTokens.surface }]}>
        <View style={styles.promptLeft}>
          <AppText variant="headline" style={styles.promptTitle}>
            {nextSession ? nextSession.routineName : 'No Session Planned'}
          </AppText>
          <AppText variant="footnote" color={themeTokens.textSecondary} style={styles.promptMeta}>
            {nextSession?.scheduledTime ?? 'Tap to start an ad-hoc session'}
          </AppText>
        </View>
        {nextSession ? (
          <Pressable
            style={[styles.promptStartBtn, { backgroundColor: nextPillarColor }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push(`/session/${nextSession.sessionId}`);
            }}
          >
            <Feather name="play" size={18} color="#fff" />
            <AppText variant="footnote" onAccent style={styles.promptStartText}>Start</AppText>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.promptStartBtn, { backgroundColor: themeTokens.accent }]}
            onPress={() => {
              if (onEmptyActionPress) {
                onEmptyActionPress();
                return;
              }
              router.push('/(tabs)/today');
            }}
          >
            <AppText variant="footnote" onAccent style={styles.promptStartText}>{emptyActionLabel}</AppText>
          </Pressable>
        )}
      </View>
    );
  }

  // ─── Active session ───────────────────────────────────────────
  const timerProgress = Math.min(progress, 1);
  const strokeDashoffset = CIRCUMFERENCE * (1 - timerProgress);
  const ringColor = isOverdue ? themeTokens.destructive : accentColor;

  return (
    <View style={[styles.activeCard, { backgroundColor: themeTokens.surface }]}>
      {/* Pillar accent strip */}
      <View style={[styles.pillarStrip, { backgroundColor: accentColor }]} />

      <View style={styles.activeContent}>
        {/* Timer ring */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <Svg width={RING_SIZE} height={RING_SIZE}>
            <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
              stroke={themeTokens.border} strokeWidth={STROKE_WIDTH} fill="none" />
            <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RADIUS}
              stroke={ringColor} strokeWidth={STROKE_WIDTH} fill="none"
              strokeDasharray={CIRCUMFERENCE} strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`} />
          </Svg>
          <View style={styles.timeOverlay}>
            <AppText
              variant="title2"
              color={isOverdue ? themeTokens.destructive : themeTokens.textPrimary}
              style={styles.timeText}
            >
              {formatTime(remaining)}
            </AppText>
            <AppText variant="caption2" color={themeTokens.textSecondary} style={styles.blockProgress}>
              {blockIndex + 1}/{totalBlocks}
            </AppText>
          </View>
        </Animated.View>

        {/* Block info */}
        <View style={styles.blockInfo}>
          <AppText variant="caption1" color={themeTokens.textSecondary} numberOfLines={1} style={styles.routineNameText}>
            {routineName}
          </AppText>
          <AppText variant="headline" numberOfLines={2} style={styles.blockNameText}>
            {currentBlockName}
          </AppText>
          {!!instructions && (
            <AppText variant="caption1" color={themeTokens.textSecondary} numberOfLines={1} style={styles.instructionText}>
              {instructions}
            </AppText>
          )}

          {/* Controls */}
          <View style={styles.controls}>
            <Pressable
              style={[styles.controlBtn, { backgroundColor: themeTokens.background }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                phase === 'running' ? pause() : resume();
              }}
            >
              <Feather
                name={phase === 'running' ? 'pause' : 'play'}
                size={16}
                color={themeTokens.textPrimary}
              />
            </Pressable>
            <Pressable
              style={[styles.controlBtn, { backgroundColor: themeTokens.background }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                skip();
              }}
            >
              <Feather name="skip-forward" size={16} color={themeTokens.textPrimary} />
            </Pressable>
            <Pressable
              style={[styles.controlBtn, { backgroundColor: themeTokens.destructive + '20' }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                if (sessionId) {
                  router.push(`/routine-launcher/${sessionId}`);
                }
              }}
            >
              <Feather name="maximize-2" size={16} color={themeTokens.destructive} />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Session progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: themeTokens.border }]}>
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
    fontWeight: '700',
  },
  promptMeta: {
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
    fontWeight: '700',
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
    fontVariant: ['tabular-nums'],
  },
  blockProgress: {
    marginTop: 2,
  },
  blockInfo: {
    flex: 1,
    gap: 4,
  },
  routineNameText: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  blockNameText: {
    fontWeight: '700',
  },
  instructionText: {},
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
