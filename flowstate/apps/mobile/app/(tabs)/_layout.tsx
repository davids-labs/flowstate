import { View, Pressable, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { useCallback, useState } from "react";
import { Tabs, useFocusEffect, useRouter } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../constants/ThemeContext";
import { useDatabaseSafe } from "../../components/DatabaseProvider";
import { useDayStore } from "../../stores/dayStore";
import { useUserPrefsStore } from "../../stores/userPrefsStore";
import { getInboxBadgeCount } from "../../services/inbox";

export default function TabLayout() {
  const { themeTokens, isDark } = useTheme();
  const { db, isReady } = useDatabaseSafe();
  const showTabLabels = useUserPrefsStore((state) => state.showTabLabels);
  const [badgeCount, setBadgeCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!db || !isReady) return;
      (async () => {
        try {
          await useDayStore.getState().rolloverMustDos(db);
          await useDayStore.getState().loadDay(db, new Date().toISOString().slice(0, 10));
          setBadgeCount(await getInboxBadgeCount(db));
        } catch (e) {
          // ignore
        }
      })();
    }, [db, isReady])
  );

  return (
    <View style={{ flex: 1, backgroundColor: themeTokens.background }}>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: themeTokens.accent,
        tabBarInactiveTintColor: themeTokens.textSecondary,
        tabBarShowLabel: showTabLabels,
        tabBarBackground: () => (
          <BlurView
            tint={isDark ? 'dark' : 'light'}
            intensity={100}
            style={StyleSheet.absoluteFill}
          />
        ),
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopColor: themeTokens.border,
        },
        headerStyle: {
          backgroundColor: themeTokens.background,
        },
        headerTintColor: themeTokens.textPrimary,
        headerShadowVisible: false,
        headerRight: () => <HeaderActions badgeCount={badgeCount} />,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => <Feather name="sun" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="plan"
        options={{
          title: "Plan",
          tabBarIcon: ({ color, size }) => <Feather name="calendar" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color, size }) => <Feather name="inbox" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="track"
        options={{
          title: "Track",
          tabBarIcon: ({ color, size }) => <Feather name="layers" size={size} color={color} />,
        }}
      />
      <Tabs.Screen name="todos" options={{ href: null }} />
      <Tabs.Screen name="library" options={{ href: null }} />
      <Tabs.Screen name="gym" options={{ href: null }} />
      <Tabs.Screen name="school" options={{ href: null }} />
      <Tabs.Screen name="progress" options={{ href: null }} />
      <Tabs.Screen name="life" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
      {/* Legacy screens — kept as routes but hidden from tab bar */}
      <Tabs.Screen name="today" options={{ href: null }} />
    </Tabs>
    </View>
  );
}

function HeaderActions({ badgeCount }: { badgeCount: number }) {
  const router = useRouter();
  const { themeTokens } = useTheme();

  return (
    <View style={styles.headerActions}>
      <Pressable
        onPress={() => router.push('/inbox')}
        hitSlop={10}
        style={[styles.headerButton, { borderColor: themeTokens.border }]}
      >
        <Feather name="inbox" size={18} color={themeTokens.textPrimary} />
        {badgeCount > 0 ? <View style={[styles.badge, { backgroundColor: themeTokens.accent }]} /> : null}
      </Pressable>
      <Pressable
        onPress={() => router.push('/settings')}
        hitSlop={10}
        style={[styles.headerButton, { borderColor: themeTokens.border }]}
      >
        <Feather name="user" size={18} color={themeTokens.textPrimary} />
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
