import React from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';
import { useDatabaseSafe } from '../DatabaseProvider';
import { createSession, createRoutine } from '@flowstate/core';

interface MandatorySessionCardProps {
  label: string;
  emoji?: string;
  sessionId?: string;
  routineName: string;
  status: 'pending' | 'in_progress' | 'completed';
  compact?: boolean;
  dayPlanId?: string;
  routineId?: string;
  durationMinutes?: number;
}

export function MandatorySessionCard({
  label,
  emoji,
  sessionId,
  routineName,
  status,
  compact,
  dayPlanId,
  routineId,
  durationMinutes,
}: MandatorySessionCardProps) {
  const { themeColors } = useTheme();
  const router = useRouter();
  const { db } = useDatabaseSafe();

  const STATUS_CONFIG = {
    pending: { icon: 'play' as const, color: themeColors.accent, bg: themeColors.accentLight, text: 'Start' },
    in_progress: { icon: 'clock' as const, color: themeColors.warning, bg: '#FEF3C7', text: 'Resume' },
    completed: { icon: 'check-circle' as const, color: themeColors.success, bg: '#DCFCE7', text: 'Done' },
  };

  const config = STATUS_CONFIG[status];

  const handlePress = async () => {
    if (status === 'completed') return;

    if (sessionId) {
      router.push(`/session/${sessionId}`);
      return;
    }

    // No session ID — create a quick session on the fly
    if (!db || !dayPlanId) {
      Alert.alert('Cannot Start', 'No day plan is active. Import a plan or create a session from the routine builder.');
      return;
    }

    try {
      let rId = routineId;
      if (!rId) {
        // Create a stub routine
        rId = await createRoutine(db, {
          name: routineName,
          totalDurationMinutes: durationMinutes ?? 25,
        });
      }
      const newSessionId = await createSession(db, {
        dayPlanId,
        routineId: rId,
        routineName,
      });
      router.push(`/session/${newSessionId}`);
    } catch (e) {
      console.error('Failed to create session:', e);
      Alert.alert('Error', 'Could not create session. Please try again.');
    }
  };

  return (
    <Pressable style={[styles.card, { backgroundColor: themeColors.surface }, compact && styles.cardCompact]} onPress={handlePress}>
      <View style={styles.info}>
        <Text style={[styles.label, { color: themeColors.text }]}>
          {emoji ? `${emoji}  ` : ''}{label}
        </Text>
        <Text style={[styles.routineName, { color: themeColors.muted }]}>{routineName}</Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
        <Feather name={config.icon} size={16} color={config.color} />
        <Text style={[styles.statusText, { color: config.color }]}>{config.text}</Text>
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
  cardCompact: {
    padding: spacing.sm,
  },
  info: {
    flex: 1,
    marginRight: spacing.sm,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  routineName: {
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
});
