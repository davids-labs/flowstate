import React from 'react';
import { ScrollView, StyleSheet, View, ViewStyle, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { space } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface ScreenWrapperProps {
  children: React.ReactNode;
  /** Wrap content in a ScrollView (default: true) */
  scrollable?: boolean;
  /** Remove all padding — for immersive full-bleed screens */
  noPadding?: boolean;
  /** Edges to apply safe area insets to (default: all) */
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  /** Pull-to-refresh callback */
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function ScreenWrapper({
  children,
  scrollable = true,
  noPadding = false,
  edges,
  style,
  contentStyle,
  onRefresh,
  refreshing = false,
}: ScreenWrapperProps) {
  const { themeTokens } = useTheme();
  const bgStyle = { backgroundColor: themeTokens.background };
  const padding = noPadding ? {} : { padding: space[16], paddingBottom: space[48] };

  if (scrollable) {
    return (
      <SafeAreaView style={[styles.safe, bgStyle, style]} edges={edges}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[padding, contentStyle]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh
              ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={themeTokens.accent} />
              : undefined
          }
        >
          {children}
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, bgStyle, style]} edges={edges}>
      <View style={[styles.fill, padding, contentStyle]}>
        {children}
      </View>
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
  fill: {
    flex: 1,
  },
});
