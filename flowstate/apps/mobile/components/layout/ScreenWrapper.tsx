import React from 'react';
import { ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface ScreenWrapperProps {
  children: React.ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
}

export function ScreenWrapper({ children, scrollable = true, style }: ScreenWrapperProps) {
  const { themeColors } = useTheme();
  const bgStyle = { backgroundColor: themeColors.background };

  if (scrollable) {
    return (
      <SafeAreaView style={[styles.safe, bgStyle]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, style]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, styles.content, bgStyle, style]}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
});
