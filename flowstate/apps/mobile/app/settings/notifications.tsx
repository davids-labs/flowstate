import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../../components/primitives/Text';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import {
  getReminderRecords,
  loadNotificationPreferences,
  saveNotificationPreferences,
  syncNotificationCenter,
  type NotificationPreferences,
} from '../../services/notificationCenter';

function isValidTime(value: string) {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value.trim());
}

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

function Divider() {
  const { themeTokens } = useTheme();
  return <View style={[styles.divider, { backgroundColor: themeTokens.border }]} />;
}

function Row({
  label,
  subtitle,
  right,
  last = false,
}: {
  label: string;
  subtitle: string;
  right: React.ReactNode;
  last?: boolean;
}) {
  const { themeTokens } = useTheme();
  return (
    <>
      <View style={styles.row}>
        <View style={styles.rowCopy}>
          <AppText variant="body" style={{ fontWeight: '600' }}>
            {label}
          </AppText>
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            {subtitle}
          </AppText>
        </View>
        {right}
      </View>
      {!last ? <Divider /> : null}
    </>
  );
}

function MinuteChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const { themeTokens } = useTheme();
  return (
    <Pressable
      style={[
        styles.minuteChip,
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

export default function NotificationSettingsScreen() {
  const { themeTokens } = useTheme();
  const { db, isReady } = useDatabaseSafe();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [recordCount, setRecordCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    (async () => {
      const [loadedPrefs, records] = await Promise.all([
        loadNotificationPreferences(),
        getReminderRecords(),
      ]);
      setPrefs(loadedPrefs);
      setRecordCount(records.filter((record) => record.status !== 'cancelled').length);
    })();
  }, []);

  async function commit(next: NotificationPreferences) {
    setPrefs(next);
    const saved = await saveNotificationPreferences(next);
    setPrefs(saved);
    if (db && isReady) {
      setSyncing(true);
      await syncNotificationCenter(db).catch(() => {});
      const records = await getReminderRecords();
      setRecordCount(records.filter((record) => record.status !== 'cancelled').length);
      setSyncing(false);
    }
  }

  if (!prefs) {
    return (
      <View style={[styles.loading, { backgroundColor: themeTokens.background }]}>
        <AppText variant="footnote" color={themeTokens.textSecondary}>
          Loading automations...
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
      <View style={[styles.heroCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
        <View style={[styles.heroIcon, { backgroundColor: themeTokens.accentTint }]}>
          <Feather name="bell" size={18} color={themeTokens.accent} />
        </View>
        <View style={styles.rowCopy}>
          <AppText variant="headline" style={{ fontWeight: '700' }}>
            Reminders mirror the inbox
          </AppText>
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            {recordCount} active reminder records are currently being tracked.
          </AppText>
        </View>
      </View>

      <Section title="Master">
        <Row
          label="Notifications"
          subtitle="Turn the full reminder engine on or off."
          right={
            <Switch
              value={prefs.enabled}
              onValueChange={(value) => commit({ ...prefs, enabled: value })}
              trackColor={{ true: themeTokens.accent }}
            />
          }
          last
        />
      </Section>

      <Section title="Daily Automations">
        <Row
          label="Morning brief"
          subtitle="A daily nudge to open Today and set the tone."
          right={
            <Switch
              value={prefs.morningBrief.enabled}
              onValueChange={(value) =>
                commit({
                  ...prefs,
                  morningBrief: { ...prefs.morningBrief, enabled: value },
                })
              }
              trackColor={{ true: themeTokens.accent }}
            />
          }
        />
        <View style={styles.inlineField}>
          <AppText variant="caption1" color={themeTokens.textSecondary}>
            Morning time
          </AppText>
          <TextInput
            value={prefs.morningBrief.time}
            onChangeText={(value) =>
              setPrefs({
                ...prefs,
                morningBrief: { ...prefs.morningBrief, time: value.replace(/[^0-9:]/g, '').slice(0, 5) },
              })
            }
            onBlur={() => {
              if (!isValidTime(prefs.morningBrief.time)) {
                setPrefs({ ...prefs, morningBrief: { ...prefs.morningBrief, time: '08:00' } });
                return;
              }
              commit(prefs);
            }}
            style={[styles.timeInput, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border, color: themeTokens.textPrimary }]}
            placeholder="08:00"
            placeholderTextColor={themeTokens.textTertiary}
          />
        </View>
        <Divider />
        <Row
          label="Evening review"
          subtitle="A cleanup reminder to wrap the day and prep tomorrow."
          right={
            <Switch
              value={prefs.eveningReview.enabled}
              onValueChange={(value) =>
                commit({
                  ...prefs,
                  eveningReview: { ...prefs.eveningReview, enabled: value },
                })
              }
              trackColor={{ true: themeTokens.accent }}
            />
          }
        />
        <View style={styles.inlineField}>
          <AppText variant="caption1" color={themeTokens.textSecondary}>
            Evening time
          </AppText>
          <TextInput
            value={prefs.eveningReview.time}
            onChangeText={(value) =>
              setPrefs({
                ...prefs,
                eveningReview: { ...prefs.eveningReview, time: value.replace(/[^0-9:]/g, '').slice(0, 5) },
              })
            }
            onBlur={() => {
              if (!isValidTime(prefs.eveningReview.time)) {
                setPrefs({ ...prefs, eveningReview: { ...prefs.eveningReview, time: '20:00' } });
                return;
              }
              commit(prefs);
            }}
            style={[styles.timeInput, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border, color: themeTokens.textPrimary }]}
            placeholder="20:00"
            placeholderTextColor={themeTokens.textTertiary}
          />
        </View>
      </Section>

      <Section title="Session Prompts">
        <Row
          label="Session reminders"
          subtitle="Create real reminders for future scheduled sessions."
          right={
            <Switch
              value={prefs.sessionReminder.enabled}
              onValueChange={(value) =>
                commit({
                  ...prefs,
                  sessionReminder: { ...prefs.sessionReminder, enabled: value },
                })
              }
              trackColor={{ true: themeTokens.accent }}
            />
          }
          last
        />
        <View style={styles.chipRow}>
          {[5, 10, 15, 30, 45].map((minutes) => (
            <MinuteChip
              key={minutes}
              label={`${minutes}m`}
              active={prefs.sessionReminder.leadMinutes === minutes}
              onPress={() =>
                commit({
                  ...prefs,
                  sessionReminder: { ...prefs.sessionReminder, leadMinutes: minutes },
                })
              }
            />
          ))}
        </View>
      </Section>

      <Section title="Tracker Prompts">
        <Row
          label="Tracker reminders"
          subtitle="Keep tracker reminders and streak alerts in the same system."
          right={
            <Switch
              value={prefs.trackerReminder.enabled}
              onValueChange={(value) =>
                commit({
                  ...prefs,
                  trackerReminder: { enabled: value },
                })
              }
              trackColor={{ true: themeTokens.accent }}
            />
          }
        />
        <Row
          label="Badge counts"
          subtitle="Surface pending inbox volume on the app icon and header badge."
          right={
            <Switch
              value={prefs.badgeCounts.enabled}
              onValueChange={(value) =>
                commit({
                  ...prefs,
                  badgeCounts: { enabled: value },
                })
              }
              trackColor={{ true: themeTokens.accent }}
            />
          }
          last
        />
      </Section>

      <Pressable
        style={[styles.syncButton, { backgroundColor: themeTokens.accent }]}
        onPress={() => commit(prefs)}
      >
        <Feather name="refresh-cw" size={16} color="#fff" />
        <AppText variant="caption1" onAccent style={{ fontWeight: '700' }}>
          {syncing ? 'Syncing reminders...' : 'Sync reminders now'}
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
  heroCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[16],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    marginBottom: space[20],
  },
  heroIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[12],
    paddingHorizontal: space[16],
    paddingVertical: space[14],
  },
  rowCopy: {
    flex: 1,
    gap: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: space[16],
  },
  inlineField: {
    gap: 8,
    paddingHorizontal: space[16],
    paddingBottom: space[14],
  },
  timeInput: {
    minHeight: 44,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space[12],
    fontSize: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[8],
    paddingHorizontal: space[16],
    paddingBottom: space[14],
  },
  minuteChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
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
