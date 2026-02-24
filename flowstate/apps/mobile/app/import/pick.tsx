import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { parseCSV, validateCSV } from '@flowstate/core';
import type { ParsedCSVRow, ValidationResult } from '@flowstate/core';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

export default function ImportPickScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePick = async () => {
    setError(null);
    setLoading(true);

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) {
        setLoading(false);
        return;
      }

      const asset = result.assets[0];
      const content = await FileSystem.readAsStringAsync(asset.uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });

      const { rows, headers } = parseCSV(content);
      const validation = validateCSV(rows);

      // Navigate to preview with data
      router.push({
        pathname: '/import/preview',
        params: {
          fileName: asset.name ?? 'import.csv',
          rows: JSON.stringify(rows),
          validation: JSON.stringify(validation),
        },
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to read file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <SectionHeader title="Import Plan" subtitle="Import a training or study plan from a CSV file" />

      <View style={[styles.dropZone, { backgroundColor: themeColors.surface, borderColor: themeColors.border }]}>
        <Feather name="upload" size={40} color={themeColors.muted} />
        <Text style={[styles.dropTitle, { color: themeColors.text }]}>Select a CSV file</Text>
        <Text style={[styles.dropSubtitle, { color: themeColors.muted }]}>
          Your CSV should have columns: date, title, must_do,{'\n'}
          session_N_routine, session_N_time
        </Text>

        <Pressable style={[styles.pickButton, { backgroundColor: themeColors.accent }]} onPress={handlePick} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color={themeColors.white} />
          ) : (
            <>
              <Feather name="file-text" size={18} color={themeColors.white} />
              <Text style={[styles.pickButtonText, { color: themeColors.white }]}>Choose File</Text>
            </>
          )}
        </Pressable>
      </View>

      {error && (
        <View style={[styles.errorCard, { backgroundColor: themeColors.danger + '15' }]}>
          <Feather name="alert-circle" size={16} color={themeColors.danger} />
          <Text style={[styles.errorText, { color: themeColors.danger }]}>{error}</Text>
        </View>
      )}

      <SectionHeader title="CSV Format" subtitle="Expected columns" />
      <View style={[styles.formatCard, { backgroundColor: themeColors.surface }]}>
        {[
          { col: 'date', desc: 'YYYY-MM-DD (required)' },
          { col: 'title', desc: 'Day title (required)' },
          { col: 'must_do', desc: 'Semicolon-separated tasks' },
          { col: 'session_1_routine', desc: 'Routine name' },
          { col: 'session_1_time', desc: 'Duration in minutes' },
          { col: 'target_steps', desc: 'Module target value' },
          { col: 'require_vitamins', desc: 'Mark module required' },
          { col: 'quiet', desc: '"true" for rest days' },
        ].map(item => (
          <View key={item.col} style={[styles.formatRow, { borderBottomColor: themeColors.border }]}>
            <Text style={[styles.formatCol, { color: themeColors.text }]}>{item.col}</Text>
            <Text style={[styles.formatDesc, { color: themeColors.muted }]}>{item.desc}</Text>
          </View>
        ))}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  dropZone: {
    borderRadius: borderRadius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    padding: spacing.xl,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  dropTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    marginTop: spacing.md,
  },
  dropSubtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    marginTop: spacing.xs,
    lineHeight: 20,
  },
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  pickButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  errorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  errorText: {
    fontSize: fontSize.sm,
    flex: 1,
  },
  formatCard: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
  },
  formatRow: {
    flexDirection: 'row',
    paddingVertical: spacing.xs + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  formatCol: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    width: 140,
    fontFamily: 'monospace',
  },
  formatDesc: {
    fontSize: fontSize.sm,
    flex: 1,
  },
});
