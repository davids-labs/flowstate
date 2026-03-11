/**
 * Tag Timer Screen — Feature 14: Tag-Based Count-Up Timer
 *
 * Records focused work blocks under custom user-defined tags (e.g. "Deep Work",
 * "Client A", "Chapter 3"). Sessions are stored in `tagged_time_logs` and
 * contribute to the Life Pillar stats.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, Pressable, StyleSheet, TextInput,
  FlatList, Alert, ActivityIndicator, ScrollView,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { useTheme } from '../../constants/ThemeContext';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import {
  startTaggedTimer,
  stopTaggedTimer,
  getTaggedTimeLogs,
  getAllTaggedTimeTagNames,
} from '@flowstate/core';

const PILLARS = ['general', 'gym', 'academic', 'life'] as const;
const PILLAR_COLORS: Record<string, string> = {
  gym: '#ef4444',
  academic: '#3b82f6',
  life: '#22c55e',
  general: '#a855f7',
};

type TimerState = 'idle' | 'running' | 'stopped';

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function formatLogDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function TagTimerScreen() {
  const { db, isReady } = useDatabaseSafe();
  const { themeColors } = useTheme();

  const [timerState, setTimerState] = useState<TimerState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [tag, setTag] = useState('');
  const [pillar, setPillar] = useState<string>('general');
  const [notes, setNotes] = useState('');
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [knownTags, setKnownTags] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const activeLogId = useRef<string | null>(null);
  const startedAtMs = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadLogs = useCallback(async () => {
    if (!db || !isReady) return;
    try {
      const [logs, tags] = await Promise.all([
        getTaggedTimeLogs(db),
        getAllTaggedTimeTagNames(db),
      ]);
      setRecentLogs(logs.slice(0, 30));
      setKnownTags(tags);
    } catch (err) {
      console.warn('Failed to load tag logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [db, isReady]);

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [loadLogs]),
  );

  // Tick every second while running
  useEffect(() => {
    if (timerState === 'running') {
      intervalRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAtMs.current) / 1000));
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timerState]);

  const handleStart = async () => {
    if (!db || !tag.trim()) return;
    try {
      const id = await startTaggedTimer(db, tag.trim(), pillar);
      activeLogId.current = id;
      startedAtMs.current = Date.now();
      setElapsed(0);
      setTimerState('running');
    } catch (err) {
      Alert.alert('Error', 'Could not start timer.');
    }
  };

  const handleStop = async () => {
    if (!db || !activeLogId.current) return;
    try {
      await stopTaggedTimer(db, activeLogId.current, notes.trim() || undefined);
      activeLogId.current = null;
      setTimerState('stopped');
      setNotes('');
      await loadLogs();
    } catch (err) {
      Alert.alert('Error', 'Could not stop timer.');
    }
  };

  const handleReset = () => {
    setTimerState('idle');
    setElapsed(0);
    setNotes('');
  };

  const pillarColor = PILLAR_COLORS[pillar] ?? PILLAR_COLORS.general;
  const isRunning = timerState === 'running';

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Page title */}
        <Text style={[styles.pageTitle, { color: themeColors.text }]}>Tag Timer</Text>
        <Text style={[styles.pageSubtitle, { color: themeColors.muted }]}>
          Record focused time blocks under custom tags.
        </Text>

        {/* Timer face */}
        <View style={[styles.timerFace, { borderColor: pillarColor + '44', backgroundColor: themeColors.surface }]}>
          <Text style={[styles.timerDisplay, { color: pillarColor }]}>
            {formatDuration(elapsed)}
          </Text>
          {isRunning && (
            <View style={styles.activeRow}>
              <View style={[styles.pulseDot, { backgroundColor: pillarColor }]} />
              <Text style={[styles.activeTag, { color: themeColors.muted }]}>
                {tag} · {pillar}
              </Text>
            </View>
          )}
        </View>

        {/* Controls when idle */}
        {timerState === 'idle' && (
          <View style={styles.configSection}>
            {/* Tag input */}
            <Text style={[styles.label, { color: themeColors.muted }]}>Tag</Text>
            <TextInput
              style={[styles.input, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder, color: themeColors.text }]}
              placeholder="e.g. Deep Work, Chapter 3…"
              placeholderTextColor={themeColors.muted}
              value={tag}
              onChangeText={setTag}
              returnKeyType="done"
            />

            {/* Known tags quick-select */}
            {knownTags.length > 0 && (
              <View style={styles.chipRow}>
                {knownTags.slice(0, 8).map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.chip, { borderColor: tag === t ? themeColors.accent : themeColors.surfaceBorder, backgroundColor: tag === t ? themeColors.accent + '22' : 'transparent' }]}
                    onPress={() => setTag(t)}
                  >
                    <Text style={[styles.chipText, { color: tag === t ? themeColors.accent : themeColors.muted }]}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Pillar */}
            <Text style={[styles.label, { color: themeColors.muted }]}>Pillar</Text>
            <View style={styles.chipRow}>
              {PILLARS.map((p) => (
                <Pressable
                  key={p}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: pillar === p ? PILLAR_COLORS[p] + '33' : themeColors.surface,
                      borderColor: pillar === p ? PILLAR_COLORS[p] : themeColors.surfaceBorder,
                    },
                  ]}
                  onPress={() => setPillar(p)}
                >
                  <Text style={[styles.chipText, { color: pillar === p ? PILLAR_COLORS[p] : themeColors.muted }]}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Start button */}
            <Pressable
              style={[styles.actionBtn, { backgroundColor: pillarColor, opacity: tag.trim() ? 1 : 0.4 }]}
              onPress={handleStart}
              disabled={!tag.trim()}
            >
              <Feather name="play" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>Start Timer</Text>
            </Pressable>
          </View>
        )}

        {/* Controls when running */}
        {timerState === 'running' && (
          <Pressable
            style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}
            onPress={handleStop}
          >
            <Feather name="square" size={20} color="#fff" />
            <Text style={styles.actionBtnText}>Stop & Save</Text>
          </Pressable>
        )}

        {/* Controls when stopped */}
        {timerState === 'stopped' && (
          <View style={styles.stoppedSection}>
            <View style={[styles.savedBanner, { backgroundColor: '#22c55e22', borderColor: '#22c55e' }]}>
              <Feather name="check-circle" size={18} color="#22c55e" />
              <Text style={[styles.savedText, { color: '#22c55e' }]}>
                Session saved · {formatDuration(elapsed)}
              </Text>
            </View>
            <Pressable
              style={[styles.actionBtn, { backgroundColor: themeColors.accent }]}
              onPress={handleReset}
            >
              <Feather name="plus" size={20} color="#fff" />
              <Text style={styles.actionBtnText}>New Session</Text>
            </Pressable>
          </View>
        )}

        {/* Recent logs */}
        <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Recent Sessions</Text>

        {isLoading ? (
          <ActivityIndicator color={themeColors.accent} style={{ marginTop: spacing.md }} />
        ) : recentLogs.length === 0 ? (
          <Text style={[styles.emptyText, { color: themeColors.muted }]}>
            No sessions yet. Start a timer above.
          </Text>
        ) : (
          recentLogs.map((log) => (
            <View
              key={log.id}
              style={[styles.logRow, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}
            >
              <View style={[styles.logPillarDot, { backgroundColor: PILLAR_COLORS[log.pillar ?? 'general'] ?? '#a855f7' }]} />
              <View style={styles.logContent}>
                <Text style={[styles.logTag, { color: themeColors.text }]}>{log.tag}</Text>
                <Text style={[styles.logMeta, { color: themeColors.muted }]}>
                  {log.pillar} · {log.startedAt ? new Date(log.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </Text>
              </View>
              <Text style={[styles.logDuration, { color: themeColors.accent }]}>
                {formatLogDuration(log.durationSeconds ?? 0)}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: spacing.md,
    paddingBottom: spacing.xl * 2,
  },
  pageTitle: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: 4,
  },
  pageSubtitle: {
    fontSize: fontSize.sm,
    marginBottom: spacing.lg,
  },
  timerFace: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  timerDisplay: {
    fontSize: 56,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeTag: {
    fontSize: fontSize.sm,
  },
  configSection: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.sm,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  chipText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  stoppedSection: {
    gap: spacing.sm,
  },
  savedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  savedText: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.md,
    textAlign: 'center',
    marginTop: spacing.md,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginBottom: spacing.xs,
  },
  logPillarDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  logContent: {
    flex: 1,
    gap: 2,
  },
  logTag: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  logMeta: {
    fontSize: fontSize.xs,
  },
  logDuration: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});
