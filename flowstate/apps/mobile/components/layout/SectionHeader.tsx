import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { fontSize, spacing } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export function SectionHeader({ title, subtitle, right }: SectionHeaderProps) {
  const { themeColors } = useTheme();
  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <Text style={[styles.title, { color: themeColors.ink }]}>{title}</Text>
        {right ? <View>{right}</View> : null}
      </View>
      {subtitle && <Text style={[styles.subtitle, { color: themeColors.muted }]}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
