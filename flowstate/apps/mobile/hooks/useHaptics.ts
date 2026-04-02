/**
 * useHaptics — haptic feedback gated on user preference.
 *
 * Usage:
 *   const { impact, success, warning, selection } = useHaptics();
 *   impact('medium');   // respects hapticFeedback + hapticIntensity settings
 *   success();          // notification success vibe
 *   selection();        // light selection tick
 *
 * When hapticFeedback === false every function is a no-op.
 * When hapticIntensity overrides the caller's level:
 *   'light'  → down-grades any 'medium' call to Light
 *   'heavy'  → up-grades any 'medium' call to Heavy
 */

import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { useUserPrefsStore } from '../stores/userPrefsStore';

type ImpactLevel = 'light' | 'medium' | 'heavy';

function resolveImpactStyle(
  requested: ImpactLevel,
  userIntensity: 'light' | 'medium' | 'heavy',
): Haptics.ImpactFeedbackStyle {
  // Respect user's global intensity preference — clamp to their setting
  const levels: ImpactLevel[] = ['light', 'medium', 'heavy'];
  const reqIdx  = levels.indexOf(requested);
  const userIdx = levels.indexOf(userIntensity);
  // Use the lower of requested vs user max (for light pref) or mirror (for heavy)
  const finalIdx =
    userIntensity === 'light'  ? Math.min(reqIdx, 0) :
    userIntensity === 'heavy'  ? Math.max(reqIdx, 2) :
    reqIdx;
  return [
    Haptics.ImpactFeedbackStyle.Light,
    Haptics.ImpactFeedbackStyle.Medium,
    Haptics.ImpactFeedbackStyle.Heavy,
  ][finalIdx];
}

export function useHaptics() {
  const enabled   = useUserPrefsStore(s => s.hapticFeedback);
  const intensity = useUserPrefsStore(s => s.hapticIntensity);

  const impact = useCallback((level: ImpactLevel = 'medium') => {
    if (!enabled) return;
    Haptics.impactAsync(resolveImpactStyle(level, intensity)).catch(() => {});
  }, [enabled, intensity]);

  const success = useCallback(() => {
    if (!enabled) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  }, [enabled]);

  const warning = useCallback(() => {
    if (!enabled) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  }, [enabled]);

  const error = useCallback(() => {
    if (!enabled) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  }, [enabled]);

  const selection = useCallback(() => {
    if (!enabled) return;
    Haptics.selectionAsync().catch(() => {});
  }, [enabled]);

  return { impact, success, warning, error, selection };
}
