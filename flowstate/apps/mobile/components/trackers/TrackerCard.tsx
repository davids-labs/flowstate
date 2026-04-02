import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { TrackerQuickAction, TrackerSpec, TrackerSummary, TrackerSurface } from '@flowstate/core';
import { getTrackerRegistryItem } from '@flowstate/core';
import { AppText } from '../primitives/Text';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';
import { TrackerQuickLog } from './TrackerQuickLog';

function formatLoggedDate(date?: string | null) {
  if (!date) return 'No entries yet';
  const today = new Date().toISOString().slice(0, 10);
  if (date === today) return 'Logged today';
  return `Last ${new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

interface TrackerCardProps {
  tracker: TrackerSpec & {
    entry?: any;
    summary?: TrackerSummary;
    quickAction?: TrackerQuickAction | null;
  };
  date?: string;
  surface?: TrackerSurface;
  compact?: boolean;
  onChanged?: () => void;
}

export function TrackerCard({
  tracker,
  date,
  surface = 'today',
  compact = false,
  onChanged,
}: TrackerCardProps) {
  const router = useRouter();
  const { themeTokens } = useTheme();
  const registry = getTrackerRegistryItem(tracker.kind);
  const summary = tracker.summary;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: themeTokens.surfaceElevated,
          borderColor: themeTokens.border,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <AppText variant="caption1" color={themeTokens.textSecondary} style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
            {registry.label}
          </AppText>
          <AppText variant={compact ? 'headline' : 'title3'} style={{ fontWeight: '700' }}>
            {tracker.emoji ? `${tracker.emoji} ` : ''}
            {tracker.label}
          </AppText>
        </View>
        <Pressable
          style={[styles.detailButton, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
          onPress={() => router.push(`/trackers/${tracker.id}` as any)}
        >
          <Feather name="chevron-right" size={16} color={themeTokens.textSecondary} />
        </Pressable>
      </View>

      {summary ? (
        <View style={styles.summaryRow}>
          <View style={styles.summaryCopy}>
            <AppText variant="title2" style={{ fontWeight: '800' }}>
              {summary.currentDisplay}
            </AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              {formatLoggedDate(summary.lastLoggedDate)}
            </AppText>
          </View>
          <View style={styles.badgeColumn}>
            {summary.currentStreak ? (
              <View style={[styles.badge, { backgroundColor: themeTokens.accentTint }]}>
                <AppText variant="caption2" color={themeTokens.accent}>
                  {summary.currentStreak} day streak
                </AppText>
              </View>
            ) : null}
            {summary.comparisonReady ? (
              <View style={[styles.badge, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border, borderWidth: 1 }]}>
                <AppText variant="caption2" color={themeTokens.textSecondary}>
                  Overlay ready
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <TrackerQuickLog
        tracker={tracker}
        date={date}
        surface={surface}
        compact={compact}
        onSaved={onChanged}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[16],
    gap: space[12],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[12],
  },
  headerCopy: {
    flex: 1,
    gap: space[4],
  },
  detailButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[12],
  },
  summaryCopy: {
    flex: 1,
    gap: space[4],
  },
  badgeColumn: {
    alignItems: 'flex-end',
    gap: space[8],
  },
  badge: {
    borderRadius: radius.full,
    paddingHorizontal: space[8],
    paddingVertical: space[4],
  },
});
