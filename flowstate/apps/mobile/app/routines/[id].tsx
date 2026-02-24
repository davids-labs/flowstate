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
} from '@flowstate/core';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

const BLOCK_TYPES = ['focus', 'break', 'warmup', 'cooldown', 'custom'] as const;
type BlockType = (typeof BLOCK_TYPES)[number];

interface BlockDraft {
  key: string;
  dbId?: string; // existing DB id, undefined for new blocks
  name: string;
  durationMinutes: number;
  type: BlockType;
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

      const existingBlocks = await getRoutineBlocks(db, id);
      const drafts: BlockDraft[] = existingBlocks.map((b: any) => ({
        key: nextKey(),
        dbId: b.id,
        name: b.name,
        durationMinutes: b.durationMinutes,
        type: b.type as BlockType,
      }));
      setBlocks(drafts);
      setOriginalBlockIds(existingBlocks.map((b: any) => b.id));
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
      { key: nextKey(), name: type === 'break' ? 'Break' : `Block ${prev.length + 1}`, durationMinutes: type === 'break' ? 5 : 25, type },
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
      // Update routine metadata
      await updateRoutine(db, id, {
        name: trimmedName,
        description: description.trim() || undefined,
        totalDurationMinutes: totalMinutes,
      });

      // Determine which blocks were removed
      const currentDbIds = blocks.filter((b) => b.dbId).map((b) => b.dbId!);
      const removedIds = originalBlockIds.filter((oid) => !currentDbIds.includes(oid));
      for (const rid of removedIds) {
        await deleteRoutineBlock(db, rid);
      }

      // Upsert blocks
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        if (b.dbId) {
          await updateRoutineBlock(db, b.dbId, {
            name: b.name,
            durationMinutes: b.durationMinutes,
            type: b.type,
            order: i,
          });
        } else {
          await createRoutineBlock(db, {
            routineId: id,
            name: b.name,
            durationMinutes: b.durationMinutes,
            type: b.type,
            order: i,
          });
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

        {/* Summary */}
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryLabel, { color: themeColors.muted }]}>{blocks.length} {blocks.length === 1 ? 'block' : 'blocks'}</Text>
          <Text style={[styles.summaryLabel, { color: themeColors.muted }]}>{formatDuration(totalMinutes)} total</Text>
        </View>

        {/* Blocks */}
        <Text style={[styles.label, { marginTop: spacing.md, color: themeColors.muted }]}>Blocks</Text>
        {blocks.map((block, index) => (
          <View key={block.key} style={[styles.blockCard, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
            <View style={styles.blockHeader}>
              <View style={[styles.typeBadge, { backgroundColor: TYPE_COLORS[block.type] + '20' }]}>
                <Feather name={TYPE_ICONS[block.type] as any} size={14} color={TYPE_COLORS[block.type]} />
                <Text style={[styles.typeText, { color: TYPE_COLORS[block.type] }]}>{block.type}</Text>
              </View>
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
});
