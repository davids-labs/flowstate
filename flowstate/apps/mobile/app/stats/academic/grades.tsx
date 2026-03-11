/**
 * Feature 11 - Weighted Grade Tracking
 *
 * Screen layout:
 * - Top: course list with current weighted average pill
 * - Tap course → expands inline editor showing grade components
 *   - Each component: name, weight%, received grade (or "pending")
 *   - Add / edit / delete components
 * - Forecast section: enter target overall grade → shows minimum needed on
 *   remaining (null receivedGrade) components to hit that target
 *
 * Data: courses + courseComponents tables via @flowstate/core queries
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { fontSize, spacing, borderRadius } from '../../../constants/theme';
import { useTheme } from '../../../constants/ThemeContext';
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

// ─── Local types ────────────────────────────────────────────────────────────

interface Course {
  id: string;
  name: string;
  pillar?: string;
  targetGrade?: number | null;
  createdAt?: string;
  updatedAt?: string;
}

interface Component {
  id: string;
  courseId: string;
  name: string;
  weight: number;
  receivedGrade: number | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Given components and a target overall grade, compute the minimum grade
 * required on all pending components combined (treated as a single block).
 *
 * Formula:
 *   earnedSoFar = Σ(receivedGrade × weight) for graded components
 *   pendingWeight = Σ(weight) for pending components
 *   needed = (targetGrade - earnedSoFar) / pendingWeight
 */
function forecastNeeded(components: Component[], targetGrade: number): number | null {
  if (components.length === 0) return null;
  let earned = 0;
  let pending = 0;
  for (const c of components) {
    if (c.receivedGrade !== null) {
      earned += (c.receivedGrade / 100) * c.weight;
    } else {
      pending += c.weight;
    }
  }
  if (pending === 0) return null; // all components graded
  const needed = ((targetGrade - earned) / pending) * 100;
  return needed;
}

function gradeColor(grade: number | null, accent: string): string {
  if (grade === null) return '#888';
  if (grade >= 85) return '#22c55e';
  if (grade >= 70) return '#f59e0b';
  return '#ef4444';
}

// ─── Add/Edit course modal ────────────────────────────────────────────────────

interface CourseModalProps {
  visible: boolean;
  initial?: Course | null;
  onClose: () => void;
  onSave: (name: string, targetGrade: number | null) => void;
}

function CourseModal({ visible, initial, onClose, onSave }: CourseModalProps) {
  const { themeColors } = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [target, setTarget] = useState(initial?.targetGrade?.toString() ?? '');

  // Reset when modal opens with different initial
  React.useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setTarget(initial?.targetGrade?.toString() ?? '');
    }
  }, [visible, initial]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert('Name required'); return; }
    const tg = target.trim() ? parseFloat(target) : null;
    if (tg !== null && (isNaN(tg) || tg < 0 || tg > 100)) {
      Alert.alert('Target grade must be 0–100'); return;
    }
    onSave(trimmed, tg);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.centeredView}>
        <View style={[styles.modalCard, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.modalTitle, { color: themeColors.text }]}>
            {initial ? 'Edit Course' : 'New Course'}
          </Text>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: themeColors.muted }]}>Course name</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: themeColors.background, color: themeColors.text }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Calculus II"
              placeholderTextColor={themeColors.muted}
              autoFocus
            />
          </View>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: themeColors.muted }]}>Target grade (%)</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: themeColors.background, color: themeColors.text }]}
              value={target}
              onChangeText={setTarget}
              placeholder="e.g. 80"
              placeholderTextColor={themeColors.muted}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.modalActions}>
            <Pressable style={[styles.modalBtn, { backgroundColor: themeColors.background }]} onPress={onClose}>
              <Text style={[styles.modalBtnText, { color: themeColors.muted }]}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.modalBtn, { backgroundColor: themeColors.accent }]} onPress={handleSave}>
              <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Add/Edit component modal ────────────────────────────────────────────────

interface ComponentModalProps {
  visible: boolean;
  initial?: Component | null;
  courseId: string;
  onClose: () => void;
  onSave: (data: { id?: string; name: string; weight: number; receivedGrade: number | null }) => void;
}

function ComponentModal({ visible, initial, courseId, onClose, onSave }: ComponentModalProps) {
  const { themeColors } = useTheme();
  const [name, setName] = useState(initial?.name ?? '');
  const [weight, setWeight] = useState(initial?.weight?.toString() ?? '');
  const [grade, setGrade] = useState(initial?.receivedGrade?.toString() ?? '');

  React.useEffect(() => {
    if (visible) {
      setName(initial?.name ?? '');
      setWeight(initial?.weight?.toString() ?? '');
      setGrade(initial?.receivedGrade?.toString() ?? '');
    }
  }, [visible, initial]);

  const handleSave = () => {
    const trimmed = name.trim();
    if (!trimmed) { Alert.alert('Name required'); return; }
    const w = parseFloat(weight);
    if (isNaN(w) || w <= 0 || w > 100) { Alert.alert('Weight must be 1–100'); return; }
    const g = grade.trim() ? parseFloat(grade) : null;
    if (g !== null && (isNaN(g) || g < 0 || g > 100)) {
      Alert.alert('Grade must be 0–100'); return;
    }
    onSave({ id: initial?.id, name: trimmed, weight: w, receivedGrade: g });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.centeredView}>
        <View style={[styles.modalCard, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.modalTitle, { color: themeColors.text }]}>
            {initial ? 'Edit Component' : 'New Component'}
          </Text>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: themeColors.muted }]}>Name</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: themeColors.background, color: themeColors.text }]}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Midterm Exam"
              placeholderTextColor={themeColors.muted}
              autoFocus
            />
          </View>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: themeColors.muted }]}>Weight (%)</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: themeColors.background, color: themeColors.text }]}
              value={weight}
              onChangeText={setWeight}
              placeholder="e.g. 30"
              placeholderTextColor={themeColors.muted}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.fieldRow}>
            <Text style={[styles.fieldLabel, { color: themeColors.muted }]}>Grade received (leave blank if pending)</Text>
            <TextInput
              style={[styles.fieldInput, { backgroundColor: themeColors.background, color: themeColors.text }]}
              value={grade}
              onChangeText={setGrade}
              placeholder="e.g. 78"
              placeholderTextColor={themeColors.muted}
              keyboardType="decimal-pad"
            />
          </View>
          <View style={styles.modalActions}>
            <Pressable style={[styles.modalBtn, { backgroundColor: themeColors.background }]} onPress={onClose}>
              <Text style={[styles.modalBtnText, { color: themeColors.muted }]}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.modalBtn, { backgroundColor: themeColors.accent }]} onPress={handleSave}>
              <Text style={[styles.modalBtnText, { color: '#fff' }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Course row (expanded / collapsed) ──────────────────────────────────────

interface CourseRowProps {
  course: Course;
  components: Component[];
  onEdit: () => void;
  onDelete: () => void;
  onAddComponent: () => void;
  onEditComponent: (c: Component) => void;
  onDeleteComponent: (id: string) => void;
}

function CourseRow({
  course, components, onEdit, onDelete, onAddComponent, onEditComponent, onDeleteComponent,
}: CourseRowProps) {
  const { themeColors } = useTheme();
  const [expanded, setExpanded] = useState(false);

  const currentGrade = computeWeightedGrade(components);
  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const forecast = course.targetGrade != null
    ? forecastNeeded(components, course.targetGrade)
    : null;

  return (
    <View style={[styles.courseCard, { backgroundColor: themeColors.surface }]}>
      {/* Header row */}
      <Pressable style={styles.courseHeader} onPress={() => setExpanded(!expanded)}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.courseName, { color: themeColors.text }]}>{course.name}</Text>
          <Text style={[styles.courseSub, { color: themeColors.muted }]}>
            {components.length} component{components.length !== 1 ? 's' : ''} · {totalWeight.toFixed(0)}% assigned
          </Text>
        </View>
        <View style={styles.courseRight}>
          <Text style={[styles.gradeChip, { color: gradeColor(currentGrade, themeColors.accent) }]}>
            {currentGrade !== null ? `${currentGrade.toFixed(1)}%` : '—'}
          </Text>
          <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={themeColors.muted} />
        </View>
      </Pressable>

      {/* Expanded detail */}
      {expanded && (
        <View style={styles.courseBody}>
          {/* Target & forecast */}
          {course.targetGrade != null && (
            <View style={[styles.forecastRow, { backgroundColor: themeColors.background }]}>
              <Text style={[styles.forecastLabel, { color: themeColors.muted }]}>
                Target: {course.targetGrade}%
              </Text>
              {forecast !== null && (
                <Text
                  style={[styles.forecastValue, {
                    color: forecast <= 100 ? '#22c55e' : '#ef4444',
                  }]}
                >
                  {forecast > 100
                    ? 'Target unreachable with pending work'
                    : forecast < 0
                      ? 'Target already achieved!'
                      : `Need ${forecast.toFixed(1)}% avg on pending`}
                </Text>
              )}
              {forecast === null && components.every(c => c.receivedGrade !== null) && (
                <Text style={[styles.forecastValue, { color: '#22c55e' }]}>All components graded!</Text>
              )}
            </View>
          )}

          {/* Components list */}
          {components.map((comp) => (
            <View key={comp.id} style={[styles.compRow, { borderBottomColor: themeColors.surfaceBorder }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.compName, { color: themeColors.text }]}>{comp.name}</Text>
                <Text style={[styles.compMeta, { color: themeColors.muted }]}>Weight: {comp.weight}%</Text>
              </View>
              <Text style={[styles.compGrade, {
                color: comp.receivedGrade !== null
                  ? gradeColor(comp.receivedGrade, themeColors.accent)
                  : themeColors.muted,
              }]}>
                {comp.receivedGrade !== null ? `${comp.receivedGrade}%` : 'Pending'}
              </Text>
              <Pressable onPress={() => onEditComponent(comp)} style={styles.compAction}>
                <Feather name="edit-2" size={14} color={themeColors.muted} />
              </Pressable>
              <Pressable onPress={() => onDeleteComponent(comp.id)} style={styles.compAction}>
                <Feather name="trash-2" size={14} color="#ef4444" />
              </Pressable>
            </View>
          ))}

          {/* Weight check */}
          {totalWeight > 100 && (
            <Text style={[styles.weightWarning, { color: '#ef4444' }]}>
              ⚠ Total weight exceeds 100% ({totalWeight.toFixed(0)}%)
            </Text>
          )}

          {/* Actions */}
          <View style={styles.courseActions}>
            <Pressable style={[styles.courseActionBtn, { backgroundColor: themeColors.background }]} onPress={onAddComponent}>
              <Feather name="plus" size={14} color={themeColors.accent} />
              <Text style={[styles.courseActionText, { color: themeColors.accent }]}>Add Component</Text>
            </Pressable>
            <Pressable style={[styles.courseActionBtn, { backgroundColor: themeColors.background }]} onPress={onEdit}>
              <Feather name="edit-2" size={14} color={themeColors.muted} />
              <Text style={[styles.courseActionText, { color: themeColors.muted }]}>Edit Course</Text>
            </Pressable>
            <Pressable style={[styles.courseActionBtn, { backgroundColor: themeColors.background }]} onPress={onDelete}>
              <Feather name="trash-2" size={14} color="#ef4444" />
              <Text style={[styles.courseActionText, { color: '#ef4444' }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function AcademicGradesScreen() {
  const { themeColors } = useTheme();
  const router = useRouter();
  const { db } = useDatabaseSafe();

  const [courses, setCoursesState] = useState<Course[]>([]);
  const [componentMap, setComponentMap] = useState<Record<string, Component[]>>({});
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [editCourse, setEditCourse] = useState<Course | null>(null);
  const [showCompModal, setShowCompModal] = useState(false);
  const [editComp, setEditComp] = useState<Component | null>(null);
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const allCourses: Course[] = await getCourses(db);
      setCoursesState(allCourses);
      const map: Record<string, Component[]> = {};
      for (const c of allCourses) {
        map[c.id] = await getCourseComponents(db, c.id);
      }
      setComponentMap(map);
    } catch (e) {
      console.error('AcademicGrades load error:', e);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // ── Course actions ──────────────────────────────────────────────────────────

  const handleCreateCourse = async (name: string, targetGrade: number | null) => {
    if (!db) return;
    await createCourse(db, { name, pillar: 'academic', targetGrade: targetGrade ?? undefined });
    setShowCourseModal(false);
    setEditCourse(null);
    load();
  };

  const handleUpdateCourse = async (name: string, targetGrade: number | null) => {
    if (!db || !editCourse) return;
    await updateCourse(db, editCourse.id, { name, targetGrade });
    setShowCourseModal(false);
    setEditCourse(null);
    load();
  };

  const handleDeleteCourse = (course: Course) => {
    Alert.alert(
      'Delete Course',
      `Delete "${course.name}" and all its grade components?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            if (!db) return;
            await deleteCourse(db, course.id);
            load();
          },
        },
      ],
    );
  };

  // ── Component actions ───────────────────────────────────────────────────────

  const handleSaveComponent = async (data: {
    id?: string;
    name: string;
    weight: number;
    receivedGrade: number | null;
  }) => {
    if (!db || !activeCourseId) return;
    await upsertCourseComponent(db, {
      id: data.id,
      courseId: activeCourseId,
      name: data.name,
      weight: data.weight,
      receivedGrade: data.receivedGrade,
    });
    setShowCompModal(false);
    setEditComp(null);
    load();
  };

  const handleDeleteComponent = (id: string) => {
    Alert.alert('Delete component?', '', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          if (!db) return;
          await deleteCourseComponent(db, id);
          load();
        },
      },
    ]);
  };

  // ── GPA summary ─────────────────────────────────────────────────────────────

  const overallGrades = courses.map(c => computeWeightedGrade(componentMap[c.id] ?? [])).filter(g => g !== null) as number[];
  const gpa = overallGrades.length > 0 ? overallGrades.reduce((a, b) => a + b, 0) / overallGrades.length : null;

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
          <Feather name="arrow-left" size={22} color={themeColors.text} />
        </Pressable>
        <Text style={[styles.title, { color: themeColors.text }]}>📚 Grade Tracker</Text>
        <Pressable onPress={() => { setEditCourse(null); setShowCourseModal(true); }}>
          <Feather name="plus" size={22} color={themeColors.accent} />
        </Pressable>
      </View>

      {/* GPA summary pill */}
      {gpa !== null && (
        <View style={[styles.gpaBanner, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.gpaLabel, { color: themeColors.muted }]}>Overall average</Text>
          <Text style={[styles.gpaValue, { color: gradeColor(gpa, themeColors.accent) }]}>
            {gpa.toFixed(1)}%
          </Text>
          <Text style={[styles.gpaCount, { color: themeColors.muted }]}>across {overallGrades.length} course{overallGrades.length !== 1 ? 's' : ''}</Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={themeColors.accent} style={{ marginTop: 40 }} />
        ) : courses.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: themeColors.surface }]}>
            <Text style={[styles.emptyTitle, { color: themeColors.muted }]}>No courses yet</Text>
            <Text style={[styles.emptyHint, { color: themeColors.muted }]}>
              Tap + to add a course, then add weighted grade components to each one.
            </Text>
          </View>
        ) : (
          courses.map((course) => (
            <CourseRow
              key={course.id}
              course={course}
              components={componentMap[course.id] ?? []}
              onEdit={() => { setEditCourse(course); setShowCourseModal(true); }}
              onDelete={() => handleDeleteCourse(course)}
              onAddComponent={() => {
                setActiveCourseId(course.id);
                setEditComp(null);
                setShowCompModal(true);
              }}
              onEditComponent={(c) => {
                setActiveCourseId(course.id);
                setEditComp(c);
                setShowCompModal(true);
              }}
              onDeleteComponent={handleDeleteComponent}
            />
          ))
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Modals */}
      <CourseModal
        visible={showCourseModal}
        initial={editCourse}
        onClose={() => { setShowCourseModal(false); setEditCourse(null); }}
        onSave={editCourse ? handleUpdateCourse : handleCreateCourse}
      />
      <ComponentModal
        visible={showCompModal}
        initial={editComp}
        courseId={activeCourseId ?? ''}
        onClose={() => { setShowCompModal(false); setEditComp(null); }}
        onSave={handleSaveComponent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 56,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: fontSize.xl, fontWeight: '700' },
  gpaBanner: {
    marginHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  gpaLabel: { fontSize: fontSize.sm },
  gpaValue: { fontSize: fontSize.xl, fontWeight: '700', flex: 1 },
  gpaCount: { fontSize: fontSize.xs },
  content: { padding: spacing.md, gap: spacing.sm },
  courseCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  courseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  courseName: { fontSize: fontSize.md, fontWeight: '700' },
  courseSub: { fontSize: fontSize.xs, marginTop: 2 },
  courseRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  gradeChip: { fontSize: fontSize.lg, fontWeight: '700' },
  courseBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md },
  forecastRow: {
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  forecastLabel: { fontSize: fontSize.xs },
  forecastValue: { fontSize: fontSize.sm, fontWeight: '600', marginTop: 2 },
  compRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  compName: { fontSize: fontSize.sm, fontWeight: '600' },
  compMeta: { fontSize: fontSize.xs },
  compGrade: { fontSize: fontSize.md, fontWeight: '700', minWidth: 56, textAlign: 'right' },
  compAction: { padding: 4 },
  weightWarning: { fontSize: fontSize.xs, marginTop: spacing.xs },
  courseActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: spacing.sm,
    flexWrap: 'wrap',
  },
  courseActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  courseActionText: { fontSize: fontSize.xs, fontWeight: '600' },
  empty: {
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyTitle: { fontSize: fontSize.md, fontWeight: '600' },
  emptyHint: { fontSize: fontSize.sm, textAlign: 'center', lineHeight: 18 },
  // Modal styles
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  centeredView: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.md,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    gap: spacing.md,
  },
  modalTitle: { fontSize: fontSize.lg, fontWeight: '700' },
  fieldRow: { gap: 6 },
  fieldLabel: { fontSize: fontSize.xs },
  fieldInput: {
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    fontSize: fontSize.md,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm, justifyContent: 'flex-end' },
  modalBtn: {
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  modalBtnText: { fontSize: fontSize.sm, fontWeight: '600' },
});
