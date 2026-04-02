/**
 * BentoComingUp — V2 spec §1.6
 * Horizontal scroll of upcoming-day cards. 220pt wide, 40pt right peek.
 */
import React from 'react';
import { View, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../primitives/Text';
import { space, radius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';
import { useUserPrefsStore, type Pillar } from '../../stores/userPrefsStore';

const CARD_WIDTH = 220;
const MAX_VISIBLE = 3;

interface SessionPreview { id: string; name: string; pillar: string; scheduledTime?: string | null; durationMinutes?: number; }
interface DayCard { dateLabel: string; isoDate: string; sessions: SessionPreview[]; }
interface Props { days: DayCard[]; onDayPress?: (isoDate: string) => void; }

function fmtTime(t?: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hr = parseInt(h, 10);
  return `${hr % 12 || 12}:${m ?? '00'}${hr >= 12 ? 'pm' : 'am'}`;
}

function DayBentoCard({ day, onPress }: { day: DayCard; onPress: () => void }) {
  const { themeTokens } = useTheme();
  const { getPillarColour } = useUserPrefsStore();
  const visible = day.sessions.slice(0, MAX_VISIBLE);
  const extra = day.sessions.length - MAX_VISIBLE;
  return (
    <Pressable style={[S.card, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]} onPress={onPress}>
      {/* Date header */}
      <AppText variant="title3" style={{ fontWeight: '700' }}>{day.dateLabel}</AppText>
      <View style={{ height: space[8] }} />
      {/* Session rows */}
      {visible.map(s => {
        const fill = getPillarColour(s.pillar as Pillar);
        return (
          <View key={s.id} style={[S.sessionRow, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border }]}>
            <View style={[S.stripe, { backgroundColor: fill }]} />
            <View style={S.nameBlock}>
              <AppText variant="footnote" numberOfLines={1} style={{ fontWeight: '600' }}>{s.name}</AppText>
              <AppText variant="caption2" color={themeTokens.textSecondary}>
                {[s.scheduledTime ? fmtTime(s.scheduledTime) : null, s.durationMinutes ? `${s.durationMinutes}m` : null].filter(Boolean).join(' · ') || '\u00A0'}
              </AppText>
            </View>
          </View>
        );
      })}
      {extra > 0 && <AppText variant="footnote" color={themeTokens.textTertiary} style={{ marginTop: space[4] }}>+ {extra} more</AppText>}
      {day.sessions.length === 0 && (
        <View style={[S.emptyCard, { borderColor: themeTokens.border }]}>
          <Feather name="sun" size={16} color={themeTokens.textTertiary} />
          <AppText variant="footnote" color={themeTokens.textTertiary}>Nothing planned</AppText>
        </View>
      )}
    </Pressable>
  );
}

export function BentoComingUp({ days, onDayPress }: Props) {
  const { themeTokens } = useTheme();
  if (!days || days.length === 0) return null;
  return (
    <View>
      <AppText variant="subheadline" color={themeTokens.textSecondary} style={S.sectionLabel}>COMING UP</AppText>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.scroll} snapToInterval={CARD_WIDTH + space[12]} decelerationRate="fast">
        {days.map(day => (
          <DayBentoCard key={day.isoDate} day={day} onPress={() => onDayPress?.(day.isoDate)} />
        ))}
        <View style={{ width: 40 }} />
      </ScrollView>
    </View>
  );
}

const S = StyleSheet.create({
  sectionLabel: { paddingHorizontal: space[16], paddingBottom: space[8], letterSpacing: 0.5 },
  scroll: { paddingHorizontal: space[16], gap: space[12] },
  card: { width: CARD_WIDTH, borderRadius: radius.lg, borderWidth: 1, padding: space[16], gap: space[4] },
  sessionRow: { flexDirection: 'row', borderRadius: radius.sm, borderWidth: 1, overflow: 'hidden', marginBottom: space[4], height: 44, alignItems: 'stretch' },
  stripe: { width: 3 },
  nameBlock: { flex: 1, paddingHorizontal: space[8], justifyContent: 'center', gap: 2 },
  emptyCard: { borderRadius: radius.sm, borderWidth: 1, borderStyle: 'dashed', paddingVertical: space[12], alignItems: 'center', gap: space[4], flexDirection: 'row', justifyContent: 'center' },
});
