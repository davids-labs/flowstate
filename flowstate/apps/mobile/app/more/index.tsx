import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppText } from '../../components/primitives/Text';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';

function SectionCard({
  title,
  subtitle,
  icon,
  rows,
}: {
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  rows: Array<{ label: string; description: string; href: string }>;
}) {
  const router = useRouter();
  const { themeTokens } = useTheme();

  return (
    <View style={[styles.card, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
      <View style={styles.cardHeader}>
        <View style={[styles.iconWrap, { backgroundColor: themeTokens.accentTint }]}>
          <Feather name={icon} size={18} color={themeTokens.accent} />
        </View>
        <View style={styles.cardCopy}>
          <AppText variant="headline" style={{ fontWeight: '700' }}>
            {title}
          </AppText>
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            {subtitle}
          </AppText>
        </View>
      </View>

      <View style={styles.rowList}>
        {rows.map((row, index) => (
          <Pressable
            key={row.label}
            style={[
              styles.row,
              index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: themeTokens.border } : null,
            ]}
            onPress={() => router.push(row.href as any)}
          >
            <View style={styles.rowCopy}>
              <AppText variant="body" style={{ fontWeight: '600' }}>
                {row.label}
              </AppText>
              <AppText variant="footnote" color={themeTokens.textSecondary}>
                {row.description}
              </AppText>
            </View>
            <Feather name="chevron-right" size={16} color={themeTokens.textTertiary} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function MoreScreen() {
  const { themeTokens } = useTheme();

  return (
    <ScreenWrapper>
      <View style={styles.hero}>
        <AppText variant="title1" style={{ fontWeight: '700' }}>
          More
        </AppText>
        <AppText variant="subheadline" color={themeTokens.textSecondary}>
          Setup, insights, backups, and the rest of the power tools live here.
        </AppText>
      </View>

      <View style={styles.stack}>
        <SectionCard
          title="Setup"
          subtitle="Build the reusable pieces behind your planner."
          icon="layers"
          rows={[
            { label: 'Session Templates', description: 'Create and refine repeatable sessions.', href: '/routines' },
            { label: 'Trackers', description: 'Manage logs, habits, scorecards, and check-ins.', href: '/library' },
            { label: 'Imported Plans', description: 'Review and edit imported plan structure.', href: '/settings/csv-plans' },
            { label: 'Import New Plan', description: 'Bring in a CSV and make it editable in-app.', href: '/import/pick' },
          ]}
        />

        <SectionCard
          title="Insights"
          subtitle="Keep analytics strong, but out of the daily workflow."
          icon="bar-chart-2"
          rows={[
            { label: 'Insights Hub', description: 'Open the consolidated analytics landing page.', href: '/insights' },
            { label: 'Tracker Insights', description: 'Open the library and drill into comparison-ready tracker detail.', href: '/library' },
          ]}
        />

        <SectionCard
          title="Backup"
          subtitle="Protect your data and move it around safely."
          icon="archive"
          rows={[
            { label: 'Backup & Restore', description: 'Export or restore your local data.', href: '/backup' },
          ]}
        />

        <SectionCard
          title="Settings"
          subtitle="Advanced controls and visual tuning."
          icon="settings"
          rows={[
            { label: 'Settings', description: 'Notifications, appearance, sync, and app controls.', href: '/settings' },
          ]}
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: space[8],
    marginBottom: space[20],
  },
  stack: {
    gap: space[16],
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    paddingHorizontal: space[16],
    paddingVertical: space[16],
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCopy: {
    flex: 1,
    gap: space[4],
  },
  rowList: {
    paddingBottom: space[4],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    paddingHorizontal: space[16],
    paddingVertical: space[12],
  },
  rowCopy: {
    flex: 1,
    gap: space[4],
  },
});
