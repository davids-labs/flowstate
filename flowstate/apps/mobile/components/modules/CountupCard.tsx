import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

type DisplayMode = 'days' | 'dhms' | 'years_days' | 'auto';

interface CountupCardProps {
  label: string;
  emoji?: string;
  /** ISO date string YYYY-MM-DD — the origin date to count from */
  originDate: string;
  displayMode?: DisplayMode;
  compact?: boolean;
}

function formatElapsed(ms: number, mode: DisplayMode): { primary: string; unit: string } {
  if (ms <= 0) return { primary: '0', unit: 'days' };

  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const effectiveMode =
    mode === 'auto' ? (days > 365 ? 'years_days' : 'days') : mode;

  switch (effectiveMode) {
    case 'dhms':
      return {
        primary: `${days}d ${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`,
        unit: '',
      };
    case 'years_days': {
      const years = Math.floor(days / 365);
      const rem = days % 365;
      return {
        primary: `${years}`,
        unit: `year${years !== 1 ? 's' : ''}, ${rem} day${rem !== 1 ? 's' : ''}`,
      };
    }
    case 'days':
    default:
      return { primary: `Day ${days}`, unit: '' };
  }
}

export function CountupCard({
  label,
  emoji,
  originDate,
  displayMode = 'auto',
  compact,
}: CountupCardProps) {
  const { themeColors } = useTheme();
  const originMs = useMemo(
    () => new Date(originDate + 'T00:00:00').getTime(),
    [originDate],
  );

  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.max(0, now - originMs);
  const { primary, unit } = formatElapsed(elapsed, displayMode);

  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface }, compact && styles.cardCompact]}>
      <Text style={[styles.label, { color: themeColors.textSecondary }]}>
        {emoji ? `${emoji}  ` : ''}
        {label}
      </Text>
      <Text style={[styles.count, { color: themeColors.accent }, compact && styles.countCompact]}>{primary}</Text>
      {unit ? <Text style={[styles.unit, { color: themeColors.muted }]}>{unit}</Text> : null}
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
  cardCompact: { padding: spacing.sm },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  count: { fontSize: fontSize.hero, fontWeight: '800' },
  countCompact: { fontSize: fontSize.xxl },
  unit: { fontSize: fontSize.xs, marginTop: 2 },
});
