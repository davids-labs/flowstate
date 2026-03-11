/**
 * SwitchboardFilter (Feature: Homescreen Overhaul - Zone 3)
 *
 * Three floating pill-shaped capsule buttons: Gym, Academic, Life.
 * These act as additive filters on the timeline below.
 * - All three are active by default.
 * - Tapping a pill toggles it. Multiple can be active simultaneously.
 * - An 'All' shortcut resets all three.
 * - Active pills use pillar fill colour with white text.
 * - Filter state persists in homeStore.
 */

import React, { useCallback } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

export type Pillar = 'gym' | 'academic' | 'life';

const PILLARS: { key: Pillar; label: string; icon: string; color: string }[] = [
  { key: 'gym', label: 'Gym', icon: '🏋️', color: '#ef4444' },
  { key: 'academic', label: 'Academic', icon: '🎓', color: '#3b82f6' },
  { key: 'life', label: 'Life', icon: '🌿', color: '#22c55e' },
];

interface Props {
  active: Set<Pillar>;
  onChange: (next: Set<Pillar>) => void;
}

export function SwitchboardFilter({ active, onChange }: Props) {
  const { themeColors } = useTheme();

  const toggle = useCallback(
    (pillar: Pillar) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const next = new Set(active);
      if (next.has(pillar)) {
        // Don't allow deselecting all
        if (next.size > 1) next.delete(pillar);
      } else {
        next.add(pillar);
      }
      onChange(next);
    },
    [active, onChange],
  );

  const handleAll = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChange(new Set<Pillar>(['gym', 'academic', 'life']));
  }, [onChange]);

  const allActive = active.size === 3;

  return (
    <View style={styles.row}>
      {/* All shortcut */}
      <Pressable
        style={[
          styles.pill,
          { backgroundColor: allActive ? themeColors.text : themeColors.surface },
        ]}
        onPress={handleAll}
      >
        <Text style={[
          styles.pillText,
          { color: allActive ? themeColors.background : themeColors.muted },
        ]}>
          All
        </Text>
      </Pressable>

      {/* Individual pillar pills */}
      {PILLARS.map(({ key, label, icon, color }) => {
        const isActive = active.has(key);
        return (
          <Pressable
            key={key}
            style={[
              styles.pill,
              { backgroundColor: isActive ? color : themeColors.surface },
            ]}
            onPress={() => toggle(key)}
          >
            <Text style={styles.pillIcon}>{icon}</Text>
            <Text style={[
              styles.pillText,
              { color: isActive ? '#fff' : themeColors.muted },
            ]}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.md,
    flexWrap: 'wrap',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.lg,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    gap: 5,
  },
  pillIcon: {
    fontSize: 13,
  },
  pillText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
});
