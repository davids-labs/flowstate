import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  createSession,
  getDayPlan,
  getRoutineBlocks,
  getRoutines,
  updateSession,
  upsertDayPlan,
} from '@flowstate/core';
import { AppText } from '../primitives/Text';
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

type RoutineCard = {
  id: string;
  name: string;
  totalDurationMinutes?: number | null;
  pillar?: string | null;
  archivedAt?: string | null;
  blockCount: number;
  blockPreview: string[];
};

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

function roundedNowTime() {
  const now = new Date();
  const minutes = now.getMinutes();
  const rounded = Math.ceil(minutes / 5) * 5;
  if (rounded === 60) {
    now.setHours(now.getHours() + 1);
    now.setMinutes(0);
  } else {
    now.setMinutes(rounded);
  }
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
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
  const [routines, setRoutines] = useState<RoutineCard[]>([]);
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
      .then(async (rows) => {
        const availableRoutines = (rows as any[]).filter((routine) => !routine.archivedAt);
        const enriched = await Promise.all(
          availableRoutines.map(async (routine) => {
            const blocks = await getRoutineBlocks(db, routine.id).catch(() => []);
            return {
              id: routine.id,
              name: routine.name,
              totalDurationMinutes: routine.totalDurationMinutes,
              pillar: routine.pillar ?? 'general',
              archivedAt: routine.archivedAt ?? null,
              blockCount: blocks.length,
              blockPreview: blocks.slice(0, 3).map((block: any) => block.name),
            } as RoutineCard;
          }),
        );
        setRoutines(enriched);

        if (!initialSession?.routineId && initialSession?.routineName) {
          const matchingRoutine = enriched.find(
            (routine) => routine.name.toLowerCase() === initialSession.routineName.toLowerCase(),
          );
          if (matchingRoutine) setSelectedRoutineId(matchingRoutine.id);
        }
      })
      .finally(() => setLoading(false));
  }, [visible, db, isReady, initialSession?.routineId, initialSession?.routineName]);

  useEffect(() => {
    if (!visible) return;
    setSelectedRoutineId(initialSession?.routineId ?? null);
    setScheduledTime(initialSession?.scheduledTime ?? '09:00');
  }, [visible, initialSession]);

  async function save() {
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
  }

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
              <AppText variant="title3" style={{ fontWeight: '800' }}>
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
              <View style={[styles.heroCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
                <View style={styles.heroCopy}>
                  <AppText variant="caption1" color={themeTokens.textSecondary} style={styles.kicker}>
                    SESSION BUILDER
                  </AppText>
                  <AppText variant="headline" style={{ fontWeight: '700' }}>
                    {selectedRoutine ? selectedRoutine.name : 'Choose a session template'}
                  </AppText>
                  <AppText variant="footnote" color={themeTokens.textSecondary}>
                    {selectedRoutine
                      ? `${selectedRoutine.blockCount || 1} blocks · ${selectedRoutine.totalDurationMinutes ?? 0} min total`
                      : 'Pick a template first, then set when it should land in the day.'}
                  </AppText>
                </View>
                <View style={[styles.heroTimeBadge, { backgroundColor: themeTokens.accentTint }]}>
                  <AppText variant="caption1" color={themeTokens.accent} style={{ fontWeight: '700' }}>
                    {scheduledTime || 'Flexible'}
                  </AppText>
                </View>
              </View>

              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionCopy}>
                    <AppText variant="headline" style={{ fontWeight: '700' }}>
                      Template
                    </AppText>
                    <AppText variant="footnote" color={themeTokens.textSecondary}>
                      Pick the session structure you want to drop into the planner.
                    </AppText>
                  </View>
                  {routines.length === 0 ? (
                    <Pressable style={[styles.smallButton, { borderColor: themeTokens.border }]} onPress={() => router.push('/routines/create')}>
                      <AppText variant="caption1" style={{ fontWeight: '700' }}>
                        New template
                      </AppText>
                    </Pressable>
                  ) : null}
                </View>

                {routines.length === 0 ? (
                  <View style={[styles.emptyCard, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}>
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
                      <AppText variant="caption1" style={{ fontWeight: '700' }}>
                        Create Session Template
                      </AppText>
                    </Pressable>
                  </View>
                ) : (
                  <View style={styles.templateList}>
                    {routines.map((routine) => {
                      const selected = selectedRoutineId === routine.id;
                      return (
                        <Pressable
                          key={routine.id}
                          style={[
                            styles.templateCard,
                            {
                              backgroundColor: selected ? themeTokens.accentTint : themeTokens.surfaceElevated,
                              borderColor: selected ? themeTokens.accent : themeTokens.border,
                            },
                          ]}
                          onPress={() => setSelectedRoutineId(routine.id)}
                        >
                          <View style={styles.templateTop}>
                            <AppText variant="headline" style={{ fontWeight: '700' }} numberOfLines={1}>
                              {routine.name}
                            </AppText>
                            {selected ? <Feather name="check-circle" size={16} color={themeTokens.accent} /> : null}
                          </View>
                          <AppText variant="footnote" color={themeTokens.textSecondary}>
                            {routine.totalDurationMinutes ?? 0} min · {routine.blockCount || 1} blocks
                          </AppText>
                          {routine.blockPreview.length > 0 ? (
                            <AppText variant="caption1" color={themeTokens.textSecondary} numberOfLines={2}>
                              {routine.blockPreview.join(' · ')}
                            </AppText>
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={styles.sectionBlock}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionCopy}>
                    <AppText variant="headline" style={{ fontWeight: '700' }}>
                      Timing
                    </AppText>
                    <AppText variant="footnote" color={themeTokens.textSecondary}>
                      Use a quick preset or type an exact start time. Leave it blank for a flexible session.
                    </AppText>
                  </View>
                </View>

                <View style={styles.quickTimeRow}>
                  {[
                    { label: 'Now', value: roundedNowTime() },
                    { label: '07:30', value: '07:30' },
                    { label: '09:00', value: '09:00' },
                    { label: '12:00', value: '12:00' },
                    { label: '18:00', value: '18:00' },
                    { label: 'Flexible', value: '' },
                  ].map((preset) => {
                    const active = scheduledTime === preset.value;
                    return (
                      <Pressable
                        key={preset.label}
                        style={[
                          styles.quickTimeChip,
                          {
                            backgroundColor: active ? themeTokens.accent : themeTokens.surface,
                            borderColor: active ? themeTokens.accent : themeTokens.border,
                          },
                        ]}
                        onPress={() => setScheduledTime(preset.value)}
                      >
                        <AppText variant="caption1" color={active ? '#fff' : themeTokens.textSecondary} style={{ fontWeight: '700' }}>
                          {preset.label}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>

                <TextInput
                  value={scheduledTime}
                  onChangeText={(value) => setScheduledTime(normalizeTimeInput(value))}
                  placeholder="09:00"
                  placeholderTextColor={themeTokens.textTertiary}
                  style={[
                    styles.timeInput,
                    {
                      backgroundColor: themeTokens.surface,
                      borderColor: isValidTime(scheduledTime) ? themeTokens.border : themeTokens.destructive,
                      color: themeTokens.textPrimary,
                    },
                  ]}
                />
                {!isValidTime(scheduledTime) ? (
                  <AppText variant="caption1" color={themeTokens.destructive}>
                    Use HH:MM, or clear the field to keep the session flexible.
                  </AppText>
                ) : null}
              </View>

              <Pressable
                style={[
                  styles.primaryButton,
                  { backgroundColor: themeTokens.accent },
                  saveDisabled ? { opacity: 0.5 } : null,
                ]}
                onPress={save}
                disabled={saveDisabled}
              >
                <Feather name="calendar" size={16} color="#fff" />
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
    maxHeight: '88%',
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
    gap: 4,
  },
  loadingWrap: {
    paddingVertical: space[24],
    alignItems: 'center',
  },
  scrollContent: {
    gap: space[20],
    paddingBottom: space[16],
  },
  heroCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[16],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    letterSpacing: 0.7,
    fontWeight: '700',
  },
  heroTimeBadge: {
    borderRadius: radius.full,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
  },
  sectionBlock: {
    gap: space[12],
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[12],
  },
  sectionCopy: {
    flex: 1,
    gap: 4,
  },
  smallButton: {
    minHeight: 36,
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space[12],
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space[16],
    gap: 4,
  },
  templateList: {
    gap: space[10],
  },
  templateCard: {
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: space[14],
    gap: 6,
  },
  templateTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[8],
  },
  quickTimeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[8],
  },
  quickTimeChip: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: space[12],
    paddingVertical: space[8],
  },
  timeInput: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space[12],
    fontSize: 16,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  secondaryButton: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: space[12],
    paddingVertical: space[10],
    marginTop: space[12],
    alignSelf: 'flex-start',
  },
});

export default PlannerSessionSheet;
