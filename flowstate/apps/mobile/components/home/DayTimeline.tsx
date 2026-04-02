/**
 * DayTimeline — V2 spec §1.4
 * SessionRow / HabitRow / TaskRow with Swipeable gestures (§11.7)
 */
import React, { useRef, useCallback, useState, useEffect } from 'react';
import { View, Pressable, StyleSheet, FlatList, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Swipeable } from 'react-native-gesture-handler';
import { useRouter } from 'expo-router';
import { AppText } from '../primitives/Text';
import { space, radius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';
import { useUserPrefsStore, type Pillar } from '../../stores/userPrefsStore';
import { useMultiSelectStore } from '../../stores/multiSelectStore';
import { useModuleValue } from '../../hooks/useModuleValue';
import { ModuleCard } from '../modules/ModuleCard';
import { updateModuleSpec } from '@flowstate/core';
import { useDatabaseSafe } from '../DatabaseProvider';
import { useHaptics } from '../../hooks/useHaptics';
import { useDateFormat } from '../../hooks/useDateFormat';

export interface TimelineSession {
  kind: 'session'; id: string; routineName: string; pillar: string;
  scheduledTime?: string | null; status: string;
  durationMinutes?: number; blockCount?: number; progress?: number;
}
export interface TimelineModule {
  kind: 'module'; id: string; label: string; type: string; pillar: string;
  emoji?: string | null; logged?: boolean; streak?: number;
  config?: Record<string, unknown>;
}
export interface TimelineTask {
  kind: 'task'; id: string; title: string; pillar: string;
  priority?: number; completed?: boolean; dueTime?: string | null; tags?: string[];
}
export type TimelineItem = TimelineSession | TimelineModule | TimelineTask;

interface Props {
  items: TimelineItem[]; activePillars: Set<Pillar>;
  onTaskToggle?: (id: string, completed: boolean) => void;
  onSessionStart?: (id: string) => void;
  onRefresh?: () => void; refreshing?: boolean;
}

function priColor(p?: number): string | null {
  return p === 3 ? '#EF4444' : p === 2 ? '#F59E0B' : null;
}
const TYPE_ORDER: Record<string,number> = { session: 0, module: 1, task: 2 };
function sortItems(items: TimelineItem[]): TimelineItem[] {
  return [...items].sort((a, b) => {
    const ta = a.kind==='session'?a.scheduledTime??'': a.kind==='task'?a.dueTime??'':'';
    const tb = b.kind==='session'?b.scheduledTime??'': b.kind==='task'?b.dueTime??'':'';
    if (ta && tb) return ta.localeCompare(tb);
    if (ta) return -1; if (tb) return 1;
    return (TYPE_ORDER[a.kind]??3)-(TYPE_ORDER[b.kind]??3);
  });
}

function SwipeBtn({ label, icon, color, onPress }: { label:string; icon:any; color:string; onPress:()=>void }) {
  return (
    <Pressable style={[S.swipeBtn, { backgroundColor: color }]} onPress={onPress}>
      <Feather name={icon} size={18} color="#fff" />
      <AppText variant="caption1" onAccent>{label}</AppText>
    </Pressable>
  );
}

function SessionRow({ item, onPress, onStart }: { item: TimelineSession; onPress:()=>void; onStart:()=>void }) {
  const { themeTokens } = useTheme();
  const { getPillarColour, swipeThreshold } = useUserPrefsStore();
  const msStore = useMultiSelectStore();
  const haptic = useHaptics();
  const { formatTime } = useDateFormat();
  const swRef = useRef<Swipeable>(null);
  const fill = getPillarColour(item.pillar as Pillar);
  const isActive = item.status === 'in_progress';
  const isDone = item.status === 'completed';
  const isPlanned = !isActive && !isDone;
  const selected = msStore.isActive && msStore.selected.has(item.id);
  return (
    <Swipeable ref={swRef} renderRightActions={() => (
      <View style={S.swipeRow}>
        <SwipeBtn label="Edit" icon="edit-2" color={themeTokens.accent} onPress={()=>swRef.current?.close()} />
        <SwipeBtn label="Skip" icon="skip-forward" color={themeTokens.warning} onPress={()=>swRef.current?.close()} />
        <SwipeBtn label="Delete" icon="trash-2" color={themeTokens.destructive} onPress={()=>{swRef.current?.close();haptic.warning();Alert.alert('Delete session?','',[{text:'Cancel',style:'cancel'},{text:'Delete',style:'destructive'}]);}} />
      </View>
    )} friction={1} overshootLeft={false} overshootRight={false} rightThreshold={swipeThreshold}>
      <Pressable
        style={({ pressed }) => [S.sessionCard, { backgroundColor: themeTokens.surfaceElevated, borderColor: selected ? themeTokens.accent : themeTokens.border, borderWidth: selected ? 2 : 1 }, pressed && { opacity: 0.75 }]}
        onPress={() => msStore.isActive ? msStore.toggle(item.id) : onPress()}
        onLongPress={() => { haptic.impact('medium'); msStore.enter(item.id); }}
      >
        <View style={[S.stripe, { backgroundColor: fill }]} />
        <View style={S.sessionBody}>
          <View style={S.row}>
            <AppText variant="headline" style={S.flex1} numberOfLines={1}>{item.routineName}</AppText>
            <View style={[S.badge, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
              <AppText variant="caption2" color={themeTokens.textSecondary}>{isActive?'Active':isDone?'Done':'Planned'}</AppText>
            </View>
          </View>
          <AppText variant="footnote" color={themeTokens.textSecondary}>
            {[item.scheduledTime?formatTime(item.scheduledTime):null, item.durationMinutes?`${item.durationMinutes}m`:null, item.blockCount?`${item.blockCount} blocks`:null].filter(Boolean).join(' · ')}
          </AppText>
          {(isActive||isDone) && typeof item.progress === 'number' && (
            <View style={[S.progressTrack, { backgroundColor: themeTokens.accentTint }]}>
              <View style={[S.progressFill, { width: `${Math.min(100,(item.progress??0)*100)}%`, backgroundColor: fill }]} />
            </View>
          )}
        </View>
        <Feather name="activity" size={14} color={fill} style={S.pillarIcon} />
        {isPlanned && <Pressable style={[S.startBtn, { backgroundColor: themeTokens.accent }]} onPress={e=>{e.stopPropagation(); haptic.success(); onStart();}}>
          <AppText variant="subheadline" onAccent style={{fontWeight:'600'}}>Start</AppText>
        </Pressable>}
      </Pressable>
    </Swipeable>
  );
}

function ModuleRow({ item, onDeleted }: { item: TimelineModule; onDeleted?: (id: string) => void }) {
  const { themeTokens } = useTheme();
  const { getPillarColour } = useUserPrefsStore();
  const swRef = useRef<Swipeable>(null);
  const fill = getPillarColour(item.pillar as Pillar);
  const { value, setValue } = useModuleValue(item.id);
  const router = useRouter();
  const { db } = useDatabaseSafe();
  const haptic = useHaptics();

  // Parse the stored string value into the typed form each card expects
  const parsedValue = (() => {
    if (value === null) return undefined;
    switch (item.type) {
      case 'checkbox': return value === 'true' || value === '1';
      case 'tally':
      case 'data_input':
      case 'rating':
      case 'streak_counter': return parseFloat(value) || 0;
      default: return value;
    }
  })();

  const handleValueChange = (newValue: unknown) => {
    if (newValue === null || newValue === undefined) return;
    setValue(String(newValue));
  };

  const handleEdit = () => {
    swRef.current?.close();
    router.push(`/modules/edit?id=${item.id}` as any);
  };
  const handleRemove = () => {
    swRef.current?.close();
    haptic.warning();
    Alert.alert(
      'Remove from home screen?',
      'This module will no longer appear on My Day.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove', style: 'destructive',
          onPress: async () => {
            if (!db) return;
            try {
              const current: string[] = Array.isArray(item.config?.placements)
                ? (item.config!.placements as string[])
                : ['homescreen'];
              const next = current.filter(p => p !== 'homescreen' && p !== 'day');
              await updateModuleSpec(db, item.id, { placements: next.length ? next : ['library'] });
              onDeleted?.(item.id);
            } catch (e) { console.error('Failed to remove module from home:', e); }
          },
        },
      ]
    );
  };
  return (
    <Swipeable ref={swRef} renderRightActions={() => (
      <View style={S.swipeRow}>
        <SwipeBtn label="Edit" icon="edit-2" color={themeTokens.accent} onPress={handleEdit} />
        <SwipeBtn label="Remove" icon="eye-off" color={themeTokens.warning} onPress={handleRemove} />
      </View>
    )} friction={1} overshootLeft={false} overshootRight={false} rightThreshold={80}>
      <View style={[S.moduleWrapper, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
        <View style={[S.stripe, { backgroundColor: fill }]} />
        <View style={S.moduleContent}>
          <ModuleCard
            id={item.id}
            type={item.type as any}
            label={item.label}
            emoji={item.emoji ?? undefined}
            config={item.config ?? {}}
            surface="homescreen"
            compact
            value={parsedValue}
            onValueChange={handleValueChange}
          />
        </View>
      </View>
    </Swipeable>
  );
}

function TaskRow({ item, onToggle, showTags }: { item: TimelineTask; onToggle:()=>void; showTags?:boolean }) {
  const { themeTokens } = useTheme();
  const { getPillarColour, swipeThreshold } = useUserPrefsStore();
  const msStore = useMultiSelectStore();
  const haptic = useHaptics();
  const { formatTime } = useDateFormat();
  const swRef = useRef<Swipeable>(null);
  const fill = getPillarColour(item.pillar as Pillar);
  const pColor = priColor(item.priority);
  return (
    <Swipeable ref={swRef}
      renderRightActions={() => (
        <View style={S.swipeRow}>
          <SwipeBtn label="Reschedule" icon="calendar" color={themeTokens.accent} onPress={()=>swRef.current?.close()} />
          <SwipeBtn label="Delete" icon="trash-2" color={themeTokens.destructive} onPress={()=>swRef.current?.close()} />
        </View>
      )}
      renderLeftActions={() => <View style={[S.swipeCompleteBtn, { backgroundColor: fill }]}><Feather name={item.completed?'rotate-ccw':'check'} size={20} color="#fff" /></View>}
      friction={1} overshootLeft={false} overshootRight={false} rightThreshold={swipeThreshold} leftThreshold={swipeThreshold}
      onSwipeableOpen={(dir) => { if (dir==='left') { haptic.impact('medium'); swRef.current?.close(); onToggle(); } }}>
      <Pressable style={({ pressed }) => [S.flushRow, { borderBottomColor: themeTokens.border }, pressed && { opacity: 0.75 }]}
        onLongPress={()=>{ haptic.impact('medium'); msStore.enter(item.id); }}
        onPress={()=>msStore.isActive && msStore.toggle(item.id)}>
        <Pressable style={[S.circle, { borderColor: item.completed?fill:themeTokens.borderStrong, backgroundColor: item.completed?fill:'transparent' }]}
          onPress={()=>{ haptic.impact('medium'); onToggle(); }} hitSlop={8}>
          {item.completed && <Feather name="check" size={12} color="#fff" />}
        </Pressable>
        <View style={S.flex1}>
          <AppText variant="headline" color={item.completed?themeTokens.textTertiary:themeTokens.textPrimary}
            style={item.completed?S.strike:undefined} numberOfLines={1}>{item.title}</AppText>
          {showTags && item.tags && item.tags.length > 0 && (
            <View style={S.tagRow}>
              {item.tags.map(t => (
                <View key={t} style={[S.tagChip, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border, borderWidth: 1 }]}>
                  <AppText variant="caption2" color={themeTokens.textSecondary}>{t}</AppText>
                </View>
              ))}
            </View>
          )}
        </View>
        <View style={S.taskRight}>
          {pColor && <View style={[S.priDot, { backgroundColor: pColor }]} />}
          {item.dueTime && <AppText variant="footnote" color={themeTokens.textSecondary}>{formatTime(item.dueTime)}</AppText>}
        </View>
      </Pressable>
    </Swipeable>
  );
}

export function DayTimeline({ items, activePillars, onTaskToggle, onSessionStart, onRefresh, refreshing }: Props) {
  const router = useRouter();
  const { densityTask } = useUserPrefsStore();
  const showTags = densityTask === 'expanded';
  const allActive = activePillars.has('gym') && activePillars.has('academic') && activePillars.has('life');

  // Local state so module removal is instant (optimistic)
  const [filteredItems, setFilteredItems] = useState<TimelineItem[]>([]);
  useEffect(() => {
    setFilteredItems(sortItems(items.filter(it => {
      const p = it.pillar as Pillar;
      return p === 'general' || allActive || activePillars.has(p);
    })));
  }, [items, activePillars, allActive]);

  const renderItem = useCallback(({ item }: { item: TimelineItem; index: number }) => {
    if (item.kind === 'session') return <SessionRow item={item} onPress={()=>router.push(`/session/${item.id}` as any)} onStart={()=>onSessionStart?.(item.id)} />;
    if (item.kind === 'module') return <ModuleRow item={item} onDeleted={id => setFilteredItems(prev => prev.filter(it => it.id !== id))} />;
    return <TaskRow item={item} onToggle={()=>onTaskToggle?.(item.id,!item.completed)} showTags={showTags} />;
  }, [router, onTaskToggle, onSessionStart, showTags]);
  const { themeTokens } = useTheme();
  if (filteredItems.length === 0) return (
    <View style={S.empty}>
      <Feather name="calendar" size={24} color={themeTokens.textTertiary} />
      <AppText variant="body" color={themeTokens.textTertiary}>
        {allActive ? 'Nothing planned for today.' : `No items for this filter today.`}
      </AppText>
    </View>
  );
  return (
    <FlatList data={filteredItems} keyExtractor={(it: TimelineItem) => `${it.kind}-${it.id}`} renderItem={renderItem}
      scrollEnabled={false} ItemSeparatorComponent={()=><View style={{ height: space[8] }} />}
      onRefresh={onRefresh} refreshing={refreshing??false} />
  );
}

const S = StyleSheet.create({
  flex1: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[8] },
  sessionCard: { flexDirection: 'row', alignItems: 'stretch', borderRadius: radius.md, borderWidth: 1, overflow: 'hidden', minHeight: 60 },
  stripe: { width: 3 },
  sessionBody: { flex: 1, paddingHorizontal: space[12], paddingVertical: space[12], gap: space[4] },
  badge: { paddingHorizontal: space[8], paddingVertical: 2, borderRadius: radius.sm, borderWidth: 1 },
  progressTrack: { height: 3, borderRadius: radius.full, marginTop: space[4], overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.full },
  pillarIcon: { alignSelf: 'center', marginHorizontal: space[8] },
  startBtn: { alignSelf: 'center', paddingHorizontal: space[12], paddingVertical: 6, borderRadius: radius.sm, marginRight: space[12], height: 28, justifyContent: 'center' },
  flushRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[16], paddingVertical: space[12], gap: space[12], borderBottomWidth: StyleSheet.hairlineWidth, backgroundColor: 'transparent' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  moduleWrapper: { flexDirection: 'row', alignItems: 'stretch', borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  moduleContent: { flex: 1, paddingVertical: space[4] },
  streakBadge: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  circle: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  taskRight: { flexDirection: 'row', alignItems: 'center', gap: space[4] },
  priDot: { width: 6, height: 6, borderRadius: 3 },
  strike: { textDecorationLine: 'line-through' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[4], marginTop: space[4] },
  tagChip: { paddingHorizontal: space[8], paddingVertical: 2, borderRadius: radius.full },
  swipeRow: { flexDirection: 'row' },
  swipeBtn: { width: 72, justifyContent: 'center', alignItems: 'center', gap: 3 },
  swipeCompleteBtn: { width: 72, justifyContent: 'center', alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: space[48], gap: space[8] },
});
