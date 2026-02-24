import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface ProgressBarCardProps {
  label: string;
  emoji?: string;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  style?: 'linear' | 'circular';
  showDaysRemaining?: boolean;
  showPercentage?: boolean;
  compact?: boolean;
}

export function ProgressBarCard({
  label,
  emoji,
  startDate,
  endDate,
  style: barStyle = 'linear',
  showDaysRemaining = true,
  showPercentage = true,
  compact,
}: ProgressBarCardProps) {
  const { themeColors } = useTheme();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000); // update every minute
    return () => clearInterval(id);
  }, []);

  const start = new Date(startDate + 'T00:00:00').getTime();
  const end = new Date(endDate + 'T00:00:00').getTime();
  const total = end - start;
  const elapsed = now - start;
  const progress = total > 0 ? Math.min(Math.max(elapsed / total, 0), 1) : 0;

  const daysRemaining = Math.max(0, Math.ceil((end - now) / 86400000));
  const totalDays = Math.ceil(total / 86400000);
  const daysElapsed = totalDays - daysRemaining;

  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface }, compact && styles.cardCompact]}>
      <Text style={[styles.label, { color: themeColors.text }]}>
        {emoji ? `${emoji}  ` : ''}{label}
      </Text>

      <View style={[styles.progressTrack, { backgroundColor: themeColors.surfaceBorder }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: themeColors.accent }]} />
      </View>

      <View style={styles.metaRow}>
        {showPercentage && (
          <Text style={[styles.meta, { color: themeColors.muted }]}>{Math.round(progress * 100)}%</Text>
        )}
        {showDaysRemaining && (
          <Text style={[styles.meta, { color: themeColors.muted }]}>
            Day {daysElapsed} of {totalDays} · {daysRemaining} remaining
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardCompact: {
    padding: spacing.sm,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '500',
    marginBottom: spacing.sm,
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
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
  },
  meta: {
    fontSize: fontSize.xs,
  },
});
