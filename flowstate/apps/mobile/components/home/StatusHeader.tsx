import React from 'react';
import { View, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { AppText } from '../primitives/Text';
import { useTheme } from '../../constants/ThemeContext';
import { space } from '../../constants/theme';

// ─── StatusHeader ─────────────────────────────────────────────────────────────
// §1.2 Status Header
// Sticky zone at the top of My Day:
//   Left:  date (title1 Bold) + summary string (footnote, text.secondary)
//   Right: notification bell (Feather, accent badge) + avatar circle (32pt)
// Background flushes to screen background — no card, no border.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  summaryText: string;
  notificationCount?: number;
  userInitials?: string;
}

function formatDateHeader(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function StatusHeader({ summaryText, notificationCount = 0, userInitials = '?' }: Props) {
  const { themeTokens } = useTheme();
  const router = useRouter();

  return (
    <View style={[styles.container, { backgroundColor: themeTokens.background }]}>
      {/* Left: date + summary */}
      <View style={styles.left}>
        <AppText variant="title1" style={styles.date}>
          {formatDateHeader()}
        </AppText>
        <AppText
          variant="footnote"
          color={themeTokens.textSecondary}
          numberOfLines={1}
          style={styles.summary}
        >
          {summaryText}
        </AppText>
      </View>

      {/* Right: bell + avatar */}
      <View style={styles.right}>
        {/* Notification bell */}
        <Pressable
          style={styles.iconBtn}
          hitSlop={8}
          onPress={() => {/* TODO: open notifications */}}
        >
          <Feather name="bell" size={24} color={themeTokens.textSecondary} />
          {notificationCount > 0 && (
            <View style={[styles.badge, { backgroundColor: themeTokens.accent }]}>
              <AppText variant="caption2" onAccent style={styles.badgeText}>
                {notificationCount > 9 ? '9+' : String(notificationCount)}
              </AppText>
            </View>
          )}
        </Pressable>

        {/* Avatar */}
        <Pressable
          style={[styles.avatar, { backgroundColor: themeTokens.accent }]}
          onPress={() => router.push('/(tabs)/profile')}
          hitSlop={4}
        >
          <AppText variant="caption1" onAccent style={styles.avatarText}>
            {userInitials.slice(0, 2).toUpperCase()}
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingTop: space[16],
    paddingHorizontal: space[16],
    paddingBottom: space[8],
  },
  left: {
    flex: 1,
    gap: 3,
    paddingRight: space[8],
  },
  date: {
    // title1 variant applied via AppText
  },
  summary: {
    // footnote variant applied via AppText
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
    paddingTop: 3,
  },
  iconBtn: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    lineHeight: 13,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    lineHeight: 14,
  },
});
