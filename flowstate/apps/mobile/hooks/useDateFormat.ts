/**
 * useDateFormat — locale-aware date/time formatting respecting user preferences.
 *
 * Usage:
 *   const { formatTime, formatDate, formatShortDate, formatDayLabel } = useDateFormat();
 *
 *   formatTime(date)          // '2:30 PM' or '14:30' depending on timeFormat pref
 *   formatTime('14:30')       // accepts HH:MM string too
 *   formatDate(date)          // 'Mon, 11 Mar 2026'
 *   formatShortDate(date)     // 'Mar 11'
 *   formatDayLabel(date)      // 'Mon' / 'Today' / 'Tomorrow'
 */

import { useCallback } from 'react';
import { useUserPrefsStore } from '../stores/userPrefsStore';

// Parse a value that could be a Date, ISO string, or 'HH:MM' time string
function toDate(value: Date | string | number): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'number') return new Date(value);
  // 'HH:MM' short time string
  if (/^\d{1,2}:\d{2}$/.test(value)) {
    const [h, m] = value.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }
  return new Date(value);
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

export function useDateFormat() {
  const timeFormat     = useUserPrefsStore(s => s.timeFormat);
  const firstDayOfWeek = useUserPrefsStore(s => s.firstDayOfWeek);

  /** Format a time value as '2:30 PM' (12h) or '14:30' (24h) */
  const formatTime = useCallback((value: Date | string | number): string => {
    try {
      const d = toDate(value);
      if (timeFormat === '24h') {
        return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
      }
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  }, [timeFormat]);

  /** Format a full date: 'Mon, 11 Mar 2026' */
  const formatDate = useCallback((value: Date | string | number): string => {
    try {
      const d = toDate(value);
      return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
      return '';
    }
  }, []);

  /** Format a short date: 'Mar 11' */
  const formatShortDate = useCallback((value: Date | string | number): string => {
    try {
      const d = toDate(value);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    } catch {
      return '';
    }
  }, []);

  /** Returns 'Today', 'Tomorrow', or the weekday abbreviation ('Mon') */
  const formatDayLabel = useCallback((value: Date | string | number): string => {
    try {
      const d = toDate(value);
      const now = new Date();
      if (isSameDay(d, now)) return 'Today';
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      if (isSameDay(d, tomorrow)) return 'Tomorrow';
      return d.toLocaleDateString('en-GB', { weekday: 'short' });
    } catch {
      return '';
    }
  }, []);

  /** Returns the first day of week value for calendar components */
  const weekStartsOn = firstDayOfWeek === 'mon' ? 1 : 0; // 1 = Monday, 0 = Sunday

  return { formatTime, formatDate, formatShortDate, formatDayLabel, weekStartsOn };
}
