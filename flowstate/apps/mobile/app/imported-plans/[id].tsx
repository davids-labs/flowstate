import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import {
  getImportedPlanBundle,
  getRoutines,
  updateCsvPlan,
  updateDayPlan,
  updatePlan,
  updateSession,
} from '@flowstate/core';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { AppText } from '../../components/primitives/Text';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';

interface DraftSession {
  id: string;
  routineId: string | null;
  routineName: string;
  scheduledTime: string;
  status: string;
}

interface DraftDay {
  id: string;
  date: string;
  title: string;
  mustDoText: string;
  mustDoDone: boolean[];
  sessions: DraftSession[];
}

interface ImportedPlanDraft {
  csvPlanId: string;
  planId: string | null;
  name: string;
  description: string;
  uploadedAt: string;
  days: DraftDay[];
}

function normalizeDateInput(value: string) {
  return value.replace(/[^0-9-]/g, '').slice(0, 10);
}

function normalizeTimeInput(value: string) {
  return value.replace(/[^0-9:]/g, '').slice(0, 5);
}

function isValidDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidTime(value: string) {
  if (!value.trim()) return true;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value.trim());
}

function listToTextarea(lines: string[]) {
  return lines.join('\n');
}

function textareaToList(value: string) {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatDateRange(days: DraftDay[]) {
  if (days.length === 0) return 'No dates';
  const ordered = [...days].sort((left, right) => left.date.localeCompare(right.date));
  if (ordered.length === 1) return ordered[0].date;
  return `${ordered[0].date} - ${ordered[ordered.length - 1].date}`;
}

function totalSessionCount(days: DraftDay[]) {
  return days.reduce((sum, day) => sum + day.sessions.length, 0);
}

function routineDurationLabel(minutes?: number | null) {
  if (!minutes) return 'Template';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function SessionTemplatePicker({
  visible,
  sessionName,
  routines,
  onSelect,
  onClose,
}: {
  visible: boolean;
  sessionName: string;
  routines: any[];
  onSelect: (routine: any) => void;
  onClose: () => void;
}) {
  const { themeTokens } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.pickerOverlay}>
        <Pressable style={styles.pickerBackdrop} onPress={onClose} />
        <View style={[styles.pickerSheet, { backgroundColor: themeTokens.background, borderColor: themeTokens.border }]}>
          <View style={[styles.pickerHandle, { backgroundColor: themeTokens.border }]} />
          <View style={styles.pickerHeader}>
            <View style={{ flex: 1, gap: space[4] }}>
              <AppText variant="title3" style={{ fontWeight: '700' }}>
                Choose Session Template
              </AppText>
              <AppText variant="footnote" color={themeTokens.textSecondary}>
                Current: {sessionName}
              </AppText>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={18} color={themeTokens.textSecondary} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.pickerList}>
              {routines.map((routine) => (
                <Pressable
                  key={routine.id}
                  style={[styles.pickerRow, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}
                  onPress={() => onSelect(routine)}
                >
                  <View style={{ flex: 1, gap: space[4] }}>
                    <AppText variant="body" style={{ fontWeight: '600' }}>
                      {routine.name}
                    </AppText>
                    <AppText variant="footnote" color={themeTokens.textSecondary}>
                      {routineDurationLabel(routine.totalDurationMinutes)}
                    </AppText>
                  </View>
                  <Feather name="chevron-right" size={14} color={themeTokens.textTertiary} />
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export default function ImportedPlanEditorScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, isReady } = useDatabaseSafe();
  const { themeTokens } = useTheme();
  const [draft, setDraft] = useState<ImportedPlanDraft | null>(null);
  const [routines, setRoutines] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerSessionId, setPickerSessionId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!db || !isReady || !id) return;
    setLoading(true);

    try {
      const [bundle, routineRows] = await Promise.all([
        getImportedPlanBundle(db, id),
        getRoutines(db),
      ]);

      if (!bundle) {
        setDraft(null);
        setRoutines([]);
        return;
      }

      setRoutines((routineRows as any[]).filter((routine) => !routine.archivedAt));
      setDraft({
        csvPlanId: bundle.csvPlan.id,
        planId: bundle.plan?.id ?? null,
        name: bundle.plan?.name ?? bundle.csvPlan.name,
        description: bundle.csvPlan.description ?? '',
        uploadedAt: bundle.csvPlan.uploadedAt,
        days: bundle.days.map((day) => ({
          id: day.id,
          date: day.date,
          title: day.title,
          mustDoText: listToTextarea(day.mustDo),
          mustDoDone: [...day.mustDoDone],
          sessions: day.sessions.map((session) => ({
            id: session.id,
            routineId: session.routineId,
            routineName: session.routineName,
            scheduledTime: session.scheduledTime ?? '',
            status: session.status,
          })),
        })),
      });
    } catch {
      setDraft(null);
    } finally {
      setLoading(false);
    }
  }, [db, id, isReady]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const updateDayDraft = useCallback((dayId: string, updater: (day: DraftDay) => DraftDay) => {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        days: current.days.map((day) => (day.id === dayId ? updater(day) : day)),
      };
    });
  }, []);

  const updateSessionDraft = useCallback((
    dayId: string,
    sessionId: string,
    updater: (session: DraftSession) => DraftSession,
  ) => {
    updateDayDraft(dayId, (day) => ({
      ...day,
      sessions: day.sessions.map((session) => (session.id === sessionId ? updater(session) : session)),
    }));
  }, [updateDayDraft]);

  const selectedSession = useMemo(() => {
    if (!draft || !pickerSessionId) return null;
    for (const day of draft.days) {
      const session = day.sessions.find((entry) => entry.id === pickerSessionId);
      if (session) {
        return { dayId: day.id, session };
      }
    }
    return null;
  }, [draft, pickerSessionId]);

  const saveDraft = useCallback(async () => {
    if (!db || !draft) return;

    const trimmedName = draft.name.trim();
    if (!trimmedName) {
      Alert.alert('Plan name required', 'Give this imported plan a name before saving.');
      return;
    }

    const cleanedDays = draft.days.map((day) => ({
      ...day,
      date: day.date.trim(),
      title: day.title.trim() || day.date.trim(),
      priorities: textareaToList(day.mustDoText),
    }));

    const duplicateDates = new Set<string>();
    const seenDates = new Set<string>();
    for (const day of cleanedDays) {
      if (!isValidDate(day.date)) {
        Alert.alert('Invalid date', `Fix the date for "${day.title}" before saving.`);
        return;
      }
      if (seenDates.has(day.date)) duplicateDates.add(day.date);
      seenDates.add(day.date);

      for (const session of day.sessions) {
        if (!isValidTime(session.scheduledTime)) {
          Alert.alert('Invalid session time', `Use HH:MM for "${session.routineName}" on ${day.date}, or leave it blank.`);
          return;
        }
      }
    }

    if (duplicateDates.size > 0) {
      Alert.alert('Duplicate dates', 'Each imported day needs its own unique date.');
      return;
    }

    const orderedDays = [...cleanedDays].sort((left, right) => left.date.localeCompare(right.date));

    setSaving(true);
    try {
      await updateCsvPlan(db, draft.csvPlanId, {
        name: trimmedName,
        description: draft.description.trim(),
      });

      if (draft.planId) {
        await updatePlan(db, draft.planId, {
          name: trimmedName,
          startDate: orderedDays[0]?.date,
          endDate: orderedDays[orderedDays.length - 1]?.date,
          totalDays: orderedDays.length,
        });
      }

      for (let index = 0; index < orderedDays.length; index += 1) {
        const day = orderedDays[index];
        const mustDoDone = day.mustDoDone.slice(0, day.priorities.length);
        while (mustDoDone.length < day.priorities.length) mustDoDone.push(false);

        await updateDayPlan(db, day.id, {
          date: day.date,
          title: day.title,
          dayNumber: index + 1,
          totalDays: orderedDays.length,
          mustDo: day.priorities,
          mustDoDone,
        });

        for (const session of day.sessions) {
          await updateSession(db, session.id, {
            scheduledTime: session.scheduledTime.trim() || null,
            ...(session.routineId ? { routineId: session.routineId } : {}),
            routineName: session.routineName,
          });
        }
      }

      await loadData();
      Alert.alert('Imported plan updated', 'Planner dates, priorities, and sessions were saved.');
    } catch {
      Alert.alert('Could not save changes', 'Please try again.');
    } finally {
      setSaving(false);
    }
  }, [db, draft, loadData]);

  if (loading) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: themeTokens.background }]}>
        <ActivityIndicator color={themeTokens.accent} />
        <AppText variant="footnote" color={themeTokens.textSecondary}>
          Loading imported plan...
        </AppText>
      </View>
    );
  }

  if (!draft) {
    return (
      <View style={[styles.loadingWrap, { backgroundColor: themeTokens.background }]}>
        <Feather name="alert-circle" size={20} color={themeTokens.destructive} />
        <AppText variant="headline" style={{ fontWeight: '700' }}>
          Imported plan not found
        </AppText>
        <AppText variant="footnote" color={themeTokens.textSecondary} style={{ textAlign: 'center' }}>
          This plan may have been removed or is no longer linked to your current planner data.
        </AppText>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: themeTokens.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
      >
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <AppText variant="title1" style={{ fontWeight: '700' }}>
              Imported Plan
            </AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              Tighten the imported structure instead of re-importing from scratch.
            </AppText>
          </View>
          <View style={[styles.heroBadge, { backgroundColor: themeTokens.accentTint }]}>
            <AppText variant="caption1" color={themeTokens.accent} style={{ fontWeight: '700' }}>
              {draft.days.length} days
            </AppText>
          </View>
        </View>

        <View style={styles.summaryRow}>
          <View style={[styles.summaryCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
            <AppText variant="caption1" color={themeTokens.textSecondary}>
              Date Window
            </AppText>
            <AppText variant="headline" style={{ fontWeight: '700' }}>
              {formatDateRange(draft.days)}
            </AppText>
          </View>
          <View style={[styles.summaryCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
            <AppText variant="caption1" color={themeTokens.textSecondary}>
              Sessions
            </AppText>
            <AppText variant="headline" style={{ fontWeight: '700' }}>
              {totalSessionCount(draft.days)}
            </AppText>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
          <AppText variant="headline" style={{ fontWeight: '700' }}>
            Plan Details
          </AppText>
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            Keep the framing direct: clean title, clear date window, no dead weight.
          </AppText>

          <View style={styles.fieldGroup}>
            <AppText variant="caption1" color={themeTokens.textTertiary}>
              PLAN NAME
            </AppText>
            <TextInput
              style={[styles.input, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border, color: themeTokens.textPrimary }]}
              value={draft.name}
              onChangeText={(value) => setDraft((current) => (current ? { ...current, name: value } : current))}
              placeholder="Plan name"
              placeholderTextColor={themeTokens.textTertiary}
            />
          </View>

          <View style={styles.fieldGroup}>
            <AppText variant="caption1" color={themeTokens.textTertiary}>
              DESCRIPTION
            </AppText>
            <TextInput
              style={[
                styles.input,
                styles.notesInput,
                { backgroundColor: themeTokens.surface, borderColor: themeTokens.border, color: themeTokens.textPrimary },
              ]}
              value={draft.description}
              onChangeText={(value) => setDraft((current) => (current ? { ...current, description: value } : current))}
              placeholder="Optional context for the import"
              placeholderTextColor={themeTokens.textTertiary}
              multiline
              textAlignVertical="top"
            />
          </View>

          <AppText variant="footnote" color={themeTokens.textSecondary}>
            Imported on {new Date(draft.uploadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </AppText>
        </View>

        <View style={styles.sectionHeader}>
          <View style={{ flex: 1, gap: space[4] }}>
            <AppText variant="headline" style={{ fontWeight: '700' }}>
              Days
            </AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              Adjust dates, titles, top priorities, and session assignment directly here.
            </AppText>
          </View>
        </View>

        {draft.days.map((day, index) => (
          <View
            key={day.id}
            style={[styles.card, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}
          >
            <View style={styles.dayHeader}>
              <View style={{ flex: 1, gap: space[4] }}>
                <AppText variant="headline" style={{ fontWeight: '700' }}>
                  Day {index + 1}
                </AppText>
                <AppText variant="footnote" color={themeTokens.textSecondary}>
                  Edit the date and priorities, then tighten any linked sessions below.
                </AppText>
              </View>
              <View style={[styles.dayBadge, { backgroundColor: themeTokens.accentTint }]}>
                <AppText variant="caption2" color={themeTokens.accent} style={{ fontWeight: '700' }}>
                  {day.sessions.length} sessions
                </AppText>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <AppText variant="caption1" color={themeTokens.textTertiary}>
                DATE
              </AppText>
              <TextInput
                style={[styles.input, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border, color: themeTokens.textPrimary }]}
                value={day.date}
                onChangeText={(value) =>
                  updateDayDraft(day.id, (current) => ({ ...current, date: normalizeDateInput(value) }))
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor={themeTokens.textTertiary}
              />
              {!isValidDate(day.date) ? (
                <AppText variant="footnote" color={themeTokens.destructive}>
                  Use a real YYYY-MM-DD date so the planner window stays consistent.
                </AppText>
              ) : null}
            </View>

            <View style={styles.fieldGroup}>
              <AppText variant="caption1" color={themeTokens.textTertiary}>
                TITLE
              </AppText>
              <TextInput
                style={[styles.input, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border, color: themeTokens.textPrimary }]}
                value={day.title}
                onChangeText={(value) => updateDayDraft(day.id, (current) => ({ ...current, title: value }))}
                placeholder="Day title"
                placeholderTextColor={themeTokens.textTertiary}
              />
            </View>

            <View style={styles.fieldGroup}>
              <AppText variant="caption1" color={themeTokens.textTertiary}>
                TOP PRIORITIES
              </AppText>
              <TextInput
                style={[
                  styles.input,
                  styles.notesInput,
                  { backgroundColor: themeTokens.surface, borderColor: themeTokens.border, color: themeTokens.textPrimary },
                ]}
                value={day.mustDoText}
                onChangeText={(value) => updateDayDraft(day.id, (current) => ({ ...current, mustDoText: value }))}
                placeholder={'One priority per line'}
                placeholderTextColor={themeTokens.textTertiary}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.sessionList}>
              {day.sessions.map((session) => (
                <View
                  key={session.id}
                  style={[styles.sessionCard, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}
                >
                  <View style={styles.sessionRow}>
                    <View style={{ flex: 1, gap: space[4] }}>
                      <AppText variant="body" style={{ fontWeight: '600' }}>
                        {session.routineName}
                      </AppText>
                      <AppText variant="footnote" color={themeTokens.textSecondary}>
                        {session.status === 'completed' ? 'Completed session' : 'Planned session'}
                      </AppText>
                    </View>
                    <Pressable
                      style={[styles.templateButton, { borderColor: themeTokens.border }]}
                      onPress={() => setPickerSessionId(session.id)}
                    >
                      <AppText variant="caption1" style={{ fontWeight: '700' }}>
                        Change Template
                      </AppText>
                    </Pressable>
                  </View>

                  <View style={styles.fieldGroup}>
                    <AppText variant="caption2" color={themeTokens.textTertiary}>
                      TIME
                    </AppText>
                    <TextInput
                      style={[styles.input, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border, color: themeTokens.textPrimary }]}
                      value={session.scheduledTime}
                      onChangeText={(value) =>
                        updateSessionDraft(day.id, session.id, (current) => ({
                          ...current,
                          scheduledTime: normalizeTimeInput(value),
                        }))
                      }
                      placeholder="HH:MM or blank"
                      placeholderTextColor={themeTokens.textTertiary}
                    />
                    {!isValidTime(session.scheduledTime) ? (
                      <AppText variant="footnote" color={themeTokens.destructive}>
                        Use HH:MM, or leave the field blank.
                      </AppText>
                    ) : null}
                  </View>
                </View>
              ))}

              {day.sessions.length === 0 ? (
                <View style={styles.emptySessions}>
                  <Feather name="calendar" size={14} color={themeTokens.textTertiary} />
                  <AppText variant="footnote" color={themeTokens.textSecondary}>
                    No imported sessions on this day.
                  </AppText>
                </View>
              ) : null}
            </View>
          </View>
        ))}

        <Pressable
          style={[
            styles.saveButton,
            { backgroundColor: themeTokens.accent },
            saving ? { opacity: 0.6 } : null,
          ]}
          onPress={saveDraft}
          disabled={saving}
        >
          <AppText variant="headline" onAccent style={{ fontWeight: '700' }}>
            {saving ? 'Saving...' : 'Save Imported Plan'}
          </AppText>
        </Pressable>
      </ScrollView>

      <SessionTemplatePicker
        visible={!!selectedSession}
        sessionName={selectedSession?.session.routineName ?? ''}
        routines={routines}
        onClose={() => setPickerSessionId(null)}
        onSelect={(routine) => {
          if (!selectedSession) return;
          updateSessionDraft(selectedSession.dayId, selectedSession.session.id, (current) => ({
            ...current,
            routineId: routine.id,
            routineName: routine.name,
          }));
          setPickerSessionId(null);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    padding: space[16],
    paddingBottom: space[32],
    gap: space[16],
  },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[8],
    paddingHorizontal: space[24],
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[12],
  },
  heroCopy: {
    flex: 1,
    gap: space[4],
  },
  heroBadge: {
    borderRadius: radius.full,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
  },
  summaryRow: {
    flexDirection: 'row',
    gap: space[8],
  },
  summaryCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[12],
    gap: space[4],
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[16],
    gap: space[12],
  },
  sectionHeader: {
    marginTop: space[8],
  },
  fieldGroup: {
    gap: space[8],
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space[12],
    paddingVertical: space[12],
    fontSize: 16,
  },
  notesInput: {
    minHeight: 92,
  },
  dayHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[12],
  },
  dayBadge: {
    borderRadius: radius.full,
    paddingHorizontal: space[12],
    paddingVertical: space[4],
  },
  sessionList: {
    gap: space[8],
  },
  sessionCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space[12],
    gap: space[8],
  },
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[12],
  },
  templateButton: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
  },
  emptySessions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    paddingVertical: space[4],
  },
  saveButton: {
    borderRadius: radius.xl,
    paddingVertical: space[16],
    alignItems: 'center',
    marginTop: space[8],
  },
  pickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  pickerSheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: space[16],
    paddingTop: space[12],
    paddingBottom: space[24],
    maxHeight: '80%',
  },
  pickerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: space[16],
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    marginBottom: space[12],
  },
  pickerList: {
    gap: space[8],
  },
  pickerRow: {
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space[12],
    paddingVertical: space[12],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
  },
});
