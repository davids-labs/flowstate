/**
 * MetricTrendLine — line graph with data peeking and goal ghost line overlay.
 */
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

interface MetricTrendLineProps {
  points: Array<{ date: string; value: number; loggedAt?: string }>;
  label?: string;
  unit?: string;
  color?: string;
  height?: number;
  targetPath?: Array<{ date: string; value: number }>;
  gapFromTarget?: number;
}

export function MetricTrendLineChart({
  points,
  label,
  unit = '',
  color = '#2563EB',
  height = 220,
  targetPath,
  gapFromTarget,
}: MetricTrendLineProps) {
  if (points.length === 0) {
    return <div style={{ color: 'var(--muted)', fontSize: 13, padding: 16, textAlign: 'center' }}>No data yet</div>;
  }

  // Merge actual + target into one dataset keyed by date
  const merged = new Map<string, { date: string; actual?: number; target?: number; loggedAt?: string }>();
  for (const p of points) {
    merged.set(p.date, { date: p.date, actual: p.value, loggedAt: p.loggedAt });
  }
  if (targetPath) {
    for (const t of targetPath) {
      const existing = merged.get(t.date);
      if (existing) {
        existing.target = t.value;
      } else {
        merged.set(t.date, { date: t.date, target: t.value });
      }
    }
  }

  const data = [...merged.values()].sort((a, b) => a.date.localeCompare(b.date)).map((d) => ({
    ...d,
    date: d.date.slice(5), // MM-DD
  }));

  // Gap badge
  let gapText = '';
  if (gapFromTarget !== undefined && gapFromTarget !== 0) {
    const sign = gapFromTarget > 0 ? '+' : '';
    gapText = `${sign}${gapFromTarget}${unit ? ` ${unit}` : ''}`;
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        {label && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>}
        {gapText && (
          <div style={{ fontSize: 13, fontWeight: 700, color: (gapFromTarget ?? 0) >= 0 ? '#16A34A' : '#DC2626' }}>
            {gapText}
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" fontSize={11} tick={{ fill: 'var(--muted)' }} />
          <YAxis fontSize={11} tick={{ fill: 'var(--muted)' }} />
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
            formatter={(value: any, name?: string) => {
              const label = name === 'target' ? 'Target' : 'Actual';
              return [`${value}${unit ? ` ${unit}` : ''}`, label];
            }}
          />
          {/* Ghost line (target path) */}
          {targetPath && (
            <Line
              type="monotone"
              dataKey="target"
              stroke="var(--muted)"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              dot={false}
              connectNulls
            />
          )}
          {/* Actual data */}
          <Line
            type="monotone"
            dataKey="actual"
            stroke={color}
            strokeWidth={2}
            dot={{ r: 3 }}
            activeDot={{ r: 5 }}
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
