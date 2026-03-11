/**
 * Feature 5 - Session Planner: Per-Block Instructions
 *
 * A bottom-sheet modal that shows all blocks of a session with a
 * TextInput per block, allowing the user to write custom instructions
 * for each block in this specific session instance.
 *
 * Instructions are persisted to sessionBlockInstructions via queries.ts.
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';
import { useDatabaseSafe } from '../DatabaseProvider';
import {
  getRoutineBlocks,
  getSessionBlockInstructions,
  upsertSessionBlockInstructions,
} from '@flowstate/core';

interface BlockRow {
  index: number;
  name: string;
  type: string;
  durationMinutes: number;
  instructions: string;
}

interface Props {
  visible: boolean;
  sessionId: string;
  routineId: string;
  routineName: string;
  onClose: () => void;
}

export function SessionPlannerSheet({
  visible,
  sessionId,
  routineId,
  routineName,
  onClose,
}: Props) {
  const { themeColors } = useTheme();
  const { db } = useDatabaseSafe();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [blocks, setBlocks] = useState<BlockRow[]>([]);

  // Load blocks + existing instructions on open
  useEffect(() => {
    if (!visible || !db || !routineId) return;
    setLoading(true);
    (async () => {
      try {
        const blks = await getRoutineBlocks(db, routineId);
        const rows: BlockRow[] = await Promise.all(
          blks.map(async (b: any, i: number) => {
            const instr = await getSessionBlockInstructions(db, sessionId, i);
            return {
              index: i,
              name: b.name,
              type: b.type ?? 'focus',
              durationMinutes: b.durationMinutes,
              instructions: instr,
            };
          }),
        );
        setBlocks(rows);
      } catch (e) {
        console.error('SessionPlannerSheet load error:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, db, routineId, sessionId]);

  const handleChange = useCallback((index: number, text: string) => {
    setBlocks((prev) =>
      prev.map((b) => (b.index === index ? { ...b, instructions: text } : b)),
    );
  }, []);

  const handleSave = useCallback(async () => {
    if (!db) return;
    setSaving(true);
    try {
      await Promise.all(
        blocks.map((b) =>
          upsertSessionBlockInstructions(db, sessionId, b.index, b.instructions),
        ),
      );
      onClose();
    } catch (e) {
      console.error('SessionPlannerSheet save error:', e);
    } finally {
      setSaving(false);
    }
  }, [db, sessionId, blocks, onClose]);

  const TYPE_COLORS: Record<string, string> = {
    focus: themeColors.accent,
    break: themeColors.success,
    warmup: '#F59E0B',
    cooldown: '#8B5CF6',
    custom: themeColors.muted,
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: themeColors.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={[styles.header, { borderBottomColor: themeColors.surfaceBorder }]}>
          <Pressable style={styles.closeBtn} onPress={onClose}>
            <Feather name="x" size={22} color={themeColors.muted} />
          </Pressable>
          <View style={styles.headerTitle}>
            <Text style={[styles.title, { color: themeColors.text }]}>Session Planner</Text>
            <Text style={[styles.subtitle, { color: themeColors.muted }]}>{routineName}</Text>
          </View>
          <Pressable
            style={[styles.saveBtn, { backgroundColor: themeColors.accent }, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving
              ? <ActivityIndicator size="small" color={themeColors.white} />
              : <Text style={[styles.saveBtnText, { color: themeColors.white }]}>Save</Text>
            }
          </Pressable>
        </View>

        {/* Intro */}
        <View style={[styles.infoBanner, { backgroundColor: themeColors.accentLight }]}>
          <Feather name="info" size={14} color={themeColors.accent} />
          <Text style={[styles.infoText, { color: themeColors.accent }]}>
            Add notes for each block — visible during the session.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={themeColors.accent} />
          </View>
        ) : (
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {blocks.map((block) => (
              <View
                key={block.index}
                style={[styles.blockCard, { backgroundColor: themeColors.surface }]}
              >
                {/* Block header */}
                <View style={styles.blockHeader}>
                  <View style={[
                    styles.typePill,
                    { backgroundColor: (TYPE_COLORS[block.type] ?? themeColors.muted) + '25' },
                  ]}>
                    <Text style={[
                      styles.typePillText,
                      { color: TYPE_COLORS[block.type] ?? themeColors.muted },
                    ]}>
                      {block.type.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.blockName, { color: themeColors.text }]}>{block.name}</Text>
                  <Text style={[styles.blockDur, { color: themeColors.muted }]}>
                    {block.durationMinutes} min
                  </Text>
                </View>

                {/* Instructions input */}
                <TextInput
                  style={[
                    styles.instrInput,
                    {
                      color: themeColors.text,
                      borderColor: themeColors.surfaceBorder,
                      backgroundColor: themeColors.background,
                    },
                  ]}
                  value={block.instructions}
                  onChangeText={(t) => handleChange(block.index, t)}
                  placeholder="Add notes for this block..."
                  placeholderTextColor={themeColors.muted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>
            ))}

            {/* Bottom padding for keyboard */}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    flex: 1,
    marginLeft: spacing.sm,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  saveBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
    minWidth: 56,
    alignItems: 'center',
  },
  saveBtnText: {
    fontWeight: '700',
    fontSize: fontSize.md,
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    margin: spacing.md,
    marginBottom: 0,
    padding: spacing.sm,
    borderRadius: borderRadius.md,
  },
  infoText: {
    flex: 1,
    fontSize: fontSize.sm,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
  },
  blockCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    gap: spacing.sm,
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  typePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: borderRadius.sm,
  },
  typePillText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  blockName: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  blockDur: {
    fontSize: fontSize.sm,
  },
  instrInput: {
    borderWidth: 1,
    borderRadius: borderRadius.md,
    padding: spacing.sm,
    fontSize: fontSize.md,
    minHeight: 70,
  },
});
