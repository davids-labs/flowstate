/**
 * Settings Screen — V2 spec §8 (Part 8)
 *
 * Profile card at top (avatar 64pt, display name title2, session count + join date).
 * Grouped list sections (System grouped table aesthetic, no custom shadows):
 *   • Appearance  – Theme / planner layout / advanced colours
 *   • Notifications – planner reminders / session focus settings
 *   • Data        – Imported Plans / Export / Backup / Cloud sync
 *   • About       – Version / Updates / App info
 *
 * Danger Zone: Delete All Data
 * Hidden Dev Panel: 5× version tap
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Pressable,
  Switch,
  StyleSheet,
  Alert,
  Platform,
  Share,
  TextInput,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { space, radius } from '../constants/theme';
import { useTheme } from '../constants/ThemeContext';
import { AppText } from '../components/primitives/Text';
import { syncReminderPreference } from '../services/notifications';
import { useDatabaseSafe } from '../components/DatabaseProvider';
import {
  getModuleSpecs, getActivePlan, getDayPlansInRange, getRoutines, getRoutineBlocks,
  routines, routineBlocks, plans, dayPlans, moduleSpecs, moduleValues, sessions, eventLog, homescreenLayout,
} from '@flowstate/core';
import { sql } from 'drizzle-orm';
import { useSyncContext } from '../components/SyncProvider';

// ─── Profile card sub-component ───────────────────────────────────────────────
function ProfileCard({ sessionCount }: { sessionCount: number }) {
  const { themeTokens } = useTheme();
  return (
    <View style={[PC.card, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
      <View style={[PC.avatar, { backgroundColor: themeTokens.accentTint }]}>
        <AppText variant="title2" style={{ fontWeight: '700', color: themeTokens.accent }}>F</AppText>
      </View>
      <View style={PC.info}>
        <AppText variant="title2" style={{ fontWeight: '700' }}>FlowState User</AppText>
        <AppText variant="footnote" color={themeTokens.textSecondary}>
          {sessionCount} session{sessionCount !== 1 ? 's' : ''} completed
        </AppText>
      </View>
      <Feather name="edit-2" size={18} color={themeTokens.textTertiary} />
    </View>
  );
}
const PC = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: space[16], padding: space[16], borderRadius: radius.lg, borderWidth: 1, marginHorizontal: space[16], marginBottom: space[8] },
  avatar: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  info: { flex: 1, gap: space[2] },
});

// ─── Setting row ──────────────────────────────────────────────────────────────
interface SRowProps {
  icon: string;
  label: string;
  subtitle?: string;
  onPress?: () => void;
  right?: React.ReactNode;
  dot?: 'accent' | 'success' | 'warning' | 'destructive';
  destructive?: boolean;
}
function SRow({ icon, label, subtitle, onPress, right, dot, destructive }: SRowProps) {
  const { themeTokens } = useTheme();
  const dotColor = dot === 'success' ? themeTokens.success : dot === 'warning' ? themeTokens.warning : dot === 'destructive' ? themeTokens.destructive : themeTokens.accent;
  const labelColor = destructive ? themeTokens.destructive : themeTokens.textPrimary;
  return (
    <Pressable
      style={[SR.row, { backgroundColor: themeTokens.surfaceElevated }]}
      onPress={onPress}
      disabled={!onPress && !right}
    >
      <View>
        <View style={[SR.iconWrap, { backgroundColor: destructive ? themeTokens.destructive + '18' : themeTokens.accentTint }]}>
          <Feather name={icon as any} size={20} color={destructive ? themeTokens.destructive : themeTokens.accent} />
        </View>
        {dot && <View style={[SR.dot, { backgroundColor: dotColor, borderColor: themeTokens.surfaceElevated }]} />}
      </View>
      <View style={SR.info}>
        <AppText variant="headline" style={{ fontWeight: '400', color: labelColor }}>{label}</AppText>
        {subtitle && <AppText variant="footnote" color={themeTokens.textTertiary}>{subtitle}</AppText>}
      </View>
      {right ?? (onPress ? <Feather name="chevron-right" size={18} color={themeTokens.textTertiary} /> : null)}
    </Pressable>
  );
}
const SR = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space[16], paddingVertical: space[12], gap: space[12] },
  iconWrap: { width: 36, height: 36, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: -3, right: -3, width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  info: { flex: 1 },
});

// ─── Section group ────────────────────────────────────────────────────────────
function SGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const { themeTokens } = useTheme();
  return (
    <View style={{ marginBottom: space[20] }}>
      <AppText variant="caption1" color={themeTokens.textTertiary} style={SG.label}>{title.toUpperCase()}</AppText>
      <View style={[SG.card, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}>
        {children}
      </View>
    </View>
  );
}
const SG = StyleSheet.create({
  label: { marginHorizontal: space[16], marginBottom: space[8], letterSpacing: 0.5 },
  card: { borderRadius: radius.lg, borderWidth: 1, overflow: 'hidden' },
});

// ─── Separator ────────────────────────────────────────────────────────────────
function Sep() {
  const { themeTokens } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: themeTokens.border, marginLeft: 68 }} />;
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function SettingsScreen() {
  const router = useRouter();
  const { db, isReady } = useDatabaseSafe();
  const { themeTokens, isDark, toggleDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, isSyncing, uid, pendingCount } = useSyncContext();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [hapticsEnabled, setHapticsEnabled] = useState(true);
  const [keepAwakeEnabled, setKeepAwakeEnabled] = useState(true);
  const [confirmOnDelete, setConfirmOnDelete] = useState(true);
  const [autoStartSessions, setAutoStartSessions] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const [devTapCount, setDevTapCount] = useState(0);
  const [dbStats, setDbStats] = useState<Record<string, number> | null>(null);
  const [dbTestResult, setDbTestResult] = useState<string | null>(null);
  const [rawSql, setRawSql] = useState('');
  const [rawSqlResult, setRawSqlResult] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [linkedProvider, setLinkedProvider] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const [notif, haptic, ka, cod, ass] = await Promise.all([
          AsyncStorage.getItem('setting_notifications'),
          AsyncStorage.getItem('setting_haptics'),
          AsyncStorage.getItem('setting_keep_awake'),
          AsyncStorage.getItem('setting_confirm_delete'),
          AsyncStorage.getItem('setting_auto_start'),
        ]);
        if (notif !== null) setNotificationsEnabled(notif === 'true');
        if (haptic !== null) setHapticsEnabled(haptic === 'true');
        if (ka !== null) setKeepAwakeEnabled(ka === 'true');
        if (cod !== null) setConfirmOnDelete(cod === 'true');
        if (ass !== null) setAutoStartSessions(ass === 'true');
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!db || !isReady) return;
    db.select().from(sessions).then((rows: any[]) => setSessionCount(rows.length)).catch(() => {});
  }, [db, isReady]);

  const toggleSetting = (key: string, setter: (v: boolean) => void) => (v: boolean) => {
    setter(v);
    AsyncStorage.setItem(key, String(v)).catch(() => {});
  };

  const handleExportData = async () => {
    if (!db) { Alert.alert('Error', 'Database not ready.'); return; }
    try {
      const specs = await getModuleSpecs(db);
      const plan = await getActivePlan(db);
      const allDays = await getDayPlansInRange(db, '2000-01-01', '2099-12-31');
      const allRoutines = await getRoutines(db);
      const allRoutineBlocks: any[] = [];
      for (const r of allRoutines) { const blocks = await getRoutineBlocks(db, r.id); allRoutineBlocks.push(...blocks); }
      const allModuleValues = await db.select().from(moduleValues);
      const allSessions = await db.select().from(sessions);
      const allEvents = await db.select().from(eventLog);
      const exportData = { exportedAt: new Date().toISOString(), plan, dayPlans: allDays, moduleSpecs: specs, routines: allRoutines, routineBlocks: allRoutineBlocks, moduleValues: allModuleValues, sessions: allSessions, eventLog: allEvents };
      await Share.share({ message: JSON.stringify(exportData, null, 2), title: 'FlowState Export' });
    } catch (e) { Alert.alert('Export Failed', e instanceof Error ? e.message : 'Unknown error'); }
  };

  const handleDeleteData = () => {
    Alert.alert('Delete All Data', 'This will permanently delete all your plans, modules, and session data. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete Everything', style: 'destructive', onPress: async () => {
        if (!db) { Alert.alert('Error', 'Database is not ready.'); return; }
        try {
          await db.delete(eventLog); await db.delete(moduleValues); await db.delete(sessions);
          await db.delete(dayPlans); await db.delete(routineBlocks); await db.delete(routines);
          await db.delete(moduleSpecs); await db.delete(homescreenLayout); await db.delete(plans);
          Alert.alert('Done', 'All data deleted. Restart the app.');
        } catch (e) { Alert.alert('Error', 'Failed to delete. ' + (e instanceof Error ? e.message : '')); }
      }},
    ]);
  };

  const handleVersionTap = () => {
    const next = devTapCount + 1;
    setDevTapCount(next);
    if (next >= 5) { setShowDevPanel(true); setDevTapCount(0); }
  };

  const loadDbStats = useCallback(async () => {
    if (!db) return;
    const tables = ['routines', 'routine_blocks', 'plans', 'day_plans', 'module_specs', 'module_values', 'sessions', 'event_log'];
    const stats: Record<string, number> = {};
    for (const t of tables) {
      try { const g = globalThis as any; const sqliteDb = g.__flowstate_sqliteDb; const rows = sqliteDb?.getAllSync(`SELECT COUNT(*) as c FROM ${t}`); stats[t] = rows?.[0]?.c ?? -1; } catch { stats[t] = -1; }
    }
    setDbStats(stats);
  }, [db]);

  const testDatabaseOperations = useCallback(async () => {
    if (!db) return;
    try {
      const start = Date.now();
      const testId = `__test_${Date.now()}`;
      await db.insert(moduleSpecs).values({ id: testId, type: 'checkbox', label: '__test__', config: '{}', placements: '[]', isLive: false, required: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      const rows = await db.select().from(moduleSpecs).where(sql`${moduleSpecs.id} = ${testId}`);
      await db.delete(moduleSpecs).where(sql`${moduleSpecs.id} = ${testId}`);
      setDbTestResult(`✅ OK — write/read/delete in ${Date.now() - start}ms (${rows.length} row)`);
    } catch (e) { setDbTestResult(`❌ ${e instanceof Error ? e.message : String(e)}`); }
  }, [db]);

  const runRawSql = useCallback(async () => {
    if (!db || !rawSql.trim()) return;
    try {
      const g = globalThis as any;
      if (!g.__flowstate_sqliteDb) { setRawSqlResult('❌ No raw SQLite handle'); return; }
      const result = g.__flowstate_sqliteDb.getAllSync(rawSql.trim());
      setRawSqlResult(JSON.stringify(result, null, 2).slice(0, 2000));
    } catch (e) { setRawSqlResult(`❌ ${e instanceof Error ? e.message : String(e)}`); }
  }, [db, rawSql]);

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: themeTokens.background, justifyContent: 'center', alignItems: 'center', gap: space[12] }}>
        <ActivityIndicator size="large" color={themeTokens.accent} />
        <AppText variant="footnote" color={themeTokens.textTertiary}>Loading settings…</AppText>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: themeTokens.background }}
      contentContainerStyle={{ paddingTop: insets.top + space[16], paddingBottom: insets.bottom + 80, paddingHorizontal: 0 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Title ── */}
      <View style={{ paddingHorizontal: space[16], paddingBottom: space[16] }}>
        <AppText variant="title1" style={{ fontWeight: '700' }}>Settings</AppText>
      </View>

      {/* ── Profile card ── */}
      <ProfileCard sessionCount={sessionCount} />

      <View style={{ height: space[16] }} />

      {/* ── Appearance ── */}
      <SGroup title="Appearance">
        <SRow icon="moon" label="Dark Mode" right={<Switch value={isDark} onValueChange={toggleDarkMode} trackColor={{ true: themeTokens.accent }} />} />
        <Sep />
        <SRow icon="smartphone" label="Haptic Feedback" subtitle="Vibration on actions" right={<Switch value={hapticsEnabled} onValueChange={toggleSetting('setting_haptics', setHapticsEnabled)} trackColor={{ true: themeTokens.accent }} />} />
        <Sep />
        <SRow icon="sliders" label="Today Layout" subtitle="Adjust spacing and density" onPress={() => router.push('/settings/layout')} />
        <Sep />
        <SRow icon="droplet" label="Advanced Colours" subtitle="Legacy colour settings for older surfaces" onPress={() => router.push('/settings/colours')} />
      </SGroup>

      {/* ── Notifications ── */}
      <SGroup title="Notifications">
        <SRow icon="bell" label="Notifications" subtitle="Planner reminders and session alerts" right={<Switch value={notificationsEnabled} onValueChange={v => { setNotificationsEnabled(v); AsyncStorage.setItem('setting_notifications', String(v)).catch(() => {}); syncReminderPreference(v).catch(() => {}); }} trackColor={{ true: themeTokens.accent }} />} />
        <Sep />
        <SRow icon="zap" label="Keep Screen Awake" subtitle="Prevent sleep during sessions" right={<Switch value={keepAwakeEnabled} onValueChange={toggleSetting('setting_keep_awake', setKeepAwakeEnabled)} trackColor={{ true: themeTokens.accent }} />} />
        <Sep />
        <SRow icon="play-circle" label="Auto-Start Sessions" subtitle="Begin timer when opening a session" right={<Switch value={autoStartSessions} onValueChange={toggleSetting('setting_auto_start', setAutoStartSessions)} trackColor={{ true: themeTokens.accent }} />} />
      </SGroup>

      {/* ── Data ── */}
      <SGroup title="Data">
        <SRow icon="upload" label="Import Plan" subtitle="Import a planner CSV" onPress={() => router.push('/import/pick')} />
        <Sep />
        <SRow icon="download" label="Export Data" subtitle="Download your data as JSON" onPress={handleExportData} />
        <Sep />
        <SRow icon="file-text" label="Imported Plans" subtitle="Edit imported plan structure in-app" onPress={() => router.push('/settings/csv-plans')} />
        <Sep />
        <SRow
          icon="cloud"
          label="Cloud Sync"
          subtitle={isSyncing ? `Syncing${pendingCount > 0 ? ` (${pendingCount} pending)` : ''}` : isAuthenticated ? 'Connected' : 'Not signed in'}
          onPress={() => Alert.alert('Cloud Sync', isAuthenticated ? `Signed in.\nUID: ${uid}\nSync ${isSyncing ? 'active' : 'inactive'}` : 'Firebase could not connect. Check network.')}
        />
        <Sep />
        <SRow
          icon="alert-triangle"
          label="Confirm Before Delete"
          right={<Switch value={confirmOnDelete} onValueChange={toggleSetting('setting_confirm_delete', setConfirmOnDelete)} trackColor={{ true: themeTokens.accent }} />}
        />
      </SGroup>

      {/* ── About ── */}
      <SGroup title="About">
        <SRow icon="info" label="Version" subtitle="1.0.0 (tap 5× for dev tools)" onPress={handleVersionTap} />
        <Sep />
        <SRow
          icon="download-cloud"
          label="Check for Updates"
          subtitle="Updates delivered via app store"
        />
        <Sep />
        <SRow icon="database" label="Storage" subtitle={`SQLite · ${Platform.OS}`} />
        <Sep />
        <SRow icon="cpu" label="App Info" subtitle={`Schema v10 · ${isAuthenticated ? 'Synced' : 'Local only'}`} />
      </SGroup>

      {/* ── Dev panel ── */}
      {showDevPanel && (
        <SGroup title="🔧 Developer Tools">
          <Pressable style={[DEV.btn, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]} onPress={loadDbStats}>
            <Feather name="bar-chart-2" size={18} color={themeTokens.accent} />
            <AppText variant="subheadline" color={themeTokens.textPrimary}>Load DB Stats</AppText>
          </Pressable>
          {dbStats && Object.entries(dbStats).map(([k, v]) => (
            <View key={k} style={[DEV.statRow, { borderBottomColor: themeTokens.border }]}>
              <AppText variant="footnote" color={themeTokens.textSecondary}>{k}</AppText>
              <AppText variant="footnote" style={{ fontWeight: '700', color: v < 0 ? themeTokens.destructive : themeTokens.textPrimary }}>{v < 0 ? 'err' : v}</AppText>
            </View>
          ))}
          <Pressable style={[DEV.btn, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]} onPress={testDatabaseOperations}>
            <Feather name="check-circle" size={18} color={themeTokens.accent} />
            <AppText variant="subheadline" color={themeTokens.textPrimary}>Test DB Read/Write</AppText>
          </Pressable>
          {dbTestResult && (
            <View style={{ padding: space[12] }}>
              <AppText variant="footnote" color={themeTokens.textSecondary}>{dbTestResult}</AppText>
            </View>
          )}
          <View style={{ padding: space[12] }}>
            <AppText variant="caption1" color={themeTokens.textTertiary} style={{ marginBottom: space[8] }}>RAW SQL</AppText>
            <TextInput
              style={[DEV.input, { backgroundColor: themeTokens.surface, borderColor: themeTokens.border, color: themeTokens.textPrimary }]}
              placeholder="SELECT * FROM module_specs LIMIT 5"
              placeholderTextColor={themeTokens.textPlaceholder}
              value={rawSql}
              onChangeText={setRawSql}
              multiline
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Pressable style={[DEV.btn, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]} onPress={runRawSql}>
              <Feather name="terminal" size={18} color={themeTokens.accent} />
              <AppText variant="subheadline" color={themeTokens.textPrimary}>Execute</AppText>
            </Pressable>
            {rawSqlResult && (
              <ScrollView horizontal style={{ maxHeight: 180 }}>
                <AppText variant="caption2" color={themeTokens.textSecondary} style={{ fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' }}>{rawSqlResult}</AppText>
              </ScrollView>
            )}
          </View>
          <View style={{ padding: space[12] }}>
            <AppText variant="caption1" color={themeTokens.textTertiary} style={{ marginBottom: space[8] }}>SYNC STATUS</AppText>
            <AppText variant="footnote" color={themeTokens.textSecondary}>
              {['Auth: ' + (isAuthenticated ? '✅' : '❌'), 'UID: ' + (uid ?? 'none'), 'Syncing: ' + (isSyncing ? '✅' : '❌'), 'Pending: ' + pendingCount].join('  |  ')}
            </AppText>
          </View>
          {uid && (
            <Pressable style={[DEV.btn, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]} onPress={async () => { try { await Clipboard.setStringAsync(uid); } catch {} Alert.alert('Copied', 'UID copied.'); }}>
              <Feather name="copy" size={18} color={themeTokens.accent} />
              <AppText variant="subheadline" color={themeTokens.textPrimary}>Copy UID</AppText>
            </Pressable>
          )}
          <Pressable style={[DEV.btn, { borderColor: themeTokens.destructive, backgroundColor: themeTokens.surfaceElevated }]} onPress={() => Alert.alert('Clear AsyncStorage?', 'Resets all preferences.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Clear', style: 'destructive', onPress: async () => { await AsyncStorage.clear(); Alert.alert('Done', 'AsyncStorage cleared.'); } }])}>
            <Feather name="trash" size={18} color={themeTokens.destructive} />
            <AppText variant="subheadline" color={themeTokens.destructive}>Clear AsyncStorage</AppText>
          </Pressable>
          <Pressable style={[DEV.btn, { borderColor: themeTokens.destructive, backgroundColor: themeTokens.surfaceElevated }]} onPress={() => Alert.alert('Re-run Migrations?', 'Re-applies schema migrations.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Run', onPress: async () => { try { const g = globalThis as any; g.__flowstate_sqliteDb?.execSync('PRAGMA user_version = 0'); Alert.alert('Done', 'Schema reset to 0. Restart to re-run.'); } catch (e) { Alert.alert('Error', String(e)); } } }])}>
            <Feather name="refresh-cw" size={18} color={themeTokens.destructive} />
            <AppText variant="subheadline" color={themeTokens.destructive}>Reset Schema Version</AppText>
          </Pressable>
          <Pressable style={[DEV.btn, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]} onPress={() => setShowDevPanel(false)}>
            <Feather name="eye-off" size={18} color={themeTokens.textTertiary} />
            <AppText variant="subheadline" color={themeTokens.textTertiary}>Hide Dev Tools</AppText>
          </Pressable>
        </SGroup>
      )}

      {/* ── Danger zone ── */}
      <View style={{ paddingHorizontal: space[16], marginBottom: space[32] }}>
        <Pressable style={[DZ.btn, { borderColor: themeTokens.destructive }]} onPress={handleDeleteData}>
          <Feather name="trash-2" size={20} color={themeTokens.destructive} />
          <AppText variant="headline" style={{ fontWeight: '600', color: themeTokens.destructive }}>Delete All Data</AppText>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const DEV = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', gap: space[8], borderRadius: radius.md, padding: space[12], marginHorizontal: space[12], marginBottom: space[8], borderWidth: 1 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space[16], paddingVertical: space[4], borderBottomWidth: StyleSheet.hairlineWidth },
  input: { borderRadius: radius.sm, borderWidth: 1, padding: space[8], marginBottom: space[8], height: 80, textAlignVertical: 'top' },
});
const DZ = StyleSheet.create({
  btn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space[8], paddingVertical: space[16], borderRadius: radius.md, borderWidth: 1 },
});
