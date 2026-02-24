import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { DatabaseProvider } from "../components/DatabaseProvider";
import { SyncProvider } from "../components/SyncProvider";
import { ErrorBoundary } from "../components/ErrorBoundary";
import { ThemeProvider, useTheme } from "../constants/ThemeContext";
import { scheduleDailyReminders } from "../services/notifications";
import { initializeTimerStore } from "../stores/timerStore";

export default function RootLayout() {
  // Schedule daily reminder notifications and restore timer state on app startup
  useEffect(() => {
    scheduleDailyReminders().catch(() => {});
    initializeTimerStore();
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <DatabaseProvider>
          <SyncProvider>
            <ThemedStack />
          </SyncProvider>
        </DatabaseProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

function ThemedStack() {
  const { isDark, themeColors } = useTheme();

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: themeColors.background },
          headerTintColor: themeColors.accent,
          headerTitleStyle: { color: themeColors.text, fontWeight: "600" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: themeColors.background },
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
        <Stack.Screen name="modules/index" options={{ title: "Modules" }} />
        <Stack.Screen name="modules/create" options={{ title: "New Module" }} />
        <Stack.Screen name="modules/[id]" options={{ title: "Module Detail" }} />
        <Stack.Screen name="modules/edit" options={{ title: "Edit Module" }} />
        <Stack.Screen name="modules/schedules" options={{ title: "Schedules" }} />
        <Stack.Screen name="modules/reminders" options={{ title: "Reminders" }} />
        <Stack.Screen name="routines/index" options={{ title: "Routines" }} />
        <Stack.Screen name="routines/create" options={{ title: "New Routine" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
        <Stack.Screen name="routines/[id]" options={{ title: "Edit Routine" }} />
        <Stack.Screen name="routine-launcher/[id]" options={{ title: "Routine", headerShown: false }} />
        <Stack.Screen name="layout-editor" options={{ title: "Edit Layout" }} />
        <Stack.Screen name="statistics/index" options={{ title: "Statistics" }} />
        <Stack.Screen name="gallery/index" options={{ title: "Gallery" }} />
        <Stack.Screen name="backup/index" options={{ title: "Backup & Restore" }} />
      </Stack>
    </>
  );
}
