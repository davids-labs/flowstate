import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Share, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import UndoToast from '../../components/shared/UndoToast';
import { getModuleSpec, deleteModuleSpec, updateModuleSpec } from '@flowstate/core';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

function computeCountdown(targetDate: string, startDate?: string) {
  const now = Date.now();
  const target = new Date(targetDate + 'T00:00:00').getTime();
  const diff = Math.max(0, target - now);

  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);

  let progress: number | null = null;
  if (startDate) {
    const start = new Date(startDate + 'T00:00:00').getTime();
    const total = target - start;
    const elapsed = now - start;
    progress = total > 0 ? Math.min(Math.max(elapsed / total, 0), 1) : 0;
  }

  return { days, hours, minutes, seconds, progress, isComplete: diff <= 0 };
}

function computeCountup(originDate: string) {
  const origin = new Date(originDate + 'T00:00:00').getTime();
  const diff = Math.max(0, Date.now() - origin);

  const totalDays = Math.floor(diff / 86400000);
  const years = Math.floor(totalDays / 365);
  const remainingDays = totalDays % 365;

  return { totalDays, years, remainingDays };
}

export default function ModuleDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { db, isReady } = useDatabaseSafe();
  const [mod, setMod] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const { themeColors } = useTheme();

  const loadModule = useCallback(async () => {
    if (!db || !isReady || !id) return;
    setLoading(true);
    try {
      const spec = await getModuleSpec(db, id);
      setMod(spec);
    } catch (err) {
      console.error('Failed to load module:', err);
    } finally {
      setLoading(false);
    }
  }, [db, isReady, id]);

  useFocusEffect(useCallback(() => { loadModule(); }, [loadModule]));

  // Clear pending timeout on unmount to prevent stale DB writes
  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!mod) return;
    if (mod.type !== 'countdown' && mod.type !== 'countup') return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [mod]);

  const [undoToast, setUndoToast] = useState<{ message: string; undoAction: () => void } | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleArchive = async () => {
    if (!db || !mod) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const label = mod.label ?? 'Module';
    setUndoToast({
      message: `"${label}" archived`,
      undoAction: () => setUndoToast(null),
    });
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(async () => {
      try {
        await updateModuleSpec(db, mod.id, { archivedAt: new Date().toISOString() });
        router.back();
      } catch (e) { console.error('Archive failed:', e); }
    }, 3200);
  };

  const handleDelete = async () => {
    if (!db || !mod) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const label = mod.label ?? 'Module';
    setUndoToast({
      message: `"${label}" deleted`,
      undoAction: () => setUndoToast(null),
    });
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(async () => {
      try {
        await deleteModuleSpec(db, mod.id);
        router.back();
      } catch (e) { console.error('Delete failed:', e); }
    }, 3200);
  };

  const handleShare = async () => {
    if (!mod) return;
    const config = mod.config ?? {};
    let msg = `${mod.emoji ?? ''} ${mod.label}`;
    if (mod.type === 'countdown' && config.targetDate) {
      const cd = computeCountdown(config.targetDate, config.startDate);
      msg += `\n${cd.days} days remaining`;
      if (cd.progress !== null) msg += ` (${Math.round(cd.progress * 100)}% elapsed)`;
    }
    if (mod.type === 'countup' && config.originDate) {
      const cu = computeCountup(config.originDate);
      msg += `\nDay ${cu.totalDays}`;
    }
    try { await Share.share({ message: msg }); } catch {}
  };

  if (loading || !mod) {
    return (
      <ScreenWrapper>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.accent} />
          <Text style={[styles.empty, { color: themeColors.muted }]}>Loading module...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  const config = mod.config ?? {};

  // ── Countdown Detail ──
  if (mod.type === 'countdown') {
    const cd = computeCountdown(config.targetDate ?? '', config.startDate);
    return (
      <ScreenWrapper>
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>{mod.emoji ?? '⏳'}</Text>
          <Text style={[styles.heroLabel, { color: themeColors.muted }]}>{mod.label}</Text>

          {cd.isComplete ? (
            <Text style={[styles.heroCount, { color: themeColors.accent }]}>{config.finishedLabel ?? 'Complete!'}</Text>
          ) : (
            <>
              <Text style={[styles.heroCount, { color: themeColors.accent }]}>{cd.days}</Text>
              <Text style={[styles.heroUnit, { color: themeColors.text }]}>days remaining</Text>
              <Text style={[styles.heroDhms, { color: themeColors.muted }]}>
                {cd.hours}h {cd.minutes}m {cd.seconds}s
              </Text>
            </>
          )}

          {config.targetDate && (
            <Text style={[styles.heroDate, { color: themeColors.muted }]}>
              Target: {new Date(config.targetDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
              })}
            </Text>
          )}

          {cd.progress !== null && (
            <View style={styles.progressContainer}>
              <View style={[styles.progressTrack, { backgroundColor: themeColors.surfaceBorder }]}>
                <View style={[styles.progressFill, { width: `${cd.progress * 100}%`, backgroundColor: themeColors.accent }]} />
              </View>
              <Text style={[styles.progressText, { color: themeColors.muted }]}>{Math.round(cd.progress * 100)}% elapsed</Text>
            </View>
          )}

          {config.intention && (
            <Text style={[styles.intention, { color: themeColors.muted }]}>"{config.intention}"</Text>
          )}
        </View>

        <View style={styles.actionRow}>
          <Pressable style={[styles.actionBtn, { backgroundColor: themeColors.surface }]} onPress={() => router.push(`/modules/edit?id=${mod.id}`)}>
            <Feather name="edit-2" size={18} color={themeColors.accent} />
            <Text style={[styles.actionLabel, { color: themeColors.text }]}>Edit</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: themeColors.surface }]} onPress={handleShare}>
            <Feather name="share-2" size={18} color={themeColors.accent} />
            <Text style={[styles.actionLabel, { color: themeColors.text }]}>Share</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: themeColors.surface }]} onPress={handleArchive}>
            <Feather name="archive" size={18} color={themeColors.warning} />
            <Text style={[styles.actionLabel, { color: themeColors.text }]}>Archive</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: themeColors.surface }]} onPress={handleDelete}>
            <Feather name="trash-2" size={18} color={themeColors.danger} />
            <Text style={[styles.actionLabel, { color: themeColors.text }]}>Delete</Text>
          </Pressable>
        </View>

        {undoToast && (
          <UndoToast
            message={undoToast.message}
            visible={true}
            onUndo={() => { undoToast.undoAction(); if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current); setUndoToast(null); }}
            onDismiss={() => setUndoToast(null)}
          />
        )}
      </ScreenWrapper>
    );
  }

  // ── Countup Detail ──
  if (mod.type === 'countup') {
    const cu = computeCountup(config.originDate ?? '');
    return (
      <ScreenWrapper>
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>{mod.emoji ?? '📈'}</Text>
          <Text style={[styles.heroLabel, { color: themeColors.muted }]}>{mod.label}</Text>
          <Text style={[styles.heroCount, { color: themeColors.accent }]}>{cu.totalDays}</Text>
          <Text style={[styles.heroUnit, { color: themeColors.text }]}>
            {cu.years > 0 ? `${cu.years} year${cu.years !== 1 ? 's' : ''}, ${cu.remainingDays} days` : `days`}
          </Text>
          {config.originDate && (
            <Text style={[styles.heroDate, { color: themeColors.muted }]}>
              Since: {new Date(config.originDate + 'T00:00:00').toLocaleDateString('en-US', {
                month: 'long', day: 'numeric', year: 'numeric',
              })}
            </Text>
          )}
        </View>

        <View style={styles.actionRow}>
          <Pressable style={[styles.actionBtn, { backgroundColor: themeColors.surface }]} onPress={() => router.push(`/modules/edit?id=${mod.id}`)}>
            <Feather name="edit-2" size={18} color={themeColors.accent} />
            <Text style={[styles.actionLabel, { color: themeColors.text }]}>Edit</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: themeColors.surface }]} onPress={handleShare}>
            <Feather name="share-2" size={18} color={themeColors.accent} />
            <Text style={[styles.actionLabel, { color: themeColors.text }]}>Share</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: themeColors.surface }]} onPress={handleArchive}>
            <Feather name="archive" size={18} color={themeColors.warning} />
            <Text style={[styles.actionLabel, { color: themeColors.text }]}>Archive</Text>
          </Pressable>
          <Pressable style={[styles.actionBtn, { backgroundColor: themeColors.surface }]} onPress={handleDelete}>
            <Feather name="trash-2" size={18} color={themeColors.danger} />
            <Text style={[styles.actionLabel, { color: themeColors.text }]}>Delete</Text>
          </Pressable>
        </View>

        {undoToast && (
          <UndoToast
            message={undoToast.message}
            visible={true}
            onUndo={() => { undoToast.undoAction(); if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current); setUndoToast(null); }}
            onDismiss={() => setUndoToast(null)}
          />
        )}
      </ScreenWrapper>
    );
  }

  // ── Generic Module Detail ──
  return (
    <ScreenWrapper>
      <View style={styles.hero}>
        <Text style={styles.heroEmoji}>{mod.emoji ?? '📦'}</Text>
        <Text style={[styles.heroLabel, { color: themeColors.muted }]}>{mod.label}</Text>
        <Text style={[styles.heroType, { color: themeColors.muted }]}>{mod.type.replace('_', ' ')}</Text>
      </View>

      <View style={[styles.detailSection, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.detailLabel, { color: themeColors.text }]}>Placements</Text>
        <Text style={[styles.detailValue, { color: themeColors.muted }]}>{(mod.placements ?? []).join(', ')}</Text>
      </View>

      <View style={[styles.detailSection, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.detailLabel, { color: themeColors.text }]}>Required</Text>
        <Text style={[styles.detailValue, { color: themeColors.muted }]}>{mod.required ? 'Yes' : 'No'}</Text>
      </View>

      <View style={[styles.detailSection, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.detailLabel, { color: themeColors.text }]}>Live</Text>
        <Text style={[styles.detailValue, { color: themeColors.muted }]}>{mod.isLive ? 'Yes (computed)' : 'No (logged)'}</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable style={[styles.actionBtn, { backgroundColor: themeColors.surface }]} onPress={() => router.push(`/modules/edit?id=${mod.id}`)}>
          <Feather name="edit-2" size={18} color={themeColors.accent} />
          <Text style={[styles.actionLabel, { color: themeColors.text }]}>Edit</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, { backgroundColor: themeColors.surface }]} onPress={handleArchive}>
          <Feather name="archive" size={18} color={themeColors.warning} />
          <Text style={[styles.actionLabel, { color: themeColors.text }]}>Archive</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, { backgroundColor: themeColors.surface }]} onPress={handleDelete}>
          <Feather name="trash-2" size={18} color={themeColors.danger} />
          <Text style={[styles.actionLabel, { color: themeColors.text }]}>Delete</Text>
        </Pressable>
      </View>

      {undoToast && (
        <UndoToast
          message={undoToast.message}
          visible={true}
          onUndo={() => { undoToast.undoAction(); if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current); setUndoToast(null); }}
          onDismiss={() => setUndoToast(null)}
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl,
    gap: spacing.md,
  },
  empty: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  hero: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  heroEmoji: {
    fontSize: 48,
    marginBottom: spacing.sm,
  },
  heroLabel: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
  heroCount: {
    fontSize: 72,
    fontWeight: '800',
    lineHeight: 80,
  },
  heroUnit: {
    fontSize: fontSize.lg,
    marginTop: spacing.xs,
  },
  heroDhms: {
    fontSize: fontSize.md,
    marginTop: spacing.xs,
    fontVariant: ['tabular-nums'],
  },
  heroDate: {
    fontSize: fontSize.sm,
    marginTop: spacing.md,
  },
  heroType: {
    fontSize: fontSize.md,
    textTransform: 'capitalize',
  },
  progressContainer: {
    width: '100%',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  intention: {
    fontSize: fontSize.md,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.lg,
  },
  detailSection: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  detailValue: {
    fontSize: fontSize.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  actionBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
  },
  actionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
});
