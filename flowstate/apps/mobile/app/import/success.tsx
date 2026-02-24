import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

export default function ImportSuccessScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const params = useLocalSearchParams<{
    daysImported: string;
    sessionsCreated: string;
    routinesCreated: string;
    planName: string;
  }>();

  const daysImported = parseInt(params.daysImported ?? '0', 10);
  const sessionsCreated = parseInt(params.sessionsCreated ?? '0', 10);
  let routinesCreated: string[] = [];
  try {
    if (params.routinesCreated) routinesCreated = JSON.parse(params.routinesCreated);
  } catch {}
  const planName = params.planName ?? 'Plan';

  return (
    <ScreenWrapper scrollable={false} style={styles.center}>
      <View style={[styles.iconCircle, { backgroundColor: themeColors.success }]}>
        <Feather name="check" size={40} color={themeColors.white} />
      </View>

      <Text style={[styles.heading, { color: themeColors.text }]}>Plan Imported</Text>
      <Text style={[styles.planName, { color: themeColors.muted }]}>{planName}</Text>

      <View style={[styles.statsRow, { backgroundColor: themeColors.surface }]}>
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: themeColors.accent }]}>{daysImported}</Text>
          <Text style={[styles.statLabel, { color: themeColors.muted }]}>Days</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: themeColors.border }]} />
        <View style={styles.stat}>
          <Text style={[styles.statValue, { color: themeColors.accent }]}>{sessionsCreated}</Text>
          <Text style={[styles.statLabel, { color: themeColors.muted }]}>Sessions</Text>
        </View>
      </View>

      {routinesCreated.length > 0 && (
        <View style={[styles.newRoutines, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.newRoutinesLabel, { color: themeColors.text }]}>New routines created:</Text>
          {routinesCreated.map(r => (
            <Text key={r} style={[styles.routineName, { color: themeColors.text }]}>• {r}</Text>
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: themeColors.accent }]}
          onPress={() => router.replace('/(tabs)/plan')}
        >
          <Feather name="calendar" size={18} color={themeColors.white} />
          <Text style={[styles.primaryBtnText, { color: themeColors.white }]}>View Plan</Text>
        </Pressable>

        <Pressable
          style={[styles.secondaryBtn, { borderColor: themeColors.border }]}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={[styles.secondaryBtnText, { color: themeColors.text }]}>Go Home</Text>
        </Pressable>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  heading: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
  },
  planName: {
    fontSize: fontSize.md,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    width: '100%',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.hero,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  statDivider: {
    width: 1,
    height: 40,
  },
  newRoutines: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    width: '100%',
    marginBottom: spacing.lg,
  },
  newRoutinesLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  routineName: {
    fontSize: fontSize.sm,
    marginLeft: spacing.sm,
    marginTop: 2,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  primaryBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
