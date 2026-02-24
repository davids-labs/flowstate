import { z } from 'zod';
import type { ParsedCSVRow, ParsedSession } from './parser';

// ─── Validation Types ───────────────────────────────────────────

export interface ValidationError {
  row: number;
  column: string;
  message: string;
}

export interface ValidationWarning {
  row?: number;
  message: string;
}

export interface ValidationResult {
  errors: ValidationError[];
  warnings: ValidationWarning[];
  isValid: boolean;
  summary: {
    totalRows: number;
    dateRange: { start: string; end: string } | null;
    routinesFound: string[];
    modulesReferenced: string[];
    quietDays: number;
    sessionsTotal: number;
  };
}

// ─── Validation Schemas ─────────────────────────────────────────

const dateSchema = z.string().regex(
  /^\d{4}-\d{2}-\d{2}$/,
  'Date must be in YYYY-MM-DD format',
);

const sessionSchema = z.object({
  routine: z.string().min(1, 'Routine name is required'),
  durationMinutes: z.number().int().positive('Duration must be a positive integer'),
  label: z.string().optional(),
});

const rowSchema = z.object({
  date: dateSchema,
  title: z.string().min(1, 'Title is required'),
  mustDo: z.array(z.string()),
  quiet: z.boolean(),
  sessions: z.array(sessionSchema),
  targets: z.record(z.string(), z.number()),
  required: z.array(z.string()),
  rowNumber: z.number(),
});

// ─── Validator ──────────────────────────────────────────────────

/**
 * Validate parsed CSV rows.
 * Returns errors (block import) and warnings (allow import).
 */
export function validateCSV(rows: ParsedCSVRow[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const datesSeen = new Set<string>();
  const routinesFound = new Set<string>();
  const modulesReferenced = new Set<string>();
  let quietDays = 0;
  let sessionsTotal = 0;

  if (rows.length === 0) {
    errors.push({ row: 0, column: '-', message: 'CSV file is empty — no data rows found' });
    return {
      errors,
      warnings,
      isValid: false,
      summary: { totalRows: 0, dateRange: null, routinesFound: [], modulesReferenced: [], quietDays: 0, sessionsTotal: 0 },
    };
  }

  for (const row of rows) {
    // Validate with Zod
    const result = rowSchema.safeParse(row);

    if (!result.success) {
      for (const issue of result.error.issues) {
        errors.push({
          row: row.rowNumber,
          column: issue.path.join('.') || 'unknown',
          message: issue.message,
        });
      }
      continue;
    }

    // Check for duplicate dates
    if (datesSeen.has(row.date)) {
      errors.push({
        row: row.rowNumber,
        column: 'date',
        message: `Duplicate date: ${row.date}`,
      });
    }
    datesSeen.add(row.date);

    // Validate date is a real date
    const dateObj = new Date(row.date + 'T12:00:00');
    if (isNaN(dateObj.getTime())) {
      errors.push({
        row: row.rowNumber,
        column: 'date',
        message: `Invalid date: ${row.date}`,
      });
    }

    // Track routines
    for (const session of row.sessions) {
      routinesFound.add(session.routine);
      sessionsTotal++;

      // Warn about unusually long/short sessions
      if (session.durationMinutes > 240) {
        warnings.push({
          row: row.rowNumber,
          message: `Session "${session.routine}" is ${session.durationMinutes} minutes — unusually long`,
        });
      }
    }

    // Track module references
    for (const moduleId of Object.keys(row.targets)) {
      modulesReferenced.add(moduleId);
    }
    for (const moduleId of row.required) {
      modulesReferenced.add(moduleId);
    }

    // Track quiet days
    if (row.quiet) {
      quietDays++;
      if (row.sessions.length > 0) {
        warnings.push({
          row: row.rowNumber,
          message: 'Quiet day has sessions defined — sessions will still be created',
        });
      }
    }

    // Warn if no must-dos and not quiet
    if (row.mustDo.length === 0 && !row.quiet) {
      warnings.push({
        row: row.rowNumber,
        message: 'No must-do items defined for this day',
      });
    }
  }

  // Check date continuity
  const sortedDates = [...datesSeen].sort();
  if (sortedDates.length >= 2) {
    const start = new Date(sortedDates[0] + 'T12:00:00');
    const end = new Date(sortedDates[sortedDates.length - 1] + 'T12:00:00');
    const expectedDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;

    if (sortedDates.length < expectedDays) {
      const missing = expectedDays - sortedDates.length;
      warnings.push({
        message: `${missing} date${missing > 1 ? 's' : ''} missing in range ${sortedDates[0]} to ${sortedDates[sortedDates.length - 1]}`,
      });
    }
  }

  const dateRange =
    sortedDates.length > 0
      ? { start: sortedDates[0], end: sortedDates[sortedDates.length - 1] }
      : null;

  return {
    errors,
    warnings,
    isValid: errors.length === 0,
    summary: {
      totalRows: rows.length,
      dateRange,
      routinesFound: [...routinesFound],
      modulesReferenced: [...modulesReferenced],
      quietDays,
      sessionsTotal,
    },
  };
}
