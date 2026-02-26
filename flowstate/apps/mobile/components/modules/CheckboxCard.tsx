import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface CheckboxCardProps {
  label: string;
  emoji?: string;
  checked: boolean;
  streak?: number;
  onToggle: () => void;
}

export function CheckboxCard({ label, emoji, checked, streak, onToggle }: CheckboxCardProps) {
  const { themeColors } = useTheme();
  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onToggle();
  };

  return (
    <Pressable onPress={handlePress} style={[styles.card, { backgroundColor: themeColors.surface }]}>
      <View style={styles.row}>
        <View style={[styles.checkbox, { borderColor: themeColors.muted }, checked && { backgroundColor: themeColors.accent, borderColor: themeColors.accent }]}>
          {checked && <Feather name="check" size={14} color={themeColors.white} />}
        </View>
        <Text style={[styles.label, { color: themeColors.text }]}>{label}</Text>
      </View>
      {streak !== undefined && streak > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.xs }}>
          <Feather name="award" size={14} color={themeColors.warning} />
          <Text style={[styles.streak, { color: themeColors.warning }]}>{streak} day streak</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '500',
    flex: 1,
  },
  streak: {
    fontSize: fontSize.xs,
    marginTop: spacing.xs,
    marginLeft: 32,
  },
});
