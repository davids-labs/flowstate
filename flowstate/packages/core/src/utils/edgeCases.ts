// ─── Edge Case Utilities ────────────────────────────────────────
// Helpers for timezone-safe dates, midnight rollover, and data validation.

/**
 * Get today's date as YYYY-MM-DD in the local timezone.
 * Safe across all timezones (no UTC offset issues).
 */
export function getLocalDateString(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Parse a YYYY-MM-DD string into a Date at noon local time.
 * Using noon avoids DST edge cases where midnight might shift to the previous day.
 */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

/**
 * Get ISO week ID from a date string (e.g. "2026-W09").
 */
export function getWeekId(dateStr: string): string {
  const date = parseLocalDate(dateStr);
  const year = date.getFullYear();
  const oneJan = new Date(year, 0, 1);
  const dayOfYear = Math.ceil((date.getTime() - oneJan.getTime()) / 86_400_000);
  const weekNum = Math.ceil((dayOfYear + oneJan.getDay()) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

/**
 * Check if a YYYY-MM-DD string is a valid date.
 */
export function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr + 'T12:00:00');
  return !isNaN(d.getTime());
}

// ─── Midnight Rollover Detection ────────────────────────────────

/**
 * MidnightWatcher detects when the date changes while the app is open.
 * Calls the callback with the new date string when midnight passes.
 */
export class MidnightWatcher {
  private _interval: ReturnType<typeof setInterval> | null = null;
  private _currentDate: string;
  private _callback: (newDate: string) => void;

  constructor(callback: (newDate: string) => void) {
    this._currentDate = getLocalDateString();
    this._callback = callback;
  }

  start() {
    this.stop();
    this._currentDate = getLocalDateString();

    // Check every 30 seconds
    this._interval = setInterval(() => {
      const now = getLocalDateString();
      if (now !== this._currentDate) {
        this._currentDate = now;
        this._callback(now);
      }
    }, 30_000);
  }

  stop() {
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  get currentDate(): string {
    return this._currentDate;
  }
}

// ─── CSV Validation Helpers ─────────────────────────────────────

export interface CSVValidationError {
  row: number;
  field: string;
  message: string;
}

/**
 * Validate parsed CSV rows for common issues before importing.
 * Returns an array of errors (empty = valid).
 */
export function validateCSVForImport(rows: Array<{ date: string; title: string }>): CSVValidationError[] {
  const errors: CSVValidationError[] = [];
  const seenDates = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 1;

    // Missing date
    if (!row.date) {
      errors.push({ row: rowNum, field: 'date', message: 'Missing date' });
      continue;
    }

    // Invalid date format
    if (!isValidDate(row.date)) {
      errors.push({ row: rowNum, field: 'date', message: `Invalid date: "${row.date}"` });
      continue;
    }

    // Duplicate date
    if (seenDates.has(row.date)) {
      errors.push({ row: rowNum, field: 'date', message: `Duplicate date: ${row.date}` });
    }
    seenDates.add(row.date);

    // Missing title
    if (!row.title || !row.title.trim()) {
      errors.push({ row: rowNum, field: 'title', message: 'Missing title' });
    }
  }

  // Check date order
  const dates = rows.map((r) => r.date).filter(Boolean);
  for (let i = 1; i < dates.length; i++) {
    if (dates[i] < dates[i - 1]) {
      errors.push({ row: i + 1, field: 'date', message: 'Dates not in chronological order' });
      break; // Only report once
    }
  }

  return errors;
}

// ─── Safe JSON Parse ────────────────────────────────────────────

/**
 * Safely parse a JSON string. Returns the fallback value on any error.
 */
export function safeJsonParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
