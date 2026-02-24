import React, { useCallback, useState } from "react";
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
  TextInput, Modal, ScrollView, Alert,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { ScreenWrapper } from "../../components/layout/ScreenWrapper";
import { SectionHeader } from "../../components/layout/SectionHeader";
import { CheckboxCard } from "../../components/modules/CheckboxCard";
import { RatingCard } from "../../components/modules/RatingCard";
import { DataInputCard } from "../../components/modules/DataInputCard";
import { TextNoteCard } from "../../components/modules/TextNoteCard";
import { SessionCard } from "../../components/modules/SessionCard";
import { ModuleCard } from "../../components/modules/ModuleCard";
import { TallyCard } from "../../components/modules/TallyCard";
import { PhotoLogCard } from "../../components/modules/PhotoLogCard";
import { HourlyTimeline } from "../../components/shared/HourlyTimeline";
import { useDatabaseSafe } from "../../components/DatabaseProvider";
import { useDayStore } from "../../stores/dayStore";
import { useSyncContext } from "../../components/SyncProvider";
import { useModuleValue, parseNumber } from "../../hooks/useModuleValue";
import {
  getModuleSpecs, getSessionsForDay, getRoutine, getRoutineBlocks,
  getRoutines, createSession, upsertDayPlan, updateMustDoDone, deleteSession,
} from "@flowstate/core";
import { fontSize, spacing, borderRadius } from "../../constants/theme";
import { useTheme } from "../../constants/ThemeContext";

type ViewMode = "list" | "timeline";

export default function TodayScreen() {
  const router = useRouter();
  const { db, isReady } = useDatabaseSafe();
  const { dayPlan, isLoading, loadDay, toggleMustDo } = useDayStore();
  const { syncDayPlan } = useSyncContext();
  const { themeColors } = useTheme();

  const [modules, setModules] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [allRoutines, setAllRoutines] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Session builder state
  const [showSessionBuilder, setShowSessionBuilder] = useState(false);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [sessionTimeHour, setSessionTimeHour] = useState(8);
  const [sessionTimeMinute, setSessionTimeMinute] = useState(0);

  // Must-do editing state
  const [editingMustDo, setEditingMustDo] = useState(false);
  const [newMustDoText, setNewMustDoText] = useState("");
  const [editMustDoIdx, setEditMustDoIdx] = useState<number | null>(null);
  const [editMustDoText, setEditMustDoText] = useState("");

  // Module picker state
  const [showModulePicker, setShowModulePicker] = useState(false);

  const todayStr = new Date().toISOString().slice(0, 10);

  useFocusEffect(
    useCallback(() => {
      if (!db || !isReady) return;
      loadDay(db, todayStr);
      (async () => {
        try {
          const specs = await getModuleSpecs(db);
          setModules(specs.filter((s: any) => !s.archivedAt));
          const rts = await getRoutines(db);
          setAllRoutines(rts.filter((r: any) => !r.archivedAt));
        } catch (e) {
          console.error("Failed to load modules/routines:", e);
        }
      })();
    }, [db, isReady, todayStr])
  );

  // Load sessions with routine data when dayPlan available
  React.useEffect(() => {
    if (!db || !dayPlan) { setSessions([]); return; }
    loadSessions();
  }, [db, dayPlan?.id]);

  const loadSessions = async () => {
    if (!db || !dayPlan) return;
    try {
      const sess = await getSessionsForDay(db, dayPlan.id);
      const enriched = await Promise.all(sess.map(async (s: any) => {
        try {
          const routine = await getRoutine(db, s.routineId);
          const blocks = await getRoutineBlocks(db, s.routineId);
          return {
            ...s,
            durationMinutes: routine?.totalDurationMinutes ?? 0,
            blockCount: blocks?.length ?? 0,
          };
        } catch {
          return { ...s, durationMinutes: 0, blockCount: 0 };
        }
      }));
      setSessions(enriched);
    } catch { setSessions([]); }
  };

  // ─── Session Builder ───
  const handleAddSession = async () => {
    if (!db || !selectedRoutineId) return;

    try {
      let dpId = dayPlan?.id;
      if (!dpId) {
        dpId = await upsertDayPlan(db, {
          date: todayStr,
          title: "Today",
          mustDo: dayPlan?.mustDo ?? [],
          moduleIds: dayPlan?.moduleIds ?? [],
        });
        await loadDay(db, todayStr);
      }

      const routine = allRoutines.find((r: any) => r.id === selectedRoutineId);
      const scheduledTime = `${String(sessionTimeHour).padStart(2, "0")}:${String(sessionTimeMinute).padStart(2, "0")}`;

      await createSession(db, {
        dayPlanId: dpId!,
        routineId: selectedRoutineId,
        routineName: routine?.name ?? "Session",
        scheduledTime,
      });

      setShowSessionBuilder(false);
      setSelectedRoutineId(null);
      setSessionTimeHour(8);
      setSessionTimeMinute(0);
      // Reload day plan and sessions
      await loadDay(db, todayStr);
      await loadSessions();
    } catch (e) {
      console.error("Failed to create session:", e);
      Alert.alert("Error", "Could not create session.");
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!db) return;
    Alert.alert("Delete Session", "Remove this session from today?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deleteSession(db, sessionId);
            await loadSessions();
          } catch (e) {
            console.error("Failed to delete session:", e);
          }
        },
      },
    ]);
  };

  // ─── Must-Do CRUD ───
  const handleAddMustDo = async () => {
    if (!db || !newMustDoText.trim()) return;
    const currentMustDo = dayPlan?.mustDo ?? [];
    const currentDone = dayPlan?.mustDoDone ?? [];
    const newMustDo = [...currentMustDo, newMustDoText.trim()];
    const newDone = [...currentDone, false];

    try {
      if (dayPlan) {
        await upsertDayPlan(db, {
          date: todayStr,
          title: dayPlan.title ?? "Today",
          mustDo: newMustDo,
          moduleIds: dayPlan.moduleIds ?? [],
        });
        await updateMustDoDone(db, dayPlan.id, newDone);
      } else {
        await upsertDayPlan(db, {
          date: todayStr,
          title: "Today",
          mustDo: newMustDo,
          moduleIds: [],
        });
      }
      setNewMustDoText("");
      await loadDay(db, todayStr);
      syncDayPlan(todayStr, { mustDo: newMustDo, mustDoDone: newDone });
    } catch (e) {
      console.error("Failed to add must-do:", e);
    }
  };

  const handleEditMustDo = async (index: number, newText: string) => {
    if (!db || !dayPlan || !newText.trim()) return;
    const newMustDo = [...(dayPlan.mustDo ?? [])];
    newMustDo[index] = newText.trim();

    try {
      await upsertDayPlan(db, {
        date: todayStr,
        title: dayPlan.title ?? "Today",
        mustDo: newMustDo,
        moduleIds: dayPlan.moduleIds ?? [],
      });
      setEditMustDoIdx(null);
      setEditMustDoText("");
      await loadDay(db, todayStr);
      syncDayPlan(todayStr, { mustDo: newMustDo, mustDoDone: dayPlan.mustDoDone });
    } catch (e) {
      console.error("Failed to edit must-do:", e);
    }
  };

  const handleDeleteMustDo = async (index: number) => {
    if (!db || !dayPlan) return;
    const newMustDo = (dayPlan.mustDo ?? []).filter((_: any, i: number) => i !== index);
    const newDone = (dayPlan.mustDoDone ?? []).filter((_: any, i: number) => i !== index);

    try {
      await upsertDayPlan(db, {
        date: todayStr,
        title: dayPlan.title ?? "Today",
        mustDo: newMustDo,
        moduleIds: dayPlan.moduleIds ?? [],
      });
      await updateMustDoDone(db, dayPlan.id, newDone);
      await loadDay(db, todayStr);
      syncDayPlan(todayStr, { mustDo: newMustDo, mustDoDone: newDone });
    } catch (e) {
      console.error("Failed to delete must-do:", e);
    }
  };

  // ─── Module picker ───
  const availableModules = modules.filter((m) => {
    const assigned = dayPlan?.moduleIds ?? [];
    const placements = Array.isArray(m.placements) ? m.placements : [];
    return !assigned.includes(m.id) && !placements.includes("today");
  });

  const handleAddModule = async (moduleId: string) => {
    if (!db) return;
    const currentIds = dayPlan?.moduleIds ?? [];
    const newIds = [...currentIds, moduleId];

    try {
      await upsertDayPlan(db, {
        date: todayStr,
        title: dayPlan?.title ?? "Today",
        mustDo: dayPlan?.mustDo ?? [],
        moduleIds: newIds,
      });
      setShowModulePicker(false);
      await loadDay(db, todayStr);
    } catch (e) {
      console.error("Failed to add module:", e);
    }
  };

  if (isLoading) {
    return (
      <ScreenWrapper>
        <ActivityIndicator size="large" color={themeColors.accent} style={{ marginTop: 60 }} />
      </ScreenWrapper>
    );
  }

  const dateObj = new Date(todayStr + "T12:00:00");
  const formatted = dateObj.toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
  });

  const mustDo = dayPlan?.mustDo ?? [];
  const mustDoDone = dayPlan?.mustDoDone ?? [];
  const doneCount = mustDoDone.filter(Boolean).length;
  const title = dayPlan?.title ?? "No plan for today";

  const dayModuleIds = dayPlan?.moduleIds ?? [];
  const dayModules = modules.filter(
    (m) => dayModuleIds.includes(m.id) || (Array.isArray(m.placements) && m.placements.includes("today"))
  );

  return (
    <ScreenWrapper>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.date, { color: themeColors.textSecondary }]}>{formatted}</Text>
          <Text style={[styles.title, { color: themeColors.text }]}>{title}</Text>
        </View>
        <Pressable
          style={[styles.viewToggle, { backgroundColor: themeColors.surface }, viewMode === "timeline" && { backgroundColor: themeColors.accent }]}
          onPress={() => setViewMode(viewMode === "list" ? "timeline" : "list")}
        >
          <Feather name={viewMode === "list" ? "clock" : "list"} size={18} color={viewMode === "timeline" ? themeColors.white : themeColors.accent} />
        </Pressable>
      </View>

      {dayPlan && (
        <Text style={[styles.progress, { color: themeColors.accent }]}>
          {doneCount}/{mustDo.length} must-dos complete
          {dayPlan.dayNumber ? ` · Day ${dayPlan.dayNumber}` : ""}
          {dayPlan.totalDays ? ` of ${dayPlan.totalDays}` : ""}
        </Text>
      )}

      {!dayPlan && isReady && (
        <View style={[styles.emptyCard, { backgroundColor: themeColors.surface }]}>
          <Feather name="calendar" size={32} color={themeColors.muted} />
          <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No plan for today</Text>
          <Text style={[styles.emptyText, { color: themeColors.muted }]}>Import a CSV plan or build your day below.</Text>
          <View style={styles.emptyActions}>
            <Pressable style={[styles.importBtn, { backgroundColor: themeColors.accent }]} onPress={() => router.push("/import/pick")}>
              <Text style={[styles.importBtnText, { color: themeColors.white }]}>Import Plan</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* ─── Timeline View ─── */}
      {viewMode === "timeline" && (
        <>
          <SectionHeader title="Timeline" subtitle="Tap a time slot to add a session" />
          <HourlyTimeline
            sessions={sessions}
            onSessionPress={(id) => router.push(`/session/${id}`)}
            onEmptySlotPress={(hour) => {
              setSessionTimeHour(hour);
              setSessionTimeMinute(0);
              setShowSessionBuilder(true);
            }}
          />
        </>
      )}

      {/* ─── List View ─── */}
      {viewMode === "list" && (
        <>
          {/* Must-Do Checklist with inline editing */}
          <View style={styles.sectionRow}>
            <SectionHeader title="Must Do" />
            <Pressable onPress={() => setEditingMustDo(!editingMustDo)} style={styles.editBtn}>
              <Feather name={editingMustDo ? "check" : "edit-2"} size={16} color={themeColors.accent} />
            </Pressable>
          </View>

          {mustDo.map((task: string, i: number) => (
            <View key={`mustdo-${i}`} style={styles.mustDoRow}>
              {editMustDoIdx === i ? (
                <View style={[styles.editMustDoRow, { backgroundColor: themeColors.surface }]}>
                  <TextInput
                    style={[styles.mustDoInput, { color: themeColors.text }]}
                    value={editMustDoText}
                    onChangeText={setEditMustDoText}
                    autoFocus
                    onSubmitEditing={() => handleEditMustDo(i, editMustDoText)}
                    returnKeyType="done"
                  />
                  <Pressable onPress={() => handleEditMustDo(i, editMustDoText)} style={styles.mustDoAction}>
                    <Feather name="check" size={16} color={themeColors.success} />
                  </Pressable>
                  <Pressable onPress={() => { setEditMustDoIdx(null); setEditMustDoText(""); }} style={styles.mustDoAction}>
                    <Feather name="x" size={16} color={themeColors.muted} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.mustDoContent}>
                  <View style={{ flex: 1 }}>
                    <CheckboxCard
                      label={task}
                      checked={mustDoDone[i] ?? false}
                      onToggle={() => db && toggleMustDo(db, i, syncDayPlan)}
                    />
                  </View>
                  {editingMustDo && (
                    <View style={styles.mustDoActions}>
                      <Pressable onPress={() => { setEditMustDoIdx(i); setEditMustDoText(task); }} style={styles.mustDoAction}>
                        <Feather name="edit-2" size={14} color={themeColors.accent} />
                      </Pressable>
                      <Pressable onPress={() => handleDeleteMustDo(i)} style={styles.mustDoAction}>
                        <Feather name="trash-2" size={14} color={themeColors.danger} />
                      </Pressable>
                    </View>
                  )}
                </View>
              )}
            </View>
          ))}

          {/* Add must-do */}
          <View style={[styles.addMustDoRow, { backgroundColor: themeColors.surface }]}>
            <TextInput
              style={[styles.addMustDoInput, { color: themeColors.text }]}
              placeholder="Add a must-do..."
              placeholderTextColor={themeColors.muted}
              value={newMustDoText}
              onChangeText={setNewMustDoText}
              onSubmitEditing={handleAddMustDo}
              returnKeyType="done"
            />
            {newMustDoText.trim() ? (
              <Pressable onPress={handleAddMustDo} style={[styles.addMustDoBtn, { backgroundColor: themeColors.accent }]}>
                <Feather name="plus" size={18} color={themeColors.white} />
              </Pressable>
            ) : null}
          </View>

          {/* Modules */}
          <View style={styles.sectionRow}>
            <SectionHeader title="Modules" subtitle="Track your day" />
            <Pressable onPress={() => setShowModulePicker(true)} style={styles.editBtn}>
              <Feather name="plus" size={16} color={themeColors.accent} />
            </Pressable>
          </View>

          {dayModules.length > 0 ? (
            dayModules.map((m: any) => (
              <ModuleValueCard key={m.id} module={m} />
            ))
          ) : (
            <Pressable style={[styles.emptySlot, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]} onPress={() => setShowModulePicker(true)}>
              <Feather name="plus-circle" size={18} color={themeColors.muted} />
              <Text style={[styles.emptySlotText, { color: themeColors.muted }]}>Add a module to track today</Text>
            </Pressable>
          )}

          {/* Sessions */}
          <View style={styles.sectionRow}>
            <SectionHeader title="Sessions" subtitle={sessions.length > 0 ? `${sessions.length} planned` : undefined} />
            <Pressable onPress={() => setShowSessionBuilder(true)} style={styles.editBtn}>
              <Feather name="plus" size={16} color={themeColors.accent} />
            </Pressable>
          </View>

          {sessions.length > 0 ? (
            sessions.map((s: any) => (
              <View key={s.id} style={styles.sessionRow}>
                <Pressable style={{ flex: 1 }} onPress={() => router.push(`/session/${s.id}`)}>
                  <SessionCard
                    sessionId={s.id}
                    routineName={s.routineName}
                    durationMinutes={s.durationMinutes ?? 0}
                    blockCount={s.blockCount ?? 0}
                    status={s.status}
                  />
                </Pressable>
                <Pressable
                  style={styles.sessionDeleteBtn}
                  onPress={() => handleDeleteSession(s.id)}
                  hitSlop={8}
                >
                  <Feather name="trash-2" size={16} color={themeColors.danger} />
                </Pressable>
              </View>
            ))
          ) : (
            <Pressable style={[styles.emptySlot, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]} onPress={() => setShowSessionBuilder(true)}>
              <Feather name="plus-circle" size={18} color={themeColors.muted} />
              <Text style={[styles.emptySlotText, { color: themeColors.muted }]}>Add a session</Text>
            </Pressable>
          )}
        </>
      )}

      {/* ─── Session Builder Modal ─── */}
      <Modal visible={showSessionBuilder} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowSessionBuilder(false)} />
        <View style={[styles.modalSheet, { backgroundColor: themeColors.background }]}>
          <Text style={[styles.modalTitle, { color: themeColors.text }]}>Add Session</Text>

          {/* Routine picker */}
          <Text style={[styles.modalLabel, { color: themeColors.muted }]}>Routine</Text>
          {allRoutines.length > 0 ? (
            <ScrollView style={styles.routineList} nestedScrollEnabled>
              {allRoutines.map((r: any) => (
                <Pressable
                  key={r.id}
                  style={[
                    styles.routineOption,
                    { backgroundColor: themeColors.surface },
                    selectedRoutineId === r.id && [styles.routineOptionActive, { backgroundColor: themeColors.accentLight, borderColor: themeColors.accent }],
                  ]}
                  onPress={() => setSelectedRoutineId(r.id)}
                >
                  <Text style={[
                    styles.routineOptionText,
                    { color: themeColors.text },
                    selectedRoutineId === r.id && [styles.routineOptionTextActive, { color: themeColors.accent }],
                  ]}>
                    {r.name}
                  </Text>
                  <Text style={[styles.routineDuration, { color: themeColors.muted }]}>{r.totalDurationMinutes}min</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.noRoutines}>
              <Text style={[styles.noRoutinesText, { color: themeColors.muted }]}>No routines yet</Text>
              <Pressable onPress={() => { setShowSessionBuilder(false); router.push("/routines/create"); }}>
                <Text style={[styles.noRoutinesLink, { color: themeColors.accent }]}>Create a routine first →</Text>
              </Pressable>
            </View>
          )}

          {/* Time picker */}
          <Text style={[styles.modalLabel, { color: themeColors.muted }]}>Scheduled Time</Text>
          <View style={styles.timePicker}>
            <Pressable onPress={() => setSessionTimeHour((h) => (h - 1 + 24) % 24)} style={styles.timeArrow}>
              <Feather name="chevron-down" size={20} color={themeColors.muted} />
            </Pressable>
            <Text style={[styles.timeValue, { color: themeColors.text }]}>
              {String(sessionTimeHour).padStart(2, "0")}:{String(sessionTimeMinute).padStart(2, "0")}
            </Text>
            <Pressable onPress={() => setSessionTimeHour((h) => (h + 1) % 24)} style={styles.timeArrow}>
              <Feather name="chevron-up" size={20} color={themeColors.muted} />
            </Pressable>
            <View style={styles.timeSpacer} />
            <Pressable onPress={() => setSessionTimeMinute((m) => (m - 15 + 60) % 60)} style={styles.timeArrow}>
              <Feather name="chevron-down" size={20} color={themeColors.muted} />
            </Pressable>
            <Pressable onPress={() => setSessionTimeMinute((m) => (m + 15) % 60)} style={styles.timeArrow}>
              <Feather name="chevron-up" size={20} color={themeColors.muted} />
            </Pressable>
          </View>
          <Text style={[styles.timeLabel, { color: themeColors.muted }]}>
            {sessionTimeHour === 0 ? "12" : sessionTimeHour > 12 ? sessionTimeHour - 12 : sessionTimeHour}
            :{String(sessionTimeMinute).padStart(2, "0")} {sessionTimeHour >= 12 ? "PM" : "AM"}
          </Text>

          {/* Actions */}
          <View style={styles.modalActions}>
            <Pressable style={[styles.modalCancel, { borderColor: themeColors.border }]} onPress={() => setShowSessionBuilder(false)}>
              <Text style={[styles.modalCancelText, { color: themeColors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.modalConfirm, { backgroundColor: themeColors.accent }, !selectedRoutineId && { opacity: 0.4 }]}
              onPress={handleAddSession}
              disabled={!selectedRoutineId}
            >
              <Text style={[styles.modalConfirmText, { color: themeColors.white }]}>Add Session</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* ─── Module Picker Modal ─── */}
      <Modal visible={showModulePicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowModulePicker(false)} />
        <View style={[styles.modalSheet, { backgroundColor: themeColors.background }]}>
          <Text style={[styles.modalTitle, { color: themeColors.text }]}>Add Module</Text>
          {availableModules.length > 0 ? (
            <ScrollView style={styles.routineList} nestedScrollEnabled>
              {availableModules.map((m: any) => (
                <Pressable key={m.id} style={[styles.routineOption, { backgroundColor: themeColors.surface }]} onPress={() => handleAddModule(m.id)}>
                  <Text style={[styles.routineOptionText, { color: themeColors.text }]}>
                    {m.emoji ?? "📦"} {m.label}
                  </Text>
                  <Text style={[styles.routineDuration, { color: themeColors.muted }]}>{m.type}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : (
            <View style={styles.noRoutines}>
              <Text style={[styles.noRoutinesText, { color: themeColors.muted }]}>All modules are already assigned</Text>
              <Pressable onPress={() => { setShowModulePicker(false); router.push("/modules/create"); }}>
                <Text style={[styles.noRoutinesLink, { color: themeColors.accent }]}>Create a new module →</Text>
              </Pressable>
            </View>
          )}
          <Pressable style={[styles.modalCancel, { borderColor: themeColors.border }]} onPress={() => setShowModulePicker(false)}>
            <Text style={[styles.modalCancelText, { color: themeColors.text }]}>Close</Text>
          </Pressable>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

function ModuleValueCard({ module }: { module: any }) {
  const { value, setValue } = useModuleValue(module.id);
  const config = module.config ?? {};

  switch (module.type) {
    case "checkbox":
      return (
        <CheckboxCard label={module.label} emoji={module.emoji}
          checked={value === "true" || value === "1"}
          onToggle={() => setValue(value === "true" ? "false" : "true")} />
      );
    case "rating":
      return (
        <RatingCard label={module.label} emoji={module.emoji}
          value={parseNumber(value)} onRate={(v) => setValue(String(v))} />
      );
    case "data_input":
      return (
        <DataInputCard label={module.label} emoji={module.emoji}
          value={parseNumber(value)} target={config.target ?? 100}
          unit={config.unit ?? ""} onChangeValue={(v) => setValue(String(v))} />
      );
    case "text_note":
      return (
        <TextNoteCard label={module.label} emoji={module.emoji}
          value={value ?? ""} onChangeValue={(v) => setValue(v)}
          prompt={config.prompt} maxLength={config.maxLength} />
      );
    case "tally":
      return (
        <TallyCard label={module.label} emoji={module.emoji}
          value={parseNumber(value)} step={config.step ?? 1}
          target={config.target}
          onChangeValue={(v) => setValue(String(v))} />
      );
    case "photo_log":
      return (
        <PhotoLogCard label={module.label} emoji={module.emoji}
          value={value ?? ""} onValueChange={(v: string) => setValue(v)}
          maxPhotosPerDay={config.maxPhotosPerDay ?? 1} prompt={config.prompt} />
      );
    default:
      return (
        <ModuleCard id={module.id} type={module.type} label={module.label}
          emoji={module.emoji} config={config} surface="day"
          value={value} onValueChange={(v) => setValue(String(v ?? ""))} />
      );
  }
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  viewToggle: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  viewToggleActive: {
  },
  date: { fontSize: fontSize.sm, marginBottom: 2 },
  title: { fontSize: fontSize.xxl, fontWeight: "800" },
  progress: { fontSize: fontSize.sm, fontWeight: "600", marginTop: spacing.xs },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editBtn: {
    padding: spacing.sm,
  },
  mustDoRow: {
    marginBottom: 2,
  },
  mustDoContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  mustDoActions: {
    flexDirection: "row",
    gap: spacing.xs,
    paddingRight: spacing.xs,
  },
  mustDoAction: {
    padding: spacing.xs,
  },
  editMustDoRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  mustDoInput: {
    flex: 1,
    fontSize: fontSize.md,
    padding: 0,
  },
  addMustDoRow: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  addMustDoInput: {
    flex: 1,
    fontSize: fontSize.sm,
    padding: 0,
  },
  addMustDoBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCard: {
    alignItems: "center", borderRadius: borderRadius.lg,
    padding: spacing.xl, marginTop: spacing.lg, gap: spacing.sm,
  },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: "700" },
  emptyText: { fontSize: fontSize.sm, textAlign: "center" },
  emptyActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  importBtn: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
  },
  importBtnText: { fontWeight: "600", fontSize: fontSize.md },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  sessionDeleteBtn: {
    padding: spacing.sm,
    marginLeft: spacing.xs,
  },
  emptySlot: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  emptySlotText: {
    fontSize: fontSize.sm,
  },
  empty: { fontSize: fontSize.sm, textAlign: "center", paddingVertical: spacing.lg },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    maxHeight: "70%",
  },
  modalTitle: {
    fontSize: fontSize.xl,
    fontWeight: "700",
    marginBottom: spacing.md,
  },
  modalLabel: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  routineList: {
    maxHeight: 200,
  },
  routineOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.xs,
  },
  routineOptionActive: {
    borderWidth: 1,
  },
  routineOptionText: {
    fontSize: fontSize.md,
    fontWeight: "500",
  },
  routineOptionTextActive: {
    fontWeight: "600",
  },
  routineDuration: {
    fontSize: fontSize.sm,
  },
  noRoutines: {
    alignItems: "center",
    padding: spacing.lg,
    gap: spacing.sm,
  },
  noRoutinesText: {
    fontSize: fontSize.sm,
  },
  noRoutinesLink: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  timePicker: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginVertical: spacing.sm,
  },
  timeArrow: {
    padding: spacing.sm,
  },
  timeValue: {
    fontSize: fontSize.xxl,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  timeSpacer: {
    width: spacing.md,
  },
  timeLabel: {
    fontSize: fontSize.sm,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  modalCancel: {
    flex: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
    borderWidth: 1,
  },
  modalCancelText: {
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  modalConfirm: {
    flex: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: "center",
  },
  modalConfirmText: {
    fontSize: fontSize.md,
    fontWeight: "600",
  },
});
