import React from 'react';
import { View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface TimelineSession {
  id: string;
  routineName: string;
  durationMinutes: number;
  scheduledTime?: string | null; // "HH:MM"
  startedAt?: string | null;
  status: string;
  blockCount?: number;
}

interface HourlyTimelineProps {
  sessions: TimelineSession[];
  onSessionPress?: (sessionId: string) => void;
  onEmptySlotPress?: (hour: number) => void;
  startHour?: number; // default 5 (5 AM)
  endHour?: number;   // default 23 (11 PM)
}

const HOUR_HEIGHT = 60;

function getSessionStartHour(session: TimelineSession): number | null {
  // Prefer scheduledTime, fallback to startedAt
  if (session.scheduledTime) {
    const [h, m] = session.scheduledTime.split(':').map(Number);
    return h + (m ?? 0) / 60;
  }
  if (session.startedAt) {
    const d = new Date(session.startedAt);
    return d.getHours() + d.getMinutes() / 60;
  }
  return null;
}

function formatHour(hour: number): string {
  if (hour === 0 || hour === 24) return '12 AM';
  if (hour === 12) return '12 PM';
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

export function HourlyTimeline({
  sessions,
  onSessionPress,
  onEmptySlotPress,
  startHour = 5,
  endHour = 23,
}: HourlyTimelineProps) {
  const { themeColors } = useTheme();
  const totalHours = endHour - startHour;

  const STATUS_COLORS: Record<string, string> = {
    pending: themeColors.accent,
    in_progress: '#F59E0B',
    completed: themeColors.success,
    abandoned: themeColors.danger,
  };

  // Sessions placed on timeline
  const placedSessions = sessions
    .map((s) => {
      const startH = getSessionStartHour(s);
      if (startH === null) return null;
      return { ...s, startH };
    })
    .filter(Boolean) as (TimelineSession & { startH: number })[];

  // Sessions without a time
  const unplacedSessions = sessions.filter((s) => getSessionStartHour(s) === null);

  return (
    <View style={styles.container}>
      {/* Timeline grid */}
      <View style={[styles.grid, { height: totalHours * HOUR_HEIGHT }]}>
        {/* Hour lines */}
        {Array.from({ length: totalHours + 1 }, (_, i) => {
          const hour = startHour + i;
          return (
            <Pressable
              key={hour}
              style={[styles.hourRow, { top: i * HOUR_HEIGHT }]}
              onPress={() => onEmptySlotPress?.(hour)}
            >
              <Text style={[styles.hourLabel, { color: themeColors.muted }]}>{formatHour(hour)}</Text>
              <View style={[styles.hourLine, { backgroundColor: themeColors.border }]} />
            </Pressable>
          );
        })}

        {/* Session blocks */}
        {placedSessions.map((s) => {
          const top = (s.startH - startHour) * HOUR_HEIGHT;
          const height = Math.max((s.durationMinutes / 60) * HOUR_HEIGHT, 30);
          const statusColor = STATUS_COLORS[s.status] ?? themeColors.accent;

          return (
            <Pressable
              key={s.id}
              style={[
                styles.sessionBlock,
                {
                  top,
                  height,
                  borderLeftColor: statusColor,
                  backgroundColor: statusColor + '15',
                },
              ]}
              onPress={() => onSessionPress?.(s.id)}
            >
              <Text style={[styles.sessionName, { color: themeColors.text }]} numberOfLines={1}>
                {s.routineName}
              </Text>
              <Text style={[styles.sessionMeta, { color: themeColors.textSecondary }]}>
                {s.durationMinutes}min
                {s.blockCount ? ` · ${s.blockCount} blocks` : ''}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Unplaced sessions */}
      {unplacedSessions.length > 0 && (
        <View style={[styles.unplacedSection, { borderTopColor: themeColors.border }]}>
          <Text style={[styles.unplacedLabel, { color: themeColors.muted }]}>Unscheduled</Text>
          {unplacedSessions.map((s) => (
            <Pressable
              key={s.id}
              style={[styles.unplacedCard, { backgroundColor: themeColors.surface }]}
              onPress={() => onSessionPress?.(s.id)}
            >
              <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[s.status] ?? themeColors.accent }]} />
              <Text style={[styles.unplacedName, { color: themeColors.text }]}>{s.routineName}</Text>
              <Text style={[styles.unplacedMeta, { color: themeColors.muted }]}>{s.durationMinutes}min</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: spacing.sm,
  },
  grid: {
    position: 'relative',
    marginLeft: 50,
  },
  hourRow: {
    position: 'absolute',
    left: -50,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    height: 20,
  },
  hourLabel: {
    width: 46,
    fontSize: fontSize.xs,
    textAlign: 'right',
    paddingRight: spacing.xs,
  },
  hourLine: {
    flex: 1,
    height: 1,
  },
  sessionBlock: {
    position: 'absolute',
    left: 4,
    right: 0,
    borderLeftWidth: 3,
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  sessionName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  sessionMeta: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  unplacedSection: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  unplacedLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  unplacedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  unplacedName: {
    flex: 1,
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  unplacedMeta: {
    fontSize: fontSize.xs,
  },
});
