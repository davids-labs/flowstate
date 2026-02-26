import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface TallyCardProps {
  label: string;
  emoji?: string;
  value: number;
  step?: number;
  target?: number;
  onChangeValue: (newValue: number) => void;
  compact?: boolean;
}

export function TallyCard({
  label,
  emoji,
  value,
  step = 1,
  target,
  onChangeValue,
  compact,
}: TallyCardProps) {
  const { themeColors } = useTheme();
  const handleIncrement = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChangeValue(value + step);
  };

  const handleDecrement = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onChangeValue(Math.max(0, value - step));
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onChangeValue(0);
  };

  const atTarget = target !== undefined && value >= target;

  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface }, atTarget && { borderWidth: 1, borderColor: themeColors.success }]}>
      <View style={styles.labelRow}>
        <Feather name={(emoji ? 'plus-square' : 'plus-square') as any} size={18} color={themeColors.accent} style={styles.icon} />
        <Text style={[styles.label, { color: themeColors.text }]}>{label}</Text>
        {target !== undefined && (
          <Text style={[styles.target, { color: themeColors.muted }, atTarget && { color: themeColors.success, fontWeight: '700' }]}>
            {value}/{target}
          </Text>
        )}
      </View>

      <View style={styles.counterRow}>
        <Pressable style={[styles.btn, { backgroundColor: themeColors.surfaceBorder }]} onPress={handleDecrement}>
          <Feather name="minus" size={20} color={themeColors.text} />
        </Pressable>

        <Pressable onLongPress={handleReset}>
          <Text style={[styles.value, { color: themeColors.text }, atTarget && { color: themeColors.success }]}>
            {value}
          </Text>
        </Pressable>

        <Pressable style={[styles.btn, { backgroundColor: themeColors.accent }]} onPress={handleIncrement}>
          <Feather name="plus" size={20} color={themeColors.white} />
        </Pressable>
      </View>

      {target !== undefined && (
        <View style={[styles.progressTrack, { backgroundColor: themeColors.surfaceBorder }]}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, (value / target) * 100)}%`, backgroundColor: themeColors.accent },
              atTarget && { backgroundColor: themeColors.success },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  emoji: {
    fontSize: fontSize.lg,
  },
  icon: { marginRight: spacing.xs },
  label: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  target: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  counterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  btn: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    fontSize: 36,
    fontWeight: '800',
    minWidth: 60,
    textAlign: 'center',
  },
  progressTrack: {
    height: 4,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
});
