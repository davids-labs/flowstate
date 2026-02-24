import React, { useState, useCallback, useEffect } from "react";
import {
  View, Text, Pressable, StyleSheet, ActivityIndicator,
  TextInput, Modal, ScrollView, Alert,
} from "react-native";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
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
  getRoutines, createSession, updateSession, deleteSession,
  updateDayPlanStatus, upsertDayPlan, updateMustDoDone,
} from "@flowstate/core";
import { fontSize, spacing, borderRadius } from "../../constants/theme";
import { useTheme } from "../../constants/ThemeContext";

type ViewMode = "list" | "timeline";

export default function DayScreen() {
  const { themeColors } = useTheme();
  const { date } = useLocalSearchParams<{ date: string }>();
  const router = useRouter();
  const { db, isReady } = useDatabaseSafe();
  const { dayPlan, isLoading, loadDay, toggleMustDo } = useDayStore();
  const { syncDayPlan } = useSyncContext();

  const [modules, setModules] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [allRoutines, setAllRoutines] = useState<any[]>([]);
  const [isQuiet, setIsQuiet] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");

  // Session builder
  const [showSessionBuilder, setShowSessionBuilder] = useState(false);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [sessionTimeHour, setSessionTimeHour] = useState(8);
  const [sessionTimeMinute, setSessionTimeMinute] = useState(0);

  // Session edit
  const [editingSession, setEditingSession] = useState<any>(null);
  const [editSessionRoutineId, setEditSessionRoutineId] = useState<string | null>(null);
  const [editSessionHour, setEditSessionHour] = useState(8);
  const [editSessionMinute, setEditSessionMinute] = useState(0);

  // Must-do editing
  const [editingMustDo, setEditingMustDo] = useState(false);
  const [newMustDoText, setNewMustDoText] = useState("");
  const [editMustDoIdx, setEditMustDoIdx] = useState<number | null>(null);
  const [editMustDoText, setEditMustDoText] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (!db || !isReady || !date) return;
      loadDay(db, date);
      (async () => {
        try {
          const specs = await getModuleSpecs(db);
          setModules(specs.filter((s: any) => !s.archivedAt));
          const rts = await getRoutines(db);
          setAllRoutines(rts.filter((r: any) => !r.archivedAt));
        } catch (e) { console.warn('operation failed:', e); }
      })();
    }, [db, isReady, date])
  );

  useEffect(() => {
    if (!db || !dayPlan) { setSessions([]); return; }
    loadSessions();
  }, [db, dayPlan?.id]);

  useEffect(() => {
    setIsQuiet(dayPlan?.status === "quiet");
  }, [dayPlan?.status]);

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
        } catch (e) {
          console.warn('operation failed:', e);
          return { ...s, durationMinutes: 0, blockCount: 0 };
        }
      }));
      setSessions(enriched);
    } catch (e) { console.warn('operation failed:', e); setSessions([]); }
  };

  // ─── Session actions ───
  const handleAddSession = async () => {
    if (!db || !dayPlan || !selectedRoutineId) return;
    try {
      const routine = allRoutines.find((r: any) => r.id === selectedRoutineId);
      const scheduledTime = `${String(sessionTimeHour).padStart(2, "0")}:${String(sessionTimeMinute).padStart(2, "0")}`;
      await createSession(db, {
        dayPlanId: dayPlan.id,
        routineId: selectedRoutineId,
        routineName: routine?.name ?? "Session",
        scheduledTime,
      });
      setShowSessionBuilder(false);
      setSelectedRoutineId(null);
      setSessionTimeHour(8);
      setSessionTimeMinute(0);
      await loadSessions();
    } catch (e) {
      Alert.alert("Error", "Could not create session.");
    }
  };

  const handleEditSession = async () => {
    if (!db || !editingSession) return;
    try {
      const updates: any = {};
      if (editSessionRoutineId && editSessionRoutineId !== editingSession.routineId) {
        const routine = allRoutines.find((r: any) => r.id === editSessionRoutineId);
        updates.routineId = editSessionRoutineId;
        updates.routineName = routine?.name ?? editingSession.routineName;
      }
      updates.scheduledTime = `${String(editSessionHour).padStart(2, "0")}:${String(editSessionMinute).padStart(2, "0")}`;
      await updateSession(db, editingSession.id, updates);
      setEditingSession(null);
      await loadSessions();
    } catch (e) {
      Alert.alert("Error", "Could not update session.");
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    if (!db) return;
    Alert.alert("Delete Session", "Remove this session?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive",
        onPress: async () => {
          try {
            await deleteSession(db, sessionId);
            await loadSessions();
          } catch (e) { console.warn('operation failed:', e); }
        },
      },
    ]);
  };

  const openEditSession = (s: any) => {
    setEditingSession(s);
    setEditSessionRoutineId(s.routineId);
    if (s.scheduledTime) {
      const [h, m] = s.scheduledTime.split(":").map(Number);
      setEditSessionHour(h);
      setEditSessionMinute(m);
    } else {
      setEditSessionHour(8);
      setEditSessionMinute(0);
    }
  };

  // ─── Must-Do CRUD ───
  const handleAddMustDo = async () => {
    if (!db || !dayPlan || !newMustDoText.trim()) return;
    const newMustDo = [...(dayPlan.mustDo ?? []), newMustDoText.trim()];
    const newDone = [...(dayPlan.mustDoDone ?? []), false];
    try {
      await upsertDayPlan(db, {
        date: date!,
        title: dayPlan.title ?? "",
        mustDo: newMustDo,
        moduleIds: dayPlan.moduleIds ?? [],
      });
      await updateMustDoDone(db, dayPlan.id, newDone);
      setNewMustDoText("");
      await loadDay(db, date!);
      syncDayPlan(date!, { mustDo: newMustDo, mustDoDone: newDone });
    } catch (e) { console.warn('operation failed:', e); }
  };

  const handleEditMustDo = async (index: number, newText: string) => {
    if (!db || !dayPlan || !newText.trim()) return;
    const newMustDo = [...(dayPlan.mustDo ?? [])];
    newMustDo[index] = newText.trim();
    try {
      await upsertDayPlan(db, {
        date: date!,
        title: dayPlan.title ?? "",
        mustDo: newMustDo,
        moduleIds: dayPlan.moduleIds ?? [],
      });
      setEditMustDoIdx(null);
      setEditMustDoText("");
      await loadDay(db, date!);
      syncDayPlan(date!, { mustDo: newMustDo, mustDoDone: dayPlan.mustDoDone });
    } catch (e) { console.warn('operation failed:', e); }
  };

  const handleDeleteMustDo = async (index: number) => {
    if (!db || !dayPlan) return;
    const newMustDo = (dayPlan.mustDo ?? []).filter((_: any, i: number) => i !== index);
    const newDone = (dayPlan.mustDoDone ?? []).filter((_: any, i: number) => i !== index);
    try {
      await upsertDayPlan(db, {
        date: date!,
        title: dayPlan.title ?? "",
        mustDo: newMustDo,
        moduleIds: dayPlan.moduleIds ?? [],
      });
      await updateMustDoDone(db, dayPlan.id, newDone);
      await loadDay(db, date!);
      syncDayPlan(date!, { mustDo: newMustDo, mustDoDone: newDone });
    } catch (e) { console.warn('operation failed:', e); }
  };

  if (isLoading) {
    return (
      <ScreenWrapper>
        <ActivityIndicator size="large" color={themeColors.accent} style={{ marginTop: 60 }} />
      </ScreenWrapper>
    );
  }

  if (!dayPlan && isReady) {
    return (
      <ScreenWrapper>
        <Text style={[styles.empty, { color: themeColors.muted }]}>No plan found for {date}</Text>
        <Pressable style={styles.backBtn} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
          <Feather name="arrow-left" size={16} color={themeColors.accent} />
          <Text style={[styles.backBtnText, { color: themeColors.accent }]}>Go back</Text>
        </Pressable>
      </ScreenWrapper>
    );
  }

  const dateObj = new Date((date ?? "") + "T12:00:00");
  const formatted = dateObj.toLocaleDateString("en-US", {
    weekday: "long", month: "short", day: "numeric",
  });

  const mustDo = dayPlan?.mustDo ?? [];
  const mustDoDone = dayPlan?.mustDoDone ?? [];
  const doneCount = mustDoDone.filter(Boolean).length;
  const allDone = mustDo.length > 0 && doneCount === mustDo.length;

  const dayModuleIds = dayPlan?.moduleIds ?? [];
  const dayModules = modules.filter((m) => dayModuleIds.includes(m.id));

  if (isQuiet) {
    return (
      <ScreenWrapper>
        <Text style={[styles.date, { color: themeColors.textSecondary }]}>{formatted}</Text>
        <Text style={[styles.title, { color: themeColors.text }]}>{dayPlan?.title}</Text>
        <View style={[styles.quietCard, { backgroundColor: themeColors.surface }]}>
          <Feather name="moon" size={48} color={themeColors.muted} />
          <Text style={[styles.quietTitle, { color: themeColors.muted }]}>Quiet Day</Text>
          <Text style={[styles.quietText, { color: themeColors.muted }]}>
            This day is marked as rest. All sessions and must-dos are paused.
          </Text>
          <Pressable style={[styles.unquietBtn, { borderColor: themeColors.border }]} onPress={() => {
            setIsQuiet(false);
            if (db && dayPlan) updateDayPlanStatus(db, dayPlan.id, 'planned').catch(() => {});
          }}>
            <Text style={[styles.unquietBtnText, { color: themeColors.text }]}>Resume this day</Text>
          </Pressable>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.topRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.date, { color: themeColors.textSecondary }]}>{formatted}</Text>
          <Text style={[styles.title, { color: themeColors.text }]}>{dayPlan?.title}</Text>
        </View>
        <View style={styles.topActions}>
          <Pressable
            style={[styles.viewToggle, { backgroundColor: themeColors.surface }, viewMode === "timeline" && { backgroundColor: themeColors.accent }]}
            onPress={() => setViewMode(viewMode === "list" ? "timeline" : "list")}
          >
            <Feather name={viewMode === "list" ? "clock" : "list"} size={18} color={viewMode === "timeline" ? themeColors.white : themeColors.accent} />
          </Pressable>
          <Pressable style={[styles.quietBtn, { backgroundColor: themeColors.surface }]} onPress={() => {
            setIsQuiet(true);
            if (db && dayPlan) updateDayPlanStatus(db, dayPlan.id, 'quiet').catch(() => {});
          }}>
            <Feather name="moon" size={18} color={themeColors.muted} />
          </Pressable>
        </View>
      </View>

      <Text style={[styles.progress, { color: themeColors.accent }]}>
        {doneCount}/{mustDo.length} must-dos complete
        {dayPlan?.dayNumber ? ` · Day ${dayPlan.dayNumber}` : ""}
        {dayPlan?.totalDays ? ` of ${dayPlan.totalDays}` : ""}
      </Text>

      {allDone && (
        <View style={[styles.milestoneBanner, { backgroundColor: themeColors.accentLight }]}>
          <Text style={styles.milestoneEmoji}>🎉</Text>
          <View>
            <Text style={[styles.milestoneTitle, { color: themeColors.success }]}>All Done!</Text>
            <Text style={[styles.milestoneText, { color: themeColors.text }]}>Every must-do complete. Great work.</Text>
          </View>
        </View>
      )}

      {/* Timeline view */}
      {viewMode === "timeline" && (
        <>
          <SectionHeader title="Timeline" subtitle="Tap a time to add" />
          <HourlyTimeline
            sessions={sessions}
            onSessionPress={(id) => {
              const s = sessions.find((x: any) => x.id === id);
              if (s) openEditSession(s);
            }}
            onEmptySlotPress={(hour) => {
              setSessionTimeHour(hour);
              setSessionTimeMinute(0);
              setShowSessionBuilder(true);
            }}
          />
        </>
      )}

      {/* List view */}
      {viewMode === "list" && (
        <>
          {/* Must-Do with CRUD */}
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
          {dayModules.length > 0 && (
            <>
              <SectionHeader title="Modules" />
              {dayModules.map((m: any) => (
                <DayModuleCard key={m.id} module={m} />
              ))}
            </>
          )}

          {/* Sessions with add/edit/delete */}
          <View style={styles.sectionRow}>
            <SectionHeader title="Sessions" subtitle={sessions.length > 0 ? `${sessions.length} planned` : undefined} />
            <Pressable onPress={() => setShowSessionBuilder(true)} style={styles.editBtn}>
              <Feather name="plus" size={16} color={themeColors.accent} />
            </Pressable>
          </View>

          {sessions.length > 0 ? (
            sessions.map((s: any) => (
              <Pressable
                key={s.id}
                onPress={() => openEditSession(s)}
                onLongPress={() => handleDeleteSession(s.id)}
              >
                <SessionCard
                  sessionId={s.id}
                  routineName={s.routineName}
                  durationMinutes={s.durationMinutes ?? 0}
                  blockCount={s.blockCount ?? 0}
                  status={s.status}
                />
                {s.scheduledTime && (
                  <Text style={[styles.scheduledLabel, { color: themeColors.muted }]}>Scheduled: {
                    (() => {
                      const [h, m] = s.scheduledTime.split(":").map(Number);
                      const ampm = h >= 12 ? "PM" : "AM";
                      const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
                      return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
                    })()
                  }</Text>
                )}
              </Pressable>
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
          <Text style={[styles.modalLabel, { color: themeColors.muted }]}>Routine</Text>
          {allRoutines.length > 0 ? (
            <ScrollView style={styles.routineList} nestedScrollEnabled>
              {allRoutines.map((r: any) => (
                <Pressable
                  key={r.id}
                  style={[styles.routineOption, { backgroundColor: themeColors.surface }, selectedRoutineId === r.id && { backgroundColor: themeColors.accentLight, borderWidth: 1, borderColor: themeColors.accent }]}
                  onPress={() => setSelectedRoutineId(r.id)}
                >
                  <Text style={[styles.routineOptionText, { color: themeColors.text }, selectedRoutineId === r.id && { color: themeColors.accent, fontWeight: "600" }]}>
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

      {/* ─── Session Edit Modal ─── */}
      <Modal visible={!!editingSession} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setEditingSession(null)} />
        <View style={[styles.modalSheet, { backgroundColor: themeColors.background }]}>
          <Text style={[styles.modalTitle, { color: themeColors.text }]}>Edit Session</Text>

          <Text style={[styles.modalLabel, { color: themeColors.muted }]}>Routine</Text>
          <ScrollView style={styles.routineList} nestedScrollEnabled>
            {allRoutines.map((r: any) => (
              <Pressable
                key={r.id}
                style={[styles.routineOption, { backgroundColor: themeColors.surface }, editSessionRoutineId === r.id && { backgroundColor: themeColors.accentLight, borderWidth: 1, borderColor: themeColors.accent }]}
                onPress={() => setEditSessionRoutineId(r.id)}
              >
                <Text style={[styles.routineOptionText, { color: themeColors.text }, editSessionRoutineId === r.id && { color: themeColors.accent, fontWeight: "600" }]}>
                  {r.name}
                </Text>
                <Text style={[styles.routineDuration, { color: themeColors.muted }]}>{r.totalDurationMinutes}min</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[styles.modalLabel, { color: themeColors.muted }]}>Scheduled Time</Text>
          <View style={styles.timePicker}>
            <Pressable onPress={() => setEditSessionHour((h) => (h - 1 + 24) % 24)} style={styles.timeArrow}>
              <Feather name="chevron-down" size={20} color={themeColors.muted} />
            </Pressable>
            <Text style={[styles.timeValue, { color: themeColors.text }]}>
              {String(editSessionHour).padStart(2, "0")}:{String(editSessionMinute).padStart(2, "0")}
            </Text>
            <Pressable onPress={() => setEditSessionHour((h) => (h + 1) % 24)} style={styles.timeArrow}>
              <Feather name="chevron-up" size={20} color={themeColors.muted} />
            </Pressable>
            <View style={styles.timeSpacer} />
            <Pressable onPress={() => setEditSessionMinute((m) => (m - 15 + 60) % 60)} style={styles.timeArrow}>
              <Feather name="chevron-down" size={20} color={themeColors.muted} />
            </Pressable>
            <Pressable onPress={() => setEditSessionMinute((m) => (m + 15) % 60)} style={styles.timeArrow}>
              <Feather name="chevron-up" size={20} color={themeColors.muted} />
            </Pressable>
          </View>
          <Text style={[styles.timeLabel, { color: themeColors.muted }]}>
            {editSessionHour === 0 ? "12" : editSessionHour > 12 ? editSessionHour - 12 : editSessionHour}
            :{String(editSessionMinute).padStart(2, "0")} {editSessionHour >= 12 ? "PM" : "AM"}
          </Text>

          <View style={styles.modalActions}>
            <Pressable style={[styles.dangerBtn, { borderColor: themeColors.danger }]} onPress={() => {
              if (editingSession) {
                handleDeleteSession(editingSession.id);
                setEditingSession(null);
              }
            }}>
              <Feather name="trash-2" size={16} color={themeColors.danger} />
            </Pressable>
            <Pressable style={[styles.modalCancel, { borderColor: themeColors.border }]} onPress={() => setEditingSession(null)}>
              <Text style={[styles.modalCancelText, { color: themeColors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.modalConfirm, { backgroundColor: themeColors.accent }]} onPress={handleEditSession}>
              <Text style={[styles.modalConfirmText, { color: themeColors.white }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScreenWrapper>
  );
}

function DayModuleCard({ module }: { module: any }) {
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
          maxPhotosPerDay={config.maxPhotosPerDay ?? 1}
          prompt={config.prompt} />
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
  topRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  topActions: { flexDirection: "row", gap: spacing.sm },
  viewToggle: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  quietBtn: { padding: spacing.sm, borderRadius: borderRadius.sm },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  editBtn: { padding: spacing.sm },
  mustDoRow: { marginBottom: 2 },
  mustDoContent: { flexDirection: "row", alignItems: "center" },
  mustDoActions: { flexDirection: "row", gap: spacing.xs, paddingRight: spacing.xs },
  mustDoAction: { padding: spacing.xs },
  editMustDoRow: {
    flexDirection: "row", alignItems: "center",
    borderRadius: borderRadius.md,
    padding: spacing.sm, gap: spacing.xs,
  },
  mustDoInput: { flex: 1, fontSize: fontSize.md, padding: 0 },
  addMustDoRow: {
    flexDirection: "row", alignItems: "center",
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    marginBottom: spacing.md, gap: spacing.sm,
  },
  addMustDoInput: { flex: 1, fontSize: fontSize.sm, padding: 0 },
  addMustDoBtn: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: "center", justifyContent: "center",
  },
  scheduledLabel: {
    fontSize: fontSize.xs,
    paddingLeft: spacing.md,
    marginTop: -spacing.xs,
    marginBottom: spacing.sm,
  },
  emptySlot: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm, borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.sm,
    borderWidth: 1, borderStyle: "dashed",
  },
  emptySlotText: { fontSize: fontSize.sm },
  quietCard: {
    alignItems: "center", borderRadius: borderRadius.lg,
    padding: spacing.xl, marginTop: spacing.lg, gap: spacing.md,
  },
  quietTitle: { fontSize: fontSize.xl, fontWeight: "700" },
  quietText: { fontSize: fontSize.md, textAlign: "center", lineHeight: 22 },
  unquietBtn: {
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md, borderWidth: 1, marginTop: spacing.sm,
  },
  unquietBtnText: { fontSize: fontSize.md, fontWeight: "600" },
  milestoneBanner: {
    flexDirection: "row", alignItems: "center",
    borderRadius: borderRadius.md, padding: spacing.md, marginVertical: spacing.sm, gap: spacing.sm,
  },
  milestoneEmoji: { fontSize: 32 },
  milestoneTitle: { fontSize: fontSize.md, fontWeight: "700" },
  milestoneText: { fontSize: fontSize.sm },
  date: { fontSize: fontSize.sm, marginBottom: 2 },
  title: { fontSize: fontSize.xxl, fontWeight: "800" },
  progress: { fontSize: fontSize.sm, fontWeight: "600", marginTop: spacing.xs },
  empty: { fontSize: fontSize.sm, textAlign: "center", paddingVertical: spacing.lg },
  backBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.xs, paddingVertical: spacing.md, marginTop: spacing.sm,
  },
  backBtnText: { fontSize: fontSize.md, fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: spacing.lg, paddingBottom: spacing.xxl, maxHeight: "70%",
  },
  modalTitle: { fontSize: fontSize.xl, fontWeight: "700", marginBottom: spacing.md },
  modalLabel: {
    fontSize: fontSize.sm, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.5, marginTop: spacing.md, marginBottom: spacing.sm,
  },
  routineList: { maxHeight: 200 },
  routineOption: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderRadius: borderRadius.md,
    padding: spacing.md, marginBottom: spacing.xs,
  },
  routineOptionText: { fontSize: fontSize.md, fontWeight: "500" },
  routineDuration: { fontSize: fontSize.sm },
  noRoutines: { alignItems: "center", padding: spacing.lg, gap: spacing.sm },
  noRoutinesText: { fontSize: fontSize.sm },
  noRoutinesLink: { fontSize: fontSize.sm, fontWeight: "600" },
  timePicker: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: spacing.sm, marginVertical: spacing.sm,
  },
  timeArrow: { padding: spacing.sm },
  timeValue: { fontSize: fontSize.xxl, fontWeight: "700", fontVariant: ["tabular-nums"] },
  timeSpacer: { width: spacing.md },
  timeLabel: { fontSize: fontSize.sm, textAlign: "center", marginBottom: spacing.sm },
  modalActions: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  dangerBtn: {
    width: 44, height: 44, borderRadius: borderRadius.md,
    borderWidth: 1, alignItems: "center", justifyContent: "center",
  },
  modalCancel: {
    flex: 1, borderRadius: borderRadius.md, paddingVertical: spacing.sm + 2,
    alignItems: "center", borderWidth: 1,
  },
  modalCancelText: { fontSize: fontSize.md, fontWeight: "600" },
  modalConfirm: {
    flex: 1, borderRadius: borderRadius.md, paddingVertical: spacing.sm + 2,
    alignItems: "center",
  },
  modalConfirmText: { fontSize: fontSize.md, fontWeight: "600" },
});
