/**
 * Session Debrief — V2 spec §4
 *
 * Focused, readable summary shown immediately after a session ends.
 * "The user should leave this screen feeling accomplished. No clutter."
 *
 *  • Large check-circle + "Session Complete" (title1 Bold, centred)
 *  • Session name (title3, textSecondary)
 *  • Total time (display Black, textPrimary, centred)  ← BUG-14 fix
 *  • 3-column stats row (Blocks · Skipped · Notes)
 *  • Block breakdown compact rows (surface bg, 1pt border, radius.md)
 *  • Tags section (accent.tint pill chips)
 *  • Notes field (multiline, surface bg, 1pt border)
 *  • Done button (full-width, accent bg, radius.md)
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  ScrollView,
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { space, radius, typography } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';
import { AppText } from '../../components/primitives/Text';
import { FormTextField } from '../../components/primitives/Form';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { getSession, getSessionEvents, getRoutineBlocks, updateSession } from '@flowstate/core';
import { useUserPrefsStore, type Pillar } from '../../stores/userPrefsStore';

// ─── Types ────────────────────────────────────────────────────────────────────
interface SessionEvent {
  type: string;
  timestamp: string;
  blockIndex?: number;
}

interface BlockSummary {
  name: string;
  index: number;
  skipped: boolean;
}

interface DebriefData {
  routineName: string;
  pillar: string;
  status: string;
  startedAt: string | null;
  endedAt: string | null;
  totalPausedMs: number;
  blockCount: number;
  blockNames: string[];
  events: SessionEvent[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDuration(ms: number): string {
  const s = Math.floor(Math.abs(ms) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── StatPill ─────────────────────────────────────────────────────────────────
function StatPill({ icon, value, label, color }: { icon: string; value: string | number; label: string; color: string }) {
  const { themeTokens } = useTheme();
  return (
    <View style={[S.statPill, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}>
      <Feather name={icon as any} size={16} color={color} />
      <AppText variant="title3" style={{ fontWeight: '700', color: themeTokens.textPrimary }}>{value}</AppText>
      <AppText variant="caption1" color={themeTokens.textTertiary}>{label}</AppText>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function DebriefScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const router = useRouter();
  const { db, isReady } = useDatabaseSafe();
  const { themeTokens } = useTheme();
  const insets = useSafeAreaInsets();
  const getPillarColour = useUserPrefsStore(s => s.getPillarColour);
  const [data, setData] = useState<DebriefData | null>(null);
  const [notes, setNotes] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [loading, setLoading] = useState(true);

  // Entrance animation
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, damping: 20, stiffness: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  useEffect(() => {
    if (!db || !isReady || !sessionId) { setLoading(false); return; }
    (async () => {
      try {
        const sess = await getSession(db, sessionId);
        if (!sess) { setLoading(false); return; }
        const events = await getSessionEvents(db, sessionId);
        let blockNames: string[] = [];
        try {
          const blocks = await getRoutineBlocks(db, sess.routineId);
          blockNames = (blocks as any[]).map(b => b.name);
        } catch {}
        setData({
          routineName: sess.routineName,
          pillar: (sess as any).pillar ?? 'general',
          status: sess.status,
          startedAt: sess.startedAt,
          endedAt: sess.endedAt,
          totalPausedMs: (sess as any).totalPausedMs ?? 0,
          blockCount: blockNames.length || 1,
          blockNames,
          events: (events as any[]).map(e => ({ type: e.type, timestamp: e.timestamp, blockIndex: e.blockIndex })),
        });
        if ((sess as any).notes) setNotes((sess as any).notes);
      } catch (e) { console.error('Failed to load debrief:', e); }
      finally { setLoading(false); }
    })();
  }, [db, isReady, sessionId]);

  // ── Guard: missing session ──────────────────────────────────────────────────
  if (!sessionId) return (
    <View style={[S.fill, { backgroundColor: themeTokens.background, justifyContent: 'center', alignItems: 'center', padding: space[24] }]}>
      <Feather name="alert-circle" size={48} color={themeTokens.destructive} />
      <AppText variant="title2" style={{ marginTop: space[16], fontWeight: '700' }}>No Session Found</AppText>
      <Pressable style={[S.doneBtn, { backgroundColor: themeTokens.accent, marginTop: space[32] }]} onPress={() => router.replace('/(tabs)')}>
        <AppText variant="headline" onAccent style={{ fontWeight: '700' }}>Go Home</AppText>
      </Pressable>
    </View>
  );

  if (loading) return (
    <View style={[S.fill, { backgroundColor: themeTokens.background, justifyContent: 'center', alignItems: 'center' }]}>
      <Feather name="loader" size={32} color={themeTokens.textTertiary} />
      <AppText variant="footnote" color={themeTokens.textTertiary} style={{ marginTop: space[16] }}>Loading session…</AppText>
    </View>
  );

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalMs = data?.startedAt && data?.endedAt
    ? new Date(data.endedAt).getTime() - new Date(data.startedAt).getTime()
    : 0;
  const activeMs = totalMs - (data?.totalPausedMs ?? 0);
  const skippedCount = data?.events.filter(e => e.type === 'block_skipped').length ?? 0;
  const completedBlocks = (data?.blockCount ?? 0) - skippedCount;
  const hasNotes = !!notes.trim();
  const isCompleted = data?.status === 'completed';
  const pillarColor = getPillarColour((data?.pillar ?? 'general') as Pillar);

  // Build block summaries from events
  const blocksCompleted = new Set<number>();
  const blocksSkipped = new Set<number>();
  data?.events.forEach(e => {
    if (e.blockIndex != null) {
      if (e.type === 'block_skipped') blocksSkipped.add(e.blockIndex);
      if (e.type === 'block_completed') blocksCompleted.add(e.blockIndex);
    }
  });

  const handleAddTag = () => {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  const handleDone = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (db && sessionId) {
      try { await updateSession(db, sessionId, { notes: notes.trim() }); } catch {}
    }
    router.replace('/(tabs)');
  };

  return (
    <Animated.ScrollView
      style={[S.fill, { backgroundColor: themeTokens.background, opacity: fadeAnim }]}
      contentContainerStyle={[S.scroll, { paddingTop: insets.top + space[32], paddingBottom: insets.bottom + space[32] }]}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Hero: icon + title ── */}
      <Animated.View style={[S.hero, { transform: [{ translateY: slideAnim }] }]}>
        <View style={[S.iconWrap, { backgroundColor: isCompleted ? themeTokens.success + '18' : themeTokens.warning + '18' }]}>
          <Feather
            name={isCompleted ? 'check-circle' : 'x-circle'}
            size={52}
            color={isCompleted ? themeTokens.success : themeTokens.warning}
          />
        </View>
        <AppText variant="title1" style={{ fontWeight: '700', marginTop: space[16], textAlign: 'center' }}>
          {isCompleted ? 'Session Complete' : 'Session Ended'}
        </AppText>
        <AppText variant="title3" color={themeTokens.textSecondary} style={{ textAlign: 'center', marginTop: space[4] }}>
          {data?.routineName ?? 'Session'}
        </AppText>
      </Animated.View>

      {/* ── Total time (display Black, BUG-14 fix) ── */}
      <View style={S.timeHero}>
        <AppText variant="display" style={{ fontWeight: '800', color: themeTokens.textPrimary, fontVariant: ['tabular-nums'] as any }}>
          {formatDuration(activeMs)}
        </AppText>
        <AppText variant="footnote" color={themeTokens.textTertiary} style={{ marginTop: space[4] }}>Active time</AppText>
        {data?.totalPausedMs ? (
          <AppText variant="caption1" color={themeTokens.textTertiary}>{formatDuration(data.totalPausedMs)} paused</AppText>
        ) : null}
      </View>

      {/* ── 3-col stats row ── */}
      <View style={[S.statsRow, { marginHorizontal: space[16] }]}>
        <StatPill icon="layers" value={completedBlocks} label="Blocks" color={pillarColor} />
        <StatPill icon="skip-forward" value={skippedCount} label="Skipped" color={themeTokens.textTertiary} />
        <StatPill icon="file-text" value={hasNotes ? '✓' : '–'} label="Notes" color={hasNotes ? themeTokens.success : themeTokens.textTertiary} />
      </View>

      {/* ── Block breakdown ── */}
      {data && data.blockNames.length > 0 && (
        <View style={[S.section, { marginHorizontal: space[16] }]}>
          <AppText variant="caption1" color={themeTokens.textTertiary} style={S.sectionLabel}>BLOCKS</AppText>
          <View style={[S.card, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}>
            {data.blockNames.map((name, i) => {
              const skipped = blocksSkipped.has(i);
              const done = blocksCompleted.has(i) || (!skipped && i < data.blockCount);
              return (
                <View key={i} style={[S.blockRow, i < data.blockNames.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeTokens.border }]}>
                  <View style={[S.blockStripe, { backgroundColor: skipped ? themeTokens.textTertiary : pillarColor }]} />
                  <AppText variant="subheadline" color={skipped ? themeTokens.textTertiary : themeTokens.textPrimary} style={{ flex: 1 }} numberOfLines={1}>
                    {name}
                  </AppText>
                  <Feather
                    name={skipped ? 'minus-circle' : 'check-circle'}
                    size={16}
                    color={skipped ? themeTokens.textTertiary : themeTokens.success}
                  />
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* ── Time breakdown ── */}
      {data?.startedAt && data?.endedAt && (
        <View style={[S.section, { marginHorizontal: space[16] }]}>
          <AppText variant="caption1" color={themeTokens.textTertiary} style={S.sectionLabel}>SESSION TIME</AppText>
          <View style={[S.card, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}>
            {[
              { label: 'Started', value: formatTime(data.startedAt) },
              { label: 'Ended', value: formatTime(data.endedAt) },
              { label: 'Total duration', value: formatDuration(totalMs) },
            ].map((row, i, arr) => (
              <View key={row.label} style={[S.timeRow, i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: themeTokens.border }]}>
                <AppText variant="subheadline" color={themeTokens.textSecondary}>{row.label}</AppText>
                <AppText variant="subheadline" style={{ fontWeight: '600', color: themeTokens.textPrimary }}>{row.value}</AppText>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* ── Tags ── */}
      <View style={[S.section, { marginHorizontal: space[16] }]}>
        <AppText variant="caption1" color={themeTokens.textTertiary} style={S.sectionLabel}>TAGS</AppText>
        <View style={S.tagRow}>
          {tags.map(t => (
            <Pressable key={t} style={[S.tagChip, { backgroundColor: themeTokens.accentTint }]} onPress={() => setTags(prev => prev.filter(x => x !== t))}>
              <AppText variant="caption1" color={themeTokens.accent}>{t}</AppText>
              <Feather name="x" size={10} color={themeTokens.accent} />
            </Pressable>
          ))}
        </View>
        <FormTextField
          containerStyle={{ marginTop: space[8] }}
          placeholder="Add tag..."
          value={tagInput}
          onChangeText={setTagInput}
          onSubmitEditing={handleAddTag}
          returnKeyType="done"
          trailing={(
            <Pressable onPress={handleAddTag} hitSlop={8}>
              <Feather name="plus" size={16} color={themeTokens.accent} />
            </Pressable>
          )}
        />
      </View>

      {/* ── Notes ── */}
      <View style={[S.section, { marginHorizontal: space[16] }]}>
        <AppText variant="caption1" color={themeTokens.textTertiary} style={S.sectionLabel}>NOTES</AppText>
        <FormTextField
          placeholder="How did it go? Any thoughts…"
          value={notes}
          onChangeText={setNotes}
          multiline
          onBlur={async () => {
            if (db && sessionId && notes.trim()) {
              try { await updateSession(db, sessionId, { notes: notes.trim() }); } catch {}
            }
          }}
        />
      </View>

      {/* ── Done ── */}
      <Pressable
        style={[S.doneBtn, { backgroundColor: themeTokens.accent, marginHorizontal: space[16], marginTop: space[8] }]}
        onPress={handleDone}
      >
        <Feather name="check" size={20} color="#fff" />
        <AppText variant="headline" onAccent style={{ fontWeight: '700' }}>Done</AppText>
      </Pressable>
    </Animated.ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
  fill: { flex: 1 },
  scroll: { alignItems: 'stretch' },

  hero: { alignItems: 'center', marginBottom: space[24], paddingHorizontal: space[16] },
  iconWrap: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },

  timeHero: { alignItems: 'center', marginBottom: space[24] },

  statsRow: { flexDirection: 'row', gap: space[8], marginBottom: space[24] },
  statPill: { flex: 1, alignItems: 'center', gap: space[4], paddingVertical: space[12], borderRadius: radius.md, borderWidth: 1 },

  section: { marginBottom: space[20] },
  sectionLabel: { letterSpacing: 0.5, marginBottom: space[8] },
  card: { borderRadius: radius.md, borderWidth: 1, overflow: 'hidden' },
  blockRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[12], paddingVertical: space[8], gap: space[8] },
  blockStripe: { width: 3, height: '100%', borderRadius: 2 },
  timeRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space[16], paddingVertical: space[8] },

  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space[8], alignItems: 'center' },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: space[4], paddingHorizontal: space[8], paddingVertical: space[4], borderRadius: radius.full },

  doneBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[8], height: 56, borderRadius: radius.md },
});
