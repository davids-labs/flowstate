/**
 * ReminderCard — Module card for the 'reminder' module type (Feature 7)
 *
 * Displays a live countdown to the next scheduled fire time of this reminder.
 * Fires every minute to update the displayed countdown.
 *
 * Props: the full ModuleSpec (type='reminder'), plus an optional onPress for
 * navigating to module edit if tapped.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../constants/ThemeContext';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import type { ReminderConfig } from '@flowstate/core';

interface ReminderCardProps {
  id: string;
  label: string;
  emoji?: string;
  config: ReminderConfig;
  onPress?: () => void;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Compute milliseconds until the next scheduled fire time.
 * Returns null if there are no scheduled days.
 */
function msUntilNext(config: ReminderConfig): number | null {
  const { daysOfWeek, time } = config;
  if (!daysOfWeek || daysOfWeek.length === 0) return null;

  const [hStr, mStr] = (time ?? '09:00').split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return null;

  const now = new Date();
  let best: number | null = null;

  for (const dow of daysOfWeek) {
    let daysAhead = (dow - now.getDay() + 7) % 7;

    const candidate = new Date(now);
    candidate.setDate(now.getDate() + daysAhead);
    candidate.setHours(h, m, 0, 0);

    // If same day but already passed, add 7 days for next week
    if (candidate.getTime() <= now.getTime()) {
      candidate.setDate(candidate.getDate() + 7);
    }

    const diff = candidate.getTime() - now.getTime();
    if (best === null || diff < best) best = diff;
  }

  return best;
}

function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const min = Math.floor((totalSec % 3600) / 60);

  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${min}m`;
  return `${min}m`;
}

export function ReminderCard({ id, label, emoji, config, onPress }: ReminderCardProps) {
  const { themeColors } = useTheme();
  const [msLeft, setMsLeft] = useState<number | null>(() => msUntilNext(config));

  useEffect(() => {
    setMsLeft(msUntilNext(config));
    const interval = setInterval(() => {
      setMsLeft(msUntilNext(config));
    }, 60_000); // update every minute
    return () => clearInterval(interval);
  }, [config]);

  const activeDays = (config.daysOfWeek ?? [])
    .map((d) => DAY_NAMES[d])
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, { backgroundColor: themeColors.surface }]}
    >
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.emojiText}>{emoji ?? '🔔'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.label, { color: themeColors.text }]}>{label}</Text>
          <Text style={[styles.time, { color: themeColors.muted }]}>
            {config.time ?? '--:--'} · {activeDays || 'No days set'}
          </Text>
        </View>
        <Feather name="chevron-right" size={16} color={themeColors.muted} />
      </View>

      {/* Countdown */}
      <View style={[styles.countdownRow, { borderTopColor: themeColors.surfaceBorder }]}>
        <Feather name="clock" size={13} color={themeColors.muted} style={{ marginRight: 4 }} />
        <Text style={[styles.countdownText, { color: themeColors.muted }]}>
          {msLeft !== null
            ? `Next in ${formatCountdown(msLeft)}`
            : 'No upcoming alerts'}
        </Text>
        {config.repeat && (
          <View style={[styles.repeatBadge, { backgroundColor: themeColors.accent + '22' }]}>
            <Text style={[styles.repeatText, { color: themeColors.accent }]}>Repeats</Text>
          </View>
        )}
      </View>

      {/* Message preview */}
      {config.message ? (
        <Text style={[styles.message, { color: themeColors.muted }]} numberOfLines={1}>
          "{config.message}"
        </Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  emojiText: { fontSize: 24 },
  label: { fontSize: fontSize.md, fontWeight: '700' },
  time: { fontSize: fontSize.xs, marginTop: 1 },
  countdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 0,
  },
  countdownText: { fontSize: fontSize.sm, flex: 1 },
  repeatBadge: {
    borderRadius: borderRadius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  repeatText: { fontSize: 10, fontWeight: '700' },
  message: {
    fontSize: fontSize.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    fontStyle: 'italic',
  },
});
