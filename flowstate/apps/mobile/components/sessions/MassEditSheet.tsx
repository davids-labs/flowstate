/**
 * MassEditSheet — Feature 13: Mass Edit Sessions
 *
 * A bottom sheet that slides up when the user has multi-selected sessions
 * (via long-press on the Day timeline or Plan week view).
 *
 * Actions supported:
 * - Mark all selected as completed
 * - Reschedule: change scheduledDate for all
 * - Change pillar tag for all
 * - Delete all selected (with confirmation)
 *
 * Usage:
 *   <MassEditSheet
 *     visible={showMassEdit}
 *     selectedIds={selectedSessionIds}
 *     onClose={() => { setShowMassEdit(false); setSelectedIds([]); }}
 *     onDone={() => { setShowMassEdit(false); setSelectedIds([]); reload(); }}
 *   />
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../constants/ThemeContext';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useDatabaseSafe } from '../DatabaseProvider';
import { batchUpdateSessions, batchDeleteSessions } from '@flowstate/core';

const PILLARS = ['gym', 'academic', 'life', 'general'] as const;
type Pillar = (typeof PILLARS)[number];

const PILLAR_COLORS: Record<string, string> = {
  gym: '#ef4444',
  academic: '#3b82f6',
  life: '#22c55e',
  general: '#a855f7',
};

interface MassEditSheetProps {
  visible: boolean;
  selectedIds: string[];
  onClose: () => void;
  onDone: () => void;
}

export function MassEditSheet({ visible, selectedIds, onClose, onDone }: MassEditSheetProps) {
  const { themeColors } = useTheme();
  const { db } = useDatabaseSafe();

  const [action, setAction] = useState<'menu' | 'reschedule' | 'pillar'>('menu');
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [selectedPillar, setSelectedPillar] = useState<Pillar | null>(null);

  const count = selectedIds.length;

  const reset = () => {
    setAction('menu');
    setRescheduleDate('');
    setSelectedPillar(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleMarkComplete = async () => {
    if (!db) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await batchUpdateSessions(db, selectedIds, { status: 'completed' });
    reset();
    onDone();
  };

  const handleReschedule = async () => {
    if (!db) return;
    const trimmed = rescheduleDate.trim();
    // Basic YYYY-MM-DD validation
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      Alert.alert('Invalid date', 'Please enter a date in YYYY-MM-DD format.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await batchUpdateSessions(db, selectedIds, { scheduledDate: trimmed });
    reset();
    onDone();
  };

  const handleChangePillar = async () => {
    if (!db || !selectedPillar) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await batchUpdateSessions(db, selectedIds, { pillar: selectedPillar });
    reset();
    onDone();
  };

  const handleDelete = () => {
    Alert.alert(
      `Delete ${count} session${count !== 1 ? 's' : ''}?`,
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            if (!db) return;
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            await batchDeleteSessions(db, selectedIds);
            reset();
            onDone();
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      {/* Backdrop */}
      <Pressable style={styles.backdrop} onPress={handleClose} />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.sheetWrapper}
      >
        <View style={[styles.sheet, { backgroundColor: themeColors.surface }]}>
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: themeColors.surfaceBorder }]} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: themeColors.text }]}>
              {count} session{count !== 1 ? 's' : ''} selected
            </Text>
            <Pressable onPress={handleClose}>
              <Feather name="x" size={20} color={themeColors.muted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {action === 'menu' && (
              <View style={styles.menuList}>
                {/* Mark complete */}
                <Pressable
                  style={[styles.menuItem, { backgroundColor: themeColors.background }]}
                  onPress={handleMarkComplete}
                >
                  <View style={[styles.menuIcon, { backgroundColor: '#22c55e22' }]}>
                    <Feather name="check-circle" size={18} color="#22c55e" />
                  </View>
                  <Text style={[styles.menuLabel, { color: themeColors.text }]}>Mark all completed</Text>
                  <Feather name="chevron-right" size={16} color={themeColors.muted} />
                </Pressable>

                {/* Reschedule */}
                <Pressable
                  style={[styles.menuItem, { backgroundColor: themeColors.background }]}
                  onPress={() => setAction('reschedule')}
                >
                  <View style={[styles.menuIcon, { backgroundColor: '#3b82f622' }]}>
                    <Feather name="calendar" size={18} color="#3b82f6" />
                  </View>
                  <Text style={[styles.menuLabel, { color: themeColors.text }]}>Reschedule all</Text>
                  <Feather name="chevron-right" size={16} color={themeColors.muted} />
                </Pressable>

                {/* Change pillar */}
                <Pressable
                  style={[styles.menuItem, { backgroundColor: themeColors.background }]}
                  onPress={() => setAction('pillar')}
                >
                  <View style={[styles.menuIcon, { backgroundColor: '#a855f722' }]}>
                    <Feather name="tag" size={18} color="#a855f7" />
                  </View>
                  <Text style={[styles.menuLabel, { color: themeColors.text }]}>Change pillar</Text>
                  <Feather name="chevron-right" size={16} color={themeColors.muted} />
                </Pressable>

                {/* Delete */}
                <Pressable
                  style={[styles.menuItem, { backgroundColor: themeColors.background }]}
                  onPress={handleDelete}
                >
                  <View style={[styles.menuIcon, { backgroundColor: '#ef444422' }]}>
                    <Feather name="trash-2" size={18} color="#ef4444" />
                  </View>
                  <Text style={[styles.menuLabel, { color: '#ef4444' }]}>Delete all</Text>
                  <Feather name="chevron-right" size={16} color={themeColors.muted} />
                </Pressable>
              </View>
            )}

            {action === 'reschedule' && (
              <View style={styles.subPanel}>
                <Pressable style={styles.backRow} onPress={() => setAction('menu')}>
                  <Feather name="arrow-left" size={16} color={themeColors.muted} />
                  <Text style={[styles.backText, { color: themeColors.muted }]}>Back</Text>
                </Pressable>
                <Text style={[styles.subTitle, { color: themeColors.text }]}>Reschedule {count} session{count !== 1 ? 's' : ''}</Text>
                <Text style={[styles.subHint, { color: themeColors.muted }]}>New date (YYYY-MM-DD)</Text>
                <TextInput
                  style={[styles.dateInput, { backgroundColor: themeColors.background, color: themeColors.text }]}
                  value={rescheduleDate}
                  onChangeText={setRescheduleDate}
                  placeholder="2026-09-01"
                  placeholderTextColor={themeColors.muted}
                  keyboardType="numbers-and-punctuation"
                  autoFocus
                />
                <Pressable
                  style={[styles.confirmBtn, { backgroundColor: themeColors.accent, opacity: rescheduleDate.length > 0 ? 1 : 0.4 }]}
                  onPress={handleReschedule}
                  disabled={rescheduleDate.length === 0}
                >
                  <Text style={styles.confirmBtnText}>Reschedule</Text>
                </Pressable>
              </View>
            )}

            {action === 'pillar' && (
              <View style={styles.subPanel}>
                <Pressable style={styles.backRow} onPress={() => setAction('menu')}>
                  <Feather name="arrow-left" size={16} color={themeColors.muted} />
                  <Text style={[styles.backText, { color: themeColors.muted }]}>Back</Text>
                </Pressable>
                <Text style={[styles.subTitle, { color: themeColors.text }]}>Change pillar for {count} session{count !== 1 ? 's' : ''}</Text>
                <View style={styles.pillarGrid}>
                  {PILLARS.map((p) => (
                    <Pressable
                      key={p}
                      onPress={() => setSelectedPillar(p)}
                      style={[
                        styles.pillarChip,
                        { borderColor: PILLAR_COLORS[p] },
                        selectedPillar === p && { backgroundColor: PILLAR_COLORS[p] },
                      ]}
                    >
                      <Text style={[
                        styles.pillarChipText,
                        { color: selectedPillar === p ? '#fff' : PILLAR_COLORS[p] },
                      ]}>
                        {p.charAt(0).toUpperCase() + p.slice(1)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
                <Pressable
                  style={[styles.confirmBtn, { backgroundColor: themeColors.accent, opacity: selectedPillar ? 1 : 0.4 }]}
                  onPress={handleChangePillar}
                  disabled={!selectedPillar}
                >
                  <Text style={styles.confirmBtnText}>Apply Pillar</Text>
                </Pressable>
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheetWrapper: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 40,
    maxHeight: '70%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  sheetTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  menuList: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  subPanel: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  backText: { fontSize: fontSize.sm },
  subTitle: { fontSize: fontSize.lg, fontWeight: '700' },
  subHint: { fontSize: fontSize.xs },
  dateInput: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
  },
  pillarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  pillarChip: {
    borderWidth: 2,
    borderRadius: borderRadius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pillarChipText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  confirmBtn: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  confirmBtnText: {
    color: '#fff',
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});
