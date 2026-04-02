/**
 * Academic Grade Tracker — V2 spec §9.4
 *
 * Course cards: name · weighted average badge · target · forecast badge.
 * Tap to expand inline component editor.
 * Forecast badge: accent (achievable) or warning (needs >100%).
 * '+ New Course' dashed row at bottom.
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { space, radius } from '../../../constants/theme';
import { useTheme } from '../../../constants/ThemeContext';
import { AppText } from '../../../components/primitives/Text';
import { useDatabaseSafe } from '../../../components/DatabaseProvider';
import {
  getCourses,
  getCourseComponents,
  createCourse,
  updateCourse,
  deleteCourse,
  upsertCourseComponent,
  deleteCourseComponent,
  computeWeightedGrade,
} from '@flowstate/core';

interface Course {
  id: string;
  name: string;
  targetGrade?: number | null;
}
interface Component {
  id: string;
  courseId: string;
  name: string;
  weight: number;
  receivedGrade: number | null;
}

function forecastNeeded(comps: Component[], target: number): number | null {
  if (!comps.length) return null;
  let earned = 0;
  let pending = 0;
  for (const c of comps) {
    if (c.receivedGrade !== null) {
      earned += (c.receivedGrade / 100) * c.weight;
    } else {
      pending += c.weight;
    }
  }
  if (pending === 0) return null;
  return ((target - earned) / pending) * 100;
}

function gradeColor(g: number | null, fallback: string): string {
  if (g === null) return '#888';
  if (g >= 85) return '#22c55e';
  if (g >= 70) return '#f59e0b';
  return '#ef4444';
}

// ─── Add / Edit Course modal ──────────────────────────────────────────────────
function CourseModal({
  visible,
  initial,
  onSave,
  onClose,
}: {
  visible: boolean;
  initial?: Course | null;
  onSave: (name: string, target: string) => void;
  onClose: () => void;
}) {
  const { themeTokens } = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [target, setTarget] = useState(
    initial?.targetGrade != null ? String(initial.targetGrade) : '',
  );

  React.useEffect(() => {
    setName(initial?.name ?? '');
    setTarget(initial?.targetGrade != null ? String(initial.targetGrade) : '');
  }, [initial, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <View
          style={[
            CM.sheet,
            {
              backgroundColor: themeTokens.background,
              borderColor: themeTokens.border,
            },
          ]}
        >
          <View style={CM.handle} />
          <AppText
            variant="title3"
            style={{ fontWeight: '700', marginBottom: space[20] }}
          >
            {initial ? 'Edit Course' : 'New Course'}
          </AppText>

          <AppText
            variant="caption1"
            color={themeTokens.textTertiary}
            style={{ marginBottom: space[4] }}
          >
            COURSE NAME
          </AppText>
          <TextInput
            style={[
              CM.input,
              {
                backgroundColor: themeTokens.surface,
                borderColor: themeTokens.border,
                color: themeTokens.textPrimary,
              },
            ]}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Calculus I"
            placeholderTextColor={themeTokens.textTertiary}
            autoFocus
          />

          <AppText
            variant="caption1"
            color={themeTokens.textTertiary}
            style={{ marginTop: space[16], marginBottom: space[4] }}
          >
            TARGET GRADE (%)
          </AppText>
          <TextInput
            style={[
              CM.input,
              {
                backgroundColor: themeTokens.surface,
                borderColor: themeTokens.border,
                color: themeTokens.textPrimary,
              },
            ]}
            value={target}
            onChangeText={setTarget}
            keyboardType="decimal-pad"
            placeholder="80"
            placeholderTextColor={themeTokens.textTertiary}
          />

          <View
            style={{ flexDirection: 'row', gap: space[12], marginTop: space[24] }}
          >
            <Pressable
              style={[CM.btn, { backgroundColor: themeTokens.surface, flex: 1 }]}
              onPress={onClose}
            >
              <AppText
                variant="headline"
                style={{ fontWeight: '600', color: themeTokens.textSecondary }}
              >
                Cancel
              </AppText>
            </Pressable>
            <Pressable
              style={[CM.btn, { backgroundColor: themeTokens.accent, flex: 2 }]}
              onPress={() => name.trim() && onSave(name.trim(), target)}
            >
              <AppText
                variant="headline"
                style={{ fontWeight: '600', color: '#fff' }}
              >
                Save
              </AppText>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const CM = StyleSheet.create({
  sheet: {
    borderRadius: radius.xl,
    borderWidth: 1,
    margin: space[16],
    padding: space[24],
    paddingBottom: space[32],
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    alignSelf: 'center',
    marginBottom: space[20],
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space[12],
    fontSize: 17,
  },
  btn: {
    borderRadius: radius.md,
    padding: space[16],
    alignItems: 'center',
  },
});

// ─── Course card ──────────────────────────────────────────────────────────────
function CourseCard({
  course,
  comps,
  expanded,
  onToggle,
  onAddComp,
  onUpdateComp,
  onSaveComp,
  onDeleteComp,
  onEdit,
  onDelete,
}: {
  course: Course;
  comps: Component[];
  expanded: boolean;
  onToggle: () => void;
  onAddComp: () => void;
  /** Local state update only — called on every keystroke. No DB write. */
  onUpdateComp: (id: string, grade: string) => void;
  /** DB write — called only on blur/onEndEditing to avoid hammering the DB. */
  onSaveComp: (id: string, grade: string) => void;
  onDeleteComp: (id: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { themeTokens } = useTheme();
  const weightedAvg =
    comps.length > 0 ? (computeWeightedGrade(comps as any) as number | null) : null;
  const forecast =
    course.targetGrade != null
      ? forecastNeeded(comps, course.targetGrade)
      : null;
  const forecastOk = forecast !== null && forecast <= (course.targetGrade ?? 100);

  return (
    <View
      style={[
        CC.card,
        {
          backgroundColor: themeTokens.surfaceElevated,
          borderColor: themeTokens.border,
        },
      ]}
    >
      <Pressable style={CC.header} onPress={onToggle}>
        <View style={{ flex: 1 }}>
          <AppText variant="headline" style={{ fontWeight: '600' }}>
            {course.name}
          </AppText>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: space[8],
              marginTop: space[4],
              flexWrap: 'wrap',
            }}
          >
            {weightedAvg !== null && (
              <View
                style={[
                  CC.pill,
                  {
                    backgroundColor:
                      gradeColor(weightedAvg, themeTokens.accent) + '22',
                  },
                ]}
              >
                <AppText
                  variant="caption1"
                  style={{
                    fontWeight: '700',
                    color: gradeColor(weightedAvg, themeTokens.accent),
                  }}
                >
                  {Math.round(weightedAvg)}%
                </AppText>
              </View>
            )}
            {forecast !== null && (
              <View
                style={[
                  CC.pill,
                  {
                    backgroundColor: forecastOk
                      ? themeTokens.accent + '18'
                      : (themeTokens.warning ?? '#f59e0b') + '22',
                  },
                ]}
              >
                <AppText
                  variant="caption1"
                  style={{
                    fontWeight: '600',
                    color: forecastOk
                      ? themeTokens.accent
                      : themeTokens.warning ?? '#f59e0b',
                  }}
                >
                  Need {Math.round(forecast)}% on remaining
                </AppText>
              </View>
            )}
          </View>
        </View>
        <View
          style={{
            flexDirection: 'row',
            gap: space[16],
            alignItems: 'center',
          }}
        >
          <Pressable onPress={onEdit} hitSlop={12}>
            <Feather name="edit-2" size={16} color={themeTokens.textTertiary} />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={12}>
            <Feather
              name="trash-2"
              size={16}
              color={themeTokens.destructive ?? '#ef4444'}
            />
          </Pressable>
          <Feather
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={themeTokens.textTertiary}
          />
        </View>
      </Pressable>

      {expanded && (
        <View style={[CC.expanded, { borderTopColor: themeTokens.border }]}>
          {/* Column headers */}
          <View
            style={[
              CC.compHeader,
              { borderBottomColor: themeTokens.border },
            ]}
          >
            <AppText
              variant="caption1"
              color={themeTokens.textTertiary}
              style={{ flex: 2 }}
            >
              COMPONENT
            </AppText>
            <AppText
              variant="caption1"
              color={themeTokens.textTertiary}
              style={{ width: 48, textAlign: 'center' }}
            >
              WT%
            </AppText>
            <AppText
              variant="caption1"
              color={themeTokens.textTertiary}
              style={{ width: 72, textAlign: 'right' }}
            >
              GRADE
            </AppText>
          </View>

          {comps.map((c) => (
            <View
              key={c.id}
              style={[
                CC.compRow,
                { borderBottomColor: themeTokens.border },
              ]}
            >
              <AppText
                variant="subheadline"
                style={{ flex: 2 }}
                numberOfLines={1}
              >
                {c.name}
              </AppText>
              <AppText
                variant="footnote"
                color={themeTokens.textSecondary}
                style={{ width: 48, textAlign: 'center' }}
              >
                {c.weight}%
              </AppText>
              <View
                style={{
                  width: 72,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  gap: space[4],
                }}
              >
                <TextInput
                  style={[
                    CC.gradeInput,
                    {
                      color:
                        c.receivedGrade !== null
                          ? gradeColor(c.receivedGrade, themeTokens.accent)
                          : themeTokens.textTertiary,
                      borderColor: themeTokens.border,
                      backgroundColor: themeTokens.surface,
                    },
                  ]}
                  value={c.receivedGrade !== null ? String(c.receivedGrade) : ''}
                  onChangeText={(v) => onUpdateComp(c.id, v)}
                  onEndEditing={(e) => onSaveComp(c.id, e.nativeEvent.text)}
                  keyboardType="decimal-pad"
                  placeholder="—"
                  placeholderTextColor={themeTokens.textTertiary}
                />
                <Pressable onPress={() => onDeleteComp(c.id)} hitSlop={8}>
                  <Feather name="x" size={14} color={themeTokens.textTertiary} />
                </Pressable>
              </View>
            </View>
          ))}

          <Pressable
            style={[CC.addComp, { borderTopColor: themeTokens.border }]}
            onPress={onAddComp}
          >
            <Feather name="plus" size={14} color={themeTokens.accent} />
            <AppText variant="caption1" color={themeTokens.accent}>
              Add component
            </AppText>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const CC = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: space[12],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space[16],
  },
  pill: {
    paddingHorizontal: space[8],
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  expanded: { borderTopWidth: StyleSheet.hairlineWidth },
  compHeader: {
    flexDirection: 'row',
    paddingHorizontal: space[16],
    paddingVertical: space[8],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[16],
    paddingVertical: space[12],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  gradeInput: {
    width: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingVertical: space[4],
    paddingHorizontal: space[8],
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  addComp: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    padding: space[12],
    paddingHorizontal: space[16],
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function GradesScreen() {
  const { themeTokens } = useTheme();
  const router = useRouter();
  const { db } = useDatabaseSafe();
  const insets = useSafeAreaInsets();

  const [courses, setCourses] = useState<Course[]>([]);
  const [components, setComponents] = useState<Record<string, Component[]>>({});
  // Always-fresh ref so handleSaveComp never closes over stale components state.
  const componentsRef = useRef<Record<string, Component[]>>({});
  useEffect(() => { componentsRef.current = components; }, [components]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [addCompCourseId, setAddCompCourseId] = useState<string | null>(null);
  const [compName, setCompName] = useState('');
  const [compWeight, setCompWeight] = useState('');
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const load = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const cs = await getCourses(db);
      setCourses(cs as Course[]);
      const compMap: Record<string, Component[]> = {};
      for (const c of cs as any[]) {
        compMap[c.id] = (await getCourseComponents(db, c.id)) as Component[];
      }
      setComponents(compMap);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const handleSaveCourse = async (name: string, target: string) => {
    if (!db) return;
    try {
      if (editingCourse) {
        await updateCourse(db, editingCourse.id, {
          name,
          targetGrade: target ? parseFloat(target) : null,
        });
      } else {
        await createCourse(db, {
          name,
          targetGrade: target ? parseFloat(target) : undefined,
        });
      }
      setShowCourseModal(false);
      setEditingCourse(null);
      await load();
    } catch {
      // ignore
    }
  };

  const handleDeleteCourse = (id: string, name: string) => {
    Alert.alert(
      'Delete Course',
      `Delete "${name}"? This will also remove all grade components.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (db) {
              await deleteCourse(db, id);
              await load();
            }
          },
        },
      ],
    );
  };

  const handleAddComp = async (courseId: string) => {
    if (!db || !compName.trim() || !compWeight.trim()) return;
    const id = `${courseId}_${Date.now()}`;
    await upsertCourseComponent(db, {
      id,
      courseId,
      name: compName.trim(),
      weight: parseFloat(compWeight),
      receivedGrade: null,
    });
    setCompName('');
    setCompWeight('');
    setAddCompCourseId(null);
    await load();
  };

  // Local-state-only update — called on every keystroke. No DB write.
  const handleUpdateComp = useCallback((id: string, gradeStr: string) => {
    const g = gradeStr === '' ? null : parseFloat(gradeStr);
    const grade = g === null || isNaN(g) ? null : g;
    setComponents((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(next)) {
        next[key] = next[key].map((c) =>
          c.id === id ? { ...c, receivedGrade: grade } : c,
        );
      }
      return next;
    });
  }, []);

  // DB write — called only on blur (onEndEditing) to avoid hammering the DB on every keystroke.
  const handleSaveComp = useCallback(async (id: string, gradeStr: string) => {
    if (!db) return;
    const g = gradeStr === '' ? null : parseFloat(gradeStr);
    const grade = g === null || isNaN(g) ? null : g;
    // Read from ref so we always have the freshest component data.
    const comp = Object.values(componentsRef.current).flat().find((c) => c.id === id);
    if (!comp) return;
    await upsertCourseComponent(db, { ...comp, receivedGrade: grade }).catch(() => {});
  }, [db]);

  const handleDeleteComp = async (id: string) => {
    if (!db) return;
    await deleteCourseComponent(db, id).catch(() => {});
    await load();
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeTokens.background }}>
      {/* Header */}
      <View
        style={[
          HDR.wrap,
          {
            paddingTop: insets.top + space[8],
            backgroundColor: themeTokens.background,
            borderBottomColor: themeTokens.border,
          },
        ]}
      >
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/(tabs)')
          }
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color={themeTokens.textPrimary} />
        </Pressable>
        <AppText
          variant="title1"
          style={{ fontWeight: '700', flex: 1, marginLeft: space[12] }}
        >
          Grade Tracker
        </AppText>
        <Pressable
          onPress={() => {
            setEditingCourse(null);
            setShowCourseModal(true);
          }}
        >
          <View
            style={[HDR.addBtn, { backgroundColor: themeTokens.accent }]}
          >
            <Feather name="plus" size={18} color="#fff" />
          </View>
        </Pressable>
      </View>

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={themeTokens.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: space[16],
            paddingBottom: insets.bottom + 80,
          }}
          showsVerticalScrollIndicator={false}
        >
          {courses.length === 0 ? (
            <View
              style={[
                EMPTY.wrap,
                {
                  backgroundColor: themeTokens.surface,
                  borderColor: themeTokens.border,
                },
              ]}
            >
              <Feather name="book-open" size={28} color={themeTokens.textTertiary} />
              <AppText
                variant="body"
                color={themeTokens.textTertiary}
                style={{ textAlign: 'center', marginTop: space[8] }}
              >
                No courses yet.
              </AppText>
              <Pressable
                onPress={() => {
                  setEditingCourse(null);
                  setShowCourseModal(true);
                }}
              >
                <AppText
                  variant="footnote"
                  color={themeTokens.accent}
                  style={{ marginTop: space[8] }}
                >
                  + New Course
                </AppText>
              </Pressable>
            </View>
          ) : (
            courses.map((c) => (
              <View key={c.id}>
                <CourseCard
                  course={c}
                  comps={components[c.id] ?? []}
                  expanded={expandedId === c.id}
                  onToggle={() =>
                    setExpandedId((id) => (id === c.id ? null : c.id))
                  }
                  onAddComp={() => setAddCompCourseId(c.id)}
                  onUpdateComp={handleUpdateComp}
                  onSaveComp={handleSaveComp}
                  onDeleteComp={handleDeleteComp}
                  onEdit={() => {
                    setEditingCourse(c);
                    setShowCourseModal(true);
                  }}
                  onDelete={() => handleDeleteCourse(c.id, c.name)}
                />
                {/* Inline add-component form */}
                {addCompCourseId === c.id && (
                  <View
                    style={[
                      ACOMP.wrap,
                      {
                        backgroundColor: themeTokens.surfaceElevated,
                        borderColor: themeTokens.accent,
                        marginTop: -space[8],
                        marginBottom: space[12],
                      },
                    ]}
                  >
                    <TextInput
                      style={[
                        ACOMP.field,
                        {
                          color: themeTokens.textPrimary,
                          borderColor: themeTokens.border,
                          backgroundColor: themeTokens.surface,
                          flex: 2,
                        },
                      ]}
                      value={compName}
                      onChangeText={setCompName}
                      placeholder="Component name"
                      placeholderTextColor={themeTokens.textTertiary}
                      autoFocus
                    />
                    <TextInput
                      style={[
                        ACOMP.field,
                        {
                          color: themeTokens.textPrimary,
                          borderColor: themeTokens.border,
                          backgroundColor: themeTokens.surface,
                          width: 56,
                        },
                      ]}
                      value={compWeight}
                      onChangeText={setCompWeight}
                      keyboardType="decimal-pad"
                      placeholder="Wt%"
                      placeholderTextColor={themeTokens.textTertiary}
                    />
                    <Pressable
                      style={[
                        ACOMP.saveBtn,
                        { backgroundColor: themeTokens.accent },
                      ]}
                      onPress={() => handleAddComp(c.id)}
                    >
                      <Feather name="check" size={16} color="#fff" />
                    </Pressable>
                    <Pressable
                      onPress={() => setAddCompCourseId(null)}
                      hitSlop={12}
                    >
                      <Feather
                        name="x"
                        size={16}
                        color={themeTokens.textTertiary}
                      />
                    </Pressable>
                  </View>
                )}
              </View>
            ))
          )}

          {/* Add course dashed row */}
          {courses.length > 0 && (
            <Pressable
              style={[DASHED.row, { borderColor: themeTokens.border }]}
              onPress={() => {
                setEditingCourse(null);
                setShowCourseModal(true);
              }}
            >
              <Feather name="plus" size={14} color={themeTokens.textTertiary} />
              <AppText variant="caption1" color={themeTokens.textTertiary}>
                + New Course
              </AppText>
            </Pressable>
          )}
        </ScrollView>
      )}

      <CourseModal
        visible={showCourseModal}
        initial={editingCourse}
        onSave={handleSaveCourse}
        onClose={() => {
          setShowCourseModal(false);
          setEditingCourse(null);
        }}
      />
    </View>
  );
}

const HDR = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[16],
    paddingBottom: space[12],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
const EMPTY = StyleSheet.create({
  wrap: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    padding: space[24],
  },
});
const ACOMP = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    padding: space[12],
    borderRadius: radius.md,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  field: {
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: space[8],
    fontSize: 15,
  },
  saveBtn: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
const DASHED = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[8],
    paddingVertical: space[12],
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
});
