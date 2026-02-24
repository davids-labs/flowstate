import React, { useEffect, useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { ScreenWrapper } from "../../components/layout/ScreenWrapper";
import { SectionHeader } from "../../components/layout/SectionHeader";
import { fontSize, spacing, borderRadius } from "../../constants/theme";
import { useTheme } from "../../constants/ThemeContext";
import { useDatabaseSafe } from "../../components/DatabaseProvider";
import {
  getWeeklyAggregate,
  getDayPlansInRange,
  getSessionCountsByDayPlanIds,
  type WeeklyAggregate,
} from "@flowstate/core";
import { generateWeeklyNarrative } from "@flowstate/core";
import ComplianceBar from "../../components/charts/ComplianceBar";
import TrendLine from "../../components/charts/TrendLine";
import StatCard from "../../components/charts/StatCard";

function getDayStatus(mustDoDone: boolean[]) {
  if (mustDoDone.length === 0) return "pending";
  const doneCount = mustDoDone.filter(Boolean).length;
  if (doneCount === mustDoDone.length) return "done";
  if (doneCount > 0) return "partial";
  return "pending";
}

function getWeekDateRange(weekId: string) {
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (match) {
    const year = parseInt(match[1], 10);
    const week = parseInt(match[2], 10);
    const jan1 = new Date(year, 0, 1);
    const dayOffset = (jan1.getDay() + 6) % 7;
    const start = new Date(jan1);
    start.setDate(start.getDate() - dayOffset + (week - 1) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  }
  const now = new Date();
  const dayOfWeek = (now.getDay() + 6) % 7;
  const start = new Date(now);
  start.setDate(start.getDate() - dayOfWeek);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

interface DayGridItem {
  date: string;
  title: string;
  mustDo: string[];
  mustDoDone: boolean[];
  sessionCount: number;
}

export default function WeekScreen() {
  const { themeColors } = useTheme();
  const { weekId } = useLocalSearchParams<{ weekId: string }>();
  const router = useRouter();
  const { db, isReady } = useDatabaseSafe();

  const [agg, setAgg] = useState<WeeklyAggregate | null>(null);
  const [narrative, setNarrative] = useState("");
  const [days, setDays] = useState<DayGridItem[]>([]);
  const [loading, setLoading] = useState(true);

  const weekLabel = weekId ?? "This Week";
  const range = getWeekDateRange(weekId ?? "");

  const STATUS_COLORS: Record<string, string> = {
    done: themeColors.success,
    partial: themeColors.warning,
    missed: themeColors.danger,
    pending: themeColors.surfaceBorder,
  };

  const loadData = useCallback(async () => {
    if (!db || !isReady) {
      setLoading(false);
      return;
    }
    try {
      // Load real day plans for the grid
      const dayPlans = await getDayPlansInRange(db, range.start, range.end);
      const allIds = dayPlans.map((dp: any) => dp.id);
      const sessionCounts = await getSessionCountsByDayPlanIds(db, allIds);

      const dayItems: DayGridItem[] = dayPlans.map((dp: any) => ({
        date: dp.date,
        title: dp.title ?? "",
        mustDo: dp.mustDo ?? [],
        mustDoDone: dp.mustDoDone ?? [],
        sessionCount: sessionCounts[dp.id] ?? 0,
      }));
      setDays(dayItems);

      // Load analytics
      const prevEnd = new Date(range.start + "T12:00:00");
      prevEnd.setDate(prevEnd.getDate() - 1);
      const prevStart = new Date(prevEnd);
      prevStart.setDate(prevStart.getDate() - 6);

      const weekAgg = await getWeeklyAggregate(
        db,
        range.start,
        range.end,
        prevStart.toISOString().slice(0, 10),
        prevEnd.toISOString().slice(0, 10),
      );
      setAgg(weekAgg);
      setNarrative(generateWeeklyNarrative(weekAgg));
    } catch (e) {
      console.warn("Week analytics error:", e);
    } finally {
      setLoading(false);
    }
  }, [db, isReady, weekId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  if (loading) {
    return (
      <ScreenWrapper>
        <SectionHeader title="Week View" subtitle={weekLabel} />
        <ActivityIndicator
          size="large"
          color={themeColors.accent}
          style={{ marginTop: spacing.xxl }}
        />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <SectionHeader title="Week View" subtitle={weekLabel} />

      {/* ─── Weekly Narrative ──── */}
      {narrative.length > 0 && (
        <View style={[styles.narrativeCard, { backgroundColor: themeColors.surface, borderColor: themeColors.accentLight }]}>
          <View style={styles.narrativeHeader}>
            <Feather name="book-open" size={16} color={themeColors.accent} />
            <Text style={[styles.narrativeTitle, { color: themeColors.accent }]}>Weekly Summary</Text>
          </View>
          <Text style={[styles.narrativeText, { color: themeColors.text }]}>{narrative}</Text>
        </View>
      )}

      {/* ─── Stat Cards Row ──── */}
      {agg && (
        <View style={styles.statRow}>
          <StatCard
            label="Sessions"
            value={agg.sessionStats.completed}
            subtitle={`of ${agg.sessionStats.totalSessions}`}
            color={themeColors.accent}
          />
          <StatCard
            label="Must-Dos"
            value={`${Math.round(agg.mustDoStats.completionRate * 100)}%`}
            subtitle={`${agg.mustDoStats.completedItems}/${agg.mustDoStats.totalItems}`}
            color={
              agg.mustDoStats.completionRate >= 0.8
                ? themeColors.success
                : themeColors.warning
            }
          />
          {agg.quietDays > 0 && (
            <StatCard
              label="Quiet"
              value={agg.quietDays}
              subtitle="rest days"
              color={themeColors.muted}
            />
          )}
        </View>
      )}

      {/* ─── Compliance Bars ──── */}
      {agg && agg.checkboxCompliance.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.muted }]}>Habit Compliance</Text>
          {agg.checkboxCompliance.map((c) => (
            <ComplianceBar
              key={c.moduleId}
              label={c.label}
              rate={c.rate}
              completed={c.completed}
              total={c.total}
            />
          ))}
        </View>
      )}

      {/* ─── Rating Trends ──── */}
      {agg && agg.ratingTrends.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.muted }]}>Rating Trends</Text>
          {agg.ratingTrends.map((r) => (
            <TrendLine
              key={r.moduleId}
              label={r.label}
              points={r.points}
              average={r.average}
              trend={r.trend}
            />
          ))}
        </View>
      )}

      {/* ─── Data Input Stats ──── */}
      {agg && agg.dataInputStats.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.muted }]}>Data Tracking</Text>
          {agg.dataInputStats.map((d) => (
            <TrendLine
              key={d.moduleId}
              label={`${d.label} (avg ${d.average}${d.unit ? " " + d.unit : ""})`}
              points={d.points}
              average={d.target ?? undefined}
              unit={d.unit}
            />
          ))}
        </View>
      )}

      {/* ─── Day Grid ──── */}
      <SectionHeader title="Days" />
      {days.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: themeColors.surface }]}>
          <Feather name="calendar" size={32} color={themeColors.muted} />
          <Text style={[styles.emptyText, { color: themeColors.text }]}>No days planned this week</Text>
          <Text style={[styles.emptySubtext, { color: themeColors.textSecondary }]}>
            Import a plan to see your week
          </Text>
        </View>
      ) : (
        <View style={styles.grid}>
          {days.map((day) => {
            const dateObj = new Date(day.date + "T12:00:00");
            const dayName = dateObj.toLocaleDateString("en-US", {
              weekday: "short",
            });
            const dayNum = dateObj.getDate();
            const doneCount = day.mustDoDone.filter(Boolean).length;
            const status = getDayStatus(day.mustDoDone);

            return (
              <Pressable
                key={day.date}
                style={[styles.dayCell, { backgroundColor: themeColors.surface }]}
                onPress={() => router.push(`/day/${day.date}`)}
              >
                <View style={styles.dayHeader}>
                  <Text style={[styles.dayName, { color: themeColors.textSecondary }]}>{dayName}</Text>
                  <Text style={[styles.dayNum, { color: themeColors.text }]}>{dayNum}</Text>
                </View>

                <Text style={[styles.dayTitle, { color: themeColors.text }]} numberOfLines={1}>
                  {day.title}
                </Text>

                <View style={styles.metaRow}>
                  <Feather
                    name="clock"
                    size={12}
                    color={themeColors.textSecondary}
                  />
                  <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                    {day.sessionCount} session
                    {day.sessionCount !== 1 ? "s" : ""}
                  </Text>
                </View>

                <View style={styles.metaRow}>
                  <Feather
                    name="check-square"
                    size={12}
                    color={themeColors.textSecondary}
                  />
                  <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                    {doneCount}/{day.mustDo.length} done
                  </Text>
                </View>

                <View style={styles.dotsRow}>
                  {day.mustDo.map((_, i) => (
                    <View
                      key={i}
                      style={[
                        styles.dot,
                        {
                          backgroundColor: day.mustDoDone[i]
                            ? themeColors.success
                            : themeColors.surfaceBorder,
                        },
                      ]}
                    />
                  ))}
                </View>

                <View
                  style={[
                    styles.statusBar,
                    { backgroundColor: STATUS_COLORS[status] },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  narrativeCard: {
    borderRadius: borderRadius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  narrativeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  narrativeTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  narrativeText: {
    fontSize: fontSize.md,
    lineHeight: 22,
  },
  statRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  section: {
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  emptyCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  emptySubtext: {
    fontSize: fontSize.sm,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  dayCell: {
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    width: "47%",
    minHeight: 140,
    position: "relative",
    overflow: "hidden",
  },
  dayHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  dayName: {
    fontSize: fontSize.xs,
    fontWeight: "500",
    textTransform: "uppercase",
  },
  dayNum: {
    fontSize: fontSize.xl,
    fontWeight: "700",
  },
  dayTitle: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 2,
  },
  metaText: {
    fontSize: fontSize.xs,
  },
  dotsRow: {
    flexDirection: "row",
    gap: 3,
    marginTop: spacing.xs,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
  },
});
