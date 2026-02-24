import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface TextNoteCardProps {
  label: string;
  emoji?: string;
  value: string;
  onChangeValue: (text: string) => void;
  maxLength?: number;
  prompt?: string;
  compact?: boolean;
}

export function TextNoteCard({
  label,
  emoji,
  value,
  onChangeValue,
  maxLength = 500,
  prompt,
  compact,
}: TextNoteCardProps) {
  const { themeColors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface }, compact && styles.cardCompact]}>
      <Text style={[styles.label, { color: themeColors.text }]}>
        {emoji ? `${emoji}  ` : ''}{label}
      </Text>
      <TextInput
        style={[styles.input, { backgroundColor: themeColors.background, borderColor: themeColors.border, color: themeColors.text }]}
        multiline
        placeholder={prompt ?? 'Write something...'}
        placeholderTextColor={themeColors.muted}
        value={value}
        onChangeText={onChangeValue}
        maxLength={maxLength}
        textAlignVertical="top"
      />
      <Text style={[styles.charCount, { color: themeColors.muted }]}>
        {value.length}/{maxLength}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  cardCompact: {
    padding: spacing.sm,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  input: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    padding: spacing.sm,
    fontSize: fontSize.md,
    minHeight: 80,
  },
  charCount: {
    fontSize: fontSize.xs,
    textAlign: 'right',
    marginTop: spacing.xs,
  },
});
