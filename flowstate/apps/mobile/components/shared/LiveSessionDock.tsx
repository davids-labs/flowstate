import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createSessionEvent, updateSession } from '@flowstate/core';
import { AppText } from '../primitives/Text';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';
import { useTimerStore } from '../../stores/timerStore';
import { useUserPrefsStore, type Pillar } from '../../stores/userPrefsStore';
import { useDatabaseSafe } from '../DatabaseProvider';
import { useSyncContext } from '../SyncProvider';
import { refreshAmbientState } from '../../services/systemSync';

type SessionPreview = {
  sessionId: string;
  routineName: string;
  scheduledTime?: string | null;
  pillar?: string | null;
};

interface LiveSessionDockProps {
  variant?: 'inline' | 'floating';
  nextSession?: SessionPreview | null;
  onEmptyActionPress?: () => void;
}

function formatTimer(ms: number) {
  const negative = ms < 0;
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const prefix = negative ? '+' : '';

  if (hours > 0) {
    return `${prefix}${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${prefix}${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function isActivePhase(phase: string) {
  return (
    phase === 'running' ||
    phase === 'paused' ||
    phase === 'overdue' ||
    phase === 'pending_condition'
  );
}

export function LiveSessionDock({
  variant = 'floating',
  nextSession = null,
  onEmptyActionPress,
}: LiveSessionDockProps) {
  const router = useRouter();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const { themeTokens } = useTheme();
  const { db, isReady } = useDatabaseSafe();
  const { syncSession, syncTimerState } = useSyncContext();
  const getPillarColour = useUserPrefsStore((state) => state.getPillarColour);

  const phase = useTimerStore((state) => state.phase);
  const blockIndex = useTimerStore((state) => state.blockIndex);
  const totalBlocks = useTimerStore((state) => state.totalBlocks);
  const blockDurationMs = useTimerStore((state) => state.blockDurationMs);
  const elapsed = useTimerStore((state) => state.elapsed);
  const blockMode = useTimerStore((state) => state.blockMode);
  const blocks = useTimerStore((state) => state.blocks);
  const currentBlockName = useTimerStore((state) => state.currentBlockName);
  const routineName = useTimerStore((state) => state.routineName);
  const sessionId = useTimerStore((state) => state.sessionId);
  const pillar = useTimerStore((state) => state.pillar);
  const pause = useTimerStore((state) => state.pause);
  const resume = useTimerStore((state) => state.resume);
  const skip = useTimerStore((state) => state.skip);
  const end = useTimerStore((state) => state.end);
  const engine = useTimerStore((state) => state._engine);

  const [expanded, setExpanded] = useState(false);
  const active = isActivePhase(phase) && !!sessionId;
  const inSessionScreen = segments[0] === 'session';
  const tabLeaf = segments.slice(1)[0];
  const inTodayScreen =
    segments[0] === '(tabs)' && (segments.length === 1 || tabLeaf === 'index' || tabLeaf === 'today');
  const accent = getPillarColour((pillar || nextSession?.pillar || 'general') as Pillar);
  const nextBlock = blocks[blockIndex + 1] ?? null;
  const timerValue =
    blockMode === 'timed' ? blockDurationMs - elapsed : elapsed;
  const timerLabel =
    blockMode === 'timed'
      ? phase === 'overdue'
        ? 'Overtime'
        : 'Remaining'
      : 'Elapsed';
  const timeText = formatTimer(timerValue);
  const progress =
    blockMode === 'timed' && blockDurationMs > 0 ? Math.min(elapsed / blockDurationMs, 1) : 0;

  useEffect(() => {
    if (!active) setExpanded(false);
  }, [active]);

  async function syncTimer() {
    const state = useTimerStore.getState();
    syncTimerState({
      phase: state.phase,
      startedAt: state._engine?.state?.startedAt ?? null,
      pausedAt: state._engine?.state?.pausedAt ?? null,
      totalPausedMs: state._engine?.state?.totalPausedMs ?? 0,
      blockDurationMs: state._engine?.state?.blockDurationMs ?? 0,
      blockIndex: state.blockIndex,
      routineId: null,
      routineName: state.routineName,
    });
  }

  async function persistSession(status: string, extra: Record<string, unknown> = {}) {
    if (!db || !isReady || !sessionId) return;
    const state = useTimerStore.getState();
    await updateSession(db, sessionId, {
      status,
      totalPausedMs: state._engine?.state?.totalPausedMs ?? 0,
      currentBlockIndex: state.blockIndex,
      ...extra,
    });
  }

  async function handlePauseResume() {
    if (!sessionId) return;

    if (phase === 'paused') {
      await resume();
      if (db && isReady) {
        await persistSession('in_progress');
        await createSessionEvent(db, { sessionId, type: 'resumed' }).catch(() => {});
      }
      await syncTimer();
      return;
    }

    await pause();
    if (db && isReady) {
      await persistSession('in_progress');
      await createSessionEvent(db, { sessionId, type: 'paused' }).catch(() => {});
    }
    await syncTimer();
  }

  async function handleSkip() {
    if (!sessionId) return;
    await skip();
    const state = useTimerStore.getState();

    if (db && isReady) {
      await createSessionEvent(db, {
        sessionId,
        type: 'block_skipped',
        blockIndex,
      }).catch(() => {});

      if (state.phase === 'completed') {
        const endedAt = new Date().toISOString();
        await updateSession(db, sessionId, { status: 'completed', endedAt });
        syncSession(sessionId, { status: 'completed', endedAt });
      } else {
        await updateSession(db, sessionId, {
          status: 'in_progress',
          currentBlockIndex: state.blockIndex,
        });
      }
      await refreshAmbientState(db);
    }

    await syncTimer();
  }

  async function handleEnd() {
    if (!sessionId) return;
    await end();
    const endedAt = new Date().toISOString();

    if (db && isReady) {
      await updateSession(db, sessionId, { status: 'completed', endedAt });
      await createSessionEvent(db, { sessionId, type: 'ended' }).catch(() => {});
      syncSession(sessionId, { status: 'completed', endedAt });
      await refreshAmbientState(db);
    }

    await syncTimer();
    setExpanded(false);
  }

  if (variant === 'floating' && (inSessionScreen || inTodayScreen || !active)) {
    return null;
  }

  if (variant === 'inline' && !active) {
    return (
      <View
        style={[
          styles.inlineCard,
          { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border },
        ]}
      >
        <View style={[styles.accentBar, { backgroundColor: accent }]} />
        <View style={styles.emptyTopRow}>
          <View style={styles.titleCopy}>
            <AppText variant="caption1" color={themeTokens.textSecondary} style={styles.kicker}>
              LIVE SESSION
            </AppText>
            <AppText variant="headline" style={{ fontWeight: '700' }}>
              {nextSession ? nextSession.routineName : 'Nothing running right now'}
            </AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              {nextSession?.scheduledTime
                ? `Next up at ${nextSession.scheduledTime}`
                : 'Start a session when you are ready to focus.'}
            </AppText>
          </View>
          <Pressable
            style={[styles.primaryAction, { backgroundColor: accent }]}
            onPress={() => {
              if (nextSession) {
                router.push(`/session/${nextSession.sessionId}` as any);
                return;
              }
              onEmptyActionPress?.();
            }}
          >
            <Feather name={nextSession ? 'play' : 'plus'} size={16} color="#fff" />
            <AppText variant="caption1" onAccent style={{ fontWeight: '700' }}>
              {nextSession ? 'Open' : 'Add Session'}
            </AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  if (!active || !sessionId) return null;

  if (variant === 'floating' && !expanded) {
    return (
      <Pressable
        style={[
          styles.floatingPill,
          {
            backgroundColor: accent,
            bottom: insets.bottom + 68,
          },
        ]}
        onPress={() => setExpanded(true)}
      >
        <View style={styles.pillDot} />
        <View style={styles.pillCopy}>
          <AppText variant="caption1" onAccent style={{ fontWeight: '700' }} numberOfLines={1}>
            {currentBlockName || routineName}
          </AppText>
          <AppText variant="caption2" color="rgba(255,255,255,0.82)" numberOfLines={1}>
            {timeText} · {timerLabel.toLowerCase()}
          </AppText>
        </View>
        <Feather name="chevron-up" size={16} color="#fff" />
      </Pressable>
    );
  }

  const shellStyle =
    variant === 'floating'
      ? [
          styles.floatingCard,
          {
            backgroundColor: themeTokens.surfaceElevated,
            borderColor: themeTokens.border,
            bottom: insets.bottom + 68,
          },
        ]
      : [
          styles.inlineCard,
          { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border },
        ];

  return (
    <View style={shellStyle}>
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <View style={styles.titleCopy}>
            <AppText variant="caption1" color={themeTokens.textSecondary} style={styles.kicker}>
              LIVE SESSION
            </AppText>
            <AppText variant="headline" style={{ fontWeight: '700' }} numberOfLines={1}>
              {currentBlockName || routineName || 'Focus block'}
            </AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary} numberOfLines={1}>
              {routineName} · Block {blockIndex + 1} of {Math.max(totalBlocks, 1)}
            </AppText>
          </View>
          {variant === 'floating' ? (
            <Pressable
              style={[styles.iconButton, { borderColor: themeTokens.border }]}
              onPress={() => setExpanded(false)}
            >
              <Feather name="chevron-down" size={16} color={themeTokens.textSecondary} />
            </Pressable>
          ) : (
            <Pressable
              style={[styles.iconButton, { borderColor: themeTokens.border }]}
              onPress={() => router.push(`/session/${sessionId}` as any)}
            >
              <Feather name="maximize-2" size={16} color={themeTokens.textPrimary} />
            </Pressable>
          )}
        </View>

        <View style={styles.metricsRow}>
          <View style={[styles.timerOrb, { backgroundColor: themeTokens.accentTint }]}>
            <AppText
              variant="title2"
              color={phase === 'overdue' ? themeTokens.destructive : themeTokens.textPrimary}
              style={{ fontWeight: '800' }}
            >
              {timeText}
            </AppText>
            <AppText variant="caption2" color={themeTokens.textSecondary}>
              {timerLabel}
            </AppText>
          </View>

          <View style={styles.metricStack}>
            <View style={[styles.stateChip, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}>
              <AppText variant="caption1" color={themeTokens.textSecondary} style={{ fontWeight: '700' }}>
                {phase === 'paused'
                  ? 'Paused'
                  : phase === 'overdue'
                    ? 'Overtime'
                    : phase === 'pending_condition'
                      ? 'Waiting'
                      : 'Running'}
              </AppText>
            </View>

            <View style={[styles.previewCard, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}>
              <AppText variant="caption1" color={themeTokens.textSecondary}>
                Next block
              </AppText>
              <AppText variant="subheadline" style={{ fontWeight: '700' }} numberOfLines={1}>
                {nextBlock?.name ?? 'Finish line'}
              </AppText>
              <AppText variant="caption1" color={themeTokens.textSecondary}>
                {nextBlock ? `${nextBlock.durationMinutes || 0} min` : 'Last block in this session'}
              </AppText>
            </View>
          </View>
        </View>

        {blockMode === 'timed' ? (
          <View style={[styles.progressTrack, { backgroundColor: themeTokens.surface }]}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.max(8, progress * 100)}%`,
                  backgroundColor: accent,
                },
              ]}
            />
          </View>
        ) : null}

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.secondaryAction, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
            onPress={() => router.push(`/session/${sessionId}` as any)}
          >
            <Feather name="external-link" size={16} color={themeTokens.textPrimary} />
            <AppText variant="caption1" style={{ fontWeight: '700' }}>
              Open
            </AppText>
          </Pressable>
          <Pressable
            style={[styles.secondaryAction, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
            onPress={handlePauseResume}
          >
            <Feather
              name={phase === 'paused' ? 'play' : 'pause'}
              size={16}
              color={themeTokens.textPrimary}
            />
            <AppText variant="caption1" style={{ fontWeight: '700' }}>
              {phase === 'paused' ? 'Resume' : 'Pause'}
            </AppText>
          </Pressable>
          <Pressable
            style={[styles.secondaryAction, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
            onPress={handleSkip}
          >
            <Feather name="skip-forward" size={16} color={themeTokens.textPrimary} />
            <AppText variant="caption1" style={{ fontWeight: '700' }}>
              Skip
            </AppText>
          </Pressable>
          <Pressable
            style={[
              styles.secondaryAction,
              {
                backgroundColor: `${themeTokens.destructive}12`,
                borderColor: `${themeTokens.destructive}35`,
              },
            ]}
            onPress={handleEnd}
          >
            <Feather name="square" size={15} color={themeTokens.destructive} />
            <AppText variant="caption1" color={themeTokens.destructive} style={{ fontWeight: '700' }}>
              End
            </AppText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  floatingPill: {
    position: 'absolute',
    right: space[16],
    left: space[16],
    borderRadius: radius.full,
    paddingHorizontal: space[16],
    paddingVertical: space[12],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  pillDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
  },
  pillCopy: {
    flex: 1,
    gap: 2,
  },
  floatingCard: {
    position: 'absolute',
    left: space[16],
    right: space[16],
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  inlineCard: {
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  accentBar: {
    height: 4,
    width: '100%',
  },
  cardBody: {
    padding: space[16],
    gap: space[16],
  },
  emptyTopRow: {
    padding: space[16],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[12],
  },
  titleCopy: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    letterSpacing: 0.7,
    fontWeight: '700',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space[12],
  },
  timerOrb: {
    minWidth: 116,
    borderRadius: radius.lg,
    paddingHorizontal: space[12],
    paddingVertical: space[16],
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  metricStack: {
    flex: 1,
    gap: space[10],
  },
  stateChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: space[10],
    paddingVertical: space[6],
    borderRadius: radius.full,
    borderWidth: 1,
  },
  previewCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space[12],
    paddingVertical: space[12],
    gap: 3,
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[8],
  },
  primaryAction: {
    minHeight: 42,
    borderRadius: radius.full,
    paddingHorizontal: space[14],
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  secondaryAction: {
    minHeight: 42,
    borderRadius: radius.full,
    paddingHorizontal: space[12],
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
});
