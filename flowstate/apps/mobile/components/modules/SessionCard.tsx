import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';
import { SessionPlannerSheet } from '../sessions/SessionPlannerSheet';

interface SessionCardProps {
  sessionId: string;
  routineName: string;
  routineId?: string;
  durationMinutes: number;
  blockCount: number;
  status: 'pending' | 'in_progress' | 'completed';
}

export function SessionCard({
  sessionId,
  routineName,
  routineId,
  durationMinutes,
  blockCount,
  status,
}: SessionCardProps) {
  const { themeColors } = useTheme();
  const router = useRouter();
  const [plannerOpen, setPlannerOpen] = useState(false);

  const statusConfig = ({
    pending: { icon: 'play' as const, color: themeColors.accent, bg: themeColors.accentLight, label: 'Start' },
    in_progress: { icon: 'clock' as const, color: themeColors.warning, bg: '#FEF3C7', label: 'Resume' },
    completed: { icon: 'check-circle' as const, color: themeColors.success, bg: '#DCFCE7', label: 'Done' },
    abandoned: { icon: 'rotate-ccw' as const, color: themeColors.textSecondary, bg: themeColors.surface, label: 'Abandoned' },
  } as Record<string, { icon: any; color: string; bg: string; label: string }>)[status]
    ?? { icon: 'play' as const, color: themeColors.accent, bg: themeColors.accentLight, label: 'Start' };

  return (
    <>
      <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
        <Pressable style={styles.cardMain} onPress={() => router.push(`/session/${sessionId}`)}>
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

        {/* Feature 5: Edit Session button — only shown when routineId is known */}
        {!!routineId && status !== 'completed' && (
          <Pressable
            style={[styles.editSessionBtn, { borderTopColor: themeColors.surfaceBorder }]}
            onPress={() => setPlannerOpen(true)}
          >
            <Feather name="edit-3" size={13} color={themeColors.muted} />
            <Text style={[styles.editSessionText, { color: themeColors.muted }]}>Edit Session Plan</Text>
          </Pressable>
        )}
      </View>

      {/* Session Planner Sheet */}
      {!!routineId && (
        <SessionPlannerSheet
          visible={plannerOpen}
          sessionId={sessionId}
          routineId={routineId}
          routineName={routineName}
          onClose={() => setPlannerOpen(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  cardMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
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
  editSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
  },
  editSessionText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
});
