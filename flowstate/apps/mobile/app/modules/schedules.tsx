import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, Switch, Alert, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import {
  getSchedulesForModule,
  createSchedule,
  updateSchedule,
  deleteSchedule,
  getModuleSpec,
} from '@flowstate/core';
import { useTheme } from '../../constants/ThemeContext';
import { fontSize, spacing, borderRadius } from '../../constants/theme';

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function ModuleSchedulesScreen() {
  const { moduleId } = useLocalSearchParams<{ moduleId: string }>();
  const { db, isReady } = useDatabaseSafe();
  const { themeColors } = useTheme();
  const [mod, setMod] = useState<any>(null);
  const [schedules, setSchedules] = useState<any[]>([]);

  const load = useCallback(async () => {
    if (!db || !isReady || !moduleId) return;
    const [spec, sched] = await Promise.all([
      getModuleSpec(db, moduleId),
      getSchedulesForModule(db, moduleId),
    ]);
    setMod(spec);
    setSchedules(sched);
  }, [db, isReady, moduleId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleAdd = async () => {
    if (!db || !moduleId) return;
    // Default: weekdays
    await createSchedule(db, { moduleId, daysOfWeek: [1, 2, 3, 4, 5] });
    load();
  };

  const toggleDay = async (schedId: string, currentDays: number[], day: number) => {
    if (!db) return;
    const updated = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort();
    await updateSchedule(db, schedId, { daysOfWeek: updated });
    load();
  };

  const toggleEnabled = async (schedId: string, enabled: boolean) => {
    if (!db) return;
    await updateSchedule(db, schedId, { enabled });
    load();
  };

  const handleDelete = (schedId: string) => {
    Alert.alert('Delete Schedule', 'Remove this recurring schedule?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          if (!db) return;
          await deleteSchedule(db, schedId);
          load();
        }
      },
    ]);
  };

  return (
    <ScreenWrapper>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerEmoji}>{mod?.emoji ?? '📅'}</Text>
          <Text style={[styles.headerLabel, { color: themeColors.text }]}>
            {mod?.label ?? 'Module'} — Schedules
          </Text>
          <Text style={[styles.headerSub, { color: themeColors.muted }]}>
            Auto-fill this module into your day plan on selected days.
          </Text>
        </View>

        {schedules.map((s) => (
          <View key={s.id} style={[styles.card, { backgroundColor: themeColors.surface }]}>
            <View style={styles.cardTop}>
              <Switch
                value={s.enabled}
                onValueChange={(v) => toggleEnabled(s.id, v)}
                trackColor={{ false: themeColors.surfaceBorder, true: themeColors.accentLight }}
                thumbColor={s.enabled ? themeColors.accent : themeColors.muted}
              />
              <Pressable onPress={() => handleDelete(s.id)}>
                <Feather name="trash-2" size={18} color={themeColors.danger} />
              </Pressable>
            </View>

            <View style={styles.dayRow}>
              {DAY_LABELS.map((label, idx) => {
                const active = s.daysOfWeek.includes(idx);
                return (
                  <Pressable
                    key={idx}
                    onPress={() => toggleDay(s.id, s.daysOfWeek, idx)}
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: active ? themeColors.accent : themeColors.surfaceBorder,
                      },
                    ]}
                  >
                    <Text style={[styles.dayText, { color: active ? '#fff' : themeColors.muted }]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}

        <Pressable style={[styles.addBtn, { backgroundColor: themeColors.accent }]} onPress={handleAdd}>
          <Feather name="plus" size={20} color="#fff" />
          <Text style={styles.addLabel}>Add Schedule</Text>
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
  dayRow: {
    flexDirection: 'row', gap: spacing.xs, justifyContent: 'center',
  },
  dayChip: {
    width: 40, height: 36, borderRadius: borderRadius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  dayText: { fontSize: fontSize.xs, fontWeight: '600' },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, padding: spacing.md, borderRadius: borderRadius.md,
  },
  addLabel: { color: '#fff', fontWeight: '600', fontSize: fontSize.md },
});
