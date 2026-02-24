import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

type DisplayMode = 'days' | 'dhms' | 'auto';

interface CountdownCardProps {
  label: string;
  emoji?: string;
  /** Static fallback — ignored when targetDate is provided */
  daysRemaining?: number;
  /** ISO date string YYYY-MM-DD — enables live ticking */
  targetDate?: string;
  /** ISO date string YYYY-MM-DD — enables progress bar */
  startDate?: string;
  displayMode?: DisplayMode;
  compact?: boolean;
}

function formatRemaining(ms: number, mode: DisplayMode): { primary: string; unit: string } {
  if (ms <= 0) return { primary: '0', unit: 'done!' };

  const days = Math.floor(ms / 86400000);
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const effectiveMode =
    mode === 'auto'
      ? days < 7
        ? 'dhms'
        : 'days'
      : mode;

  switch (effectiveMode) {
    case 'dhms':
      return {
        primary: `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`,
        unit: '',
      };
    case 'days':
    default:
      return { primary: `Day ${days}`, unit: `${days} day${days !== 1 ? 's' : ''} remaining` };
  }
}

export function CountdownCard({
  label,
  emoji,
  daysRemaining,
  targetDate,
  startDate,
  displayMode = 'auto',
  compact,
}: CountdownCardProps) {
  const { themeColors } = useTheme();
  const targetMs = useMemo(
    () => (targetDate ? new Date(targetDate + 'T00:00:00').getTime() : null),
    [targetDate],
  );
  const startMs = useMemo(
    () => (startDate ? new Date(startDate + 'T00:00:00').getTime() : null),
    [startDate],
  );

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!targetMs) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  const remaining = targetMs ? Math.max(0, targetMs - now) : (daysRemaining ?? 0) * 86400000;
  const { primary, unit } = formatRemaining(remaining, displayMode);

  // Progress bar
  let progress: number | null = null;
  if (startMs && targetMs) {
    const total = targetMs - startMs;
    const elapsed = now - startMs;
    progress = total > 0 ? Math.min(Math.max(elapsed / total, 0), 1) : 0;
  }

  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface }, compact && styles.cardCompact]}>
      <Text style={[styles.label, { color: themeColors.textSecondary }]}>
        {emoji ? `${emoji}  ` : ''}
        {label}
      </Text>
      <Text style={[styles.count, { color: themeColors.accent }, compact && styles.countCompact]}>{primary}</Text>
      {unit ? <Text style={[styles.unit, { color: themeColors.muted }]}>{unit}</Text> : null}
      {progress !== null && (
        <View style={[styles.progressTrack, { backgroundColor: themeColors.surfaceBorder }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: themeColors.accent }]} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'center',
  },
  cardCompact: {
    padding: spacing.sm,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  count: {
    fontSize: fontSize.hero,
    fontWeight: '800',
  },
  countCompact: {
    fontSize: fontSize.xxl,
  },
  unit: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    marginTop: spacing.sm,
    overflow: 'hidden' as const,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
});
