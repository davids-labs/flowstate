import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  createSession,
  getDayPlan,
  getRoutines,
  updateSession,
  upsertDayPlan,
} from '@flowstate/core';
import { AppText } from '../primitives/Text';
import { FormCard, FormChip, FormSection, FormTextField } from '../primitives/Form';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';
import { useDatabaseSafe } from '../DatabaseProvider';

interface PlannerSessionSheetProps {
  visible: boolean;
  date: string;
  initialSession?: {
    id: string;
    routineId: string | null;
    routineName: string;
    scheduledTime: string | null;
  } | null;
  onClose: () => void;
  onSaved: () => void;
}

function normalizeTimeInput(value: string): string {
  return value.replace(/[^0-9:]/g, '').slice(0, 5);
}

function isValidTime(value: string): boolean {
  if (!value.trim()) return true;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value.trim());
}

function fallbackDayTitle(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

export function PlannerSessionSheet({
  visible,
  date,
  initialSession,
  onClose,
  onSaved,
}: PlannerSessionSheetProps) {
  const router = useRouter();
  const { themeTokens } = useTheme();
  const { db, isReady } = useDatabaseSafe();
  const [routines, setRoutines] = useState<any[]>([]);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedRoutine = useMemo(
    () => routines.find((routine) => routine.id === selectedRoutineId) ?? null,
    [routines, selectedRoutineId],
  );

  useEffect(() => {
    if (!visible || !db || !isReady) return;
    setLoading(true);
    getRoutines(db)
      .then((rows) => {
        const availableRoutines = (rows as any[]).filter((routine) => !routine.archivedAt);
        setRoutines(availableRoutines);

        if (!initialSession?.routineId && initialSession?.routineName) {
          const matchingRoutine = availableRoutines.find(
            (routine) => routine.name.toLowerCase() === initialSession.routineName.toLowerCase(),
          );
          if (matchingRoutine) {
            setSelectedRoutineId(matchingRoutine.id);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [visible, db, isReady, initialSession?.routineId, initialSession?.routineName]);

  useEffect(() => {
    if (!visible) return;
    setSelectedRoutineId(initialSession?.routineId ?? null);
    setScheduledTime(initialSession?.scheduledTime ?? '09:00');
  }, [visible, initialSession]);

  const save = useCallback(async () => {
    if (!db || !isReady) return;
    if (!selectedRoutine && !initialSession) return;
    if (!isValidTime(scheduledTime)) return;

    setSaving(true);
    try {
      if (initialSession?.id) {
        await updateSession(db, initialSession.id, {
          ...(selectedRoutineId ?? initialSession.routineId
            ? { routineId: selectedRoutineId ?? initialSession.routineId ?? undefined }
            : {}),
          routineName: selectedRoutine?.name ?? initialSession.routineName,
          scheduledTime: scheduledTime || null,
        });
      } else {
        let dayPlan = await getDayPlan(db, date);
        if (!dayPlan) {
          await upsertDayPlan(db, {
            date,
            title: fallbackDayTitle(date),
            mustDo: [],
            mustDoDone: [],
            moduleIds: [],
          });
          dayPlan = await getDayPlan(db, date);
        }

        if (!dayPlan || !selectedRoutine) return;

        await createSession(db, {
          dayPlanId: dayPlan.id,
          routineId: selectedRoutine.id,
          routineName: selectedRoutine.name,
          scheduledTime: scheduledTime || undefined,
          csvPlanId: (dayPlan as any).csvPlanId ?? undefined,
          pillar: selectedRoutine.pillar ?? 'general',
        });
      }

      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }, [db, isReady, initialSession, selectedRoutineId, selectedRoutine, scheduledTime, date, onSaved, onClose]);

  const saveDisabled = (!initialSession && !selectedRoutine) || saving || !isValidTime(scheduledTime);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: themeTokens.background, borderColor: themeTokens.border }]}>
          <View style={[styles.handle, { backgroundColor: themeTokens.border }]} />
          <View style={styles.header}>
            <View style={styles.headerText}>
              <AppText variant="title3" style={{ fontWeight: '700' }}>
                {initialSession ? 'Edit Session' : 'Add Session'}
              </AppText>
              <AppText variant="footnote" color={themeTokens.textSecondary}>
                {fallbackDayTitle(date)}
              </AppText>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Feather name="x" size={18} color={themeTokens.textSecondary} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={themeTokens.accent} />
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
              <FormCard>
                <FormSection
                  eyebrow="Session Template"
                  title="Pick the structure"
                  description="Choose the session template you want to place in the planner."
                >
                  {routines.length === 0 ? (
                    <View
                      style={[
                        styles.emptyCard,
                        { backgroundColor: themeTokens.surface, borderColor: themeTokens.border },
                      ]}
                    >
                      <AppText variant="body" style={{ fontWeight: '600' }}>
                        No session templates yet
                      </AppText>
                      <AppText variant="footnote" color={themeTokens.textSecondary}>
                        Create one in Setup, then come back here to schedule it.
                      </AppText>
                      <Pressable
                        style={[styles.secondaryButton, { borderColor: themeTokens.border }]}
                        onPress={() => router.push('/routines/create')}
                      >
                        <AppText variant="footnote" style={{ fontWeight: '600' }}>
                          Create Session Template
                        </AppText>
                      </Pressable>
                    </View>
                  ) : (
                    <View style={styles.optionList}>
                      {routines.map((routine) => (
                        <FormChip
                          key={routine.id}
                          label={`${routine.name} · ${routine.totalDurationMinutes ?? 0}m`}
                          selected={selectedRoutineId === routine.id}
                          onPress={() => setSelectedRoutineId(routine.id)}
                        />
                      ))}
                    </View>
                  )}
                </FormSection>
              </FormCard>

              <FormCard>
                <FormSection
                  eyebrow="Timing"
                  title="Give it a start time"
                  description="Leave it blank if you want the session in the day without pinning it to a specific slot."
                >
                  <FormTextField
                    label="Start time"
                    value={scheduledTime}
                    onChangeText={(value) => setScheduledTime(normalizeTimeInput(value))}
                    placeholder="09:00"
                    autoCapitalize="none"
                    autoCorrect={false}
                    error={isValidTime(scheduledTime) ? null : 'Use HH:MM, or leave it blank.'}
                  />
                </FormSection>
              </FormCard>

              <Pressable
                style={[
                  styles.primaryButton,
                  { backgroundColor: themeTokens.accent },
                  saveDisabled ? { opacity: 0.5 } : null,
                ]}
                onPress={save}
                disabled={saveDisabled}
              >
                <AppText variant="headline" onAccent style={{ fontWeight: '700' }}>
                  {saving ? 'Saving...' : initialSession ? 'Save Session' : 'Add Session'}
                </AppText>
              </Pressable>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingHorizontal: space[16],
    paddingTop: space[12],
    paddingBottom: space[24],
    maxHeight: '85%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: space[16],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: space[8],
  },
  headerText: {
    flex: 1,
    gap: space[4],
  },
  loadingWrap: {
    paddingVertical: space[24],
    alignItems: 'center',
  },
  scrollContent: {
    gap: space[16],
    paddingBottom: space[16],
  },
  optionList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[8],
  },
  primaryButton: {
    borderRadius: radius.lg,
    paddingVertical: space[16],
    alignItems: 'center',
    marginTop: space[20],
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
    marginTop: space[12],
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space[16],
    gap: space[4],
  },
});

export default PlannerSessionSheet;
