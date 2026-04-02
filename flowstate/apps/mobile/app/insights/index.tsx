import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppText } from '../../components/primitives/Text';
import { useTheme } from '../../constants/ThemeContext';
import { radius, space } from '../../constants/theme';

const DESTINATIONS = [
  {
    title: 'Planner Insights',
    description: 'Open the main analytics screen for trackers and day-by-day trends.',
    href: '/statistics',
    icon: 'bar-chart-2',
  },
  {
    title: 'Gym Legacy Stats',
    description: 'Keep the existing gym-focused analytics reachable during the reset.',
    href: '/stats/gym',
    icon: 'activity',
  },
  {
    title: 'Academic Legacy Stats',
    description: 'Keep the existing study and grades analytics reachable during the reset.',
    href: '/stats/academic',
    icon: 'book-open',
  },
  {
    title: 'Life Legacy Stats',
    description: 'Keep the existing life analytics reachable during the reset.',
    href: '/stats/life',
    icon: 'heart',
  },
] as const;

export default function InsightsScreen() {
  const router = useRouter();
  const { themeTokens } = useTheme();

  return (
    <ScreenWrapper>
      <View style={styles.hero}>
        <AppText variant="title1" style={{ fontWeight: '700' }}>
          Insights
        </AppText>
        <AppText variant="subheadline" color={themeTokens.textSecondary}>
          Analytics stay strong, but they no longer compete with the planner for attention.
        </AppText>
      </View>

      <View style={styles.list}>
        {DESTINATIONS.map((item) => (
          <Pressable
            key={item.title}
            style={[styles.card, { backgroundColor: themeTokens.surfaceElevated, borderColor: themeTokens.border }]}
            onPress={() => router.push(item.href as any)}
          >
            <View style={[styles.iconWrap, { backgroundColor: themeTokens.accentTint }]}>
              <Feather name={item.icon} size={18} color={themeTokens.accent} />
            </View>
            <View style={styles.copy}>
              <AppText variant="headline" style={{ fontWeight: '700' }}>
                {item.title}
              </AppText>
              <AppText variant="footnote" color={themeTokens.textSecondary}>
                {item.description}
              </AppText>
            </View>
            <Feather name="chevron-right" size={16} color={themeTokens.textTertiary} />
          </Pressable>
        ))}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  hero: {
    gap: space[8],
    marginBottom: space[20],
  },
  list: {
    gap: space[12],
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.xl,
    paddingHorizontal: space[16],
    paddingVertical: space[16],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[12],
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: space[4],
  },
});
