import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, Alert, ScrollView, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import {
  getRoutine, getRoutineBlocks, updateRoutine, createRoutineBlock,
  updateRoutineBlock, deleteRoutineBlock,
  getRoutineBlockSets, createRoutineBlockSet, updateRoutineBlockSet, deleteRoutineBlockSet,
} from '@flowstate/core';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

const BLOCK_TYPES = ['focus', 'break', 'warmup', 'cooldown', 'custom'] as const;
type BlockType = (typeof BLOCK_TYPES)[number];

interface BlockTodoItem {
  id: string;
  text: string;
}

interface BlockDraft {
  key: string;
  dbId?: string; // existing DB id, undefined for new blocks
  name: string;
  durationMinutes: number;
  type: BlockType;
  // V2: Feature 4 - Session To-Do List
  todos: BlockTodoItem[];
  // V2: Feature 2 - Goal-Based Blocks
  blockMode: 'timed' | 'goal_based' | 'countup';
  goalTarget: string; // string for TextInput, convert to number on save
  // V2: Feature 1 - Lift tag for gym stats
  liftTag: string;
  // V2: Feature 3 - Variable Block Sets
  blockSetId: string | null; // null = appears in all sets
}

const TYPE_ICONS: Record<BlockType, string> = {
  focus: 'target',
  break: 'coffee',
  warmup: 'sunrise',
  cooldown: 'moon',
  custom: 'zap',
};

export default function EditRoutineScreen() {
  const { themeColors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { db, isReady } = useDatabaseSafe();

  const keyCounterRef = useRef(100);
  const nextKey = () => `block_${++keyCounterRef.current}`;

  const TYPE_COLORS: Record<BlockType, string> = useMemo(() => ({
    focus: themeColors.accent,
    break: themeColors.success,
    warmup: '#F59E0B',
    cooldown: '#8B5CF6',
    custom: themeColors.muted,
  }), [themeColors]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [blocks, setBlocks] = useState<BlockDraft[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [originalBlockIds, setOriginalBlockIds] = useState<string[]>([]);
  // V2: Feature 6 - Routine mode
  const [routineMode, setRoutineMode] = useState<'sequential' | 'countup_list'>('sequential');
  const [routinePillar, setRoutinePillar] = useState('general');
  // Expanded block state for todo editor
  const [expandedBlockKey, setExpandedBlockKey] = useState<string | null>(null);
  const [newTodoText, setNewTodoText] = useState('');
  // V2: Feature 3 - Variable Block Sets
  const [blockSets, setBlockSets] = useState<Array<{ id: string; name: string; isDefault: number }>>([]);
  const [activeSetId, setActiveSetId] = useState<string | null>(null); // null = "All"
  const [newSetName, setNewSetName] = useState('');

  // ─── Load existing routine ────────────────────────────────────
  const loadRoutine = useCallback(async () => {
    if (!db || !isReady || !id) return;
    try {
      const routine = await getRoutine(db, id);
      if (!routine) {
        Alert.alert('Not found', 'Routine not found.');
        router.canGoBack() ? router.back() : router.replace('/(tabs)');
        return;
      }
      setName(routine.name);
      setDescription(routine.description || '');
      setRoutineMode((routine as any).mode ?? 'sequential');
      setRoutinePillar((routine as any).pillar ?? 'general');

      const existingBlocks = await getRoutineBlocks(db, id);
      const drafts: BlockDraft[] = existingBlocks.map((b: any) => ({
        key: nextKey(),
        dbId: b.id,
        name: b.name,
        durationMinutes: b.durationMinutes,
        type: b.type as BlockType,
        todos: (() => { try { return JSON.parse(b.todos ?? '[]'); } catch { return []; } })(),
        blockMode: b.blockMode ?? 'timed',
        goalTarget: b.goalTarget != null ? String(b.goalTarget) : '',
        liftTag: b.liftTag ?? '',
        blockSetId: b.blockSetId ?? null,
      }));
      setBlocks(drafts);
      setOriginalBlockIds(existingBlocks.map((b: any) => b.id));

      const sets = await getRoutineBlockSets(db, id);
      setBlockSets(sets as any);
      setLoaded(true);
    } catch (e) {
      console.error('Failed to load routine:', e);
    }
  }, [db, isReady, id]);

  useFocusEffect(useCallback(() => { if (!loaded) loadRoutine(); }, [loaded, loadRoutine]));

  // ─── Block ops ────────────────────────────────────────────────
  const addBlock = (type: BlockType = 'focus') => {
    setBlocks((prev) => [
      ...prev,
      {
        key: nextKey(),
        name: type === 'break' ? 'Break' : `Block ${prev.length + 1}`,
        durationMinutes: type === 'break' ? 5 : 25,
        type,
        todos: [],
        blockMode: 'timed',
        goalTarget: '',
        liftTag: '',
        blockSetId: activeSetId, // assign to active set (null = all sets)
      },
    ]);
  };

  const updateBlockDraft = (key: string, field: Partial<BlockDraft>) => {
    setBlocks((prev) => prev.map((b) => (b.key === key ? { ...b, ...field } : b)));
  };

  const removeBlock = (key: string) => {
    setBlocks((prev) => prev.filter((b) => b.key !== key));
  };

  const moveBlock = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    setBlocks((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const addTodoToBlock = (key: string, text: string) => {
    if (!text.trim()) return;
    setBlocks((prev) =>
      prev.map((b) =>
        b.key === key
          ? { ...b, todos: [...b.todos, { id: `todo_${Date.now()}_${Math.random().toString(36).slice(2)}`, text: text.trim() }] }
          : b,
      ),
    );
  };

  const removeTodoFromBlock = (blockKey: string, todoId: string) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.key === blockKey ? { ...b, todos: b.todos.filter((t) => t.id !== todoId) } : b,
      ),
    );
  };

  // ─── Block Set ops ────────────────────────────────────────────
  const addBlockSet = async () => {
    const name = newSetName.trim();
    if (!name || !db || !id) return;
    try {
      const newId = await createRoutineBlockSet(db, id, name, blockSets.length === 0);
      const fresh = await getRoutineBlockSets(db, id);
      setBlockSets(fresh as any);
      setActiveSetId(newId);
      setNewSetName('');
    } catch (e) {
      console.error('Failed to create block set:', e);
    }
  };

  const removeBlockSet = (setId: string) => {
    Alert.alert(
      'Delete Set',
      'Blocks in this set will be moved to "All". This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteRoutineBlockSet(db, setId);
              const fresh = await getRoutineBlockSets(db, id!);
              setBlockSets(fresh as any);
              if (activeSetId === setId) setActiveSetId(null);
              // Update local drafts: blocks that belonged to this set revert to null
              setBlocks((prev) => prev.map((b) => b.blockSetId === setId ? { ...b, blockSetId: null } : b));
            } catch (e) {
              console.error('Failed to delete block set:', e);
            }
          },
        },
      ],
    );
  };

  const adjustDuration = (key: string, delta: number) => {
    setBlocks((prev) =>
      prev.map((b) =>
        b.key === key ? { ...b, durationMinutes: Math.max(1, b.durationMinutes + delta) } : b,
      ),
    );
  };

  const totalMinutes = blocks.reduce((sum, b) => sum + b.durationMinutes, 0);

  // ─── Save ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!db || !isReady || !id) return;
    const trimmedName = name.trim();
    if (!trimmedName) {
      Alert.alert('Name required', 'Give your routine a name.');
      return;
    }
    if (blocks.length === 0) {
      Alert.alert('No blocks', 'Add at least one block to your routine.');
      return;
    }
    setSaving(true);
    try {
      // Update routine metadata (including V2 mode + pillar)
      await updateRoutine(db, id, {
        name: trimmedName,
        description: description.trim() || undefined,
        totalDurationMinutes: totalMinutes,
        mode: routineMode,
        pillar: routinePillar,
      } as any);

      // Determine which blocks were removed
      const currentDbIds = blocks.filter((b) => b.dbId).map((b) => b.dbId!);
      const removedIds = originalBlockIds.filter((oid) => !currentDbIds.includes(oid));
      for (const rid of removedIds) {
        await deleteRoutineBlock(db, rid);
      }

      // Upsert blocks with V2 fields
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        const v2Fields = {
          todos: JSON.stringify(b.todos),
          blockMode: b.blockMode,
          goalTarget: b.goalTarget ? parseInt(b.goalTarget, 10) : null,
          liftTag: b.liftTag.trim() || null,
          blockSetId: b.blockSetId ?? null,
        };
        if (b.dbId) {
          await updateRoutineBlock(db, b.dbId, {
            name: b.name,
            durationMinutes: b.durationMinutes,
            type: b.type,
            order: i,
            ...v2Fields,
          } as any);
        } else {
          await createRoutineBlock(db, {
            routineId: id,
            name: b.name,
            durationMinutes: b.durationMinutes,
            type: b.type,
            order: i,
            ...v2Fields,
          } as any);
        }
      }

      router.canGoBack() ? router.back() : router.replace('/(tabs)');
    } catch (e) {
      console.error('Failed to update routine:', e);
      Alert.alert('Error', 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <ScreenWrapper>
        <View style={styles.loading}>
          <Text style={[styles.loadingText, { color: themeColors.muted }]}>Loading…</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper scrollable>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        {/* Name */}
        <Text style={[styles.label, { color: themeColors.muted }]}>Name</Text>
        <TextInput
          style={[styles.input, { backgroundColor: themeColors.surface, color: themeColors.text, borderColor: themeColors.border }]}
          value={name}
          onChangeText={setName}
          placeholder="Routine name"
          placeholderTextColor={themeColors.muted}
        />

        {/* Description */}
        <Text style={[styles.label, { color: themeColors.muted }]}>Description</Text>
        <TextInput
          style={[styles.input, { minHeight: 60, backgroundColor: themeColors.surface, color: themeColors.text, borderColor: themeColors.border }]}
          value={description}
          onChangeText={setDescription}
          placeholder="Optional description"
          placeholderTextColor={themeColors.muted}
          multiline
        />

        {/* V2: Routine Mode */}
        <Text style={[styles.label, { color: themeColors.muted }]}>Mode</Text>
        <View style={styles.modeRow}>
          {(['sequential', 'countup_list'] as const).map((m) => (
            <Pressable
              key={m}
              style={[
                styles.modeChip,
                { borderColor: themeColors.border },
                routineMode === m && { borderColor: themeColors.accent, backgroundColor: themeColors.accentLight },
              ]}
              onPress={() => setRoutineMode(m)}
            >
              <Text style={[styles.modeChipText, { color: themeColors.muted }, routineMode === m && { color: themeColors.accent }]}>
                {m === 'sequential' ? 'Sequential (Timed)' : 'Count-Up List'}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* V2: Routine Pillar */}
        <Text style={[styles.label, { color: themeColors.muted }]}>Pillar</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.sm }}>
          <View style={styles.addRow}>
            {(['general', 'gym', 'academic', 'life'] as const).map((p) => (
              <Pressable
                key={p}
                style={[
                  styles.addBtn,
                  { borderColor: themeColors.border },
                  routinePillar === p && { borderColor: themeColors.accent, backgroundColor: themeColors.accentLight, borderStyle: 'solid' },
                ]}
                onPress={() => setRoutinePillar(p)}
              >
                <Text style={[styles.addBtnText, { color: themeColors.muted }, routinePillar === p && { color: themeColors.accent }]}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        {/* Summary */}
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: themeColors.muted }]}>{blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}</Text>
          <Text style={[styles.summaryLabel, { color: themeColors.muted }]}>{formatDuration(totalMinutes)} total</Text>
        </View>

        {/* V2: Feature 3 - Block Sets tab bar */}
        <Text style={[styles.label, { marginTop: spacing.md, color: themeColors.muted }]}>Block Sets</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.xs }}>
          <View style={{ flexDirection: 'row', gap: spacing.xs, alignItems: 'center' }}>
            {/* "All" tab */}
            <Pressable
              style={[
                styles.setTab,
                { borderColor: themeColors.border },
                activeSetId === null && { borderColor: themeColors.accent, backgroundColor: themeColors.accentLight },
              ]}
              onPress={() => setActiveSetId(null)}
            >
              <Text style={[styles.setTabText, { color: themeColors.muted }, activeSetId === null && { color: themeColors.accent }]}>All</Text>
            </Pressable>
            {blockSets.map((set) => (
              <Pressable
                key={set.id}
                style={[
                  styles.setTab,
                  { borderColor: themeColors.border },
                  activeSetId === set.id && { borderColor: themeColors.accent, backgroundColor: themeColors.accentLight },
                ]}
                onPress={() => setActiveSetId(set.id)}
                onLongPress={() => removeBlockSet(set.id)}
              >
                <Text style={[styles.setTabText, { color: themeColors.muted }, activeSetId === set.id && { color: themeColors.accent }]}>
                  {set.name}{set.isDefault ? ' ★' : ''}
                </Text>
              </Pressable>
            ))}
            {/* Add new set inline */}
            <View style={[styles.setAddRow, { borderColor: themeColors.border }]}>
              <TextInput
                style={[styles.setNameInput, { color: themeColors.text }]}
                value={newSetName}
                onChangeText={setNewSetName}
                placeholder="New set…"
                placeholderTextColor={themeColors.muted}
                returnKeyType="done"
                onSubmitEditing={addBlockSet}
              />
              <Pressable hitSlop={8} onPress={addBlockSet}>
                <Feather name="plus" size={16} color={themeColors.accent} />
              </Pressable>
            </View>
          </View>
        </ScrollView>
        {blockSets.length > 0 && (
          <Text style={[styles.setHint, { color: themeColors.muted }]}>
            {activeSetId === null
              ? 'Showing all blocks. Tap a set to filter.'
              : `Blocks assigned to "${blockSets.find((s) => s.id === activeSetId)?.name}".`}
            {'  Long-press a set tab to delete it.'}
          </Text>
        )}

        {/* Blocks */}
        <Text style={[styles.label, { marginTop: spacing.md, color: themeColors.muted }]}>Blocks</Text>
        {blocks
          .map((block, origIndex) => ({ block, origIndex }))
          .filter(({ block }) => activeSetId === null || block.blockSetId === activeSetId || block.blockSetId === null)
          .map(({ block, origIndex: index }) => (
          <View key={block.key} style={[styles.blockCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <View style={styles.blockHeader}>
              <View style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[block.type] + '20' }]}>
                <Feather name={TYPE_ICONS[block.type] as any} size={14} color={TYPE_COLORS[block.type]} />
                <Text style={[styles.typeText, { color: TYPE_COLORS[block.type] }]}>{block.type}</Text>
              </View>
              {/* V2: Feature 3 - show/assign set when sets exist */}
              {blockSets.length > 0 && (
                <Pressable
                  style={[styles.setChip, { borderColor: themeColors.border }]}
                  onPress={() => {
                    // Cycle: null → first set → ... → last set → null
                    const allIds = [null, ...blockSets.map((s) => s.id)];
                    const current = block.blockSetId;
                    const idx = allIds.indexOf(current);
                    const next = allIds[(idx + 1) % allIds.length] ?? null;
                    updateBlockDraft(block.key, { blockSetId: next });
                  }}
                >
                  <Feather name="layers" size={11} color={themeColors.muted} />
                  <Text style={[styles.setChipText, { color: themeColors.muted }]}>
                    {block.blockSetId ? (blockSets.find((s) => s.id === block.blockSetId)?.name ?? 'Set') : 'All'}
                  </Text>
                </Pressable>
              )}
              <View style={styles.blockActions}>
                <Pressable onPress={() => moveBlock(index, -1)} hitSlop={8}>
                  <Feather name="arrow-up" size={16} color={index === 0 ? themeColors.border : themeColors.muted} />
                </Pressable>
                <Pressable onPress={() => moveBlock(index, 1)} hitSlop={8}>
                  <Feather name="arrow-down" size={16} color={index === blocks.length - 1 ? themeColors.border : themeColors.muted} />
                </Pressable>
                <Pressable onPress={() => removeBlock(block.key)} hitSlop={8}>
                  <Feather name="trash-2" size={16} color={themeColors.danger} />
                </Pressable>
              </View>
            </View>

            <TextInput
              style={[styles.blockNameInput, { color: themeColors.text, borderBottomColor: themeColors.border }]}
              value={block.name}
              onChangeText={(t) => updateBlockDraft(block.key, { name: t })}
              placeholder="Block name"
              placeholderTextColor={themeColors.muted}
            />

            <View style={styles.durationRow}>
              <Pressable style={[styles.durationBtn, { backgroundColor: themeColors.accentLight }]} onPress={() => adjustDuration(block.key, -5)}>
                <Feather name="minus" size={16} color={themeColors.accent} />
              </Pressable>
              <Pressable style={[styles.durationBtn, { backgroundColor: themeColors.accentLight }]} onPress={() => adjustDuration(block.key, -1)}>
                <Text style={[styles.durationBtnText, { color: themeColors.accent }]}>-1</Text>
              </Pressable>
              <Text style={[styles.durationValue, { color: themeColors.text }]}>{block.durationMinutes}m</Text>
              <Pressable style={[styles.durationBtn, { backgroundColor: themeColors.accentLight }]} onPress={() => adjustDuration(block.key, 1)}>
                <Text style={[styles.durationBtnText, { color: themeColors.accent }]}>+1</Text>
              </Pressable>
              <Pressable style={[styles.durationBtn, { backgroundColor: themeColors.accentLight }]} onPress={() => adjustDuration(block.key, 5)}>
                <Feather name="plus" size={16} color={themeColors.accent} />
              </Pressable>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.typePills}>
              {BLOCK_TYPES.map((t) => (
                <Pressable
                  key={t}
                  style={[styles.pill, { backgroundColor: themeColors.background }, block.type === t && { backgroundColor: themeColors.accent }]}
                  onPress={() => updateBlockDraft(block.key, { type: t })}
                >
                  <Text style={[styles.pillText, { color: themeColors.muted }, block.type === t && { color: themeColors.white }]}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* V2: Feature 2 - Block Mode */}
            <View style={styles.blockModeRow}>
              {(['timed', 'goal_based', 'countup'] as const).map((m) => (
                <Pressable
                  key={m}
                  style={[
                    styles.blockModeChip,
                    { borderColor: themeColors.border },
                    block.blockMode === m && { borderColor: themeColors.accent, backgroundColor: themeColors.accentLight },
                  ]}
                  onPress={() => updateBlockDraft(block.key, { blockMode: m })}
                >
                  <Text style={[styles.pillText, { color: themeColors.muted }, block.blockMode === m && { color: themeColors.accent }]}>
                    {m === 'timed' ? 'Timed' : m === 'goal_based' ? 'Goal' : 'Free'}
                  </Text>
                </Pressable>
              ))}
            </View>
            {block.blockMode === 'goal_based' && (
              <TextInput
                style={[styles.blockNameInput, { color: themeColors.text, borderBottomColor: themeColors.border }]}
                value={block.goalTarget}
                onChangeText={(t) => updateBlockDraft(block.key, { goalTarget: t })}
                placeholder="Target count (e.g. 30)"
                placeholderTextColor={themeColors.muted}
                keyboardType="numeric"
              />
            )}

            {/* V2: Feature 9 - Lift tag */}
            {block.type === 'focus' && (
              <TextInput
                style={[styles.blockNameInput, { color: themeColors.text, borderBottomColor: themeColors.border, marginTop: spacing.xs }]}
                value={block.liftTag}
                onChangeText={(t) => updateBlockDraft(block.key, { liftTag: t })}
                placeholder="Lift tag (e.g. Bench Press)"
                placeholderTextColor={themeColors.muted}
              />
            )}

            {/* V2: Feature 4 - Block Todos */}
            <Pressable
              style={[styles.todoToggle, { borderColor: themeColors.border }]}
              onPress={() => setExpandedBlockKey(expandedBlockKey === block.key ? null : block.key)}
            >
              <Feather name="check-square" size={14} color={block.todos.length > 0 ? themeColors.accent : themeColors.muted} />
              <Text style={[styles.todoToggleText, { color: block.todos.length > 0 ? themeColors.accent : themeColors.muted }]}>
                To-dos ({block.todos.length})
              </Text>
              <Feather name={expandedBlockKey === block.key ? 'chevron-up' : 'chevron-down'} size={14} color={themeColors.muted} />
            </Pressable>
            {expandedBlockKey === block.key && (
              <View style={styles.todoSection}>
                {block.todos.map((todo) => (
                  <View key={todo.id} style={styles.todoRow}>
                    <Feather name="circle" size={14} color={themeColors.muted} />
                    <Text style={[styles.todoText, { color: themeColors.text }]}>{todo.text}</Text>
                    <Pressable hitSlop={8} onPress={() => removeTodoFromBlock(block.key, todo.id)}>
                      <Feather name="x" size={14} color={themeColors.muted} />
                    </Pressable>
                  </View>
                ))}
                <View style={styles.todoAddRow}>
                  <TextInput
                    style={[styles.todoInput, { color: themeColors.text, borderColor: themeColors.border, backgroundColor: themeColors.background }]}
                    placeholder="Add todo…"
                    placeholderTextColor={themeColors.muted}
                    value={expandedBlockKey === block.key ? newTodoText : ''}
                    onChangeText={setNewTodoText}
                    onSubmitEditing={() => {
                      addTodoToBlock(block.key, newTodoText);
                      setNewTodoText('');
                    }}
                    returnKeyType="done"
                  />
                  <Pressable
                    style={[styles.todoAddBtn, { backgroundColor: themeColors.accent }]}
                    onPress={() => {
                      addTodoToBlock(block.key, newTodoText);
                      setNewTodoText('');
                    }}
                  >
                    <Feather name="plus" size={16} color="#fff" />
                  </Pressable>
                </View>
              </View>
            )}
          </View>
        ))}

        {/* Add block buttons */}
        <View style={styles.addRow}>
          <Pressable style={[styles.addBtn, { borderColor: themeColors.border }]} onPress={() => addBlock('focus')}>
            <Feather name="plus" size={16} color={themeColors.accent} />
            <Text style={[styles.addBtnText, { color: themeColors.accent }]}>Focus</Text>
          </Pressable>
          <Pressable style={[styles.addBtn, { borderColor: themeColors.border }]} onPress={() => addBlock('break')}>
            <Feather name="coffee" size={16} color={themeColors.success} />
            <Text style={[styles.addBtnText, { color: themeColors.success }]}>Break</Text>
          </Pressable>
          <Pressable style={[styles.addBtn, { borderColor: themeColors.border }]} onPress={() => addBlock('custom')}>
            <Feather name="zap" size={16} color={themeColors.muted} />
            <Text style={[styles.addBtnText, { color: themeColors.muted }]}>Custom</Text>
          </Pressable>
        </View>

        {/* Save */}
        <Pressable
          style={[styles.saveBtn, { backgroundColor: themeColors.accent }, saving && { opacity: 0.5 }]}
          onPress={handleSave}
          disabled={saving}
        >
          <Feather name="check" size={20} color={themeColors.white} />
          <Text style={[styles.saveBtnText, { color: themeColors.white }]}>{saving ? 'Saving…' : 'Save Changes'}</Text>
        </Pressable>

        <View style={{ height: spacing.xxl }} />
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
}

function formatDuration(mins: number): string {
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${mins}m`;
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xxl,
  },
  loadingText: {
    fontSize: fontSize.md,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  summaryLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  blockCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  blockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  typeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  blockActions: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  blockNameInput: {
    fontSize: fontSize.md,
    fontWeight: '600',
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  durationBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  durationValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    minWidth: 50,
    textAlign: 'center',
  },
  typePills: {
    marginTop: spacing.sm,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.xl,
    marginRight: spacing.xs,
  },
  pillText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  addRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  addBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  addBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  saveBtn: {
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  saveBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  // V2 styles
  modeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  modeChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    alignItems: 'center',
  },
  modeChipText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  blockModeRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: spacing.xs,
  },
  blockModeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  todoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
  },
  todoToggleText: {
    flex: 1,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  todoSection: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  todoText: {
    flex: 1,
    fontSize: fontSize.sm,
  },
  todoAddRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 2,
  },
  todoInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: borderRadius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    fontSize: fontSize.sm,
  },
  todoAddBtn: {
    width: 32,
    height: 32,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // V2: Feature 3 - Block Sets
  setTab: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderStyle: 'dashed' as const,
  },
  setTabText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  setAddRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderStyle: 'dashed' as const,
  },
  setNameInput: {
    fontSize: fontSize.xs,
    minWidth: 80,
    maxWidth: 120,
    paddingVertical: 0,
  },
  setHint: {
    fontSize: fontSize.xs,
    marginBottom: spacing.xs,
    fontStyle: 'italic',
  },
  setChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  setChipText: {
    fontSize: 10,
    fontWeight: '500',
  },
});
