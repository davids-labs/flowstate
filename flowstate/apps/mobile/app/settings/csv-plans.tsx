/**
 * CSV Plans Manager — V2 spec §9.5
 *
 * Plan list with surfaceElevated cards, active toggle Switch, conflict banner.
 * Long-press card → Rename / Delete.
 * '+' FAB → /import/pick.
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Switch,
  Alert,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { space, radius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';
import { AppText } from '../../components/primitives/Text';
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

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  return iso.slice(0, 10).replace(/-/g, '/');
}

// ─── Rename modal ─────────────────────────────────────────────────────────────
function RenameModal({
  visible,
  plan,
  onSave,
  onClose,
}: {
  visible: boolean;
  plan: PlanItem | null;
  onSave: (name: string, desc: string) => void;
  onClose: () => void;
}) {
  const { themeTokens } = useTheme();
  const [name, setName] = useState(plan?.name ?? '');
  const [desc, setDesc] = useState(plan?.description ?? '');

  React.useEffect(() => {
    setName(plan?.name ?? '');
    setDesc(plan?.description ?? '');
  }, [plan, visible]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1, justifyContent: 'flex-end' }}
      >
        <View
          style={[
            RM.sheet,
            {
              backgroundColor: themeTokens.background,
              borderColor: themeTokens.border,
            },
          ]}
        >
          <View style={RM.handle} />
          <AppText
            variant="title3"
            style={{ fontWeight: '700', marginBottom: space[20] }}
          >
            Rename Plan
          </AppText>
          <TextInput
            style={[
              RM.input,
              {
                backgroundColor: themeTokens.surface,
                borderColor: themeTokens.border,
                color: themeTokens.textPrimary,
              },
            ]}
            value={name}
            onChangeText={setName}
            placeholder="Plan name"
            placeholderTextColor={themeTokens.textTertiary}
            autoFocus
          />
          <TextInput
            style={[
              RM.input,
              {
                marginTop: space[12],
                backgroundColor: themeTokens.surface,
                borderColor: themeTokens.border,
                color: themeTokens.textPrimary,
              },
            ]}
            value={desc ?? ''}
            onChangeText={setDesc}
            placeholder="Description (optional)"
            placeholderTextColor={themeTokens.textTertiary}
          />
          <View
            style={{ flexDirection: 'row', gap: space[12], marginTop: space[24] }}
          >
            <Pressable
              style={[RM.btn, { backgroundColor: themeTokens.surface, flex: 1 }]}
              onPress={onClose}
            >
              <AppText
                variant="headline"
                style={{ fontWeight: '600', color: themeTokens.textSecondary }}
              >
                Cancel
              </AppText>
            </Pressable>
            <Pressable
              style={[RM.btn, { backgroundColor: themeTokens.accent, flex: 2 }]}
              onPress={() => name.trim() && onSave(name.trim(), desc)}
            >
              <AppText
                variant="headline"
                style={{ fontWeight: '600', color: '#fff' }}
              >
                Save
              </AppText>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const RM = StyleSheet.create({
  sheet: {
    borderRadius: radius.xl,
    borderWidth: 1,
    margin: space[16],
    padding: space[24],
    paddingBottom: space[32],
  },
  handle: {
    width: 32,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    alignSelf: 'center',
    marginBottom: space[20],
  },
  input: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: space[12],
    fontSize: 17,
  },
  btn: {
    borderRadius: radius.md,
    padding: space[16],
    alignItems: 'center',
  },
});

// ─── Plan card ────────────────────────────────────────────────────────────────
function PlanCard({
  plan,
  onToggle,
  onEdit,
  onDelete,
  onOpen,
}: {
  plan: PlanItem;
  onToggle: (p: PlanItem) => void;
  onEdit: (p: PlanItem) => void;
  onDelete: (p: PlanItem) => void;
  onOpen: (p: PlanItem) => void;
}) {
  const { themeTokens } = useTheme();
  const active = !!plan.isActive;
  const range =
    plan.earliestDate && plan.latestDate
      ? `${formatDate(plan.earliestDate)} – ${formatDate(plan.latestDate)}`
      : 'No sessions';

  return (
    <Pressable
      style={[
        PC.card,
        {
          backgroundColor: themeTokens.surfaceElevated,
          borderWidth: active ? 2 : 1,
          borderColor: active ? themeTokens.accent : themeTokens.border,
        },
      ]}
      onPress={() => onOpen(plan)}
      onLongPress={() =>
        Alert.alert(plan.name, 'What would you like to do?', [
          { text: 'Rename', onPress: () => onEdit(plan) },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => onDelete(plan),
          },
          { text: 'Cancel', style: 'cancel' },
        ])
      }
    >
      <View style={PC.top}>
        <View style={{ flex: 1 }}>
          <AppText variant="headline" style={{ fontWeight: '600' }} numberOfLines={1}>
            {plan.name}
          </AppText>
          <AppText variant="footnote" color={themeTokens.textTertiary}>
            Uploaded {formatDate(plan.uploadedAt)}
          </AppText>
        </View>
        <Switch
          value={active}
          onValueChange={() => onToggle(plan)}
          trackColor={{ true: themeTokens.accent }}
        />
      </View>

      <View style={[PC.meta, { borderTopColor: themeTokens.border }]}>
        <View style={PC.metaItem}>
          <Feather name="calendar" size={13} color={themeTokens.textTertiary} />
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            {range}
          </AppText>
        </View>
        <View style={PC.metaItem}>
          <Feather name="clock" size={13} color={themeTokens.textTertiary} />
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            {plan.sessionCount} session{plan.sessionCount !== 1 ? 's' : ''}
          </AppText>
        </View>
      </View>

      {plan.description ? (
        <AppText
          variant="footnote"
          color={themeTokens.textTertiary}
          style={{ paddingHorizontal: space[16], paddingBottom: space[12] }}
          numberOfLines={2}
        >
          {plan.description}
        </AppText>
      ) : null}
    </Pressable>
  );
}

const PC = StyleSheet.create({
  card: { borderRadius: radius.lg, overflow: 'hidden', marginBottom: space[12] },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: space[16],
    gap: space[12],
  },
  meta: {
    flexDirection: 'row',
    gap: space[20],
    paddingHorizontal: space[16],
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
  },
});

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CsvPlansScreen() {
  const { themeTokens } = useTheme();
  const router = useRouter();
  const { db } = useDatabaseSafe();
  const insets = useSafeAreaInsets();

  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [conflicts, setConflicts] = useState(0);
  const [editPlan, setEditPlan] = useState<PlanItem | null>(null);

  const loadPlans = useCallback(async () => {
    if (!db) return;
    setLoading(true);
    try {
      const raw = await getCsvPlans(db);
      const enriched: PlanItem[] = await Promise.all(
        (raw as any[]).map(async (p) => {
          const stats = await getCsvPlanStats(db, p.id);
          return { ...p, ...(stats as any) };
        }),
      );
      setPlans(enriched);
      const c = await getCsvPlanConflicts(db);
      setConflicts(c as number);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadPlans();
    }, [loadPlans]),
  );

  const handleToggle = async (plan: PlanItem) => {
    if (!db) return;
    try {
      if (plan.isActive) await deactivateCsvPlan(db, plan.id);
      else await activateCsvPlan(db, plan.id);
      await loadPlans();
    } catch {
      // ignore
    }
  };

  const handleRename = async (name: string, desc: string) => {
    if (!db || !editPlan) return;
    await updateCsvPlan(db, editPlan.id, {
      name,
      description: desc || undefined,
    }).catch(() => {});
    setEditPlan(null);
    await loadPlans();
  };

  const handleDelete = (plan: PlanItem) => {
    Alert.alert(
      'Delete Plan',
      `Delete "${plan.name}"? This will remove all associated sessions.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (db) {
              await deleteCsvPlan(db, plan.id).catch(() => {});
              await loadPlans();
            }
          },
        },
      ],
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: themeTokens.background }}>
      {/* Header */}
      <View
        style={[
          HDR.wrap,
          {
            paddingTop: insets.top + space[8],
            backgroundColor: themeTokens.background,
            borderBottomColor: themeTokens.border,
          },
        ]}
      >
        <Pressable
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace('/settings')
          }
          hitSlop={12}
        >
          <Feather name="arrow-left" size={22} color={themeTokens.textPrimary} />
        </Pressable>
        <AppText
          variant="title1"
          style={{ fontWeight: '700', flex: 1, marginLeft: space[12] }}
        >
          Imported Plans
        </AppText>
      </View>

      {/* Conflict warning banner */}
      {conflicts > 0 && (
        <Pressable
          style={[
            BNR.wrap,
            {
              backgroundColor: (themeTokens.warning ?? '#f59e0b') + '22',
              borderColor: themeTokens.warning ?? '#f59e0b',
              marginHorizontal: space[16],
              marginTop: space[12],
            },
          ]}
          onPress={() =>
            Alert.alert(
              'Plan Conflict',
              'Two or more active plans overlap on the same dates. Disable one plan to resolve.',
            )
          }
        >
          <Feather
            name="alert-triangle"
            size={16}
            color={themeTokens.warning ?? '#f59e0b'}
          />
          <AppText
            variant="footnote"
            style={{
              fontWeight: '600',
              color: themeTokens.warning ?? '#f59e0b',
              flex: 1,
            }}
          >
            {conflicts} conflict{conflicts !== 1 ? 's' : ''} detected between
            active plans.
          </AppText>
          <Feather
            name="chevron-right"
            size={16}
            color={themeTokens.warning ?? '#f59e0b'}
          />
        </Pressable>
      )}

      {loading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={themeTokens.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{
            padding: space[16],
            paddingBottom: insets.bottom + 100,
          }}
          showsVerticalScrollIndicator={false}
        >
          {plans.length === 0 ? (
            <View
              style={[
                EMPTY.wrap,
                {
                  backgroundColor: themeTokens.surface,
                  borderColor: themeTokens.border,
                },
              ]}
            >
              <Feather name="file-text" size={28} color={themeTokens.textTertiary} />
              <AppText
                variant="body"
                color={themeTokens.textTertiary}
                style={{ textAlign: 'center', marginTop: space[8] }}
              >
                No imported plans yet.
              </AppText>
              <AppText
                variant="footnote"
                color={themeTokens.textTertiary}
                style={{ textAlign: 'center', marginTop: space[4] }}
              >
                Import a planner CSV, then tighten dates, titles, priorities, and sessions in-app.
              </AppText>
              <Pressable onPress={() => router.push('/import/pick')}>
                <AppText
                  variant="footnote"
                  color={themeTokens.accent}
                  style={{ marginTop: space[8] }}
                >
                  Import your first plan →
                </AppText>
              </Pressable>
            </View>
          ) : (
            plans.map((p) => (
              <PlanCard
                key={p.id}
                plan={p}
                onToggle={handleToggle}
                onEdit={setEditPlan}
                onDelete={handleDelete}
                onOpen={(plan) => router.push(`/imported-plans/${plan.id}` as any)}
              />
            ))
          )}
        </ScrollView>
      )}

      {/* FAB */}
      <Pressable
        style={[
          FAB.btn,
          {
            backgroundColor: themeTokens.accent,
            bottom: insets.bottom + 24,
            right: space[20],
          },
        ]}
        onPress={() => router.push('/import/pick')}
      >
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>

      <RenameModal
        visible={!!editPlan}
        plan={editPlan}
        onSave={handleRename}
        onClose={() => setEditPlan(null)}
      />
    </View>
  );
}

const HDR = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[16],
    paddingBottom: space[12],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
const BNR = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[8],
    padding: space[12],
    borderRadius: radius.md,
    borderWidth: 1,
  },
});
const EMPTY = StyleSheet.create({
  wrap: {
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    padding: space[24],
  },
});
const FAB = StyleSheet.create({
  btn: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
