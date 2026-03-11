/**
 * UpdatesProvider — OTA update lifecycle manager for FlowState.
 *
 * Behaviour:
 *  1. On cold launch: checks for a new update 3 seconds after the app renders
 *     (giving the UI time to settle before potentially reloading).
 *  2. On every foreground resume: silently checks for a new update in the
 *     background.  If one is available, it is downloaded.
 *  3. After a successful download: shows a non-blocking banner offering the
 *     user a restart.  The update is already stored; they can restart any
 *     time — it won't be lost.
 *
 * In development / Expo Go: all update calls are guarded by `Updates.isEnabled`
 * so nothing throws.  The banner never appears in dev.
 */

import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState, AppStateStatus, Animated, Easing,
  Pressable, StyleSheet, Text, View,
} from 'react-native';
import * as Updates from 'expo-updates';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../constants/ThemeContext';
import { spacing, fontSize, borderRadius } from '../constants/theme';

// ─── Context ────────────────────────────────────────────────────

interface UpdatesContextValue {
  /** Manually trigger an update check (e.g. from Settings). */
  checkNow: () => Promise<void>;
  /** Immediately apply a downloaded update (reload the app). */
  applyNow: () => Promise<void>;
  isChecking: boolean;
  /** True after a successful download but before the user restarts. */
  updateReady: boolean;
}

const UpdatesContext = createContext<UpdatesContextValue>({
  checkNow: async () => {},
  applyNow: async () => {},
  isChecking: false,
  updateReady: false,
});

export function useAppUpdates() {
  return useContext(UpdatesContext);
}

// ─── Provider ───────────────────────────────────────────────────

type ToastKind = 'downloading' | 'ready' | 'upToDate';

export function UpdatesProvider({ children }: { children: React.ReactNode }) {
  const { themeColors } = useTheme();
  const [isChecking, setIsChecking] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  const [toast, setToast] = useState<ToastKind | null>(null);
  const isMounted = useRef(true);

  // Slide-up animation value shared by both toast and banner
  const slideY = useRef(new Animated.Value(120)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => { isMounted.current = false; };
  }, []);

  // ─── Animation helpers ─────────────────────────────────────────

  const showSlide = useCallback(() => {
    slideY.setValue(120);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(slideY, { toValue: 0, duration: 320, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
  }, [slideY, opacity]);

  const hideSlide = useCallback((cb?: () => void) => {
    Animated.parallel([
      Animated.timing(slideY, { toValue: 120, duration: 260, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => cb?.());
  }, [slideY, opacity]);

  const showToast = useCallback((kind: ToastKind, autoDismissMs?: number) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(kind);
    showSlide();
    if (autoDismissMs) {
      toastTimer.current = setTimeout(() => {
        hideSlide(() => { if (isMounted.current) setToast(null); });
      }, autoDismissMs);
    }
  }, [showSlide, hideSlide]);

  // ─── Core update logic ─────────────────────────────────────────

  const checkAndApply = useCallback(async (isManual = false) => {
    if (!Updates.isEnabled || __DEV__) {
      if (isManual) showToast('upToDate', 2500);
      return;
    }
    if (isChecking) return;

    try {
      if (isMounted.current) setIsChecking(true);

      const check = await Updates.checkForUpdateAsync();

      if (!check.isAvailable) {
        if (isManual) showToast('upToDate', 2500);
        return;
      }

      // Download it
      showToast('downloading');
      await Updates.fetchUpdateAsync();

      // Ready — switch banner to persistent "ready" state
      if (isMounted.current) {
        if (toastTimer.current) clearTimeout(toastTimer.current);
        setUpdateReady(true);
        setToast('ready');
        showSlide(); // re-animate into ready state
      }
    } catch {
      // Network failure — hide any pending toast silently
      hideSlide(() => { if (isMounted.current) setToast(null); });
    } finally {
      if (isMounted.current) setIsChecking(false);
    }
  }, [isChecking, showToast, showSlide, hideSlide]);

  // ─── Cold launch: check 3s after render ───────────────────────

  useEffect(() => {
    if (!Updates.isEnabled || __DEV__) return;
    const t = setTimeout(() => checkAndApply(false), 3000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Foreground resume ─────────────────────────────────────────

  useEffect(() => {
    if (!Updates.isEnabled || __DEV__) return;
    const handler = (nextState: AppStateStatus) => {
      if (nextState === 'active' && !updateReady) checkAndApply(false);
    };
    const sub = AppState.addEventListener('change', handler);
    return () => sub.remove();
  }, [checkAndApply, updateReady]);

  // ─── Apply update ──────────────────────────────────────────────

  const applyUpdate = useCallback(async () => {
    hideSlide(async () => {
      setToast(null);
      try { await Updates.reloadAsync(); } catch { setUpdateReady(false); }
    });
  }, [hideSlide]);

  const dismissBanner = useCallback(() => {
    hideSlide(() => {
      // Keep updateReady=true so the dot stays in Settings; just hide the banner
      if (isMounted.current) setToast(null);
    });
  }, [hideSlide]);

  // ─── Manual check ──────────────────────────────────────────────

  const checkNow = useCallback(async () => {
    await checkAndApply(true);
  }, [checkAndApply]);

  const applyNow = useCallback(async () => {
    await applyUpdate();
  }, [applyUpdate]);

  // ─── Render ────────────────────────────────────────────────────

  const toastContent = (() => {
    if (toast === 'downloading') return (
      <View style={styles.toastRow}>
        <View style={[styles.toastIconWrap, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
          <Feather name="download-cloud" size={18} color="#fff" />
        </View>
        <View style={styles.toastTextWrap}>
          <Text style={styles.toastTitle}>Downloading update…</Text>
          <Text style={styles.toastSub}>FlowState will be ready to restart shortly.</Text>
        </View>
      </View>
    );
    if (toast === 'upToDate') return (
      <View style={styles.toastRow}>
        <View style={[styles.toastIconWrap, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
          <Feather name="check-circle" size={18} color="#fff" />
        </View>
        <View style={styles.toastTextWrap}>
          <Text style={styles.toastTitle}>You're up to date</Text>
          <Text style={styles.toastSub}>FlowState is running the latest version.</Text>
        </View>
      </View>
    );
    if (toast === 'ready') return (
      <View style={styles.toastRow}>
        <View style={[styles.toastIconWrap, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
          <Feather name="zap" size={18} color="#fff" />
        </View>
        <View style={styles.toastTextWrap}>
          <Text style={styles.toastTitle}>Update ready</Text>
          <Text style={styles.toastSub}>Restart to apply the latest version.</Text>
        </View>
        <View style={styles.toastActions}>
          <Pressable style={styles.laterBtn} onPress={dismissBanner}>
            <Text style={styles.laterText}>Later</Text>
          </Pressable>
          <Pressable style={styles.restartBtn} onPress={applyUpdate}>
            <Text style={styles.restartText}>Restart</Text>
          </Pressable>
        </View>
      </View>
    );
    return null;
  })();

  return (
    <UpdatesContext.Provider value={{ checkNow, applyNow, isChecking, updateReady }}>
      {children}

      {toast && (
        <Animated.View
          style={[
            styles.toast,
            {
              backgroundColor: toast === 'upToDate' ? themeColors.success : themeColors.accent,
              transform: [{ translateY: slideY }],
              opacity,
            },
          ]}
          pointerEvents={toast === 'downloading' ? 'none' : 'box-none'}
        >
          {toastContent}
        </Animated.View>
      )}
    </UpdatesContext.Provider>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    bottom: 96,          // clear tab bar (56) + safe area + breathing room
    left: spacing.md,
    right: spacing.md,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    zIndex: 9999,
  },
  toastRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  toastIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  toastTextWrap: {
    flex: 1,
  },
  toastTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: fontSize.sm,
    letterSpacing: 0.1,
  },
  toastSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  toastActions: {
    flexDirection: 'row',
    gap: spacing.xs,
    flexShrink: 0,
  },
  laterBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  laterText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  restartBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
    backgroundColor: '#fff',
  },
  restartText: {
    color: '#0B0F14',
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
