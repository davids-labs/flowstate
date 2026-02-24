import React, { useState } from 'react';
import { View, Text, Pressable, ScrollView, ActivityIndicator, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { SectionHeader } from '../../components/layout/SectionHeader';
import { importPlan } from '@flowstate/core';
import type { ParsedCSVRow, ValidationResult } from '@flowstate/core';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

export default function ImportPreviewScreen() {
  const router = useRouter();
  const { themeColors } = useTheme();
  const { db } = useDatabaseSafe();
  const params = useLocalSearchParams<{ fileName: string; rows: string; validation: string }>();
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const fileName = params.fileName ?? 'import.csv';
  let rows: ParsedCSVRow[] = [];
  let validation: ValidationResult = { errors: [], warnings: [], isValid: false, summary: { totalRows: 0, dateRange: null, routinesFound: [], modulesReferenced: [], quietDays: 0, sessionsTotal: 0 } };
  try {
    if (params.rows) rows = JSON.parse(params.rows);
    if (params.validation) validation = JSON.parse(params.validation);
  } catch (e) {
    Alert.alert('Error', 'Failed to load import data. Please try again.');
  }

  const { summary } = validation;

  const handleImport = async () => {
    if (!db) {
      Alert.alert('Error', 'Database is not ready yet.');
      return;
    }
    setImporting(true);
    setImportError(null);
    try {
      const result = await importPlan(db, {
        planName: fileName.replace(/\.csv$/i, ''),
        sourceFile: fileName,
        rows,
      });
      router.replace({
        pathname: '/import/success',
        params: {
          daysImported: String(result.daysImported),
          sessionsCreated: String(result.sessionsCreated),
          routinesCreated: JSON.stringify(result.routinesCreated),
          planName: fileName.replace(/\.csv$/i, ''),
        },
      });
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Import failed');
      setImporting(false);
    }
  };

  return (
    <ScreenWrapper>
      <SectionHeader title="Import Preview" subtitle={fileName} />

      {/* Summary Card */}
      <View style={[styles.summaryCard, { backgroundColor: themeColors.surface }]}>
        <View style={[styles.statRow, { borderBottomColor: themeColors.border }]}>
          <StatChip label="Rows" value={String(summary.totalRows)} icon="file-text" themeColors={themeColors} />
          <StatChip label="Sessions" value={String(summary.sessionsTotal)} icon="clock" themeColors={themeColors} />
          <StatChip label="Quiet Days" value={String(summary.quietDays)} icon="moon" themeColors={themeColors} />
        </View>

        {summary.dateRange && (
          <View style={styles.dateRange}>
            <Text style={[styles.dateRangeLabel, { color: themeColors.muted }]}>Date Range</Text>
            <Text style={[styles.dateRangeValue, { color: themeColors.text }]}>
              {summary.dateRange.start} → {summary.dateRange.end}
            </Text>
          </View>
        )}

        {summary.routinesFound.length > 0 && (
          <View style={styles.listSection}>
            <Text style={[styles.listLabel, { color: themeColors.muted }]}>Routines Found</Text>
            <View style={styles.chipRow}>
              {summary.routinesFound.map(r => (
                <View key={r} style={[styles.chip, { backgroundColor: themeColors.accentLight }]}>
                  <Text style={[styles.chipText, { color: themeColors.text }]}>{r}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {summary.modulesReferenced.length > 0 && (
          <View style={styles.listSection}>
            <Text style={[styles.listLabel, { color: themeColors.muted }]}>Module Targets</Text>
            <View style={styles.chipRow}>
              {summary.modulesReferenced.map(m => (
                <View key={m} style={[styles.chip, { backgroundColor: themeColors.border }]}>
                  <Text style={[styles.chipText, { color: themeColors.text }]}>{m}</Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Errors */}
      {validation.errors.length > 0 && (
        <>
          <SectionHeader title="Errors" subtitle={`${validation.errors.length} — must fix before importing`} />
          <View style={[styles.errorList, { backgroundColor: themeColors.danger + '15' }]}>
            {validation.errors.map((err, i) => (
              <View key={i} style={styles.errorRow}>
                <Feather name="x-circle" size={14} color={themeColors.danger} />
                <Text style={[styles.errorText, { color: themeColors.text }]}>
                  <Text style={[styles.errorRowNum, { color: themeColors.danger }]}>Row {err.row}</Text>
                  {' '}{err.column}: {err.message}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Warnings */}
      {validation.warnings.length > 0 && (
        <>
          <SectionHeader title="Warnings" subtitle={`${validation.warnings.length} — will not block import`} />
          <View style={[styles.warningList, { backgroundColor: themeColors.warning + '15' }]}>
            {validation.warnings.map((w, i) => (
              <View key={i} style={styles.warningRow}>
                <Feather name="alert-triangle" size={14} color={themeColors.warning} />
                <Text style={[styles.warningText, { color: themeColors.text }]}>
                  {w.row ? <Text style={[styles.errorRowNum, { color: themeColors.danger }]}>Row {w.row} </Text> : null}
                  {w.message}
                </Text>
              </View>
            ))}
          </View>
        </>
      )}

      {importError && (
        <View style={[styles.importError, { backgroundColor: themeColors.danger + '15' }]}>
          <Feather name="alert-circle" size={16} color={themeColors.danger} />
          <Text style={[styles.importErrorText, { color: themeColors.danger }]}>{importError}</Text>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        <Pressable style={[styles.cancelBtn, { borderColor: themeColors.border }]} onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')}>
          <Text style={[styles.cancelBtnText, { color: themeColors.text }]}>Cancel</Text>
        </Pressable>

        <Pressable
          style={[styles.importBtn, { backgroundColor: themeColors.accent }, !validation.isValid && styles.importBtnDisabled]}
          onPress={handleImport}
          disabled={!validation.isValid || importing}
        >
          {importing ? (
            <ActivityIndicator size="small" color={themeColors.white} />
          ) : (
            <>
              <Feather name="download" size={18} color={themeColors.white} />
              <Text style={[styles.importBtnText, { color: themeColors.white }]}>Import</Text>
            </>
          )}
        </Pressable>
      </View>
    </ScreenWrapper>
  );
}

function StatChip({ label, value, icon, themeColors }: { label: string; value: string; icon: string; themeColors: any }) {
  return (
    <View style={chipStyles.container}>
      <Feather name={icon as any} size={14} color={themeColors.accent} />
      <Text style={[chipStyles.value, { color: themeColors.text }]}>{value}</Text>
      <Text style={[chipStyles.label, { color: themeColors.muted }]}>{label}</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    padding: spacing.sm,
  },
  value: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  label: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
});

const styles = StyleSheet.create({
  summaryCard: {
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  statRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.md,
    marginBottom: spacing.md,
  },
  dateRange: {
    marginBottom: spacing.md,
  },
  dateRangeLabel: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  dateRangeValue: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  listSection: {
    marginBottom: spacing.sm,
  },
  listLabel: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  chipText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  errorList: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: fontSize.sm,
    flex: 1,
  },
  errorRowNum: {
    fontWeight: '700',
  },
  warningList: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  warningText: {
    fontSize: fontSize.sm,
    flex: 1,
  },
  importError: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  importErrorText: {
    fontSize: fontSize.sm,
    flex: 1,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.sm + 4,
    alignItems: 'center',
    borderRadius: borderRadius.md,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  importBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 4,
    borderRadius: borderRadius.md,
    gap: spacing.sm,
  },
  importBtnDisabled: {
    opacity: 0.4,
  },
  importBtnText: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
});
