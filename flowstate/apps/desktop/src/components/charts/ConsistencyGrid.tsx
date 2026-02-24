/**
 * ConsistencyGrid — 365-day GitHub-style binary heatmap.
 */

interface ConsistencyGridProps {
  days: Array<{ date: string; logged: boolean }>;
  label?: string;
  totalLogged?: number;
  color?: string;
}

const CELL = 14;
const GAP = 2;
const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

export function ConsistencyGrid({ days, label, totalLogged, color = '#2563EB' }: ConsistencyGridProps) {
  // Group into columns of 7
  const columns: Array<Array<{ date: string; logged: boolean }>> = [];
  for (let i = 0; i < days.length; i += 7) {
    columns.push(days.slice(i, i + 7));
  }

  const width = columns.length * (CELL + GAP) + 30;
  const height = 7 * (CELL + GAP) + 5;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        {label && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>}
        {totalLogged !== undefined && (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{totalLogged}/365 days</div>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <svg width={width} height={height}>
          {/* Day labels */}
          {DAY_LABELS.map((l, i) =>
            l ? (
              <text key={i} x={0} y={i * (CELL + GAP) + CELL - 3} fontSize={10} fill="var(--muted)">
                {l}
              </text>
            ) : null,
          )}
          {/* Cells */}
          {columns.map((col, ci) =>
            col.map((cell, ri) => (
              <rect
                key={`${ci}-${ri}`}
                x={ci * (CELL + GAP) + 30}
                y={ri * (CELL + GAP)}
                width={CELL}
                height={CELL}
                rx={3}
                fill={cell.logged ? color : 'var(--border)'}
                opacity={cell.logged ? 1 : 0.3}
                style={{ transition: 'fill 150ms' }}
              >
                <title>{cell.date}: {cell.logged ? 'Logged' : 'No entry'}</title>
              </rect>
            )),
          )}
        </svg>
      </div>
    </div>
  );
}
