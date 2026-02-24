import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert, ActivityIndicator, Share } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useDatabaseSafe } from '../../components/DatabaseProvider';
import { exportBackup, importBackup } from '@flowstate/core';
import { useTheme } from '../../constants/ThemeContext';
import { fontSize, spacing, borderRadius } from '../../constants/theme';

export default function BackupScreen() {
  const { db, isReady } = useDatabaseSafe();
  const { themeColors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // ── Export ───────────────────────────────────────────────────────────
  const handleExport = async () => {
    if (!db || !isReady) return;
    setBusy(true);
    setStatus(null);
    try {
      const data = await exportBackup(db);
      const json = JSON.stringify(data, null, 2);
      const path = `${FileSystem.cacheDirectory}flowstate-backup.json`;
      await FileSystem.writeAsStringAsync(path, json, { encoding: FileSystem.EncodingType.UTF8 });

      await Share.share({
        title: 'FlowState Backup',
        url: path,
        message: 'FlowState database backup',
      });
      setStatus(`Exported ${Object.keys(data.tables).length} tables.`);
    } catch (err: any) {
      Alert.alert('Export Failed', err.message ?? 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  // ── Import ──────────────────────────────────────────────────────────
  const handleImport = async () => {
    if (!db || !isReady) return;

    Alert.alert(
      'Import Backup',
      'This will REPLACE all existing data. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Import',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            setStatus(null);
            try {
              const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
              if (result.canceled || !result.assets?.[0]) { setBusy(false); return; }

              const raw = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: FileSystem.EncodingType.UTF8 });
              const data = JSON.parse(raw);

              if (!data.version || !data.tables) {
                Alert.alert('Invalid File', 'This does not look like a FlowState backup.');
                setBusy(false);
                return;
              }

              const { tablesRestored, rowsRestored } = await importBackup(db, data);
              setStatus(`Restored ${tablesRestored} tables, ${rowsRestored} rows.`);
              Alert.alert('Import Complete', `Restored ${rowsRestored} rows across ${tablesRestored} tables.`);
            } catch (err: any) {
              Alert.alert('Import Failed', err.message ?? 'Unknown error');
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Text style={[styles.heading, { color: themeColors.text }]}>Backup & Restore</Text>
        <Text style={[styles.description, { color: themeColors.muted }]}>
          Export your entire FlowState database to a JSON file, or import a previous backup to restore your data.
        </Text>

        {busy && <ActivityIndicator size="large" color={themeColors.accent} style={{ marginVertical: spacing.lg }} />}

        {status && (
          <View style={[styles.statusBox, { backgroundColor: themeColors.accentLight }]}>
            <Feather name="check-circle" size={18} color={themeColors.accent} />
            <Text style={[styles.statusText, { color: themeColors.accent }]}>{status}</Text>
          </View>
        )}

        <Pressable
          style={[styles.actionBtn, { backgroundColor: themeColors.accent }]}
          onPress={handleExport}
          disabled={busy}
        >
          <Feather name="upload" size={20} color="#fff" />
          <Text style={styles.actionLabel}>Export Backup</Text>
        </Pressable>

        <Pressable
          style={[styles.actionBtn, { backgroundColor: themeColors.surface, borderWidth: 1, borderColor: themeColors.border }]}
          onPress={handleImport}
          disabled={busy}
        >
          <Feather name="download" size={20} color={themeColors.accent} />
          <Text style={[styles.actionLabel, { color: themeColors.accent }]}>Import Backup</Text>
        </Pressable>

        <Text style={[styles.warning, { color: themeColors.muted }]}>
          ⚠ Importing will replace ALL existing data. Make sure to export a backup first if you want to keep your current data.
        </Text>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { padding: spacing.md, gap: spacing.md },
  heading: { fontSize: fontSize.xl, fontWeight: '700' },
  description: { fontSize: fontSize.sm, lineHeight: 20 },
  statusBox: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: borderRadius.md,
  },
  statusText: { fontSize: fontSize.sm, fontWeight: '600' },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, padding: spacing.md, borderRadius: borderRadius.md,
  },
  actionLabel: { fontSize: fontSize.md, fontWeight: '600', color: '#fff' },
  warning: { fontSize: fontSize.xs, lineHeight: 18, marginTop: spacing.sm },
});
