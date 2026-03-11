/**
 * BentoComingUp (Feature: Homescreen Overhaul - Zone 5)
 *
 * Horizontal scroll showing the next 3 days as Bento-style cards.
 * Each card shows: date label, up to 3 priority items (sessions first,
 * then high-priority tasks), then a muted remainder count.
 *
 * Tapping a day card navigates to the Day screen for that date.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  Dimensions,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';
import { useDatabaseSafe } from '../DatabaseProvider';
import { getDayPlan, getSessionsForDay, getTasks, MidnightWatcher } from '@flowstate/core';

const CARD_WIDTH = 220;
const CARD_GAP = spacing.sm;

const PILLAR_COLORS: Record<string, string> = {
  gym: '#ef4444',
  academic: '#3b82f6',
  life: '#22c55e',
  general: '#a855f7',
};

interface DayItem {
  type: 'session' | 'task';
  label: string;
  pillar?: string;
  time?: string;
}

interface DayCard {
  dateStr: string;        // 'YYYY-MM-DD'
  displayLabel: string;  // 'Tomorrow', 'Wed 12 Mar', etc.
  items: DayItem[];
  totalCount: number;
}

function formatDayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export function BentoComingUp() {
  const { themeColors } = useTheme();
  const router = useRouter();
  const { db } = useDatabaseSafe();
  const [days, setDays] = useState<DayCard[]>([]);

  const load = useCallback(async () => {
    if (!db) return;
    const today = new Date();
    const cards: DayCard[] = [];
    for (let offset = 1; offset <= 3; offset++) {
      const d = new Date(today);
      d.setDate(today.getDate() + offset);
      const dateStr = d.toISOString().slice(0, 10);
      const items: DayItem[] = [];

      try {
        const plan = await getDayPlan(db, dateStr);
        if (plan?.id) {
          const sess = await getSessionsForDay(db, plan.id);
          for (const s of sess.slice(0, 5)) {
            items.push({
              type: 'session',
              label: s.routineName,
              pillar: (s as any).pillar ?? 'general',
              time: s.scheduledTime ?? undefined,
            });
          }
        }
      } catch {}

      try {
        const tasks = await getTasks(db);
        const due = tasks.filter((t: any) => t.dueDate === dateStr && !t.completedAt);
        for (const t of due.slice(0, 3)) {
          items.push({ type: 'task', label: t.title, pillar: t.pillar ?? 'general' });
        }
      } catch {}

      cards.push({
        dateStr,
        displayLabel: formatDayLabel(dateStr),
        items: items.slice(0, 3),
        totalCount: items.length,
      });
    }
    setDays(cards);
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // BUG-16: Re-fetch when the date rolls past midnight while the app is open.
  useEffect(() => {
    const watcher = new MidnightWatcher(() => {
      load();
    });
    watcher.start();
    return () => watcher.stop();
  }, [load]);

  if (days.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: themeColors.muted }]}>COMING UP</Text>
      <FlatList<DayCard>
        data={days}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={{ paddingRight: CARD_WIDTH * 0.18, gap: CARD_GAP }}
        keyExtractor={(item: DayCard) => item.dateStr}
        renderItem={({ item }: { item: DayCard }) => (
          <Pressable
            style={[styles.card, { backgroundColor: themeColors.surface, width: CARD_WIDTH }]}
            onPress={() => router.push(`/day/${item.dateStr}`)}
          >
            <Text style={[styles.dateLabel, { color: themeColors.text }]}>{item.displayLabel}</Text>
            {item.items.length === 0 ? (
              <Text style={[styles.emptyText, { color: themeColors.muted }]}>Nothing planned</Text>
            ) : (
              item.items.map((it: DayItem, idx: number) => (
                <View key={idx} style={styles.itemRow}>
                  <View style={[styles.pillarDot, { backgroundColor: PILLAR_COLORS[it.pillar ?? 'general'] }]} />
                  <Text style={[styles.itemLabel, { color: themeColors.text }]} numberOfLines={1}>
                    {it.label}
                  </Text>
                  {!!it.time && (
                    <Text style={[styles.itemTime, { color: themeColors.muted }]}>{it.time}</Text>
                  )}
                </View>
              ))
            )}
            {item.totalCount > 3 && (
              <Text style={[styles.moreText, { color: themeColors.muted }]}>
                + {item.totalCount - 3} more
              </Text>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
  },
  card: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.xs,
  },
  dateLabel: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  pillarDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  itemLabel: {
    flex: 1,
    fontSize: fontSize.sm,
  },
  itemTime: {
    fontSize: fontSize.xs,
    flexShrink: 0,
  },
  moreText: {
    fontSize: fontSize.xs,
    marginTop: 4,
  },
  emptyText: {
    fontSize: fontSize.sm,
    fontStyle: 'italic',
  },
});
