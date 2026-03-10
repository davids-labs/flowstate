import { View } from "react-native";
import { useCallback, useState } from "react";
import { Tabs, useFocusEffect } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../constants/ThemeContext";
import { NowBar } from "../../components/shared/NowBar";
import { useDatabaseSafe } from "../../components/DatabaseProvider";
import { useDayStore } from "../../stores/dayStore";

export default function TabLayout() {
  const { themeColors } = useTheme();
  const { db, isReady } = useDatabaseSafe();
  const [rolledCount, setRolledCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!db || !isReady) return;
      let mounted = true;
      (async () => {
        try {
          const before = useDayStore.getState().dayPlan?.mustDo?.length ?? 0;
          await useDayStore.getState().rolloverMustDos(db);
          // Reload today's plan into the store so counts update
          await useDayStore.getState().loadDay(db, new Date().toISOString().slice(0, 10));
          const after = useDayStore.getState().dayPlan?.mustDo?.length ?? 0;
          if (mounted) setRolledCount(Math.max(0, after - before));
        } catch (e) {
          // ignore
        }
      })();
      return () => { mounted = false; };
    }, [db, isReady])
  );

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: themeColors.accent,
        tabBarInactiveTintColor: themeColors.muted,
        tabBarStyle: {
          backgroundColor: themeColors.background,
          borderTopColor: themeColors.surfaceBorder,
        },
        headerStyle: {
          backgroundColor: themeColors.background,
        },
        headerTintColor: themeColors.text,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Feather name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => (
            <Feather name="calendar" size={size} color={color} />
          ),
          tabBarBadge: rolledCount > 0 ? rolledCount : undefined,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: "Plan",
          tabBarIcon: ({ color, size }) => (
            <Feather name="list" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
    <NowBar />
    </View>
  );
}
