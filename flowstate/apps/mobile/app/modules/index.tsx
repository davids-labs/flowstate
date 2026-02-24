import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { SectionHeader } from '../../components/layout/SectionHeader';
import UndoToast from '../../components/shared/UndoToast';
import { getModuleSpecs, deleteModuleSpec, updateModuleSpec } from '@flowstate/core';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

const TYPE_LABELS: Record<string, string> = {
  countdown: 'Countdown',
  countup: 'Countup',
  checkbox: 'Checkbox',
  rating: 'Rating',
  data_input: 'Data Input',
  mandatory_session: 'Session',
  text_note: 'Text Note',
  progress_bar: 'Progress Bar',
  streak_counter: 'Streak',
  tally: 'Tally',
  photo_log: 'Photo Log',
  routine_launcher: 'Routine Launcher',
  group: 'Group',
};

interface ModuleRow {
  id: string;
  type: string;
  label: string;
  emoji?: string | null;
  isLive: boolean;
  required: boolean;
  placements: string[];
  archivedAt?: string | null;
}

export default function ModulesScreen() {
  const router = useRouter();
  const { db, isReady } = useDatabaseSafe();
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const { themeColors } = useTheme();

  const loadModules = useCallback(async () => {
    if (!db || !isReady) return;
    try {
      const specs = await getModuleSpecs(db);
      setModules(specs.map((s: any) => ({
        id: s.id,
        type: s.type,
        label: s.label,
        emoji: s.emoji,
        isLive: !!s.isLive,
        required: !!s.required,
        placements: Array.isArray(s.placements) ? s.placements : [],
        archivedAt: s.archivedAt,
      })));
    } catch (err) {
      console.error('Failed to load modules:', err);
    }
  }, [db, isReady]);

  useFocusEffect(useCallback(() => { loadModules(); }, [loadModules]));

  // Clear pending timeout on unmount to prevent stale DB writes
  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    };
  }, []);

  const [undoToast, setUndoToast] = useState<{ message: string; undoAction: () => void } | null>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleArchive = async (id: string, isArchived: boolean) => {
    if (!db) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const label = modules.find(m => m.id === id)?.label ?? 'Module';

    if (!isArchived) {
      setModules(prev => prev.map(m => m.id === id ? { ...m, archivedAt: new Date().toISOString() } : m));
      setUndoToast({
        message: `"${label}" archived`,
        undoAction: () => setModules(prev => prev.map(m => m.id === id ? { ...m, archivedAt: null } : m)),
      });
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = setTimeout(async () => {
        try { await updateModuleSpec(db, id, { archivedAt: new Date().toISOString() }); } catch (e) { console.error('Archive failed:', e); }
      }, 3200);
    } else {
      try { await updateModuleSpec(db, id, { archivedAt: null }); loadModules(); } catch (e) { console.error('Restore failed:', e); }
    }
  };

  const handleDelete = async (id: string) => {
    if (!db) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const label = modules.find(m => m.id === id)?.label ?? 'Module';
    const snapshot = modules.find(m => m.id === id);

    setModules(prev => prev.filter(m => m.id !== id));
    setUndoToast({
      message: `"${label}" deleted`,
      undoAction: () => { if (snapshot) setModules(prev => [...prev, snapshot]); },
    });
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(async () => {
      try { await deleteModuleSpec(db, id); } catch (e) { console.error('Delete failed:', e); }
    }, 3200);
  };

  const active = modules.filter(m => !m.archivedAt);
  const archived = modules.filter(m => !!m.archivedAt);

  const renderItem = ({ item }: { item: ModuleRow }) => (
    <Pressable
      style={[styles.moduleRow, { backgroundColor: themeColors.surface }]}
      onPress={() => router.push(`/modules/${item.id}`)}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
          item.label,
          'What would you like to do?',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Archive', onPress: () => handleArchive(item.id, false) },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => handleDelete(item.id),
            },
          ],
        );
      }}
    >
      <Text style={styles.emoji}>{item.emoji ?? '📦'}</Text>
      <View style={styles.moduleInfo}>
        <Text style={[styles.moduleLabel, { color: themeColors.text }]}>{item.label}</Text>
        <View style={styles.badges}>
          <View style={[styles.typeBadge, { backgroundColor: themeColors.accentLight }]}>
            <Text style={[styles.typeBadgeText, { color: themeColors.accent }]}>{TYPE_LABELS[item.type] ?? item.type}</Text>
          </View>
          {item.placements.map(p => (
            <Text key={p} style={[styles.placementText, { color: themeColors.muted }]}>{p}</Text>
          ))}
        </View>
      </View>
      <Pressable
        style={styles.rowDeleteBtn}
        onPress={() => {
          Alert.alert('Delete Module', `Delete "${item.label}"? This cannot be undone.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item.id) },
          ]);
        }}
        hitSlop={8}
      >
        <Feather name="trash-2" size={16} color={themeColors.danger} />
      </Pressable>
    </Pressable>
  );

  return (
    <ScreenWrapper>
      <SectionHeader title="Modules" subtitle={`${active.length} active`} />

      {active.length === 0 && (
        <View style={styles.emptyState}>
          <Feather name="box" size={40} color={themeColors.muted} />
          <Text style={[styles.emptyText, { color: themeColors.text }]}>No modules yet</Text>
          <Text style={[styles.emptySubtext, { color: themeColors.muted }]}>Create your first module to start tracking</Text>
        </View>
      )}

      {active.map(item => <React.Fragment key={item.id}>{renderItem({ item })}</React.Fragment>)}

      {archived.length > 0 && (
        <>
          <SectionHeader title="Archived" subtitle={`${archived.length} modules`} />
          {archived.map(item => (
            <Pressable
              key={item.id}
              style={[styles.moduleRow, styles.archivedRow, { backgroundColor: themeColors.surface }]}
              onPress={() => handleArchive(item.id, true)}
            >
              <Text style={styles.emoji}>{item.emoji ?? '📦'}</Text>
              <View style={styles.moduleInfo}>
                <Text style={[styles.moduleLabel, { color: themeColors.muted }]}>{item.label}</Text>
                <Text style={[styles.placementText, { color: themeColors.muted }]}>Tap to restore</Text>
              </View>
              <Feather name="rotate-ccw" size={16} color={themeColors.muted} />
            </Pressable>
          ))}
        </>
      )}

      <Pressable style={[styles.createBtn, { backgroundColor: themeColors.accent }]} onPress={() => router.push('/modules/create')}>
        <Feather name="plus" size={20} color={themeColors.white} />
        <Text style={[styles.createBtnText, { color: themeColors.white }]}>New Module</Text>
      </Pressable>

      {undoToast && (
        <UndoToast
          message={undoToast.message}
          visible={true}
          onUndo={() => {
            undoToast.undoAction();
            if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
            setUndoToast(null);
          }}
          onDismiss={() => setUndoToast(null)}
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  moduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowDeleteBtn: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
  archivedRow: {
    opacity: 0.6,
  },
  emoji: {
    fontSize: 24,
    marginRight: spacing.sm,
  },
  moduleInfo: {
    flex: 1,
  },
  moduleLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  typeBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  typeBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  placementText: {
    fontSize: fontSize.xs,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: fontSize.sm,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.md,
  },
  createBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
