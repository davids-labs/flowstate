import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, Switch, StyleSheet, Alert, Platform, Share, TextInput, ActivityIndicator, ScrollView } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '../components/layout/ScreenWrapper';
import { SectionHeader } from '../components/layout/SectionHeader';
import { syncReminderPreference } from '../services/notifications';
import { useDatabaseSafe } from '../components/DatabaseProvider';
import {
  getModuleSpecs,
  getActivePlan,
  getDayPlansInRange,
  getRoutines,
  getRoutineBlocks,
  linkGoogleAccount,
  getCurrentUser,
  routines,
  routineBlocks,
  plans,
  dayPlans,
  moduleSpecs,
  moduleValues,
  sessions,
  eventLog,
  homescreenLayout,
} from '@flowstate/core';
import { sql } from 'drizzle-orm';
import { useSyncContext } from '../components/SyncProvider';
import { useTheme } from '../constants/ThemeContext';
import { fontSize, spacing, borderRadius } from '../constants/theme';

interface SettingRowProps {
  icon: string;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
}

function SettingRow({ icon, label, subtitle, onPress, right }: SettingRowProps) {
  const { themeColors } = useTheme();
  return (
    <Pressable style={[styles.row, { backgroundColor: themeColors.surface }]} onPress={onPress} disabled={!onPress && !right}>
      <View style={[styles.rowIcon, { backgroundColor: themeColors.accentLight }]}>
        <Feather name={icon as any} size={20} color={themeColors.accent} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={[styles.rowLabel, { color: themeColors.text }]}>{label}</Text>
        {subtitle && <Text style={[styles.rowSubtitle, { color: themeColors.muted }]}>{subtitle}</Text>}
      </View>
      {right || (onPress && <Feather name="chevron-right" size={18} color={themeColors.muted} />)}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { db } = useDatabaseSafe();
  const { isAuthenticated, isSyncing, uid, pendingCount } = useSyncContext();
  const { isDark, themeColors, toggleDarkMode: setDarkModeTheme } = useTheme();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [isLinking, setIsLinking] = useState(false);
  const [linkedProvider, setLinkedProvider] = useState<string | null>(null);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [devTapCount, setDevTapCount] = useState(0);
  const [dbStats, setDbStats] = useState<Record<string, number> | null>(null);
  const [dbTestResult, setDbTestResult] = useState<string | null>(null);
  const [keepAwakeEnabled, setKeepAwakeEnabled] = useState(true);
  const [confirmOnDelete, setConfirmOnDelete] = useState(true);
  const [autoStartSessions, setAutoStartSessions] = useState(false);
  const [compactCards, setCompactCards] = useState(false);

  // Check if already linked
  useEffect(() => {
    try {
      const user = getCurrentUser();
      if (user) {
        const googleProvider = user.providerData?.find((p: any) => p.providerId === 'google.com');
        if (googleProvider) setLinkedProvider(googleProvider.email ?? 'Google');
      }
    } catch {}
  }, [isAuthenticated]);

  const handleLinkGoogle = async () => {
    if (!isAuthenticated) {
      Alert.alert('Not Available', 'Cloud sync must be active before linking an account.');
      return;
    }
    if (linkedProvider) {
      Alert.alert('Already Linked', `Your account is linked to ${linkedProvider}.`);
      return;
    }

    setIsLinking(true);
    try {
      // Dynamic import to avoid crashing when native modules aren't available
      let AuthSession: any;
      let WebBrowser: any;
      try {
        AuthSession = require('expo-auth-session');
        WebBrowser = require('expo-web-browser');
      } catch {
        Alert.alert('Not Available', 'Google sign-in requires a production build. It is not available in Expo Go.');
        setIsLinking(false);
        return;
      }
      if (!AuthSession || !WebBrowser) {
        Alert.alert('Not Available', 'Google sign-in requires a production build. It is not available in Expo Go.');
        setIsLinking(false);
        return;
      }
      WebBrowser.maybeCompleteAuthSession?.();

      const discovery = await AuthSession.fetchDiscoveryAsync('https://accounts.google.com');
      const redirectUri = AuthSession.makeRedirectUri({ scheme: 'flowstate' });
      const request = new AuthSession.AuthRequest({
        clientId: '693723347422-akp5cv832dlhd35pqrdtag5bihh7urtm.apps.googleusercontent.com',
        scopes: ['openid', 'profile', 'email'],
        redirectUri,
        responseType: AuthSession.ResponseType.IdToken,
      });
      const result = await request.promptAsync(discovery);
      if (result.type === 'success' && result.params?.id_token) {
        await linkGoogleAccount(result.params.id_token);
        const user = getCurrentUser();
        const gp = user?.providerData?.find((p: any) => p.providerId === 'google.com');
        setLinkedProvider(gp?.email ?? 'Google');
        Alert.alert('Linked!', 'Your Google account is now linked for cross-device sync.');
      }
    } catch (err: any) {
      if (err?.message?.includes?.('Cannot find native module')) {
        Alert.alert('Not Available', 'Google sign-in requires a production build. It is not available in Expo Go.');
      } else {
        Alert.alert('Link Failed', err.message ?? 'Could not link Google account.');
      }
    } finally {
      setIsLinking(false);
    }
  };

  // Load persisted settings
  useEffect(() => {
    (async () => {
      try {
        const [notif, haptic] = await Promise.all([
          AsyncStorage.getItem('setting_notifications'),
          AsyncStorage.getItem('setting_haptics'),
        ]);
        if (notif !== null) setNotificationsEnabled(notif === 'true');
        if (haptic !== null) setHapticsEnabled(haptic === 'true');
      } catch {}
    })();
  }, []);

  // Persist on change
  const toggleNotifications = (v: boolean) => {
    setNotificationsEnabled(v);
    AsyncStorage.setItem('setting_notifications', String(v)).catch(() => {});
    syncReminderPreference(v).catch(() => {});
  };
  const toggleHaptics = (v: boolean) => {
    setHapticsEnabled(v);
    AsyncStorage.setItem('setting_haptics', String(v)).catch(() => {});
  };

  // Load extended preferences
  useEffect(() => {
    (async () => {
      try {
        const [ka, cod, ass, cc] = await Promise.all([
          AsyncStorage.getItem('setting_keep_awake'),
          AsyncStorage.getItem('setting_confirm_delete'),
          AsyncStorage.getItem('setting_auto_start'),
          AsyncStorage.getItem('setting_compact_cards'),
        ]);
        if (ka !== null) setKeepAwakeEnabled(ka === 'true');
        if (cod !== null) setConfirmOnDelete(cod === 'true');
        if (ass !== null) setAutoStartSessions(ass === 'true');
        if (cc !== null) setCompactCards(cc === 'true');
      } catch {}
    })();
  }, []);

  const toggleSetting = (key: string, setter: (v: boolean) => void) => (v: boolean) => {
    setter(v);
    AsyncStorage.setItem(key, String(v)).catch(() => {});
  };

  // Dev panel: version tap easter egg (5 taps)
  const handleVersionTap = () => {
    const next = devTapCount + 1;
    setDevTapCount(next);
    if (next >= 5 && !showDevPanel) {
      setShowDevPanel(true);
      setDevTapCount(0);
      Alert.alert('🔧 Developer Mode', 'Developer panel is now visible.');
    }
  };

  // Dev: gather database stats
  const loadDbStats = useCallback(async () => {
    if (!db) return;
    try {
      const tables = [
        { name: 'moduleSpecs', table: moduleSpecs },
        { name: 'moduleValues', table: moduleValues },
        { name: 'sessions', table: sessions },
        { name: 'eventLog', table: eventLog },
        { name: 'dayPlans', table: dayPlans },
        { name: 'routines', table: routines },
        { name: 'routineBlocks', table: routineBlocks },
        { name: 'plans', table: plans },
        { name: 'homescreenLayout', table: homescreenLayout },
      ];
      const stats: Record<string, number> = {};
      for (const t of tables) {
        try {
          const rows = await db.select({ count: sql`count(*)` }).from(t.table);
          stats[t.name] = rows[0]?.count ?? 0;
        } catch {
          stats[t.name] = -1;
        }
      }
      setDbStats(stats);
    } catch (e) {
      Alert.alert('Error', String(e));
    }
  }, [db]);

  // Dev: test DB read/write cycle
  const testDbReadWrite = useCallback(async () => {
    if (!db) {
      setDbTestResult('❌ No database connection');
      return;
    }
    try {
      const start = Date.now();
      // Write test
      const testId = `__test_${Date.now()}`;
      await db.insert(moduleSpecs).values({
        id: testId,
        type: 'checkbox',
        label: '__test__',
        config: '{}',
        placements: '[]',
        isLive: false,
        required: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      // Read test
      const rows = await db.select().from(moduleSpecs).where(sql`${moduleSpecs.id} = ${testId}`);
      // Cleanup
      await db.delete(moduleSpecs).where(sql`${moduleSpecs.id} = ${testId}`);
      const elapsed = Date.now() - start;
      setDbTestResult(`✅ OK — write/read/delete in ${elapsed}ms (${rows.length} row matched)`);
    } catch (e) {
      setDbTestResult(`❌ Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [db]);

  // Dev: run raw SQL query
  const [rawSql, setRawSql] = useState('');
  const [rawSqlResult, setRawSqlResult] = useState<string | null>(null);
  const runRawSql = useCallback(async () => {
    if (!db || !rawSql.trim()) return;
    try {
      // Access the underlying SQLite handle via globalThis singleton
      const g = globalThis as any;
      const sqliteDb = g.__flowstate_sqliteDb;
      if (!sqliteDb) {
        setRawSqlResult('❌ No raw SQLite handle');
        return;
      }
      const result = sqliteDb.getAllSync(rawSql.trim());
      setRawSqlResult(JSON.stringify(result, null, 2).slice(0, 2000));
    } catch (e) {
      setRawSqlResult(`❌ ${e instanceof Error ? e.message : String(e)}`);
    }
  }, [db, rawSql]);

  const handleExportData = async () => {
    if (!db) {
      Alert.alert('Not Ready', 'Database is not ready yet.');
      return;
    }
    try {
      const specs = await getModuleSpecs(db);
      const plan = await getActivePlan(db);
      const allDays = await getDayPlansInRange(db, '2000-01-01', '2099-12-31');

      // Also export sessions, module values, routines, and event log
      const allRoutines = await getRoutines(db);
      const allRoutineBlocks: any[] = [];
      for (const r of allRoutines) {
        const blocks = await getRoutineBlocks(db, r.id);
        allRoutineBlocks.push(...blocks);
      }
      const allModuleValues = await db.select().from(moduleValues);
      const allSessions = await db.select().from(sessions);
      const allEvents = await db.select().from(eventLog);

      const exportData = {
        exportedAt: new Date().toISOString(),
        plan,
        dayPlans: allDays,
        moduleSpecs: specs,
        routines: allRoutines,
        routineBlocks: allRoutineBlocks,
        moduleValues: allModuleValues,
        sessions: allSessions,
        eventLog: allEvents,
      };
      const json = JSON.stringify(exportData, null, 2);
      await Share.share({
        message: json,
        title: 'FlowState Export',
      });
    } catch (e) {
      Alert.alert('Export Failed', e instanceof Error ? e.message : 'Unknown error');
    }
  };

  const handleDeleteData = () => {
    Alert.alert(
      'Delete All Data',
      'This will permanently delete all your plans, modules, and session data. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            if (!db) {
              Alert.alert('Error', 'Database is not ready.');
              return;
            }
            try {
              // Delete in dependency order (children first)
              await db.delete(eventLog);
              await db.delete(moduleValues);
              await db.delete(sessions);
              await db.delete(dayPlans);
              await db.delete(routineBlocks);
              await db.delete(routines);
              await db.delete(moduleSpecs);
              await db.delete(homescreenLayout);
              await db.delete(plans);
              Alert.alert('Done', 'All data has been deleted. Restart the app for a fresh start.');
            } catch (e) {
              console.error('Delete failed:', e);
              Alert.alert('Error', 'Failed to delete data. ' + (e instanceof Error ? e.message : ''));
            }
          },
        },
      ],
    );
  };

  return (
    <ScreenWrapper>
      <SectionHeader title="Settings" />

      {/* ─── General ──── */}
      <Text style={[styles.sectionLabel, { color: themeColors.muted }]}>General</Text>
      <SettingRow
        icon="bell"
        label="Notifications"
        subtitle="Session reminders & must-do alerts"
        right={
          <Switch
            value={notificationsEnabled}
            onValueChange={toggleNotifications}
            trackColor={{ true: themeColors.accent }}
          />
        }
      />
      <SettingRow
        icon="smartphone"
        label="Haptic Feedback"
        subtitle="Vibration on actions"
        right={
          <Switch
            value={hapticsEnabled}
            onValueChange={toggleHaptics}
            trackColor={{ true: themeColors.accent }}
          />
        }
      />
      <SettingRow
        icon="moon"
        label="Dark Mode"
        subtitle="Dark theme for the interface"
        right={
          <Switch
            value={isDark}
            onValueChange={setDarkModeTheme}
            trackColor={{ true: themeColors.accent }}
          />
        }
      />

      {/* ─── Data ──── */}
      <Text style={[styles.sectionLabel, { color: themeColors.muted }]}>Data</Text>
      <SettingRow
        icon="upload"
        label="Import Plan"
        subtitle="Import a CSV training plan"
        onPress={() => router.push('/import/pick')}
      />
      <SettingRow
        icon="download"
        label="Export Data"
        subtitle="Download your data as JSON"
        onPress={handleExportData}
      />
      <SettingRow
        icon="cloud"
        label="Cloud Sync"
        subtitle={
          isSyncing
            ? `Syncing${pendingCount > 0 ? ` (${pendingCount} pending)` : ' — connected'}`
            : isAuthenticated
            ? 'Authenticated, sync starting...'
            : 'Not signed in'
        }
        onPress={() =>
          Alert.alert(
            'Cloud Sync',
            isAuthenticated
              ? `Signed in anonymously.\nUID: ${uid}\n\nSync is ${isSyncing ? 'active' : 'inactive'}.\n\nTo use FlowState on another device, share your UID and import data manually via Export, or sign in with the same account on both devices.`
              : 'Firebase could not connect. Sync is disabled.\n\nCheck your network connection and restart the app.',
          )
        }
      />
      <SettingRow
        icon="link"
        label="Link Account"
        subtitle={
          linkedProvider
            ? `Linked to ${linkedProvider}`
            : isAuthenticated
            ? 'Link a Google account for cross-device sync'
            : 'Sign in first'
        }
        onPress={handleLinkGoogle}
        right={isLinking ? <ActivityIndicator size="small" color={themeColors.accent} /> : undefined}
      />

      {/* ─── Modules ──── */}
      <Text style={[styles.sectionLabel, { color: themeColors.muted }]}>Modules</Text>
      <SettingRow
        icon="grid"
        label="Manage Modules"
        subtitle="View, archive, and reorder modules"
        onPress={() => router.push('/modules')}
      />
      <SettingRow
        icon="list"
        label="Manage Routines"
        subtitle="Create and edit timed routines"
        onPress={() => router.push('/routines')}
      />

      {/* ─── Power User ──── */}
      <Text style={[styles.sectionLabel, { color: themeColors.muted }]}>Advanced</Text>
      <SettingRow
        icon="zap"
        label="Keep Screen Awake"
        subtitle="Prevent sleep during active sessions"
        right={
          <Switch
            value={keepAwakeEnabled}
            onValueChange={toggleSetting('setting_keep_awake', setKeepAwakeEnabled)}
            trackColor={{ true: themeColors.accent }}
          />
        }
      />
      <SettingRow
        icon="alert-triangle"
        label="Confirm Before Delete"
        subtitle="Show confirmation dialog on destructive actions"
        right={
          <Switch
            value={confirmOnDelete}
            onValueChange={toggleSetting('setting_confirm_delete', setConfirmOnDelete)}
            trackColor={{ true: themeColors.accent }}
          />
        }
      />
      <SettingRow
        icon="play-circle"
        label="Auto-Start Sessions"
        subtitle="Begin timer immediately when opening a session"
        right={
          <Switch
            value={autoStartSessions}
            onValueChange={toggleSetting('setting_auto_start', setAutoStartSessions)}
            trackColor={{ true: themeColors.accent }}
          />
        }
      />
      <SettingRow
        icon="minimize-2"
        label="Compact Module Cards"
        subtitle="Use smaller cards on homescreen"
        right={
          <Switch
            value={compactCards}
            onValueChange={toggleSetting('setting_compact_cards', setCompactCards)}
            trackColor={{ true: themeColors.accent }}
          />
        }
      />

      {/* ─── About ──── */}
      <Text style={[styles.sectionLabel, { color: themeColors.muted }]}>About</Text>
      <SettingRow
        icon="info"
        label="Version"
        subtitle="1.0.0 (tap 5x for dev tools)"
        onPress={handleVersionTap}
      />
      <SettingRow
        icon="github"
        label="Open Source"
        subtitle="FlowState is open source"
      />
      <SettingRow
        icon="database"
        label="Storage"
        subtitle={`SQLite • Platform: ${Platform.OS}`}
      />
      <SettingRow
        icon="cpu"
        label="App Info"
        subtitle={`Schema v4 • ${isAuthenticated ? 'Synced' : 'Local only'}`}
      />

      {/* ─── Developer Panel ──── */}
      {showDevPanel && (
        <>
          <Text style={[styles.sectionLabel, { color: '#F59E0B' }]}>🔧 Developer Tools</Text>

          {/* DB Stats */}
          <Pressable style={[styles.devBtn, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]} onPress={loadDbStats}>
            <Feather name="bar-chart-2" size={18} color={themeColors.accent} />
            <Text style={[styles.devBtnText, { color: themeColors.text }]}>Load Database Stats</Text>
          </Pressable>
          {dbStats && (
            <View style={[styles.devResult, { backgroundColor: themeColors.surface, borderLeftColor: themeColors.accent }]}>
              {Object.entries(dbStats).map(([k, v]) => (
                <View key={k} style={styles.devStatRow}>
                  <Text style={[styles.devStatLabel, { color: themeColors.textSecondary }]}>{k}</Text>
                  <Text style={[styles.devStatValue, { color: themeColors.text }, v < 0 && { color: themeColors.danger }]}>
                    {v < 0 ? 'error' : v}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* DB Test */}
          <Pressable style={[styles.devBtn, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]} onPress={testDbReadWrite}>
            <Feather name="check-circle" size={18} color={themeColors.accent} />
            <Text style={[styles.devBtnText, { color: themeColors.text }]}>Test DB Read/Write</Text>
          </Pressable>
          {dbTestResult && (
            <View style={[styles.devResult, { backgroundColor: themeColors.surface, borderLeftColor: themeColors.accent }]}>
              <Text style={[styles.devResultText, { color: themeColors.textSecondary }]}>{dbTestResult}</Text>
            </View>
          )}

          {/* Raw SQL */}
          <View style={styles.devSection}>
            <Text style={[styles.devSectionTitle, { color: themeColors.textSecondary }]}>Raw SQL Query</Text>
            <TextInput
              style={[styles.devInput, { height: 80, textAlignVertical: 'top', backgroundColor: themeColors.surface, borderColor: themeColors.border, color: themeColors.text }]}
              placeholder="SELECT * FROM module_specs LIMIT 5"
              placeholderTextColor={themeColors.muted}
              value={rawSql}
              onChangeText={setRawSql}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable style={[styles.devBtn, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]} onPress={runRawSql}>
              <Feather name="terminal" size={18} color={themeColors.accent} />
              <Text style={[styles.devBtnText, { color: themeColors.text }]}>Execute</Text>
            </Pressable>
            {rawSqlResult && (
              <View style={[styles.devResult, { backgroundColor: themeColors.surface, borderLeftColor: themeColors.accent }]}>
                <ScrollView horizontal style={{ maxHeight: 200 }}>
                  <Text style={[styles.devResultText, { color: themeColors.textSecondary, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 }]}>
                    {rawSqlResult}
                  </Text>
                </ScrollView>
              </View>
            )}
          </View>

          {/* Sync Info */}
          <View style={styles.devSection}>
            <Text style={[styles.devSectionTitle, { color: themeColors.textSecondary }]}>Sync Status</Text>
            <View style={[styles.devResult, { backgroundColor: themeColors.surface, borderLeftColor: themeColors.accent }]}>
              <Text style={[styles.devResultText, { color: themeColors.textSecondary }]}>
                {`Auth: ${isAuthenticated ? '✅' : '❌'}\nUID: ${uid ?? 'none'}\nSyncing: ${isSyncing ? '✅' : '❌'}\nPending: ${pendingCount}`}
              </Text>
            </View>
          </View>

          {/* Copy UID */}
          {uid && (
            <Pressable
              style={[styles.devBtn, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}
              onPress={async () => {
                try { await Clipboard.setStringAsync(uid); } catch {}
                Alert.alert('Copied', 'UID copied to clipboard.');
              }}
            >
              <Feather name="copy" size={18} color={themeColors.accent} />
              <Text style={[styles.devBtnText, { color: themeColors.text }]}>Copy UID to Clipboard</Text>
            </Pressable>
          )}

          {/* Force clear AsyncStorage */}
          <Pressable
            style={[styles.devBtn, { borderColor: themeColors.danger, backgroundColor: themeColors.surface }]}
            onPress={() =>
              Alert.alert('Clear AsyncStorage?', 'This resets all preferences.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Clear',
                  style: 'destructive',
                  onPress: async () => {
                    await AsyncStorage.clear();
                    Alert.alert('Done', 'AsyncStorage cleared. Restart the app.');
                  },
                },
              ])
            }
          >
            <Feather name="trash" size={18} color={themeColors.danger} />
            <Text style={[styles.devBtnText, { color: themeColors.danger }]}>Clear AsyncStorage</Text>
          </Pressable>

          {/* Reset schema */}
          <Pressable
            style={[styles.devBtn, { borderColor: themeColors.danger, backgroundColor: themeColors.surface }]}
            onPress={() =>
              Alert.alert('Re-run Migrations?', 'This will attempt to re-apply CREATE IF NOT EXISTS and version migrations.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Run',
                  onPress: async () => {
                    try {
                      const g = globalThis as any;
                      const sqliteDb = g.__flowstate_sqliteDb;
                      if (sqliteDb) {
                        sqliteDb.execSync('PRAGMA user_version = 0');
                        Alert.alert('Done', 'Schema version reset to 0. Restart the app to re-run migrations.');
                      }
                    } catch (e) {
                      Alert.alert('Error', String(e));
                    }
                  },
                },
              ])
            }
          >
            <Feather name="refresh-cw" size={18} color={themeColors.danger} />
            <Text style={[styles.devBtnText, { color: themeColors.danger }]}>Reset Schema Version</Text>
          </Pressable>

          {/* Close dev panel */}
          <Pressable
            style={[styles.devBtn, { marginTop: spacing.md, backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}
            onPress={() => setShowDevPanel(false)}
          >
            <Feather name="eye-off" size={18} color={themeColors.muted} />
            <Text style={[styles.devBtnText, { color: themeColors.muted }]}>Hide Developer Tools</Text>
          </Pressable>
        </>
      )}

      {/* ─── Danger ──── */}
      <Text style={[styles.sectionLabel, { color: themeColors.danger }]}>Danger Zone</Text>
      <Pressable style={[styles.dangerRow, { borderColor: themeColors.danger }]} onPress={handleDeleteData}>
        <Feather name="trash-2" size={20} color={themeColors.danger} />
        <Text style={[styles.dangerText, { color: themeColors.danger }]}>Delete All Data</Text>
      </Pressable>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  rowInfo: {
    flex: 1,
  },
  rowLabel: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  rowSubtitle: {
    fontSize: fontSize.sm,
    marginTop: 2,
  },
  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  dangerText: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  // ─── Dev Panel ───
  devBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  devBtnText: {
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  devResult: {
    borderRadius: borderRadius.sm,
    padding: spacing.sm,
    marginBottom: spacing.sm,
    borderLeftWidth: 3,
  },
  devResultText: {
    fontSize: fontSize.sm,
  },
  devStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  devStatLabel: {
    fontSize: fontSize.sm,
  },
  devStatValue: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  devSection: {
    marginBottom: spacing.sm,
  },
  devSectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  devInput: {
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    padding: spacing.sm,
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
  },
});
