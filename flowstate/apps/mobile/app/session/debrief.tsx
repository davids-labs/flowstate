import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { fontSize, spacing, borderRadius } from "../../constants/theme";
import { useTheme } from "../../constants/ThemeContext";
import { useDatabaseSafe } from "../../components/DatabaseProvider";
import { getSession, getSessionEvents, getRoutineBlocks, updateSession } from "@flowstate/core";

interface DebriefData {
  routineName: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  totalPausedMs: number;
  blockCount: number;
  events: Array<{ type: string; timestamp: string; blockIndex?: number }>;
}

export default function DebriefScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const { db, isReady } = useDatabaseSafe();
  const [data, setData] = useState<DebriefData | null>(null);
  const [notes, setNotes] = useState('');
  const { themeColors } = useTheme();

  useEffect(() => {
    if (!db || !isReady || !sessionId) return;
    (async () => {
      try {
        const sess = await getSession(db, sessionId);
        if (!sess) return;
        const events = await getSessionEvents(db, sessionId);
        let blockCount = 1;
        try {
          const blocks = await getRoutineBlocks(db, sess.routineId);
          blockCount = blocks.length || 1;
        } catch {}

        setData({
          routineName: sess.routineName,
          status: sess.status,
          startedAt: sess.startedAt,
          endedAt: sess.endedAt,
          totalPausedMs: sess.totalPausedMs ?? 0,
          blockCount,
          events: events.map((e: any) => ({
            type: e.type,
            timestamp: e.timestamp,
            blockIndex: e.blockIndex,
          })),
        });
      } catch (e) {
        console.error("Failed to load debrief data:", e);
      }
    })();
  }, [db, isReady, sessionId]);

  if (!sessionId) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: themeColors.surface }]}>
            <Feather name="alert-circle" size={48} color={themeColors.warning} />
          </View>
        </View>
        <Text style={[styles.title, { color: themeColors.text }]}>No Session Found</Text>
        <Text style={[styles.routineName, { color: themeColors.muted }]}>Session ID is missing</Text>
        <Pressable
          style={[styles.doneBtn, { backgroundColor: themeColors.accent }]}
          onPress={() => router.replace('/(tabs)')}
        >
          <Text style={[styles.doneBtnText, { color: themeColors.white }]}>Go Home</Text>
        </Pressable>
      </ScrollView>
    );
  }

  if (!data) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.content}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={themeColors.accent} />
          <Text style={[styles.loadingText, { color: themeColors.muted }]}>Loading session data...</Text>
        </View>
      </ScrollView>
    );
  }

  const totalDurationMs =
    data?.startedAt && data?.endedAt
      ? new Date(data.endedAt).getTime() - new Date(data.startedAt).getTime()
      : 0;
  const activeDurationMs = totalDurationMs - (data?.totalPausedMs ?? 0);
  const pauseCount = data?.events.filter((e) => e.type === "timer_paused").length ?? 0;
  const skipCount = data?.events.filter((e) => e.type === "block_skipped").length ?? 0;

  function formatDuration(ms: number): string {
    const totalSeconds = Math.floor(Math.abs(ms) / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
  }

  function formatTime(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.background }]} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.iconContainer}>
        <View style={[styles.iconCircle, { backgroundColor: themeColors.surface }]}>
          <Feather
            name={data?.status === "completed" ? "check-circle" : "x-circle"}
            size={48}
            color={data?.status === "completed" ? themeColors.success : themeColors.warning}
          />
        </View>
      </View>

      <Text style={[styles.title, { color: themeColors.text }]}>
        {data?.status === "completed" ? "Session Complete" : "Session Ended"}
      </Text>
      <Text style={[styles.routineName, { color: themeColors.muted }]}>{data?.routineName ?? "Session"}</Text>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: themeColors.surface }]}>
          <Feather name="clock" size={20} color={themeColors.accent} />
          <Text style={[styles.statValue, { color: themeColors.text }]}>{formatDuration(activeDurationMs)}</Text>
          <Text style={[styles.statLabel, { color: themeColors.muted }]}>Active Time</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: themeColors.surface }]}>
          <Feather name="layers" size={20} color={themeColors.accent} />
          <Text style={[styles.statValue, { color: themeColors.text }]}>{data?.blockCount ?? 0}</Text>
          <Text style={[styles.statLabel, { color: themeColors.muted }]}>Blocks</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: themeColors.surface }]}>
          <Feather name="pause" size={20} color={themeColors.warning} />
          <Text style={[styles.statValue, { color: themeColors.text }]}>{pauseCount}</Text>
          <Text style={[styles.statLabel, { color: themeColors.muted }]}>Pauses</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: themeColors.surface }]}>
          <Feather name="skip-forward" size={20} color={themeColors.muted} />
          <Text style={[styles.statValue, { color: themeColors.text }]}>{skipCount}</Text>
          <Text style={[styles.statLabel, { color: themeColors.muted }]}>Skips</Text>
        </View>
      </View>

      {/* Time breakdown */}
      {data?.startedAt && data?.endedAt && (
        <View style={[styles.timeBreakdown, { backgroundColor: themeColors.surface }]}>
          <View style={styles.timeRow}>
            <Text style={[styles.timeLabel, { color: themeColors.muted }]}>Started</Text>
            <Text style={[styles.timeValue, { color: themeColors.text }]}>{formatTime(data.startedAt)}</Text>
          </View>
          <View style={styles.timeRow}>
            <Text style={[styles.timeLabel, { color: themeColors.muted }]}>Ended</Text>
            <Text style={[styles.timeValue, { color: themeColors.text }]}>{formatTime(data.endedAt)}</Text>
          </View>
          <View style={styles.timeRow}>
            <Text style={[styles.timeLabel, { color: themeColors.muted }]}>Total Duration</Text>
            <Text style={[styles.timeValue, { color: themeColors.text }]}>{formatDuration(totalDurationMs)}</Text>
          </View>
          {data.totalPausedMs > 0 && (
            <View style={styles.timeRow}>
              <Text style={[styles.timeLabel, { color: themeColors.muted }]}>Time Paused</Text>
              <Text style={[styles.timeValue, { color: themeColors.text }]}>{formatDuration(data.totalPausedMs)}</Text>
            </View>
          )}
        </View>
      )}

      {/* Event timeline */}
      {data?.events && data.events.length > 0 && (
        <>
          <Text style={[styles.sectionTitle, { color: themeColors.muted }]}>Timeline</Text>
          <View style={[styles.timeline, { backgroundColor: themeColors.surface }]}>
            {data.events.map((event, i) => (
              <View key={i} style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: themeColors.accent }]} />
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineEvent, { color: themeColors.text }]}>
                    {event.type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                    {event.blockIndex !== undefined && event.blockIndex !== null
                      ? ` (Block ${event.blockIndex + 1})`
                      : ""}
                  </Text>
                  <Text style={[styles.timelineTime, { color: themeColors.muted }]}>{formatTime(event.timestamp)}</Text>
                </View>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Session Notes */}
      <Text style={[styles.sectionTitle, { color: themeColors.muted }]}>Notes</Text>
      <TextInput
        style={[
          styles.notesInput,
          { backgroundColor: themeColors.surface, color: themeColors.text, borderColor: themeColors.surfaceBorder ?? themeColors.surface },
        ]}
        placeholder="How did it go? Any thoughts..."
        placeholderTextColor={themeColors.muted}
        value={notes}
        onChangeText={setNotes}
        multiline
        textAlignVertical="top"
      />

      {/* Done button */}
      <Pressable
        style={[styles.doneBtn, { backgroundColor: themeColors.accent }]}
        onPress={async () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          // Save notes if user wrote any
          if (notes.trim() && db && sessionId) {
            try {
              await updateSession(db, sessionId, { notes: notes.trim() });
            } catch (e) {
              console.warn('Failed to save notes:', e);
            }
          }
          router.replace('/(tabs)');
        }}
      >
        <Text style={[styles.doneBtnText, { color: themeColors.white }]}>Done</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  iconContainer: {
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: fontSize.xxl,
    fontWeight: "800",
    textAlign: "center",
  },
  routineName: {
    fontSize: fontSize.md,
    textAlign: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: "center",
    gap: spacing.xs,
  },
  statValue: {
    fontSize: fontSize.xl,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: fontSize.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  timeBreakdown: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  timeLabel: {
    fontSize: fontSize.sm,
  },
  timeValue: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  timeline: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  timelineItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    marginRight: spacing.sm,
  },
  timelineContent: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timelineEvent: {
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  timelineTime: {
    fontSize: fontSize.xs,
  },
  doneBtn: {
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
  },
  doneBtnText: {
    fontSize: fontSize.lg,
    fontWeight: "700",
  },
  notesInput: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    fontSize: fontSize.md,
    minHeight: 100,
    marginBottom: spacing.md,
  },
  loadingContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: spacing.xxl * 2,
    gap: spacing.md,
  },
  loadingText: {
    fontSize: fontSize.md,
  },
});
