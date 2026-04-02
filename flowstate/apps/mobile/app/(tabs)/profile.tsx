/**
 * Profile & Settings — V2 spec §8
 *
 * Mirrors the web prototype's "Profile & Settings" screen:
 *   • Profile card: initials circle + name + app subtitle (horizontal layout)
 *   • Appearance group: Dark Mode · Pillar Colours · Haptic Feedback · Tab Bar Labels
 *   • Notifications group: Session Reminders · Keep Screen Awake · Auto-Start
 *   • Data group: Import Plan · Export Data · Statistics
 *
 * Visual language: grouped surface containers (not individual bordered rows),
 * section labels uppercase footnote, dividers between rows via hairlineWidth,
 * chevrons on navigable rows, switches on toggle rows.
 */

import React from 'react';
import { View, Pressable, ScrollView, StyleSheet, Switch } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../components/primitives/Text';
import { useTheme, type ThemePreference } from '../../constants/ThemeContext';
import { useUserPrefsStore, type Pillar, type ThemePreset, type GlobalDensity } from '../../stores/userPrefsStore';
import { space, radius } from '../../constants/theme';

// ─── Segment control row ─────────────────────────────────────────────────────
function SegmentRow<T extends string>({ options, value, onChange }: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { themeTokens } = useTheme();
  return (
    <View style={ST.segmentWrap}>
      {options.map(opt => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            style={[ST.segChip, active && { backgroundColor: themeTokens.accent }]}
            onPress={() => onChange(opt.value)}
          >
            <AppText
              variant="footnote"
              color={active ? '#fff' : themeTokens.textSecondary}
              style={active ? { fontWeight: '700' } : undefined}
            >
              {opt.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Theme preset chip row ────────────────────────────────────────────────────
const PRESET_META: { value: ThemePreset; label: string; color: string }[] = [
  { value: 'default',  label: 'Default',  color: '#4F46E5' },
  { value: 'midnight', label: 'Midnight', color: '#6366F1' },
  { value: 'warm',     label: 'Warm',     color: '#D97706' },
  { value: 'forest',   label: 'Forest',   color: '#059669' },
  { value: 'ocean',    label: 'Ocean',    color: '#0EA5E9' },
  { value: 'mono',     label: 'Mono',     color: '#71717A' },
];
function ThemePresetRow() {
  const { themeTokens } = useTheme();
  const { themePreset, setThemePreset } = useUserPrefsStore();
  return (
    <View style={ST.presetRow}>
      {PRESET_META.map(p => {
        const active = p.value === themePreset;
        return (
          <Pressable
            key={p.value}
            onPress={() => setThemePreset(p.value)}
            style={[ST.presetChip, { backgroundColor: p.color }, active && ST.presetChipActive]}
          >
            {active && <Feather name="check" size={12} color="#fff" />}
            <AppText variant="caption2" onAccent style={{ fontWeight: active ? '700' : '400' }}>
              {p.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  const { themeTokens } = useTheme();
  return (
    <AppText
      variant="caption2"
      color={themeTokens.textTertiary}
      style={ST.sectionLabel}
    >
      {label.toUpperCase()}
    </AppText>
  );
}
function SettingsGroup({ children }: { children: React.ReactNode }) {
  const { themeTokens } = useTheme();
  return (
    <View style={[ST.group, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
      {children}
    </View>
  );
}

// ─── Row inside a group ───────────────────────────────────────────────────────
interface RowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  last?: boolean;
}
function SettingRow({ label, value, onPress, right, last }: RowProps) {
  const { themeTokens } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        ST.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeTokens.border },
        pressed && !!onPress && { opacity: 0.6 },
      ]}
      onPress={onPress}
      disabled={!onPress && right === undefined}
    >
      <View style={ST.rowLeft}>
        <AppText variant="body" style={{ fontWeight: '500' }}>{label}</AppText>
        {value ? (
          <AppText variant="footnote" color={themeTokens.textSecondary}>{value}</AppText>
        ) : null}
      </View>
      {right !== undefined
        ? right
        : onPress
          ? <Feather name="chevron-right" size={18} color={themeTokens.textSecondary} />
          : null}
    </Pressable>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ProfileScreen() {
  const { themeTokens, themePreference, setThemePreference } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const {
    showTabLabels, setShowTabLabels, getPillarColour,
    hapticFeedback, setHapticFeedback,
    sessionReminders, setSessionReminders,
    keepAwake, setKeepAwake,
    autoStart, setAutoStart,
    showFloatingPill, setShowFloatingPill,
    pillAlignment, setPillAlignment,
    fontSizeOffset, setFontSizeOffset,
    boldMode, setBoldMode,
    globalDensity, setGlobalDensity,
    themePreset,
    accentColour,
  } = useUserPrefsStore();

  const PILLARS: Pillar[] = ['gym', 'academic', 'life'];

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: themeTokens.background }}
      contentContainerStyle={[
        ST.scroll,
        { paddingTop: insets.top + space[16], paddingBottom: insets.bottom + 100 },
      ]}
      showsVerticalScrollIndicator={false}
    >

      {/* ── Profile card ─────────────────────────────────────── */}
      <View style={[ST.profileCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
        <View style={[ST.initialsCircle, { backgroundColor: themeTokens.accent }]}>
          <AppText variant="title3" style={{ color: '#fff', fontWeight: '700' }}>FS</AppText>
        </View>
        <View style={ST.profileText}>
          <AppText variant="title3" style={{ fontWeight: '700' }}>My Profile</AppText>
          <AppText variant="footnote" color={themeTokens.textSecondary}>FlowState</AppText>
        </View>
        <Feather name="chevron-right" size={18} color={themeTokens.textSecondary} />
      </View>

      {/* ── Navigate ─────────────────────────────────────── */}
      <SectionLabel label="Navigate" />
      <SettingsGroup>
        <SettingRow
          label="My Day"
          value="Today's overview"
          onPress={() => router.push('/(tabs)' as any)}
        />
        <SettingRow
          label="Gym"
          value="Gym homebase"
          onPress={() => router.push('/(tabs)/gym' as any)}
        />
        <SettingRow
          label="School"
          value="Academic hub"
          onPress={() => router.push('/(tabs)/school' as any)}
        />
        <SettingRow
          label="Life"
          value="Lifestyle hub"
          onPress={() => router.push('/(tabs)/life' as any)}
        />
        <SettingRow
          label="Tasks"
          value="All tasks"
          onPress={() => router.push('/(tabs)/todos' as any)}
        />
        <SettingRow
          label="Plan"
          value="Weekly planner"
          onPress={() => router.push('/(tabs)/plan' as any)}
        />
        <SettingRow
          label="Library"
          value="Routines & modules"
          last
          onPress={() => router.push('/(tabs)/library' as any)}
        />
      </SettingsGroup>

      {/* ── Analytics ────────────────────────────────────── */}
      <SectionLabel label="Analytics" />
      <SettingsGroup>
        <SettingRow
          label="Progress"
          value="All pillar stats"
          onPress={() => router.push('/(tabs)/progress' as any)}
        />
        <SettingRow
          label="Gym Stats"
          value="PRs, volume, frequency"
          onPress={() => router.push('/stats/gym' as any)}
        />
        <SettingRow
          label="Study Stats"
          value="Time & subjects"
          onPress={() => router.push('/stats/academic' as any)}
        />
        <SettingRow
          label="Grade Tracker"
          value="Course grades"
          onPress={() => router.push('/stats/academic/grades' as any)}
        />
        <SettingRow
          label="Life Stats"
          value="Streaks & mood"
          last
          onPress={() => router.push('/stats/life' as any)}
        />
      </SettingsGroup>

      {/* ── Appearance ───────────────────────────────────────── */}
      <SectionLabel label="Appearance" />
      <SettingsGroup>
        <SettingRow
          label="Theme"
          value={themePreference === 'system' ? 'System' : themePreference === 'dark' ? 'Dark' : 'Light'}
          right={
            <SegmentRow<ThemePreference>
              options={[{ label: 'System', value: 'system' }, { label: 'Light', value: 'light' }, { label: 'Dark', value: 'dark' }]}
              value={themePreference}
              onChange={setThemePreference}
            />
          }
        />
        <SettingRow
          label="Preset"
          value={PRESET_META.find(p => p.value === themePreset)?.label ?? 'Default'}
          right={null}
        />
        <View style={ST.subRow}>
          <ThemePresetRow />
        </View>
        <SettingRow
          label="Accent Colour"
          value="Non-pillar highlights"
          onPress={() => router.push('/settings/accent-colour' as any)}
          right={
            <View style={[ST.colorDot, { backgroundColor: accentColour, marginRight: 4 }]} />
          }
        />
        <SettingRow
          label="Pillar Colours"
          value="Gym · Academic · Life"
          onPress={() => router.push('/settings/pillar-colours')}
          right={
            <View style={ST.dotsRow}>
              {PILLARS.map(p => (
                <View key={p} style={[ST.colorDot, { backgroundColor: getPillarColour(p) }]} />
              ))}
            </View>
          }
        />
        <SettingRow
          label="Haptic Feedback"
          right={
            <Switch
              value={hapticFeedback}
              onValueChange={setHapticFeedback}
              trackColor={{ true: themeTokens.accent, false: themeTokens.border }}
              thumbColor="#fff"
            />
          }
        />
        <SettingRow
          label="Tab Bar Labels"
          value={showTabLabels ? 'Shown' : 'Hidden'}
          last
          right={
            <Switch
              value={showTabLabels}
              onValueChange={setShowTabLabels}
              trackColor={{ true: themeTokens.accent, false: themeTokens.border }}
              thumbColor="#fff"
            />
          }
        />
      </SettingsGroup>

      {/* ── Typography & Layout ───────────────────────────────── */}
      <SectionLabel label="Typography & Layout" />
      <SettingsGroup>
        <SettingRow
          label="Text Size"
          value={fontSizeOffset === -2 ? 'Small' : fontSizeOffset === 0 ? 'Normal' : fontSizeOffset === 2 ? 'Large' : 'Larger'}
          right={
            <SegmentRow<string>
              options={[{ label: 'S', value: '-2' }, { label: 'M', value: '0' }, { label: 'L', value: '2' }, { label: 'XL', value: '4' }]}
              value={String(fontSizeOffset)}
              onChange={v => setFontSizeOffset(Number(v))}
            />
          }
        />
        <SettingRow
          label="Bold Text"
          value="Makes all text heavier"
          right={
            <Switch
              value={boldMode}
              onValueChange={setBoldMode}
              trackColor={{ true: themeTokens.accent, false: themeTokens.border }}
              thumbColor="#fff"
            />
          }
        />
        <SettingRow
          label="Density"
          value={globalDensity.charAt(0).toUpperCase() + globalDensity.slice(1)}
          last
          right={
            <SegmentRow<GlobalDensity>
              options={[{ label: 'Compact', value: 'compact' }, { label: 'Standard', value: 'standard' }, { label: 'Expanded', value: 'expanded' }]}
              value={globalDensity}
              onChange={setGlobalDensity}
            />
          }
        />
      </SettingsGroup>

      {/* ── Timer ────────────────────────────────────────────── */}
      <SectionLabel label="Timer" />
      <SettingsGroup>
        <SettingRow
          label="Keep Screen Awake"
          value="During active sessions"
          right={
            <Switch
              value={keepAwake}
              onValueChange={setKeepAwake}
              trackColor={{ true: themeTokens.accent, false: themeTokens.border }}
              thumbColor="#fff"
            />
          }
        />
        <SettingRow
          label="Auto-Start Sessions"
          value="Begin timer on screen open"
          right={
            <Switch
              value={autoStart}
              onValueChange={setAutoStart}
              trackColor={{ true: themeTokens.accent, false: themeTokens.border }}
              thumbColor="#fff"
            />
          }
        />
        <SettingRow
          label="Floating Pill"
          value="Visible when session active"
          right={
            <Switch
              value={showFloatingPill}
              onValueChange={setShowFloatingPill}
              trackColor={{ true: themeTokens.accent, false: themeTokens.border }}
              thumbColor="#fff"
            />
          }
        />
        <SettingRow
          label="Pill Position"
          value={pillAlignment === 'right' ? 'Right' : 'Left'}
          last
          right={
            <SegmentRow<'left' | 'right'>
              options={[{ label: 'Left', value: 'left' }, { label: 'Right', value: 'right' }]}
              value={pillAlignment}
              onChange={setPillAlignment}
            />
          }
        />
      </SettingsGroup>

      {/* ── Notifications ────────────────────────────────────── */}
      <SectionLabel label="Notifications" />
      <SettingsGroup>
        <SettingRow
          label="Session Reminders"
          value="30 min before"
          last
          right={
            <Switch
              value={sessionReminders}
              onValueChange={setSessionReminders}
              trackColor={{ true: themeTokens.accent, false: themeTokens.border }}
              thumbColor="#fff"
            />
          }
        />
      </SettingsGroup>

      {/* ── Data ─────────────────────────────────────────────── */}
      <SectionLabel label="Data" />
      <SettingsGroup>
        <SettingRow
          label="Import Plan"
          value="CSV training plans"
          onPress={() => router.push('/import/pick' as any)}
        />
        <SettingRow
          label="Export Data"
          value="JSON backup of all data"
          last
          onPress={() => router.push('/backup' as any)}
        />
      </SettingsGroup>

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const ST = StyleSheet.create({
  scroll: {
    paddingHorizontal: space[16],
    gap: space[8],
  },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space[16],
    marginBottom: space[8],
  },
  initialsCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  profileText: {
    flex: 1,
    gap: space[2],
  },

  // Section label
  sectionLabel: {
    paddingTop: space[12],
    paddingBottom: space[4],
    paddingHorizontal: space[4],
    letterSpacing: 0.5,
    fontWeight: '600',
  },

  // Settings group
  group: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    marginBottom: space[4],
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[16],
    paddingVertical: space[12],
    gap: space[12],
  },
  rowLeft: {
    flex: 1,
    gap: space[2],
  },

  // Pillar colour dots
  dotsRow: {
    flexDirection: 'row',
    gap: space[8],
  },
  colorDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },

  // Segment controls
  segmentWrap: {
    flexDirection: 'row',
    gap: space[4],
    flexShrink: 1,
  },
  segChip: {
    paddingHorizontal: space[8],
    paddingVertical: space[4],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'transparent',
  },

  // Theme preset chips
  subRow: {
    paddingHorizontal: space[16],
    paddingBottom: space[8],
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[8],
    paddingVertical: space[4],
  },
  presetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space[12],
    paddingVertical: space[4],
    borderRadius: radius.full,
  },
  presetChipActive: {
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.6)',
  },
});
