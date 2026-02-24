import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface DataInputCardProps {
  label: string;
  emoji?: string;
  value: number;
  target: number;
  unit: string;
  onChangeValue: (v: number) => void;
  compact?: boolean;
}

export function DataInputCard({
  label,
  emoji,
  value,
  target,
  unit,
  onChangeValue,
  compact,
}: DataInputCardProps) {
  const { themeColors } = useTheme();
  const progress = target > 0 ? Math.min(value / target, 1) : 0;

  if (compact) {
    return (
      <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
        <Text style={[styles.label, { color: themeColors.text }]}>
          {emoji ? `${emoji}  ` : ''}{label}
        </Text>
        <Text style={[styles.compactValue, { color: themeColors.text }]}>
          {value.toLocaleString()} <Text style={[styles.unit, { color: themeColors.textSecondary }]}>/ {target.toLocaleString()} {unit}</Text>
        </Text>
        <View style={[styles.progressTrack, { backgroundColor: themeColors.surfaceBorder }]}>
          <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: themeColors.accent }]} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
      <Text style={[styles.label, { color: themeColors.text }]}>
        {emoji ? `${emoji}  ` : ''}{label}
      </Text>
      <View style={styles.inputRow}>
        <TextInput
          style={[styles.input, { backgroundColor: themeColors.background, borderColor: themeColors.surfaceBorder, color: themeColors.text }]}
          keyboardType="numeric"
          value={value > 0 ? String(value) : ''}
          onChangeText={text => {
            const num = parseInt(text, 10);
            onChangeValue(isNaN(num) ? 0 : num);
          }}
          placeholder="0"
          placeholderTextColor={themeColors.muted}
        />
        <Text style={[styles.unit, { color: themeColors.textSecondary }]}>/ {target.toLocaleString()} {unit}</Text>
      </View>
      <View style={[styles.progressTrack, { backgroundColor: themeColors.surfaceBorder }]}>
        <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: themeColors.accent }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  input: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: fontSize.lg,
    fontWeight: '600',
    width: 80,
    textAlign: 'center',
    marginRight: spacing.sm,
  },
  compactValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  unit: {
    fontSize: fontSize.sm,
    fontWeight: '400',
  },
  progressTrack: {
    height: 6,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: borderRadius.full,
  },
});
