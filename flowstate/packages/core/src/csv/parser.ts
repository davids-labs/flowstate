// ─── Pure-JS CSV parser (no Node.js Buffer dependency) ──────────

/**
 * Minimal RFC-4180 CSV parser that works in React Native.
 * Handles quoted fields, embedded commas, and escaped quotes.
 */
function parseCsvString(csv: string): Record<string, string>[] {
  const lines = splitCsvLines(csv);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]).map(h => h.trim());
  const records: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue; // skip empty lines
    const values = parseCsvLine(line);
    const record: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      record[headers[j]] = (values[j] ?? '').trim();
    }
    records.push(record);
  }

  return records;
}

/** Split CSV text into lines, respecting quoted fields that contain newlines */
function splitCsvLines(text: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      current += ch;
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++; // skip \r\n
      lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Parse a single CSV line into field values */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
  }
  fields.push(current);
  return fields;
}

// ─── CSV Column Conventions ─────────────────────────────────────
//
// Required columns:
//   date       — YYYY-MM-DD
//   title      — Day title
//
// Optional columns:
//   must_do    — Semicolon-separated must-do items
//   quiet      — "true" to mark as quiet day (no sessions expected)
//
// Session columns (N = 1, 2, 3…):
//   session_N_routine — routine name/id
//   session_N_time    — duration in minutes
//   session_N_label   — display label (optional)
//
// Module target columns:
//   target_{moduleId} — numeric target for a data_input module
//   require_{moduleId} — "true" to mark module as required for this day

export interface ParsedCSVRow {
  date: string;
  title: string;
  mustDo: string[];
  quiet: boolean;
  sessions: ParsedSession[];
  targets: Record<string, number>;
  required: string[];
  rowNumber: number;
}

export interface ParsedSession {
  routine: string;
  durationMinutes: number;
  label?: string;
}

export interface CSVParseResult {
  rows: ParsedCSVRow[];
  headers: string[];
  rawRowCount: number;
}

/**
 * Parse a CSV string into structured row data.
 * Does NOT validate — just extracts structure from the raw CSV.
 */
export function parseCSV(csvContent: string): CSVParseResult {
  const records: Record<string, string>[] = parseCsvString(csvContent);

  // Extract headers from the first record's keys
  const headers = records.length > 0 ? Object.keys(records[0]) : [];

  // Detect session column groups (session_1_routine, session_2_routine, etc.)
  const sessionIndices = new Set<number>();
  for (const h of headers) {
    const match = h.match(/^session_(\d+)_routine$/);
    if (match) sessionIndices.add(parseInt(match[1], 10));
  }
  const sortedSessionIndices = [...sessionIndices].sort((a, b) => a - b);

  // Detect target columns (target_steps, target_water, etc.)
  const targetModuleIds: string[] = [];
  for (const h of headers) {
    const match = h.match(/^target_(.+)$/);
    if (match) targetModuleIds.push(match[1]);
  }

  // Detect require columns (require_vitamins, etc.)
  const requireModuleIds: string[] = [];
  for (const h of headers) {
    const match = h.match(/^require_(.+)$/);
    if (match) requireModuleIds.push(match[1]);
  }

  const rows: ParsedCSVRow[] = records.map((record, index) => {
    // Parse sessions
    const sessions: ParsedSession[] = [];
    for (const n of sortedSessionIndices) {
      const routine = record[`session_${n}_routine`]?.trim();
      if (!routine) continue;

      const timeStr = record[`session_${n}_time`]?.trim();
      const durationMinutes = timeStr ? parseInt(timeStr, 10) : 25; // default 25min
      const label = record[`session_${n}_label`]?.trim() || undefined;

      sessions.push({
        routine,
        durationMinutes: isNaN(durationMinutes) ? 25 : durationMinutes,
        label,
      });
    }

    // Parse targets
    const targets: Record<string, number> = {};
    for (const moduleId of targetModuleIds) {
      const val = record[`target_${moduleId}`]?.trim();
      if (val) {
        const num = parseFloat(val);
        if (!isNaN(num)) targets[moduleId] = num;
      }
    }

    // Parse required modules
    const required: string[] = [];
    for (const moduleId of requireModuleIds) {
      const val = record[`require_${moduleId}`]?.trim()?.toLowerCase();
      if (val === 'true' || val === '1' || val === 'yes') {
        required.push(moduleId);
      }
    }

    // Parse must-do items
    const mustDoStr = record['must_do']?.trim() ?? '';
    const mustDo = mustDoStr
      ? mustDoStr.split(';').map(s => s.trim()).filter(Boolean)
      : [];

    return {
      date: record['date']?.trim() ?? '',
      title: record['title']?.trim() ?? '',
      mustDo,
      quiet: (record['quiet']?.trim()?.toLowerCase() ?? '') === 'true',
      sessions,
      targets,
      required,
      rowNumber: index + 2, // +2 because row 1 is headers, index is 0-based
    };
  });

  return { rows, headers, rawRowCount: records.length };
}
