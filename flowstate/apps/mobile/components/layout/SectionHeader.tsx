import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontSize, spacing } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: themeColors.ink }]}>{title}</Text>
      {subtitle && <Text style={[styles.subtitle, { color: themeColors.muted }]}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
});
