/**
 * SwitchboardFilter — V2 spec §1.3
 */
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { AppText } from '../primitives/Text';
import { space, radius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';
import { useUserPrefsStore, type Pillar } from '../../stores/userPrefsStore';
import { useHaptics } from '../../hooks/useHaptics';

export type { Pillar };

const PILLAR_META = [
  { key: 'gym' as Pillar,      label: 'Gym',      icon: 'activity' as const },
  { key: 'academic' as Pillar, label: 'Academic', icon: 'book-open' as const },
  { key: 'life' as Pillar,     label: 'Life',     icon: 'heart' as const },
];

interface Props {
  active: Set<Pillar>;
  onToggle: (p: Pillar) => void;
  onReset: () => void;
}

export function SwitchboardFilter({ active, onToggle, onReset }: Props) {
  const { themeTokens } = useTheme();
  const getPillarColour = useUserPrefsStore(s => s.getPillarColour);
  const haptic = useHaptics();

  const handleToggle = useCallback((p: Pillar) => {
    haptic.selection();
    onToggle(p);
  }, [onToggle, haptic]);

  const handleReset = useCallback(() => {
    haptic.selection();
    onReset();
  }, [onReset, haptic]);

  const allActive = active.has('gym') && active.has('academic') && active.has('life');

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[styles.row, { paddingHorizontal: space[16] }]}
      style={styles.scroll}
    >
      {PILLAR_META.map(({ key, label, icon }) => {
        const isActive = active.has(key);
        const fillColor = getPillarColour(key);
        return (
          <Pressable
            key={key}
            style={[
              styles.pill,
              isActive
                ? { backgroundColor: fillColor, borderColor: 'transparent', borderWidth: 1 }
                : { backgroundColor: themeTokens.surface, borderColor: themeTokens.border, borderWidth: 1 },
            ]}
            onPress={() => handleToggle(key)}
          >
            <Feather name={icon} size={14} color={isActive ? '#FFFFFF' : themeTokens.textSecondary} />
            <AppText
              variant="subheadline"
              color={isActive ? '#FFFFFF' : themeTokens.textSecondary}
              style={isActive ? styles.bold : undefined}
            >
              {label}
            </AppText>
          </Pressable>
        );
      })}
      {!allActive && (
        <Pressable
          style={[styles.pill, { backgroundColor: themeTokens.accentTint, borderColor: 'transparent', borderWidth: 1 }]}
          onPress={handleReset}
        >
          <AppText variant="subheadline" color={themeTokens.accent}>All</AppText>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: {
    flexDirection: 'row',
    gap: space[8],
    alignItems: 'center',
    paddingVertical: space[4],
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.full,
    paddingVertical: space[8],
    paddingHorizontal: space[12],
    gap: space[4],
  },
  bold: { fontWeight: '600' },
});
