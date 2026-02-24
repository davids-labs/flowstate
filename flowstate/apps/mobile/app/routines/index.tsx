import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { getRoutines, getRoutineBlocks, deleteRoutine } from '@flowstate/core';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface RoutineItem {
  id: string;
  name: string;
  description: string | null;
  totalDurationMinutes: number;
  blockCount: number;
  archivedAt: string | null;
}

export default function RoutinesScreen() {
  const { themeColors } = useTheme();
  const router = useRouter();
  const { db, isReady } = useDatabaseSafe();
  const [routines, setRoutines] = useState<RoutineItem[]>([]);

  const loadRoutines = useCallback(async () => {
    if (!db || !isReady) return;
    try {
      const all = await getRoutines(db);
      const enriched = await Promise.all(
        all.map(async (r: any) => {
          const blocks = await getRoutineBlocks(db, r.id);
          return {
            id: r.id,
            name: r.name,
            description: r.description,
            totalDurationMinutes: r.totalDurationMinutes,
            blockCount: blocks.length,
            archivedAt: r.archivedAt,
          };
        }),
      );
      setRoutines(enriched.filter((r) => !r.archivedAt));
    } catch (e) {
      console.error('Failed to load routines:', e);
    }
  }, [db, isReady]);

  useFocusEffect(useCallback(() => { loadRoutines(); }, [loadRoutines]));

  const handleDelete = (id: string, name: string) => {
    Alert.alert('Delete Routine', `Delete "${name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!db) return;
          try {
            await deleteRoutine(db, id);
            loadRoutines();
          } catch (e) {
            Alert.alert('Error', 'Failed to delete routine.');
          }
        },
      },
    ]);
  };

  function formatDuration(mins: number): string {
    if (mins >= 60) {
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      return m > 0 ? `${h}h ${m}m` : `${h}h`;
    }
    return `${mins}m`;
  }

  return (
    <ScreenWrapper>
      <SectionHeader title="Routines" subtitle="Build reusable session templates" />

      {routines.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="layers" size={48} color={themeColors.muted} />
          <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No Routines Yet</Text>
          <Text style={[styles.emptySubtitle, { color: themeColors.muted }]}>
            Create a routine to define timer blocks for your sessions.
          </Text>
        </View>
      ) : (
        routines.map((item) => (
          <Pressable
            key={item.id}
            style={[styles.card, { backgroundColor: themeColors.surface }]}
            onPress={() => router.push(`/routines/${item.id}`)}
            onLongPress={() => handleDelete(item.id, item.name)}
          >
            <View style={styles.cardInfo}>
              <Text style={[styles.cardName, { color: themeColors.text }]}>{item.name}</Text>
              <Text style={[styles.cardMeta, { color: themeColors.muted }]}>
                {formatDuration(item.totalDurationMinutes)} · {item.blockCount} {item.blockCount === 1 ? 'block' : 'blocks'}
              </Text>
              {item.description ? (
                <Text style={[styles.cardDesc, { color: themeColors.textSecondary }]} numberOfLines={1}>{item.description}</Text>
              ) : null}
            </View>
            <Feather name="chevron-right" size={18} color={themeColors.muted} />
          </Pressable>
        ))
      )}

      <Pressable
        style={[styles.createBtn, { backgroundColor: themeColors.accent }]}
        onPress={() => router.push('/routines/create')}
      >
        <Feather name="plus" size={20} color={themeColors.white} />
        <Text style={[styles.createBtnText, { color: themeColors.white }]}>Create Routine</Text>
      </Pressable>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  cardMeta: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  cardDesc: {
    fontSize: fontSize.sm,
    marginTop: 4,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  emptySubtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  createBtn: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  createBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
