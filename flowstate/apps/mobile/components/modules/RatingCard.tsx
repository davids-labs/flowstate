import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { fontSize, spacing, borderRadius } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface RatingCardProps {
  label: string;
  emoji?: string;
  value: number;         // 0–5
  onRate: (v: number) => void;
}

export function RatingCard({ label, emoji, value, onRate }: RatingCardProps) {
  const { themeColors } = useTheme();
  const handleTap = (star: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onRate(star === value ? 0 : star); // tap same star to clear
  };

  return (
    <View style={[styles.card, { backgroundColor: themeColors.surface }]}>
      <Text style={[styles.label, { color: themeColors.text }]}>
        {emoji ? `${emoji}  ` : ''}{label}
      </Text>
      <View style={styles.stars}>
        {[1, 2, 3, 4, 5].map(star => (
          <Pressable key={star} onPress={() => handleTap(star)} hitSlop={4}>
            <Feather
              name="star"
              size={28}
              color={star <= value ? themeColors.warning : themeColors.muted}
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: fontSize.md,
    fontWeight: '500',
    marginBottom: spacing.sm,
  },
  stars: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
});
