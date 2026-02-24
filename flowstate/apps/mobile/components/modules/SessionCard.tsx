import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface SessionCardProps {
  sessionId: string;
  routineName: string;
  durationMinutes: number;
  blockCount: number;
  status: 'pending' | 'in_progress' | 'completed';
}

export function SessionCard({
  sessionId,
  routineName,
  durationMinutes,
  blockCount,
  status,
}: SessionCardProps) {
  const { themeColors } = useTheme();
  const router = useRouter();

  const statusConfig = {
    pending: { icon: 'play' as const, color: themeColors.accent, bg: themeColors.accentLight, label: 'Start' },
    in_progress: { icon: 'clock' as const, color: themeColors.warning, bg: '#FEF3C7', label: 'Resume' },
    completed: { icon: 'check-circle' as const, color: themeColors.success, bg: '#DCFCE7', label: 'Done' },
  }[status];

  return (
    <Pressable
      style={[styles.card, { backgroundColor: themeColors.surface }]}
      onPress={() => {
        router.push(`/session/${sessionId}`);
      }}
    >
      <View style={styles.info}>
        <Text style={[styles.name, { color: themeColors.text }]}>{routineName}</Text>
        <Text style={[styles.meta, { color: themeColors.textSecondary }]}>
          {durationMinutes} min · {blockCount} blocks
        </Text>
      </View>
      <View style={[styles.actionBtn, { backgroundColor: statusConfig.bg }]}>
        <Feather name={statusConfig.icon} size={18} color={statusConfig.color} />
        <Text style={[styles.actionLabel, { color: statusConfig.color }]}>
          {statusConfig.label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  info: {
    flex: 1,
    marginRight: spacing.sm,
  },
  name: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  meta: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    gap: 4,
  },
  actionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
