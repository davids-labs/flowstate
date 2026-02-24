import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { timing } from '../../constants/theme';
import { useTheme } from '../../constants/ThemeContext';

interface UndoToastProps {
  message: string;
  visible: boolean;
  /** Called when the user taps Undo */
  onUndo: () => void;
  /** Called when the toast expires without undo */
  onDismiss: () => void;
  /** Duration in ms before auto-dismiss (default 3000) */
  duration?: number;
}

export default function UndoToast({
  message,
  visible,
  onUndo,
  onDismiss,
  duration = 3000,
}: UndoToastProps) {
  const { themeColors } = useTheme();
  const translateY = useRef(new Animated.Value(100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: timing.fast,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: timing.fast,
          useNativeDriver: true,
        }),
      ]).start();

      timerRef.current = setTimeout(() => {
        dismiss(false);
      }, duration);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [visible]);

  const dismiss = (undone: boolean) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: 100,
        duration: timing.fast,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: timing.fast,
        useNativeDriver: true,
      }),
    ]).start(() => {
      if (undone) onUndo();
      else onDismiss();
    });
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateY }], opacity }]}
      pointerEvents="box-none"
    >
      <View style={[styles.toast, { backgroundColor: themeColors.ink }]}>
        <Text style={styles.message}>{message}</Text>
        <TouchableOpacity onPress={() => dismiss(true)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={[styles.undoBtn, { color: themeColors.accentLight }]}>Undo</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 40,
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  message: {
    flex: 1,
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  undoBtn: {
    fontSize: 14,
    fontWeight: '700',
  },
});
