import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../primitives/Text';
import { useTheme } from '../../constants/ThemeContext';
import { space, radius } from '../../constants/theme';
import { useMultiSelectStore } from '../../stores/multiSelectStore';

// ─── MultiSelectActionBar ─────────────────────────────────────────────────────
// §1.7 — appears at the bottom of the screen when long-press multi-select is
// active. Slides up from behind the tab bar (handled by the parent via
// Animated.Value). Tab bar hides while this is visible.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  onReschedule?: () => void;
  onDuplicate?: () => void;
  onTag?: () => void;
  onDelete?: () => void;
}

export function MultiSelectActionBar({ onReschedule, onDuplicate, onTag, onDelete }: Props) {
  const { themeTokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { count, exit } = useMultiSelectStore();
  const selectedCount = count();

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: themeTokens.surfaceElevated,
          borderTopColor: themeTokens.border,
          paddingBottom: insets.bottom + space[8],
        },
      ]}
    >
      {/* Selection count */}
      <AppText variant="headline" style={styles.count}>
        {selectedCount} selected
      </AppText>

      {/* Action buttons */}
      <View style={styles.actions}>
        {onReschedule && (
          <Pressable style={styles.action} onPress={onReschedule} hitSlop={8}>
            <Feather name="calendar" size={18} color={themeTokens.accent} />
            <AppText variant="subheadline" color={themeTokens.accent}>Reschedule</AppText>
          </Pressable>
        )}
        {onDuplicate && (
          <Pressable style={styles.action} onPress={onDuplicate} hitSlop={8}>
            <Feather name="copy" size={18} color={themeTokens.accent} />
            <AppText variant="subheadline" color={themeTokens.accent}>Duplicate</AppText>
          </Pressable>
        )}
        {onTag && (
          <Pressable style={styles.action} onPress={onTag} hitSlop={8}>
            <Feather name="tag" size={18} color={themeTokens.accent} />
            <AppText variant="subheadline" color={themeTokens.accent}>Tag</AppText>
          </Pressable>
        )}
        {onDelete && (
          <Pressable style={styles.action} onPress={onDelete} hitSlop={8}>
            <Feather name="trash-2" size={18} color={themeTokens.destructive} />
            <AppText variant="subheadline" color={themeTokens.destructive}>Delete</AppText>
          </Pressable>
        )}

        {/* Cancel */}
        <Pressable onPress={exit} hitSlop={8} style={styles.cancelBtn}>
          <Feather name="x" size={22} color={themeTokens.textSecondary} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: space[12],
    paddingHorizontal: space[16],
    borderTopWidth: 1,
  },
  count: {
    marginBottom: space[8],
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[16],
    flexWrap: 'wrap',
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4],
    paddingVertical: space[8],
  },
  cancelBtn: {
    marginLeft: 'auto',
    paddingVertical: space[8],
  },
});
