import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';
import { AppText } from '../primitives/Text';
import { FormCard, FormChip, FormSection, FormTextField } from '../primitives/Form';

const PILLARS = ['general', 'gym', 'academic', 'life'] as const;
const PILLAR_LABELS: Record<string, string> = {
  general: 'General',
  gym: 'Gym',
  academic: 'Academic',
  life: 'Life',
};
const PILLAR_COLORS: Record<string, string> = {
  gym: '#EF4444',
  academic: '#3B82F6',
  life: '#22C55E',
  general: '#4F46E5',
};
const PRIORITIES = [
  { value: 1, label: 'High', color: '#EF4444' },
  { value: 2, label: 'Medium', color: '#F59E0B' },
  { value: 3, label: 'Low', color: '#6B7280' },
];

export interface TaskFormData {
  id?: string;
  title: string;
  pillar: string;
  category: string;
  dueDate: string;
  dueTime: string;
  priority: number;
  notes: string;
  recurrence: string;
}

interface TaskEditorProps {
  visible: boolean;
  initial?: Partial<TaskFormData>;
  onSave: (data: TaskFormData) => void;
  onCancel: () => void;
  hidePillar?: boolean;
  defaultPillar?: string;
}

function normalizeTimeInput(value: string): string {
  return value.replace(/[^0-9:]/g, '').slice(0, 5);
}

function isValidDate(value: string): boolean {
  if (!value.trim()) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return false;
  const parsed = new Date(`${value}T12:00:00`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isValidTime(value: string): boolean {
  if (!value.trim()) return true;
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value.trim());
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(date: string, offset: number): string {
  const next = new Date(`${date}T12:00:00`);
  next.setDate(next.getDate() + offset);
  return next.toISOString().slice(0, 10);
}

function resolveCalendarSeed(date: string): { year: number; month: number } {
  const seed = isValidDate(date) && date ? date : todayISO();
  const parsed = new Date(`${seed}T12:00:00`);
  return {
    year: parsed.getFullYear(),
    month: parsed.getMonth(),
  };
}

function buildCalendarCells(year: number, month: number): Array<number | null> {
  const firstDay = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const cells: Array<number | null> = Array(firstDay).fill(null);
  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

function monthISO(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatMonthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}

function formatDateLabel(value: string): string {
  if (!value || !isValidDate(value)) return 'Choose a date';
  return new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function TaskDatePicker({
  value,
  expanded,
  viewYear,
  viewMonth,
  onToggle,
  onMoveMonth,
  onSelectDate,
  onClear,
}: {
  value: string;
  expanded: boolean;
  viewYear: number;
  viewMonth: number;
  onToggle: () => void;
  onMoveMonth: (offset: number) => void;
  onSelectDate: (date: string) => void;
  onClear: () => void;
}) {
  const { themeTokens } = useTheme();
  const today = todayISO();
  const tomorrow = addDays(today, 1);

  const monthLabel = useMemo(
    () => formatMonthLabel(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  const cells = useMemo(
    () => buildCalendarCells(viewYear, viewMonth),
    [viewYear, viewMonth],
  );

  return (
    <View style={styles.dateFieldGroup}>
      <AppText variant="caption1" color={themeTokens.textTertiary} style={styles.fieldLabel}>
        Due date
      </AppText>

      <Pressable
        style={[
          styles.dateTrigger,
          {
            backgroundColor: themeTokens.surfaceInput,
            borderColor: expanded ? themeTokens.accent : themeTokens.border,
          },
        ]}
        onPress={onToggle}
      >
        <View style={styles.dateTriggerCopy}>
          <AppText variant="body" style={{ fontWeight: '600' }}>
            {formatDateLabel(value)}
          </AppText>
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            {value && isValidDate(value)
              ? value
              : 'Tap to place it in the planner with a real calendar date.'}
          </AppText>
        </View>
        <Feather
          name={expanded ? 'chevron-up' : 'calendar'}
          size={18}
          color={expanded ? themeTokens.accent : themeTokens.textSecondary}
        />
      </Pressable>

      <View style={styles.chipWrap}>
        <FormChip label="Today" selected={value === today} onPress={() => onSelectDate(today)} />
        <FormChip
          label="Tomorrow"
          selected={value === tomorrow}
          onPress={() => onSelectDate(tomorrow)}
        />
        <FormChip label="No date" selected={!value} onPress={onClear} />
      </View>

      {expanded ? (
        <View
          style={[
            styles.calendarCard,
            {
              backgroundColor: themeTokens.surface,
              borderColor: themeTokens.border,
            },
          ]}
        >
          <View style={styles.calendarHeader}>
            <Pressable
              style={[
                styles.calendarNav,
                {
                  backgroundColor: themeTokens.surfaceElevated,
                  borderColor: themeTokens.border,
                },
              ]}
              onPress={() => onMoveMonth(-1)}
            >
              <Feather name="chevron-left" size={16} color={themeTokens.textPrimary} />
            </Pressable>
            <AppText variant="headline" style={{ fontWeight: '700' }}>
              {monthLabel}
            </AppText>
            <Pressable
              style={[
                styles.calendarNav,
                {
                  backgroundColor: themeTokens.surfaceElevated,
                  borderColor: themeTokens.border,
                },
              ]}
              onPress={() => onMoveMonth(1)}
            >
              <Feather name="chevron-right" size={16} color={themeTokens.textPrimary} />
            </Pressable>
          </View>

          <View style={styles.calendarDowRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, index) => (
              <View key={`${day}-${index}`} style={styles.calendarCell}>
                <AppText variant="caption2" color={themeTokens.textTertiary}>
                  {day}
                </AppText>
              </View>
            ))}
          </View>

          <View style={styles.calendarGrid}>
            {cells.map((day, index) => {
              if (!day) {
                return <View key={`empty-${index}`} style={styles.calendarCell} />;
              }

              const date = monthISO(viewYear, viewMonth, day);
              const isToday = date === today;
              const isSelected = date === value;

              return (
                <Pressable
                  key={date}
                  style={styles.calendarCell}
                  onPress={() => onSelectDate(date)}
                >
                  <View
                    style={[
                      styles.calendarBadge,
                      isToday ? { backgroundColor: themeTokens.accentTint } : null,
                      isSelected
                        ? { backgroundColor: themeTokens.accent, borderColor: themeTokens.accent, borderWidth: 1 }
                        : null,
                      !isSelected && !isToday
                        ? { backgroundColor: themeTokens.surfaceElevated }
                        : null,
                    ]}
                  >
                    <AppText
                      variant="footnote"
                      color={
                        isSelected
                          ? '#fff'
                          : isToday
                          ? themeTokens.accent
                          : themeTokens.textPrimary
                      }
                      style={{ fontWeight: isSelected || isToday ? '700' : '500' }}
                    >
                      {day}
                    </AppText>
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function TaskEditor({
  visible,
  initial,
  onSave,
  onCancel,
  hidePillar = false,
  defaultPillar = 'general',
}: TaskEditorProps) {
  const { themeTokens } = useTheme();

  const [title, setTitle] = useState('');
  const [pillar, setPillar] = useState<string>('general');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState(2);
  const [notes, setNotes] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calendarYear, setCalendarYear] = useState(() => resolveCalendarSeed('').year);
  const [calendarMonth, setCalendarMonth] = useState(() => resolveCalendarSeed('').month);

  useEffect(() => {
    if (!visible) return;
    const nextDueDate = initial?.dueDate && isValidDate(initial.dueDate) ? initial.dueDate : '';
    const seed = resolveCalendarSeed(nextDueDate);
    setTitle(initial?.title ?? '');
    setPillar(initial?.pillar ?? defaultPillar);
    setCategory(initial?.category ?? '');
    setDueDate(nextDueDate);
    setDueTime(initial?.dueTime ?? '');
    setPriority(initial?.priority ?? 2);
    setNotes(initial?.notes ?? '');
    setCalendarYear(seed.year);
    setCalendarMonth(seed.month);
    setShowDatePicker(false);
  }, [visible, initial, defaultPillar]);

  const handleSelectDate = (value: string) => {
    const seed = resolveCalendarSeed(value);
    setDueDate(value);
    setCalendarYear(seed.year);
    setCalendarMonth(seed.month);
    setShowDatePicker(false);
  };

  const handleClearDate = () => {
    setDueDate('');
    const seed = resolveCalendarSeed('');
    setCalendarYear(seed.year);
    setCalendarMonth(seed.month);
    setShowDatePicker(false);
  };

  const moveCalendarMonth = (offset: number) => {
    const next = new Date(calendarYear, calendarMonth + offset, 1);
    setCalendarYear(next.getFullYear());
    setCalendarMonth(next.getMonth());
  };

  const handleSave = () => {
    if (!title.trim() || !isValidDate(dueDate) || !isValidTime(dueTime)) return;
    onSave({
      id: initial?.id,
      title: title.trim(),
      pillar: hidePillar ? (initial?.pillar ?? defaultPillar) : pillar,
      category: category.trim(),
      dueDate: dueDate.trim(),
      dueTime: dueTime.trim(),
      priority,
      notes: notes.trim(),
      recurrence: initial?.recurrence ?? '',
    });
  };

  const canSave = Boolean(title.trim()) && isValidDate(dueDate) && isValidTime(dueTime);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: themeTokens.background,
              borderColor: themeTokens.border,
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: themeTokens.border }]} />
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <AppText variant="title3" style={{ fontWeight: '700' }}>
                {initial?.id ? 'Edit Task' : 'New Task'}
              </AppText>
              <AppText variant="footnote" color={themeTokens.textSecondary}>
                Keep it quick, clear, and easy to place in the day.
              </AppText>
            </View>
            <Pressable onPress={onCancel} hitSlop={8}>
              <Feather name="x" size={18} color={themeTokens.textSecondary} />
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            <FormSection eyebrow="Task" title="What needs to happen?">
              <FormTextField
                label="Title"
                titleField
                placeholder="Readings, admin, deep work..."
                value={title}
                onChangeText={setTitle}
                autoFocus
              />
            </FormSection>

            <FormCard>
              <FormSection
                eyebrow="Placement"
                title="When should it show up?"
                description="Give it a date or time only when it helps the plan stay honest."
              >
                <TaskDatePicker
                  value={dueDate}
                  expanded={showDatePicker}
                  viewYear={calendarYear}
                  viewMonth={calendarMonth}
                  onToggle={() => {
                    const seed = resolveCalendarSeed(dueDate);
                    setCalendarYear(seed.year);
                    setCalendarMonth(seed.month);
                    setShowDatePicker((current) => !current);
                  }}
                  onMoveMonth={moveCalendarMonth}
                  onSelectDate={handleSelectDate}
                  onClear={handleClearDate}
                />
                <FormTextField
                  label="Due time"
                  placeholder="HH:MM"
                  value={dueTime}
                  onChangeText={(value) => setDueTime(normalizeTimeInput(value))}
                  keyboardType="numbers-and-punctuation"
                  autoCorrect={false}
                  error={isValidTime(dueTime) ? null : 'Use HH:MM, or leave it blank.'}
                />
              </FormSection>
            </FormCard>

            <FormCard>
              <FormSection
                eyebrow="Focus"
                title="How important is it?"
                description="Priority changes the tone of the planner, so keep it deliberate."
              >
                {!hidePillar ? (
                  <View style={styles.chipWrap}>
                    {PILLARS.map((value) => (
                      <FormChip
                        key={value}
                        label={PILLAR_LABELS[value]}
                        selected={pillar === value}
                        accentColor={PILLAR_COLORS[value]}
                        onPress={() => setPillar(value)}
                      />
                    ))}
                  </View>
                ) : null}
                <View style={styles.chipWrap}>
                  {PRIORITIES.map((item) => (
                    <FormChip
                      key={item.value}
                      label={item.label}
                      selected={priority === item.value}
                      accentColor={item.color}
                      onPress={() => setPriority(item.value)}
                    />
                  ))}
                </View>
              </FormSection>
            </FormCard>

            <FormCard>
              <FormSection
                eyebrow="Context"
                title="Add just enough detail"
                description="The form should help you act, not tempt you into writing a manifesto."
              >
                <FormTextField
                  label="Category"
                  placeholder="Work, personal, admin..."
                  value={category}
                  onChangeText={setCategory}
                />
                <FormTextField
                  label="Notes"
                  placeholder="Any extra context you actually need later."
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                />
              </FormSection>
            </FormCard>
          </ScrollView>

          <Pressable
            style={[
              styles.saveButton,
              {
                backgroundColor: themeTokens.accent,
                opacity: canSave ? 1 : 0.45,
              },
            ]}
            onPress={handleSave}
            disabled={!canSave}
          >
            <AppText variant="headline" onAccent style={{ fontWeight: '700' }}>
              {initial?.id ? 'Save Changes' : 'Add Task'}
            </AppText>
          </Pressable>
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
    paddingBottom: space[20],
    maxHeight: '92%',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: space[16],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space[12],
    marginBottom: space[16],
  },
  headerCopy: {
    flex: 1,
    gap: space[4],
  },
  content: {
    gap: space[16],
    paddingBottom: space[16],
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[8],
  },
  fieldLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  dateFieldGroup: {
    gap: space[8],
  },
  dateTrigger: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: space[16],
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[12],
  },
  dateTriggerCopy: {
    flex: 1,
    gap: space[4],
  },
  calendarCard: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space[12],
    gap: space[12],
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calendarNav: {
    width: 32,
    height: 32,
    borderWidth: 1,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calendarDowRow: {
    flexDirection: 'row',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  calendarCell: {
    width: '14.2857%',
    alignItems: 'center',
    paddingVertical: space[4],
  },
  calendarBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButton: {
    borderRadius: radius.lg,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space[12],
  },
});

export default TaskEditor;
