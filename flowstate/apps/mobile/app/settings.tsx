import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../components/primitives/Text';
import { useTheme, type ThemePreference } from '../constants/ThemeContext';
import { radius, space } from '../constants/theme';
import { useUserPrefsStore, type ThemePreset } from '../stores/userPrefsStore';

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
  onPress,
  right,
  last = false,
}: {
  label: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  last?: boolean;
}) {
  const { themeTokens } = useTheme();

  return (
    <>
      <Pressable
        style={styles.row}
        onPress={onPress}
        disabled={!onPress && right === undefined}
      >
        <View style={styles.rowCopy}>
          <AppText variant="body" style={{ fontWeight: '600' }}>
            {label}
          </AppText>
          {subtitle ? (
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {right ?? (onPress ? <Feather name="chevron-right" size={16} color={themeTokens.textTertiary} /> : null)}
      </Pressable>
      {!last ? <Divider /> : null}
    </>
  );
}

function Segment<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  const { themeTokens } = useTheme();

  return (
    <View style={[styles.segment, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            style={[styles.segmentChip, active ? { backgroundColor: themeTokens.accent } : null]}
            onPress={() => onChange(option.value)}
          >
            <AppText
              variant="caption1"
              color={active ? '#fff' : themeTokens.textSecondary}
              style={{ fontWeight: '700' }}
            >
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const PRESETS: Array<{ value: ThemePreset; label: string; color: string }> = [
  { value: 'default', label: 'Default', color: '#4F46E5' },
  { value: 'midnight', label: 'Midnight', color: '#334155' },
  { value: 'warm', label: 'Warm', color: '#D97706' },
  { value: 'forest', label: 'Forest', color: '#059669' },
  { value: 'ocean', label: 'Ocean', color: '#0EA5E9' },
  { value: 'mono', label: 'Mono', color: '#71717A' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { themeTokens, themePreference, setThemePreference } = useTheme();
  const {
    themePreset,
    setThemePreset,
    hapticFeedback,
    setHapticFeedback,
    keepAwake,
    setKeepAwake,
    autoStart,
    setAutoStart,
    showTabLabels,
    setShowTabLabels,
  } = useUserPrefsStore();

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: themeTokens.background }}
      contentContainerStyle={{ paddingTop: insets.top + space[16], paddingBottom: insets.bottom + 72, paddingHorizontal: space[16] }}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.heroCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
        <View style={[styles.heroAvatar, { backgroundColor: themeTokens.accentTint }]}>
          <AppText variant="title2" color={themeTokens.accent} style={{ fontWeight: '800' }}>
            FS
          </AppText>
        </View>
        <View style={styles.heroCopy}>
          <AppText variant="title2" style={{ fontWeight: '800' }}>
            Settings
          </AppText>
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            One place for experience, reminders, widgets, imports, backups, and setup.
          </AppText>
        </View>
      </View>

      <Section title="Appearance">
        <View style={styles.row}>
          <View style={styles.rowCopy}>
            <AppText variant="body" style={{ fontWeight: '600' }}>
              Theme
            </AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              Light, dark, or follow the system.
            </AppText>
          </View>
        </View>
        <View style={styles.inlineControl}>
          <Segment<ThemePreference>
            value={themePreference}
            onChange={setThemePreference}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </View>
        <Divider />
        <View style={styles.row}>
          <View style={styles.rowCopy}>
            <AppText variant="body" style={{ fontWeight: '600' }}>
              Visual preset
            </AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              Keep the app feeling intentional instead of flat.
            </AppText>
          </View>
        </View>
        <View style={styles.presetRow}>
          {PRESETS.map((preset) => {
            const active = preset.value === themePreset;
            return (
              <Pressable
                key={preset.value}
                style={[
                  styles.presetChip,
                  { backgroundColor: preset.color },
                  active ? styles.presetChipActive : null,
                ]}
                onPress={() => setThemePreset(preset.value)}
              >
                {active ? <Feather name="check" size={12} color="#fff" /> : null}
                <AppText variant="caption2" onAccent style={{ fontWeight: '700' }}>
                  {preset.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
        <Divider />
        <Row
          label="Pillar colours"
          subtitle="Adjust gym, academic, and life accents."
          onPress={() => router.push('/settings/pillar-colours')}
          last
        />
      </Section>

      <Section title="Session Experience">
        <Row
          label="Haptic feedback"
          subtitle="Keep actions tactile without going overboard."
          right={<Switch value={hapticFeedback} onValueChange={setHapticFeedback} trackColor={{ true: themeTokens.accent }} />}
        />
        <Row
          label="Keep screen awake"
          subtitle="Prevent the display sleeping during active sessions."
          right={<Switch value={keepAwake} onValueChange={setKeepAwake} trackColor={{ true: themeTokens.accent }} />}
        />
        <Row
          label="Auto-start sessions"
          subtitle="Begin the timer as soon as you open a session."
          right={<Switch value={autoStart} onValueChange={setAutoStart} trackColor={{ true: themeTokens.accent }} />}
        />
        <Row
          label="Tab labels"
          subtitle="Show or hide labels under the main navigation."
          right={<Switch value={showTabLabels} onValueChange={setShowTabLabels} trackColor={{ true: themeTokens.accent }} />}
          last
        />
      </Section>

      <Section title="Reminders">
        <Row
          label="Reminders & automations"
          subtitle="Morning brief, evening review, session nudges, tracker prompts, and badge settings."
          onPress={() => router.push('/settings/notifications')}
          last
        />
      </Section>

      <Section title="Widgets">
        <Row
          label="Widgets setup"
          subtitle="Configure the focus, quick log, weekly pulse, and goals widgets."
          onPress={() => router.push('/settings/widgets')}
          last
        />
      </Section>

      <Section title="Setup">
        <Row
          label="Session templates"
          subtitle="Create and refine the reusable sessions behind your planner."
          onPress={() => router.push('/routines')}
        />
        <Row
          label="Track"
          subtitle="Open tracker collections, quick logging, and archived items."
          onPress={() => router.push('/track')}
        />
        <Row
          label="Imported plans"
          subtitle="Review and edit imported plan structure."
          onPress={() => router.push('/settings/csv-plans')}
        />
        <Row
          label="Import plan"
          subtitle="Bring in a CSV and make it editable in-app."
          onPress={() => router.push('/import/pick')}
          last
        />
      </Section>

      <Section title="Data & Insights">
        <Row
          label="Insights"
          subtitle="Open the unified analytics hub."
          onPress={() => router.push('/insights')}
        />
        <Row
          label="Backup & restore"
          subtitle="Export or restore the app’s local data."
          onPress={() => router.push('/backup')}
          last
        />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[16],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    marginBottom: space[20],
  },
  heroAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    flex: 1,
    gap: 4,
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
  inlineControl: {
    paddingHorizontal: space[16],
    paddingBottom: space[14],
  },
  segment: {
    borderWidth: 1,
    borderRadius: radius.full,
    padding: 3,
    flexDirection: 'row',
    gap: 4,
  },
  segmentChip: {
    flex: 1,
    borderRadius: radius.full,
    paddingVertical: space[8],
    alignItems: 'center',
    justifyContent: 'center',
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[8],
    paddingHorizontal: space[16],
    paddingBottom: space[14],
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
    borderRadius: radius.full,
  },
  presetChipActive: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.7)',
  },
});
