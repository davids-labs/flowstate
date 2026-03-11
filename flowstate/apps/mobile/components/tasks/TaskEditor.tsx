/**
 * TaskEditor — bottom-sheet style modal for creating or editing a task.
 * Used by both the Todos screen (new task) and pressing an existing TaskCard (edit).
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, Modal, Pressable, TextInput, ScrollView,
  StyleSheet, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../constants/ThemeContext';
import { fontSize, spacing, borderRadius } from '../../constants/theme';

const PILLARS = ['general', 'gym', 'academic', 'life'] as const;
const PILLAR_LABELS: Record<string, string> = {
  general: 'General',
  gym: 'Gym',
  academic: 'Academic',
  life: 'Life',
};
const PILLAR_COLORS: Record<string, string> = {
  gym: '#ef4444',
  academic: '#3b82f6',
  life: '#22c55e',
  general: '#a855f7',
};
const PRIORITIES = [
  { value: 1, label: 'High', color: '#ef4444' },
  { value: 2, label: 'Medium', color: '#f59e0b' },
  { value: 3, label: 'Low', color: '#6b7280' },
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
}

export function TaskEditor({ visible, initial, onSave, onCancel }: TaskEditorProps) {
  const { themeColors } = useTheme();

  const [title, setTitle] = useState('');
  const [pillar, setPillar] = useState<string>('general');
  const [category, setCategory] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [priority, setPriority] = useState(2);
  const [notes, setNotes] = useState('');

  // Populate form when editing an existing task or when modal opens fresh
  useEffect(() => {
    if (visible) {
      setTitle(initial?.title ?? '');
      setPillar(initial?.pillar ?? 'general');
      setCategory(initial?.category ?? '');
      setDueDate(initial?.dueDate ?? '');
      setDueTime(initial?.dueTime ?? '');
      setPriority(initial?.priority ?? 2);
      setNotes(initial?.notes ?? '');
    }
  }, [visible, initial]);

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      id: initial?.id,
      title: title.trim(),
      pillar,
      category: category.trim(),
      dueDate: dueDate.trim(),
      dueTime: dueTime.trim(),
      priority,
      notes: notes.trim(),
      recurrence: initial?.recurrence ?? '',
    });
  };

  const s = makeStyles(themeColors);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.overlay}
      >
        <Pressable style={s.backdrop} onPress={onCancel} />
        <View style={s.sheet}>
          {/* Header */}
          <View style={s.header}>
            <Text style={s.headerTitle}>{initial?.id ? 'Edit Task' : 'New Task'}</Text>
            <Pressable onPress={onCancel} hitSlop={8}>
              <Feather name="x" size={20} color={themeColors.muted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* Title input */}
            <TextInput
              style={s.titleInput}
              placeholder="Task title…"
              placeholderTextColor={themeColors.muted}
              value={title}
              onChangeText={setTitle}
              autoFocus
              multiline
            />

            {/* Pillar selector */}
            <Text style={s.label}>Pillar</Text>
            <View style={s.chipRow}>
              {PILLARS.map((p) => (
                <Pressable
                  key={p}
                  style={[
                    s.chip,
                    {
                      backgroundColor:
                        pillar === p ? PILLAR_COLORS[p] + '33' : themeColors.surface,
                      borderColor: pillar === p ? PILLAR_COLORS[p] : themeColors.surfaceBorder,
                    },
                  ]}
                  onPress={() => setPillar(p)}
                >
                  <Text
                    style={[
                      s.chipText,
                      { color: pillar === p ? PILLAR_COLORS[p] : themeColors.muted },
                    ]}
                  >
                    {PILLAR_LABELS[p]}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Category */}
            <Text style={s.label}>Category (optional)</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. Work, Personal…"
              placeholderTextColor={themeColors.muted}
              value={category}
              onChangeText={setCategory}
            />

            {/* Due Date */}
            <Text style={s.label}>Due Date (YYYY-MM-DD)</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. 2026-04-01"
              placeholderTextColor={themeColors.muted}
              value={dueDate}
              onChangeText={setDueDate}
              keyboardType="numeric"
            />

            {/* Due Time */}
            <Text style={s.label}>Due Time (HH:MM, optional)</Text>
            <TextInput
              style={s.input}
              placeholder="e.g. 09:30"
              placeholderTextColor={themeColors.muted}
              value={dueTime}
              onChangeText={setDueTime}
              keyboardType="numeric"
            />

            {/* Priority */}
            <Text style={s.label}>Priority</Text>
            <View style={s.chipRow}>
              {PRIORITIES.map((p) => (
                <Pressable
                  key={p.value}
                  style={[
                    s.chip,
                    {
                      backgroundColor:
                        priority === p.value ? p.color + '33' : themeColors.surface,
                      borderColor: priority === p.value ? p.color : themeColors.surfaceBorder,
                    },
                  ]}
                  onPress={() => setPriority(p.value)}
                >
                  <Text
                    style={[
                      s.chipText,
                      { color: priority === p.value ? p.color : themeColors.muted },
                    ]}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Notes */}
            <Text style={s.label}>Notes (optional)</Text>
            <TextInput
              style={[s.input, s.notesInput]}
              placeholder="Any extra details…"
              placeholderTextColor={themeColors.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
              textAlignVertical="top"
            />

            {/* Save button */}
            <Pressable
              style={[s.saveBtn, { opacity: title.trim() ? 1 : 0.4 }]}
              onPress={handleSave}
              disabled={!title.trim()}
            >
              <Text style={s.saveBtnText}>{initial?.id ? 'Save Changes' : 'Add Task'}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function makeStyles(c: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.4)',
    },
    sheet: {
      backgroundColor: c.background,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.md,
      paddingBottom: spacing.xl + 16,
      maxHeight: '90%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.md,
    },
    headerTitle: {
      fontSize: fontSize.lg,
      fontWeight: '700',
      color: c.text,
    },
    titleInput: {
      fontSize: fontSize.xl,
      fontWeight: '600',
      color: c.text,
      borderBottomWidth: 1,
      borderBottomColor: c.surfaceBorder,
      paddingBottom: spacing.sm,
      marginBottom: spacing.md,
    },
    label: {
      fontSize: fontSize.sm,
      fontWeight: '600',
      color: c.muted,
      marginBottom: spacing.xs,
      marginTop: spacing.sm,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      marginBottom: spacing.xs,
    },
    chip: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 5,
      borderRadius: borderRadius.sm,
      borderWidth: 1,
    },
    chipText: {
      fontSize: fontSize.md,
      fontWeight: '500',
    },
    input: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.surfaceBorder,
      borderRadius: borderRadius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      fontSize: fontSize.md,
      color: c.text,
      marginBottom: spacing.xs,
    },
    notesInput: {
      minHeight: 80,
    },
    saveBtn: {
      backgroundColor: c.accent,
      borderRadius: borderRadius.md,
      paddingVertical: spacing.md,
      alignItems: 'center',
      marginTop: spacing.lg,
    },
    saveBtnText: {
      color: '#fff',
      fontSize: fontSize.md,
      fontWeight: '700',
    },
  });
}
