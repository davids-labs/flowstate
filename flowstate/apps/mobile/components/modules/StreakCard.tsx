import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface StreakCardProps {
  label: string;
  emoji?: string;
  currentStreak: number;
  bestStreak?: number;
  showBest?: boolean;
  compact?: boolean;
}

export function StreakCard({
  label,
  emoji,
  currentStreak,
  bestStreak,
  showBest = true,
  compact,
}: StreakCardProps) {
  const { themeColors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface }, compact && styles.cardCompact]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Feather name="award" size={14} color={themeColors.muted} style={styles.icon} />
        <Text style={[styles.label, { color: themeColors.muted }]}>{label}</Text>
      </View>

      <View style={styles.countRow}>
        <Text style={[styles.count, { color: themeColors.warning }]}>{currentStreak}</Text>
        <Text style={[styles.unit, { color: themeColors.muted }]}>day{currentStreak !== 1 ? 's' : ''}</Text>
      </View>

      {showBest && bestStreak !== undefined && bestStreak > 0 && (
        <View style={styles.bestRow}>
          <Feather name="award" size={14} color={themeColors.warning} />
          <Text style={[styles.bestText, { color: themeColors.muted }]}>Best: {bestStreak} day{bestStreak !== 1 ? 's' : ''}</Text>
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
  countRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  count: {
    fontSize: fontSize.hero,
    fontWeight: '800',
  },
  unit: {
    fontSize: fontSize.md,
  },
  bestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  bestText: {
    fontSize: fontSize.xs,
  },
  icon: { marginRight: spacing.xs },
});
