import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { DatabaseProvider } from "../components/DatabaseProvider";
import { SyncProvider } from "../components/SyncProvider";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ThemeProvider, useTheme } from "../constants/ThemeContext";
import { initializeTimerStore } from "../stores/timerStore";
import { useUserPrefsStore } from "../stores/userPrefsStore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LiveSessionDock } from "../components/shared/LiveSessionDock";
import { useDatabaseSafe } from "../components/DatabaseProvider";
import { refreshAmbientState } from "../services/systemSync";

export default function RootLayout() {
  useEffect(() => {
    // Initialise stores on app startup
    (async () => {
      try {
        await useUserPrefsStore.getState().loadPrefs();
        await migrateLegacySessionSettings();
      } catch {}
    })();
    let cleanup: (() => void) | undefined;
    initializeTimerStore().then((fn) => { cleanup = fn; }).catch(() => {});
    return () => { cleanup?.(); };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ThemeProvider>
          <DatabaseProvider>
            <SyncProvider>
              <ThemedStack />
            </SyncProvider>
          </DatabaseProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

function ThemedStack() {
  const { isDark, themeTokens } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <StatusBar style={isDark ? "light" : "dark" } />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: themeTokens.background },
          headerTintColor: themeTokens.accent,
          headerTitleStyle: { color: themeTokens.textPrimary, fontWeight: '600' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: themeTokens.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="day/[date]" options={{ title: "Day" }} />
        <Stack.Screen name="session/[id]" options={{ title: "Session" }} />
        <Stack.Screen name="session/debrief" options={{ title: "Session Summary", headerBackVisible: false }} />
        <Stack.Screen name="week/[weekId]" options={{ title: "Week" }} />
        <Stack.Screen name="import/pick" options={{ title: "Import Plan" }} />
        <Stack.Screen name="import/preview" options={{ title: "Preview Import" }} />
        <Stack.Screen name="import/success" options={{ title: "Import Complete", headerShown: false }} />
        <Stack.Screen name="trackers/[id]" options={{ title: "Tracker Detail" }} />
        <Stack.Screen name="trackers/edit" options={{ title: "Tracker Editor" }} />
        <Stack.Screen name="modules/index" options={{ title: "Trackers" }} />
        <Stack.Screen name="modules/create" options={{ title: "New Tracker" }} />
        <Stack.Screen name="modules/[id]" options={{ title: "Tracker Detail" }} />
        <Stack.Screen name="modules/edit" options={{ title: "Edit Tracker" }} />
        <Stack.Screen name="modules/schedules" options={{ title: "Schedules" }} />
        <Stack.Screen name="modules/reminders" options={{ title: "Reminders" }} />
        <Stack.Screen name="routines/index" options={{ title: "Session Templates" }} />
        <Stack.Screen name="routines/create" options={{ title: "New Session Template" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="settings/notifications" options={{ title: "Reminders & Automations" }} />
        <Stack.Screen name="settings/widgets" options={{ title: "Widgets" }} />
        <Stack.Screen name="settings/csv-plans" options={{ title: "Imported Plans" }} />
        <Stack.Screen name="routines/[id]" options={{ title: "Edit Session Template" }} />
        <Stack.Screen name="routine-launcher/[id]" options={{ title: "Routine", headerShown: false }} />
        <Stack.Screen name="layout-editor" options={{ title: "Edit Layout" }} />
        <Stack.Screen name="statistics/index" options={{ title: "Insights" }} />
        <Stack.Screen name="insights/index" options={{ title: "Insights" }} />
        <Stack.Screen name="more/index" options={{ title: "Settings" }} />
        <Stack.Screen name="imported-plans/[id]" options={{ title: "Edit Imported Plan" }} />
        <Stack.Screen name="gallery/index" options={{ title: "Gallery" }} />
        <Stack.Screen name="backup/index" options={{ title: "Backup & Restore" }} />
      </Stack>
      <AmbientSyncBridge />
      <LiveSessionDock />
    </View>
  );
}

function AmbientSyncBridge() {
  const { db, isReady } = useDatabaseSafe();

  useEffect(() => {
    if (!db || !isReady) return;
    refreshAmbientState(db).catch(() => {});
  }, [db, isReady]);

  return null;
}

async function migrateLegacySessionSettings() {
  const rawPrefs = await AsyncStorage.getItem("flowstate_user_prefs").catch(() => null);
  const savedPrefs = rawPrefs ? JSON.parse(rawPrefs) : null;
  const store = useUserPrefsStore.getState();
  const [legacyHaptics, legacyKeepAwake, legacyAutoStart, legacyConfirmDelete] =
    await Promise.all([
      AsyncStorage.getItem("setting_haptics").catch(() => null),
      AsyncStorage.getItem("setting_keep_awake").catch(() => null),
      AsyncStorage.getItem("setting_auto_start").catch(() => null),
      AsyncStorage.getItem("setting_confirm_delete").catch(() => null),
    ]);

  if (legacyHaptics != null && savedPrefs?.hapticFeedback === undefined) store.setHapticFeedback(legacyHaptics === "true");
  if (legacyKeepAwake != null && savedPrefs?.keepAwake === undefined) store.setKeepAwake(legacyKeepAwake === "true");
  if (legacyAutoStart != null && savedPrefs?.autoStart === undefined) store.setAutoStart(legacyAutoStart === "true");
  if (legacyConfirmDelete != null && savedPrefs?.confirmBeforeDelete === undefined) store.setConfirmBeforeDelete(legacyConfirmDelete === "true");

  await Promise.all([
    AsyncStorage.removeItem("setting_haptics").catch(() => {}),
    AsyncStorage.removeItem("setting_keep_awake").catch(() => {}),
    AsyncStorage.removeItem("setting_auto_start").catch(() => {}),
    AsyncStorage.removeItem("setting_confirm_delete").catch(() => {}),
  ]);
}
