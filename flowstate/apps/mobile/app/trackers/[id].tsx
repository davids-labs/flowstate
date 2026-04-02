import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { getTracker, getTrackerEntry, getTrackerSummary, getRemindersForTracker, getSchedulesForTracker, updateTracker } from '@flowstate/core';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';
import { AppText } from '../../components/primitives/Text';
import { TrackerQuickLog } from '../../components/trackers/TrackerQuickLog';
import { TrackerStats } from '../../components/trackers/TrackerStats';

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function TrackerDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { db } = useDatabaseSafe();
  const { themeTokens } = useTheme();
  const [tracker, setTracker] = useState<any>(null);
  const [entry, setEntry] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!db || !id) return;
    const [nextTracker, nextEntry, nextSummary, nextSchedules, nextReminders] = await Promise.all([
      getTracker(db, id),
      getTrackerEntry(db, id, todayIso()),
      getTrackerSummary(db, id),
      getSchedulesForTracker(db, id),
      getRemindersForTracker(db, id),
    ]);
    setTracker(nextTracker);
    setEntry(nextEntry);
    setSummary(nextSummary);
    setSchedules(nextSchedules);
    setReminders(nextReminders);
  }, [db, id]);

  useFocusEffect(
    useCallback(() => {
      load().catch((error) => console.error('Failed to load tracker detail', error));
    }, [load]),
  );

  if (!tracker) {
    return (
      <ScreenWrapper>
        <AppText variant="body" color={themeTokens.textSecondary}>
          Loading tracker…
        </AppText>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={[styles.hero, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1, gap: space[4] }}>
            <AppText variant="caption1" color={themeTokens.textSecondary} style={{ textTransform: 'uppercase', letterSpacing: 0.7 }}>
              {tracker.kind}
            </AppText>
            <AppText variant="title1" style={{ fontWeight: '800' }}>
              {tracker.emoji ? `${tracker.emoji} ` : ''}
              {tracker.label}
            </AppText>
            <AppText variant="subheadline" color={themeTokens.textSecondary}>
              {summary?.currentDisplay ?? 'No current state'}
            </AppText>
          </View>
          <Pressable
            style={[styles.iconButton, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
            onPress={() => router.push({ pathname: '/trackers/edit' as any, params: { id: tracker.id } })}
          >
            <Feather name="edit-2" size={16} color={themeTokens.textSecondary} />
          </Pressable>
        </View>

        <TrackerQuickLog
          tracker={{ ...tracker, entry, summary }}
          onSaved={() => {
            load().catch((error) => console.error('Failed to refresh tracker detail', error));
          }}
        />

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.secondaryButton, { borderColor: themeTokens.border }]}
            onPress={async () => {
              if (!db) return;
              await updateTracker(db, tracker.id, { archivedAt: tracker.archivedAt ? null : new Date().toISOString() });
              load().catch((error) => console.error('Failed to refresh tracker archive state', error));
            }}
          >
            <AppText variant="caption1" color={themeTokens.textSecondary}>
              {tracker.archivedAt ? 'Restore' : 'Archive'}
            </AppText>
          </Pressable>
          <Pressable
            style={[styles.secondaryButton, { borderColor: themeTokens.border }]}
            onPress={() => router.push('/track' as any)}
          >
            <AppText variant="caption1" color={themeTokens.textSecondary}>
              Back to track
            </AppText>
          </Pressable>
        </View>
      </View>

      <View style={styles.metaStack}>
        <View style={[styles.metaCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
          <AppText variant="headline" style={{ fontWeight: '700' }}>Schedules</AppText>
          {schedules.length === 0 ? (
            <AppText variant="footnote" color={themeTokens.textSecondary}>No schedules attached.</AppText>
          ) : (
            schedules.map((schedule) => (
              <AppText key={schedule.id} variant="footnote" color={themeTokens.textSecondary}>
                {schedule.daysOfWeek.join(', ')} {schedule.timeOfDay ? `at ${schedule.timeOfDay}` : ''}
              </AppText>
            ))
          )}
        </View>
        <View style={[styles.metaCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
          <AppText variant="headline" style={{ fontWeight: '700' }}>Reminders</AppText>
          {reminders.length === 0 ? (
            <AppText variant="footnote" color={themeTokens.textSecondary}>No reminders attached.</AppText>
          ) : (
            reminders.map((reminder) => (
              <AppText key={reminder.id} variant="footnote" color={themeTokens.textSecondary}>
                {reminder.time} {reminder.message ? `· ${reminder.message}` : ''}
              </AppText>
            ))
          )}
        </View>
      </View>

      <TrackerStats trackerId={tracker.id} />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[16],
    gap: space[16],
  },
  heroTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[12],
  },
  iconButton: {
    width: 36,
    height: 36,
    borderWidth: 1,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: space[8],
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  metaStack: {
    gap: space[12],
    marginTop: space[16],
    marginBottom: space[16],
  },
  metaCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[16],
    gap: space[8],
  },
});
