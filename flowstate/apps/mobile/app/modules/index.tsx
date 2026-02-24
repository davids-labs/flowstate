import React, { useState, useCallback, useRef, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { SectionHeader } from '../../components/layout/SectionHeader';
import UndoToast from '../../components/shared/UndoToast';
import { getModuleSpecs, getCollections, deleteModuleSpec, updateModuleSpec } from '@flowstate/core';
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
  timer: 'Timer',
  group: 'Group',
};

interface CollectionRow {
  id: string;
  name: string;
  emoji?: string | null;
  parentId?: string | null;
  type: string;
}

interface ModuleRow {
  id: string;
  type: string;
  label: string;
  emoji?: string | null;
  isLive: boolean;
  required: boolean;
  placements: string[];
  collectionId?: string | null;
  archivedAt?: string | null;
}

export default function ModulesScreen() {
  const router = useRouter();
  const { db, isReady } = useDatabaseSafe();
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [allCollections, setAllCollections] = useState<CollectionRow[]>([]);
  const [folderStack, setFolderStack] = useState<Array<{ id: string | null; name: string }>>([
    { id: null, name: 'Modules' },
  ]);
  const { themeColors } = useTheme();

  const currentFolderId = folderStack[folderStack.length - 1].id;
  const currentFolderName = folderStack[folderStack.length - 1].name;

  const loadData = useCallback(async () => {
    if (!db || !isReady) return;
    try {
      const [specs, cols] = await Promise.all([
        getModuleSpecs(db),
        getCollections(db),
      ]);
      setModules(specs.map((s: any) => ({
        id: s.id,
        type: s.type,
        label: s.label,
        emoji: s.emoji,
        isLive: !!s.isLive,
        required: !!s.required,
        placements: Array.isArray(s.placements) ? s.placements : [],
        collectionId: s.collectionId ?? null,
        archivedAt: s.archivedAt,
      })));
      setAllCollections(cols.map((c: any) => ({
        id: c.id,
        name: c.name,
        emoji: c.emoji,
        parentId: c.parentId ?? null,
        type: c.type,
      })));
    } catch (err) {
      console.error('Failed to load modules:', err);
    }
  }, [db, isReady]);

  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

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
      try { await updateModuleSpec(db, id, { archivedAt: null }); loadData(); } catch (e) { console.error('Restore failed:', e); }
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

  // Filter: show folders and modules for the current nesting level
  const visibleFolders = allCollections.filter(c =>
    currentFolderId === null ? !c.parentId : c.parentId === currentFolderId,
  );
  const visibleModules = modules.filter(m =>
    !m.archivedAt && (currentFolderId === null ? !m.collectionId : m.collectionId === currentFolderId),
  );
  const archived = modules.filter(m => !!m.archivedAt);

  const enterFolder = (folder: CollectionRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFolderStack(prev => [...prev, { id: folder.id, name: folder.name }]);
  };

  const goBack = () => {
    if (folderStack.length > 1) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setFolderStack(prev => prev.slice(0, -1));
    }
  };

  const renderFolderItem = (folder: CollectionRow) => (
    <Pressable
      key={folder.id}
      style={[styles.moduleRow, { backgroundColor: themeColors.surface }]}
      onPress={() => enterFolder(folder)}
    >
      <Text style={styles.emoji}>{folder.emoji ?? '📁'}</Text>
      <View style={styles.moduleInfo}>
        <Text style={[styles.moduleLabel, { color: themeColors.text }]}>{folder.name}</Text>
        <View style={styles.badges}>
          <View style={[styles.typeBadge, { backgroundColor: themeColors.accentLight }]}>
            <Text style={[styles.typeBadgeText, { color: themeColors.accent }]}>Collection</Text>
          </View>
        </View>
      </View>
      <Feather name="chevron-right" size={18} color={themeColors.muted} />
    </Pressable>
  );

  const renderModuleItem = (item: ModuleRow) => (
    <Pressable
      key={item.id}
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
            { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item.id) },
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
      {/* Breadcrumb / Back navigation */}
      {folderStack.length > 1 && (
        <Pressable style={styles.backRow} onPress={goBack}>
          <Feather name="arrow-left" size={18} color={themeColors.accent} />
          <Text style={[styles.backText, { color: themeColors.accent }]}>
            {folderStack[folderStack.length - 2].name}
          </Text>
        </Pressable>
      )}

      <SectionHeader
        title={currentFolderName}
        subtitle={`${visibleFolders.length} folders · ${visibleModules.length} modules`}
      />

      {visibleFolders.length === 0 && visibleModules.length === 0 && (
        <View style={styles.emptyState}>
          <Feather name="box" size={40} color={themeColors.muted} />
          <Text style={[styles.emptyText, { color: themeColors.text }]}>
            {currentFolderId ? 'Empty folder' : 'No modules yet'}
          </Text>
          <Text style={[styles.emptySubtext, { color: themeColors.muted }]}>
            {currentFolderId ? 'Add modules to this collection' : 'Create your first module to start tracking'}
          </Text>
        </View>
      )}

      {/* Folders first */}
      {visibleFolders.map(renderFolderItem)}

      {/* Then modules */}
      {visibleModules.map(renderModuleItem)}

      {/* Archived (only at root) */}
      {currentFolderId === null && archived.length > 0 && (
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
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  backText: {
    fontSize: fontSize.md,
    fontWeight: '500',
  },
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
