/**
 * CSV Plans Manager (Part 7)
 *
 * Settings > CSV Plans — power-user screen for managing multiple imported
 * CSV training plans as toggleable layers.
 *
 * Features:
 * - List all CSV plans with name, upload date, session count, date range, toggle
 * - Toggle plans active/inactive (hides sessions from timeline without deleting)
 * - Edit: rename, change description
 * - Delete: permanently removes plan + all its sessions
 * - Import: '+' button links to existing import flow
 * - Conflict detection: warns when multiple active plans overlap
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Switch,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import {
  getCsvPlans,
  activateCsvPlan,
  deactivateCsvPlan,
  updateCsvPlan,
  deleteCsvPlan,
  getCsvPlanStats,
  getCsvPlanConflicts,
} from '@flowstate/core';

interface PlanItem {
  id: string;
  name: string;
  description: string | null;
  uploadedAt: string;
  isActive: number;
  fileHash: string | null;
  sessionCount: number;
  earliestDate: string | null;
  latestDate: string | null;
}

export default function CsvPlansScreen() {
  const { themeColors } = useTheme();
  const router = useRouter();
  const { db } = useDatabaseSafe();

  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [conflicts, setConflicts] = useState(0);

  // Edit modal state
  const [editPlan, setEditPlan] = useState<PlanItem | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const loadPlans = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const raw = await getCsvPlans(db);
      const enriched: PlanItem[] = await Promise.all(
        raw.map(async (p: any) => {
          const stats = await getCsvPlanStats(db, p.id);
          return { ...p, ...stats };
        }),
      );
      setPlans(enriched);

      const c = await getCsvPlanConflicts(db);
      setConflicts(c);
    } catch (e) {
      console.error('Failed to load CSV plans:', e);
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => { loadPlans(); }, [loadPlans]));

  const handleToggle = async (plan: PlanItem) => {
    if (!db) return;
    try {
      if (plan.isActive) {
        await deactivateCsvPlan(db, plan.id);
      } else {
        await activateCsvPlan(db, plan.id);
      }
      await loadPlans();
    } catch (e) {
      Alert.alert('Error', 'Failed to toggle plan.');
    }
  };

  const handleDelete = (plan: PlanItem) => {
    Alert.alert(
      'Delete Plan',
      `Permanently delete "${plan.name}" and all ${plan.sessionCount} of its sessions? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!db) return;
            try {
              await deleteCsvPlan(db, plan.id);
              await loadPlans();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete plan.');
            }
          },
        },
      ],
    );
  };

  const openEdit = (plan: PlanItem) => {
    setEditPlan(plan);
    setEditName(plan.name);
    setEditDesc(plan.description ?? '');
  };

  const handleSaveEdit = async () => {
    if (!db || !editPlan) return;
    try {
      await updateCsvPlan(db, editPlan.id, {
        name: editName.trim() || editPlan.name,
        description: editDesc.trim() || undefined,
      });
      setEditPlan(null);
      await loadPlans();
    } catch (e) {
      Alert.alert('Error', 'Failed to update plan.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace('/settings')}>
          <Feather name="arrow-left" size={22} color={themeColors.text} />
        </Pressable>
        <Text style={[styles.title, { color: themeColors.text }]}>CSV Plans</Text>
        <Pressable onPress={() => router.push('/import/pick')}>
          <Feather name="plus" size={22} color={themeColors.accent} />
        </Pressable>
      </View>

      {/* Conflict warning */}
      {conflicts > 0 && (
        <View style={[styles.conflictBanner, { backgroundColor: '#FEF3C7' }]}>
          <Feather name="alert-triangle" size={16} color="#D97706" />
          <Text style={styles.conflictText}>
            {conflicts} scheduling conflict{conflicts > 1 ? 's' : ''} detected between active plans
          </Text>
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={themeColors.accent} style={{ marginTop: 40 }} />
        ) : plans.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="file-text" size={48} color={themeColors.muted} />
            <Text style={[styles.emptyTitle, { color: themeColors.text }]}>No CSV Plans</Text>
            <Text style={[styles.emptyHint, { color: themeColors.muted }]}>
              Import a CSV training plan to get started. Each imported file becomes a named, toggleable plan layer.
            </Text>
            <Pressable
              style={[styles.importBtn, { backgroundColor: themeColors.accent }]}
              onPress={() => router.push('/import/pick')}
            >
              <Feather name="upload" size={16} color={themeColors.white} />
              <Text style={[styles.importBtnText, { color: themeColors.white }]}>Import Plan</Text>
            </Pressable>
          </View>
        ) : (
          plans.map((plan) => (
            <View key={plan.id} style={[styles.planCard, { backgroundColor: themeColors.surface }]}>
              <View style={styles.planHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.planName, { color: themeColors.text }]}>{plan.name}</Text>
                  {plan.description ? (
                    <Text style={[styles.planDesc, { color: themeColors.muted }]}>{plan.description}</Text>
                  ) : null}
                </View>
                <Switch
                  value={!!plan.isActive}
                  onValueChange={() => handleToggle(plan)}
                  trackColor={{ true: themeColors.accent }}
                />
              </View>

              <View style={styles.planMeta}>
                <Text style={[styles.metaText, { color: themeColors.muted }]}>
                  {plan.sessionCount} session{plan.sessionCount !== 1 ? 's' : ''}
                </Text>
                {plan.earliestDate && plan.latestDate && (
                  <Text style={[styles.metaText, { color: themeColors.muted }]}>
                    {plan.earliestDate.slice(0, 10)} → {plan.latestDate.slice(0, 10)}
                  </Text>
                )}
                <Text style={[styles.metaText, { color: themeColors.muted }]}>
                  Uploaded {plan.uploadedAt.slice(0, 10)}
                </Text>
              </View>

              <View style={styles.planActions}>
                <Pressable style={[styles.actionBtn, { borderColor: themeColors.border }]} onPress={() => openEdit(plan)}>
                  <Feather name="edit-2" size={14} color={themeColors.accent} />
                  <Text style={[styles.actionText, { color: themeColors.accent }]}>Edit</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, { borderColor: themeColors.border }]} onPress={() => router.push('/import/pick')}>
                  <Feather name="refresh-cw" size={14} color={themeColors.accent} />
                  <Text style={[styles.actionText, { color: themeColors.accent }]}>Re-import</Text>
                </Pressable>
                <Pressable style={[styles.actionBtn, { borderColor: themeColors.danger }]} onPress={() => handleDelete(plan)}>
                  <Feather name="trash-2" size={14} color={themeColors.danger} />
                  <Text style={[styles.actionText, { color: themeColors.danger }]}>Delete</Text>
                </Pressable>
              </View>

              {!plan.isActive && (
                <View style={[styles.inactiveBadge, { backgroundColor: themeColors.surfaceBorder }]}>
                  <Text style={[styles.inactiveBadgeText, { color: themeColors.muted }]}>Inactive — sessions hidden from timeline</Text>
                </View>
              )}
            </View>
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={!!editPlan} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setEditPlan(null)} />
        <View style={[styles.modalSheet, { backgroundColor: themeColors.background }]}>
          <Text style={[styles.modalTitle, { color: themeColors.text }]}>Edit Plan</Text>

          <Text style={[styles.fieldLabel, { color: themeColors.muted }]}>Name</Text>
          <TextInput
            style={[styles.input, { backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
            value={editName}
            onChangeText={setEditName}
            placeholder="Plan name"
            placeholderTextColor={themeColors.muted}
          />

          <Text style={[styles.fieldLabel, { color: themeColors.muted }]}>Description</Text>
          <TextInput
            style={[styles.input, { height: 80, textAlignVertical: 'top', backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
            value={editDesc}
            onChangeText={setEditDesc}
            placeholder="Optional description"
            placeholderTextColor={themeColors.muted}
            multiline
          />

          <View style={styles.modalActions}>
            <Pressable style={[styles.modalCancel, { borderColor: themeColors.border }]} onPress={() => setEditPlan(null)}>
              <Text style={[styles.modalCancelText, { color: themeColors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.modalConfirm, { backgroundColor: themeColors.accent }]} onPress={handleSaveEdit}>
              <Text style={[styles.modalConfirmText, { color: themeColors.white }]}>Save</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 56,
    paddingBottom: spacing.sm,
  },
  title: { fontSize: fontSize.xl, fontWeight: '700' },
  conflictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    padding: spacing.sm,
    borderRadius: borderRadius.sm,
    marginBottom: spacing.sm,
  },
  conflictText: { fontSize: fontSize.sm, color: '#D97706', fontWeight: '500', flex: 1 },
  content: { paddingHorizontal: spacing.md, paddingTop: spacing.sm },
  emptyState: { alignItems: 'center', paddingTop: 60, gap: spacing.sm },
  emptyTitle: { fontSize: fontSize.lg, fontWeight: '700' },
  emptyHint: { fontSize: fontSize.sm, textAlign: 'center', paddingHorizontal: spacing.lg },
  importBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  importBtnText: { fontSize: fontSize.md, fontWeight: '600' },
  planCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  planName: { fontSize: fontSize.md, fontWeight: '700' },
  planDesc: { fontSize: fontSize.sm, marginTop: 2 },
  planMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  metaText: { fontSize: fontSize.xs },
  planActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
  },
  actionText: { fontSize: fontSize.xs, fontWeight: '600' },
  inactiveBadge: {
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: borderRadius.sm,
  },
  inactiveBadgeText: { fontSize: fontSize.xs, textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalTitle: { fontSize: fontSize.xl, fontWeight: '700', marginBottom: spacing.md },
  fieldLabel: { fontSize: fontSize.sm, fontWeight: '600', marginTop: spacing.md, marginBottom: spacing.xs },
  input: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    padding: spacing.sm,
    fontSize: fontSize.md,
  },
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  modalCancel: {
    flex: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    borderWidth: 1,
  },
  modalCancelText: { fontSize: fontSize.md, fontWeight: '600' },
  modalConfirm: {
    flex: 1,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  modalConfirmText: { fontSize: fontSize.md, fontWeight: '600' },
});
