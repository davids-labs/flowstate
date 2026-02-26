import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
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
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Feather name="file-text" size={14} color={themeColors.text} style={styles.icon} />
        <Text style={[styles.label, { color: themeColors.text }]}>{label}</Text>
      </View>
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
  icon: { marginRight: spacing.xs },
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
