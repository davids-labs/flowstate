import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Switch, Alert, ScrollView, TextInput } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import {
  getRemindersForModule,
  createReminder,
  updateReminder,
  deleteReminder,
  getModuleSpec,
} from '@flowstate/core';
import { scheduleModuleReminder, cancelModuleReminder } from '../../services/notifications';
import { useTheme } from '../../constants/ThemeContext';
import { fontSize, spacing, borderRadius } from '../../constants/theme';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ModuleRemindersScreen() {
  const { moduleId } = useLocalSearchParams<{ moduleId: string }>();
  const { db, isReady } = useDatabaseSafe();
  const { themeColors } = useTheme();
  const [mod, setMod] = useState<any>(null);
  const [reminders, setReminders] = useState<any[]>([]);
  const [editingTimeId, setEditingTimeId] = useState<string | null>(null);
  const [timeInput, setTimeInput] = useState('');

  const load = useCallback(async () => {
    if (!db || !isReady || !moduleId) return;
    const [spec, rems] = await Promise.all([
      getModuleSpec(db, moduleId),
      getRemindersForModule(db, moduleId),
    ]);
    setMod(spec);
    setReminders(rems);
  }, [db, isReady, moduleId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAdd = async () => {
    if (!db || !moduleId) return;
    await createReminder(db, { moduleId, daysOfWeek: [1, 2, 3, 4, 5], time: '09:00' });
    load();
  };

  const toggleDay = async (remId: string, currentDays: number[], day: number) => {
    if (!db) return;
    const updated = currentDays.includes(day)
      ? currentDays.filter((d: number) => d !== day)
      : [...currentDays, day].sort();
    await updateReminder(db, remId, { daysOfWeek: updated });
    load();
  };

  const toggleEnabled = async (rem: any, enabled: boolean) => {
    if (!db) return;
    await updateReminder(db, rem.id, { enabled });
    if (enabled && mod) {
      await scheduleModuleReminder(
        rem.id, mod.label, null, rem.time, rem.daysOfWeek, rem.message,
      );
    } else {
      await cancelModuleReminder(rem.id);
    }
    load();
  };

  const handleTimeChange = async (remId: string, value: string) => {
    if (!db) return;
    // Validate HH:MM format
    const match = value.match(/^(\d{1,2}):(\d{2})$/);
    if (!match) { Alert.alert('Invalid Time', 'Use HH:MM format (e.g. 09:00)'); return; }
    const hh = match[1].padStart(2, '0');
    const mm = match[2];
    const time = `${hh}:${mm}`;
    await updateReminder(db, remId, { time });
    // Re-schedule notification
    const rem = reminders.find(r => r.id === remId);
    if (rem?.enabled && mod) {
      await scheduleModuleReminder(
        remId, mod.label, null, time, rem.daysOfWeek, rem.message,
      );
    }
    setEditingTimeId(null);
    load();
  };

  const handleMessageChange = async (remId: string, message: string) => {
    if (!db) return;
    await updateReminder(db, remId, { message: message || null });
  };

  const handleDelete = (remId: string) => {
    Alert.alert('Delete Reminder', 'Remove this reminder?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          if (!db) return;
          await cancelModuleReminder(remId);
          await deleteReminder(db, remId);
          load();
        }
      },
    ]);
  };

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Feather name="bell" size={36} color={themeColors.accent} />
          <Text style={[styles.headerLabel, { color: themeColors.text }]}> 
            {mod?.label ?? 'Module'} — Reminders
          </Text>
          <Text style={[styles.headerSub, { color: themeColors.muted }]}>
            Get notified on selected days at specific times.
          </Text>
        </View>

        {reminders.map((r) => (
          <View key={r.id} style={[styles.card, { backgroundColor: themeColors.surface }]}>
            <View style={styles.cardTop}>
              <Switch
                value={r.enabled}
                onValueChange={(v) => toggleEnabled(r, v)}
                trackColor={{ false: themeColors.surfaceBorder, true: themeColors.accentLight }}
                thumbColor={r.enabled ? themeColors.accent : themeColors.muted}
              />
              <Pressable onPress={() => { setEditingTimeId(r.id); setTimeInput(r.time); }} style={[styles.timePill, { backgroundColor: themeColors.accentLight }]}>
                <Feather name="clock" size={14} color={themeColors.accent} />
                <Text style={[styles.timeText, { color: themeColors.accent }]}>{r.time}</Text>
              </Pressable>
              <Pressable onPress={() => handleDelete(r.id)}>
                <Feather name="trash-2" size={18} color={themeColors.danger} />
              </Pressable>
            </View>

            {editingTimeId === r.id && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <TextInput
                  style={[styles.messageInput, { color: themeColors.text, borderColor: themeColors.accent, flex: 1 }]}
                  placeholder="HH:MM"
                  placeholderTextColor={themeColors.muted}
                  value={timeInput}
                  onChangeText={setTimeInput}
                  keyboardType="numbers-and-punctuation"
                  autoFocus
                />
                <Pressable onPress={() => handleTimeChange(r.id, timeInput)} style={[styles.timePill, { backgroundColor: themeColors.accent }]}>
                  <Text style={{ color: '#fff', fontWeight: '600', fontSize: fontSize.sm }}>Set</Text>
                </Pressable>
              </View>
            )}

            <View style={styles.dayRow}>
              {DAY_LABELS.map((label, idx) => {
                const active = r.daysOfWeek.includes(idx);
                return (
                  <Pressable
                    key={idx}
                    onPress={() => toggleDay(r.id, r.daysOfWeek, idx)}
                    style={[
                      styles.dayChip,
                      { backgroundColor: active ? themeColors.accent : themeColors.surfaceBorder },
                    ]}
                  >
                    <Text style={[styles.dayText, { color: active ? '#fff' : themeColors.muted }]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              style={[styles.messageInput, { color: themeColors.text, borderColor: themeColors.surfaceBorder }]}
              placeholder="Custom message (optional)"
              placeholderTextColor={themeColors.muted}
              defaultValue={r.message ?? ''}
              onEndEditing={(e) => handleMessageChange(r.id, e.nativeEvent.text)}
            />
          </View>
        ))}

        <Pressable style={[styles.addBtn, { backgroundColor: themeColors.accent }]} onPress={handleAdd}>
          <Feather name="plus" size={20} color="#fff" />
          <Text style={styles.addLabel}>Add Reminder</Text>
        </Pressable>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md },
  header: { alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm },
  headerEmoji: { fontSize: 36 },
  headerLabel: { fontSize: fontSize.lg, fontWeight: '700' },
  headerSub: { fontSize: fontSize.sm, textAlign: 'center' },
  card: {
    borderRadius: borderRadius.md, padding: spacing.md, gap: spacing.sm,
  },
  cardTop: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  timePill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: borderRadius.sm,
  },
  timeText: { fontSize: fontSize.sm, fontWeight: '600' },
  dayRow: {
    flexDirection: 'row', gap: spacing.xs, justifyContent: 'center',
  },
  dayChip: {
    width: 40, height: 36, borderRadius: borderRadius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  dayText: { fontSize: fontSize.xs, fontWeight: '600' },
  messageInput: {
    borderWidth: 1, borderRadius: borderRadius.sm,
    padding: spacing.sm, fontSize: fontSize.sm,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, padding: spacing.md, borderRadius: borderRadius.md,
  },
  addLabel: { color: '#fff', fontWeight: '600', fontSize: fontSize.md },
});
