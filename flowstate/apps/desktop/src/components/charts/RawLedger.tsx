/**
 * RawLedger — searchable, high-speed paginated table for desktop.
 */
import { useState, useCallback } from 'react';

interface LedgerRow {
  id: string;
  date: string;
  value: string;
  loggedAt: string;
  sessionId: string | null;
}

interface RawLedgerProps {
  entries: LedgerRow[];
  label?: string;
  unit?: string;
  hasMore?: boolean;
  onLoadMore?: () => void;
  onSearch?: (query: string) => void;
}

export function RawLedger({ entries, label, unit, hasMore, onLoadMore, onSearch }: RawLedgerProps) {
  const [search, setSearch] = useState('');

  const handleSearch = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setSearch(val);
      onSearch?.(val);
    },
    [onSearch],
  );

  const formatValue = (raw: string): string => {
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed === 'number') return `${parsed}${unit ? ` ${unit}` : ''}`;
      if (typeof parsed === 'boolean') return parsed ? '✓' : '✗';
      if (typeof parsed === 'string') return parsed;
      return raw;
    } catch {
      return raw;
    }
  };

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        {label && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>}
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{entries.length} entries</div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search entries..."
        value={search}
        onChange={handleSearch}
        style={{
          width: '100%',
          padding: '6px 10px',
          borderRadius: 6,
          border: '1px solid var(--border)',
          background: 'var(--background)',
          color: 'var(--text)',
          fontSize: 13,
          marginBottom: 12,
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />

      {/* Table */}
      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 8px', fontWeight: 600 }}>
                Date
              </th>
              <th style={{ textAlign: 'left', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 8px', fontWeight: 600 }}>
                Time
              </th>
              <th style={{ textAlign: 'left', fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', padding: '4px 8px', fontWeight: 600 }}>
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '6px 8px', color: 'var(--text)', fontWeight: 500 }}>{entry.date}</td>
                <td style={{ padding: '6px 8px', color: 'var(--muted)' }}>
                  {entry.loggedAt ? new Date(entry.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                </td>
                <td style={{ padding: '6px 8px', color: 'var(--text)', fontWeight: 600 }}>{formatValue(entry.value)}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={3} style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>
                  {search ? 'No matching entries' : 'No entries yet'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <button
          onClick={onLoadMore}
          style={{
            width: '100%',
            marginTop: 8,
            padding: '6px 12px',
            borderRadius: 6,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            color: 'var(--text)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          Load more
        </button>
      )}
    </div>
  );
}
