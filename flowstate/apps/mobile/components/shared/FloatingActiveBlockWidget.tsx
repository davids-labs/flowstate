/**
 * FloatingActiveBlockWidget — V2 spec §1.6
 *
 * Floating overlay shown when a timer session is active.
 * Lives in the root _layout.tsx as an absolute-positioned View so it persists
 * across tab switches. Anchored bottom-right above the tab bar.
 *
 * States:
 *   expanded  – full card: pillar bar · block/routine name · timer · progress · controls
 *   minimised – pill: block name + timer (truncated) + pulse dot
 */
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Animated,
  Easing,
  ViewStyle,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '../primitives/Text';
import { space, radius, motion } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';
import { useTimerStore } from '../../stores/timerStore';
import { useUserPrefsStore, type Pillar } from '../../stores/userPrefsStore';

const TAB_BAR_HEIGHT = 49; // standard iOS tab bar height (insets.bottom added separately)

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

// ─── Pulse dot (minimised pill indicator) ────────────────────────────────────
function PulseDot({ color }: { color: string }) {
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 0.3, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return <Animated.View style={[S.pulseDot, { backgroundColor: color, opacity: anim }]} />;
}

// ─── Pulse ring (expanded timer background) ──────────────────────────────────
function PulseRing({ color }: { color: string }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.06, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.5, duration: 800, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 1, duration: 800, useNativeDriver: true }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <Animated.View
      style={[S.pulseRing, { borderColor: color, opacity: Animated.multiply(opacity, 0.3), transform: [{ scale }] }]}
      pointerEvents="none"
    />
  );
}

// ─── Main widget ─────────────────────────────────────────────────────────────
export function FloatingActiveBlockWidget() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { themeTokens } = useTheme();
  const getPillarColour = useUserPrefsStore((s) => s.getPillarColour);

  const phase = useTimerStore((s) => s.phase);
  const currentBlockName = useTimerStore((s) => s.currentBlockName);
  const routineName = useTimerStore((s) => s.routineName);
  const sessionId = useTimerStore((s) => s.sessionId);
  const pillar = useTimerStore((s) => s.pillar);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const skip = useTimerStore((s) => s.skip);
  const end = useTimerStore((s) => s.end);
  const engine = useTimerStore((s) => s._engine);

  const remaining = engine?.remaining ?? 0;
  const progress = Math.min(engine?.progress ?? 0, 1);
  const isOverdue = engine?.isOverdue ?? false;

  const [minimised, setMinimised] = useState(false);

  // Animate slide-in on first appear
  const slideAnim = useRef(new Animated.Value(120)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const isActive = phase === 'running' || phase === 'paused' || phase === 'overdue' || phase === 'pending_condition';

  useEffect(() => {
    if (isActive) {
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, ...motion.springSheet, useNativeDriver: true }),
        Animated.spring(scaleAnim, { toValue: 1, ...motion.springDefault, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: 120, duration: 200, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start();
      setMinimised(false);
    }
  }, [isActive]);

  if (!isActive) return null;

  const pillarColor = getPillarColour(pillar as Pillar);
  const isPaused = phase === 'paused';
  const bottomAnchor = insets.bottom + TAB_BAR_HEIGHT + space[12];

  // ── Minimised pill ──────────────────────────────────────────────────────────
  if (minimised) {
    return (
      <Animated.View
        style={[
          S.pillWrap,
          { bottom: bottomAnchor },
          { transform: [{ translateY: slideAnim }, { scale: scaleAnim }], opacity: fadeAnim },
        ]}
        pointerEvents="box-none"
      >
        <Pressable
          style={[S.pill, { backgroundColor: pillarColor }]}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setMinimised(false);
          }}
        >
          <PulseDot color="#FFFFFF" />
          <AppText variant="caption1" onAccent numberOfLines={1} style={S.pillText}>
            {formatTime(remaining)}  {currentBlockName}
          </AppText>
        </Pressable>
      </Animated.View>
    );
  }

  // ── Expanded card ──────────────────────────────────────────────────────────
  return (
    <Animated.View
      style={[
        S.cardWrap,
        { bottom: bottomAnchor },
        { transform: [{ translateY: slideAnim }, { scale: scaleAnim }], opacity: fadeAnim },
      ]}
      pointerEvents="box-none"
    >
      <View style={[S.card, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]} pointerEvents="auto">
        {/* 4pt top pillar accent bar */}
        <View style={[S.accentBar, { backgroundColor: pillarColor }]} />

        {/* Dismiss to pill */}
        <Pressable
          style={S.dismissBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setMinimised(true);
          }}
          hitSlop={8}
        >
          <Feather name="chevron-down" size={20} color={themeTokens.textTertiary} />
        </Pressable>

        {/* Go to session screen */}
        <Pressable
          style={S.nameBlock}
          onPress={() => sessionId && router.push(`/routine-launcher/${sessionId}` as any)}
        >
          <AppText variant="title3" numberOfLines={1} style={{ fontWeight: '700' }}>{currentBlockName || 'Focus'}</AppText>
          <AppText variant="footnote" color={themeTokens.textSecondary} numberOfLines={1}>{routineName}</AppText>
        </Pressable>

        {/* Timer with pulse ring */}
        <View style={S.timerRow}>
          <PulseRing color={pillarColor} />
          <AppText
            variant="display"
            color={isOverdue ? themeTokens.destructive : themeTokens.textPrimary}
            style={S.timerText}
          >
            {formatTime(remaining)}
          </AppText>
        </View>

        {/* Progress bar */}
        <View style={[S.progressTrack, { backgroundColor: themeTokens.accentTint }]}>
          <View style={[S.progressFill, { width: `${progress * 100}%` as any, backgroundColor: pillarColor }]} />
        </View>

        {/* Controls */}
        <View style={S.controls}>
          <Pressable
            style={[S.controlGhost, { borderColor: themeTokens.border }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); skip(); }}
          >
            <Feather name="skip-forward" size={16} color={themeTokens.textSecondary} />
            <AppText variant="subheadline" color={themeTokens.textSecondary}>Skip</AppText>
          </Pressable>

          <Pressable
            style={[S.controlFilled, { backgroundColor: themeTokens.accent }]}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              isPaused ? resume() : pause();
            }}
          >
            <Feather name={isPaused ? 'play' : 'pause'} size={18} color="#FFFFFF" />
            <AppText variant="subheadline" onAccent>{isPaused ? 'Resume' : 'Pause'}</AppText>
          </Pressable>

          <Pressable
            style={[S.controlGhost, { borderColor: themeTokens.border }]}
            onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); end(); }}
          >
            <Feather name="square" size={16} color={themeTokens.destructive} />
            <AppText variant="subheadline" color={themeTokens.destructive}>End</AppText>
          </Pressable>
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  // Minimised pill
  pillWrap: {
    position: 'absolute',
    right: space[16],
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    height: 44,
    paddingHorizontal: space[16],
    borderRadius: radius.full,
    maxWidth: 200,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  pillText: {
    fontWeight: '600',
    flex: 1,
  },

  // Expanded card
  cardWrap: {
    position: 'absolute',
    left: space[16],
    right: space[16],
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    paddingBottom: space[16],
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  dismissBtn: {
    position: 'absolute',
    top: space[12],
    right: space[12],
    zIndex: 10,
  },
  nameBlock: {
    paddingHorizontal: space[16],
    paddingTop: space[12],
    paddingRight: 44, // don't overlap dismiss button
    gap: space[2],
  },
  timerRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[8],
  },
  pulseRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
  },
  timerText: {
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    height: 4,
    marginHorizontal: space[16],
    borderRadius: radius.full,
    overflow: 'hidden',
    marginBottom: space[12],
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    paddingHorizontal: space[16],
  },
  controlFilled: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[8],
    height: 40,
    borderRadius: radius.md,
  },
  controlGhost: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[4],
    height: 40,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
