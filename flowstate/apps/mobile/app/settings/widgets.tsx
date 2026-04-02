import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { getTrackers } from '@flowstate/core';
import { AppText } from '../../components/primitives/Text';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import {
  getWidgetSnapshotSummary,
  loadWidgetPreferences,
  saveWidgetPreferences,
  syncWidgetSnapshots,
  type WidgetPreferences,
} from '../../services/widgetSync';

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { themeTokens } = useTheme();
  return (
    <View style={styles.sectionShell}>
      <AppText variant="caption1" color={themeTokens.textSecondary} style={styles.sectionLabel}>
        {title.toUpperCase()}
      </AppText>
      <View style={[styles.sectionCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
        {children}
      </View>
    </View>
  );
}

function WidgetCard({
  title,
  subtitle,
  icon,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
}) {
  const { themeTokens } = useTheme();
  return (
    <View style={[styles.widgetCard, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}>
      <View style={[styles.widgetIcon, { backgroundColor: themeTokens.accentTint }]}>
        <Feather name={icon} size={16} color={themeTokens.accent} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <AppText variant="headline" style={{ fontWeight: '700' }}>
          {title}
        </AppText>
        <AppText variant="footnote" color={themeTokens.textSecondary}>
          {subtitle}
        </AppText>
      </View>
    </View>
  );
}

function PickerChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  const { themeTokens } = useTheme();
  return (
    <Pressable
      style={[
        styles.pickerChip,
        {
          backgroundColor: active ? themeTokens.accent : themeTokens.surface,
          borderColor: active ? themeTokens.accent : themeTokens.border,
        },
      ]}
      onPress={onPress}
    >
      <AppText variant="caption1" color={active ? '#fff' : themeTokens.textSecondary} style={{ fontWeight: '700' }}>
        {label}
      </AppText>
    </Pressable>
  );
}

export default function WidgetSettingsScreen() {
  const { themeTokens } = useTheme();
  const { db, isReady } = useDatabaseSafe();
  const [prefs, setPrefs] = useState<WidgetPreferences | null>(null);
  const [trackers, setTrackers] = useState<any[]>([]);
  const [snapshotSummary, setSnapshotSummary] = useState<any>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    (async () => {
      const loadedPrefs = await loadWidgetPreferences();
      setPrefs(loadedPrefs);
      setSnapshotSummary(await getWidgetSnapshotSummary());
      if (db && isReady) {
        const trackerRows = await getTrackers(db, { includeArchived: false }).catch(() => []);
        setTrackers(trackerRows as any[]);
      }
    })();
  }, [db, isReady]);

  async function commit(next: WidgetPreferences) {
    setPrefs(next);
    await saveWidgetPreferences(next);
    if (db && isReady) {
      setSyncing(true);
      await syncWidgetSnapshots(db).catch(() => {});
      setSnapshotSummary(await getWidgetSnapshotSummary());
      setSyncing(false);
    }
  }

  if (!prefs) {
    return (
      <View style={[styles.loading, { backgroundColor: themeTokens.background }]}>
        <AppText variant="footnote" color={themeTokens.textSecondary}>
          Loading widget settings...
        </AppText>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: themeTokens.background }}
      contentContainerStyle={{ padding: space[16], paddingBottom: space[40] }}
      showsVerticalScrollIndicator={false}
    >
      <Section title="Availability">
        <WidgetCard
          title="Android-first widgets"
          subtitle="Widgets are currently exposed as Android home-screen surfaces. Existing widget identifiers remain intact for compatibility."
          icon="smartphone"
        />
      </Section>

      <Section title="Surfaces">
        <WidgetCard
          title="FlowStateDay"
          subtitle="Focus Widget. Mirrors today’s title, must-dos, and module coverage."
          icon="sun"
        />
        <WidgetCard
          title="FlowStateQuickLog"
          subtitle="Quick Log Widget. Lets you surface the trackers you want to capture from the home screen."
          icon="edit-3"
        />
        <WidgetCard
          title="FlowStateWeeklyStats"
          subtitle="Weekly Pulse Widget. Shows completed session density across the current week."
          icon="bar-chart-2"
        />
        <WidgetCard
          title="FlowStateGoalProgress"
          subtitle="Goals Widget. Highlights a small set of progress trackers with countdown context."
          icon="target"
        />
      </Section>

      <Section title="Install">
        <View style={styles.installList}>
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            1. Long-press your home screen.
          </AppText>
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            2. Open the widget picker and search for FlowState.
          </AppText>
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            3. Add the widget, then return here if you want to change which trackers feed Quick Log or Goals.
          </AppText>
        </View>
      </Section>

      <Section title="Quick Log Sources">
        <View style={styles.trackerList}>
          {trackers.length === 0 ? (
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              Create a few trackers first, then pin the ones you want on the Quick Log widget.
            </AppText>
          ) : (
            trackers.map((tracker) => {
              const selected = prefs.quickLogTrackerIds.includes(tracker.id);
              return (
                <View key={`quick-${tracker.id}`} style={styles.trackerRow}>
                  <View style={styles.trackerCopy}>
                    <AppText variant="body" style={{ fontWeight: '600' }}>
                      {tracker.emoji ? `${tracker.emoji} ` : ''}
                      {tracker.label}
                    </AppText>
                    <AppText variant="footnote" color={themeTokens.textSecondary}>
                      {tracker.kind}
                    </AppText>
                  </View>
                  <PickerChip
                    active={selected}
                    label={selected ? 'Pinned' : 'Pin'}
                    onPress={() =>
                      commit({
                        ...prefs,
                        quickLogTrackerIds: selected
                          ? prefs.quickLogTrackerIds.filter((id) => id !== tracker.id)
                          : [...prefs.quickLogTrackerIds, tracker.id].slice(-6),
                      })
                    }
                  />
                </View>
              );
            })
          )}
        </View>
      </Section>

      <Section title="Goals Sources">
        <View style={styles.trackerList}>
          {trackers.length === 0 ? (
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              No trackers available yet.
            </AppText>
          ) : (
            trackers.map((tracker) => {
              const selected = prefs.goalTrackerIds.includes(tracker.id);
              return (
                <View key={`goal-${tracker.id}`} style={styles.trackerRow}>
                  <View style={styles.trackerCopy}>
                    <AppText variant="body" style={{ fontWeight: '600' }}>
                      {tracker.emoji ? `${tracker.emoji} ` : ''}
                      {tracker.label}
                    </AppText>
                    <AppText variant="footnote" color={themeTokens.textSecondary}>
                      {tracker.kind}
                    </AppText>
                  </View>
                  <PickerChip
                    active={selected}
                    label={selected ? 'Pinned' : 'Pin'}
                    onPress={() =>
                      commit({
                        ...prefs,
                        goalTrackerIds: selected
                          ? prefs.goalTrackerIds.filter((id) => id !== tracker.id)
                          : [...prefs.goalTrackerIds, tracker.id].slice(-3),
                      })
                    }
                  />
                </View>
              );
            })
          )}
        </View>
      </Section>

      <Section title="Snapshot Status">
        <View style={styles.snapshotCard}>
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            Focus widget plan: {snapshotSummary?.focus?.planName ?? 'Not synced yet'}
          </AppText>
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            Weekly pulse total: {snapshotSummary?.weekly?.weekTotal ?? 0}
          </AppText>
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            Quick log items: {snapshotSummary?.quickLog?.modules?.length ?? 0}
          </AppText>
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            Goal items: {snapshotSummary?.goals?.goals?.length ?? 0}
          </AppText>
        </View>
      </Section>

      <Pressable
        style={[styles.syncButton, { backgroundColor: themeTokens.accent }]}
        onPress={() => commit(prefs)}
      >
        <Feather name="refresh-cw" size={16} color="#fff" />
        <AppText variant="caption1" onAccent style={{ fontWeight: '700' }}>
          {syncing ? 'Syncing widgets...' : 'Sync widget snapshots now'}
        </AppText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionShell: {
    marginBottom: space[20],
  },
  sectionLabel: {
    letterSpacing: 0.7,
    fontWeight: '700',
    marginBottom: space[8],
    paddingHorizontal: space[4],
  },
  sectionCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
    padding: space[16],
    gap: space[12],
  },
  widgetCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space[12],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
  },
  widgetIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  installList: {
    gap: 6,
  },
  trackerList: {
    gap: space[10],
  },
  trackerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
  },
  trackerCopy: {
    flex: 1,
    gap: 4,
  },
  pickerChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
  },
  snapshotCard: {
    gap: 6,
  },
  syncButton: {
    minHeight: 46,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
});
