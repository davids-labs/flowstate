import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';
import { useDatabaseSafe } from '../DatabaseProvider';
import { getRoutine, getRoutineBlocks } from '@flowstate/core';

interface RoutineLauncherCardProps {
  label: string;
  emoji?: string;
  moduleId: string;
  routineId: string;
  autoStartOnTap?: boolean;
  showBlockPreview?: boolean;
  accentColor?: string;
  compact?: boolean;
  /** Value is the last session status: 'completed' | 'in_progress' | null */
  value?: unknown;
}

interface RoutineBlock {
  name: string;
  durationMinutes: number;
  type: string;
}

export function RoutineLauncherCard({
  label,
  emoji,
  moduleId,
  routineId,
  autoStartOnTap,
  showBlockPreview = true,
  accentColor,
  compact,
  value,
}: RoutineLauncherCardProps) {
  const { themeColors } = useTheme();
  const router = useRouter();
  const { db } = useDatabaseSafe();
  const [blocks, setBlocks] = useState<RoutineBlock[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);

  useEffect(() => {
    if (!db || !routineId) return;
    (async () => {
      try {
        const routine = await getRoutine(db, routineId);
        const blks = await getRoutineBlocks(db, routineId);
        setBlocks(
          blks.map((b: any) => ({
            name: b.name,
            durationMinutes: b.durationMinutes,
            type: b.type ?? 'focus',
          })),
        );
        setTotalMinutes(routine?.totalDurationMinutes ?? blks.reduce((s: number, b: any) => s + b.durationMinutes, 0));
      } catch {}
    })();
  }, [db, routineId]);

  const tint = accentColor ?? themeColors.accent;
  const todayDone = value === 'completed';

  const handlePress = () => {
    // Navigate to the routine launcher page
    router.push(`/routine-launcher/${moduleId}`);
  };

  const TYPE_COLORS: Record<string, string> = {
    focus: themeColors.accent,
    break: themeColors.success,
    warmup: '#F59E0B',
    cooldown: '#8B5CF6',
    custom: themeColors.muted,
  };

  if (compact) {
    return (
      <Pressable style={[styles.cardCompact, { backgroundColor: themeColors.surface }, todayDone && styles.cardDone]} onPress={handlePress}>
        <View style={styles.compactRow}>
          <Feather name="play" size={18} color={themeColors.accent} style={styles.icon} />
          <Text style={[styles.compactLabel, { color: themeColors.text }]} numberOfLines={1}>{label}</Text>
          {todayDone ? (
            <Feather name="check-circle" size={18} color={themeColors.success} />
          ) : (
            <View style={[styles.playBadge, { backgroundColor: tint + '20' }]}>
              <Feather name="play" size={14} color={tint} />
            </View>
          )}
        </View>
        {!todayDone && (
          <Text style={[styles.compactMeta, { color: themeColors.muted }]}>{totalMinutes}m · {blocks.length} blocks</Text>
        )}
      </Pressable>
    );
  }

  return (
    <Pressable style={[styles.card, { backgroundColor: themeColors.surface }, todayDone && styles.cardDone]} onPress={handlePress}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="play" size={28} color={themeColors.accent} style={styles.icon} />
          <View style={styles.titleInfo}>
            <Text style={[styles.label, { color: themeColors.text }]}>{label}</Text>
            <Text style={[styles.meta, { color: themeColors.muted }]}>{totalMinutes} min · {blocks.length} blocks</Text>
          </View>
        </View>
        {todayDone ? (
          <View style={[styles.statusBadge, { backgroundColor: '#DCFCE7' }]}>
            <Feather name="check-circle" size={16} color={themeColors.success} />
            <Text style={[styles.statusText, { color: themeColors.success }]}>Done</Text>
          </View>
        ) : (
          <View style={[styles.statusBadge, { backgroundColor: tint + '20' }]}>
            <Feather name="play" size={16} color={tint} />
            <Text style={[styles.statusText, { color: tint }]}>Start</Text>
          </View>
        )}
      </View>

      {showBlockPreview && blocks.length > 0 && !todayDone && (
        <View style={[styles.blockPreview, { borderTopColor: themeColors.surfaceBorder }]}>
          {blocks.slice(0, 5).map((b, i) => (
            <View key={i} style={styles.blockRow}>
              <View style={[styles.blockDot, { backgroundColor: TYPE_COLORS[b.type] ?? themeColors.muted }]} />
              <Text style={[styles.blockName, { color: themeColors.textSecondary }]} numberOfLines={1}>{b.name}</Text>
              <Text style={[styles.blockDur, { color: themeColors.muted }]}>{b.durationMinutes}m</Text>
            </View>
          ))}
          {blocks.length > 5 && (
            <Text style={[styles.moreText, { color: themeColors.muted }]}>+{blocks.length - 5} more</Text>
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardCompact: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardDone: {
    opacity: 0.7,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  emoji: {
    fontSize: 28,
    marginRight: spacing.sm,
  },
  titleInfo: {
    flex: 1,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  meta: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  blockPreview: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  blockDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  blockName: {
    flex: 1,
    fontSize: fontSize.sm,
  },
  blockDur: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  moreText: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  compactEmoji: {
    fontSize: 18,
  },
  icon: { marginRight: spacing.sm },
  compactLabel: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  compactMeta: {
    fontSize: fontSize.xs,
    marginTop: 2,
    marginLeft: 26,
  },
  playBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
