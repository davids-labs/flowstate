import { View, Pressable, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { useCallback } from "react";
import { Tabs, useFocusEffect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../../constants/ThemeContext";
import { useDatabaseSafe } from "../../components/DatabaseProvider";
import { useDayStore } from "../../stores/dayStore";
import { useTimerStore } from "../../stores/timerStore";
import { useUserPrefsStore, type Pillar } from "../../stores/userPrefsStore";
import { AppText } from "../../components/primitives/Text";

export default function TabLayout() {
  const { themeTokens, isDark } = useTheme();
  const { db, isReady } = useDatabaseSafe();
  const showTabLabels = useUserPrefsStore((state) => state.showTabLabels);

  useFocusEffect(
    useCallback(() => {
      if (!db || !isReady) return;
      (async () => {
        try {
          await useDayStore.getState().rolloverMustDos(db);
          await useDayStore.getState().loadDay(db, new Date().toISOString().slice(0, 10));
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
        headerRight: () => <MoreButton />,
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
        name="gym"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="school"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="progress"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="life"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="todos"
        options={{
          title: "Tasks",
          tabBarIcon: ({ color, size }) => (
            <Feather name="check-square" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />
      {/* Legacy screens — kept as routes but hidden from tab bar */}
      <Tabs.Screen name="today" options={{ href: null }} />
    </Tabs>
    <FloatingTimerPill />
    </View>
  );
}

function MoreButton() {
  const router = useRouter();
  const { themeTokens } = useTheme();

  return (
    <Pressable
      onPress={() => router.push('/more')}
      hitSlop={10}
      style={{ paddingHorizontal: 4, paddingVertical: 4 }}
    >
      <Feather name="more-horizontal" size={20} color={themeTokens.textPrimary} />
    </Pressable>
  );
}

// ─── Floating active-block pill ────────────────────────────────────────────────
// Mirrors the web prototype's minimised floating widget.
// Persists across all tab screens. Tapping navigates to the active session.
// Hidden automatically when the user navigates to the session screen
// (which lives outside the tab layout at /session/[id]).
// ──────────────────────────────────────────────────────────────────────────────
function FloatingTimerPill() {
  const { themeTokens } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const getPillarColour   = useUserPrefsStore(s => s.getPillarColour);
  const showFloatingPill  = useUserPrefsStore(s => s.showFloatingPill);
  const pillAlignment     = useUserPrefsStore(s => s.pillAlignment);

  const phase         = useTimerStore(s => s.phase);
  const sessionId     = useTimerStore(s => s.sessionId);
  const routineName   = useTimerStore(s => s.routineName);
  const blockName     = useTimerStore(s => s.currentBlockName);
  const blockIndex    = useTimerStore(s => s.blockIndex);
  const totalBlocks   = useTimerStore(s => s.totalBlocks);
  const pillar        = useTimerStore(s => s.pillar);

  const isActive = phase === 'running' || phase === 'overdue' || phase === 'paused' || phase === 'pending_condition';
  if (!isActive || !sessionId || !showFloatingPill) return null;

  const pillColor = getPillarColour(pillar as Pillar);
  const label = blockName || routineName;
  const blockMeta = totalBlocks > 0 ? `${blockIndex + 1}/${totalBlocks}` : '';
  const side = pillAlignment === 'left' ? { left: 20, right: undefined } : { right: 20, left: undefined };

  return (
    <Pressable
      style={[pill.container, { backgroundColor: pillColor, bottom: insets.bottom + 52, ...side }]}
      onPress={() => router.push(`/session/${sessionId}` as any)}
    >
      <AppText variant="footnote" onAccent style={pill.label} numberOfLines={1}>{label}</AppText>
      {blockMeta ? <AppText variant="caption2" color="rgba(255,255,255,0.75)" style={pill.meta}>· {blockMeta}</AppText> : null}
      <View style={pill.dot} />
    </Pressable>
  );
}

const pill = StyleSheet.create({
  container: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    maxWidth: 220,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  label: {
    fontWeight: '600',
    flexShrink: 1,
  },
  meta: {
    fontWeight: '500',
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.85)',
    marginLeft: 2,
  },
});
