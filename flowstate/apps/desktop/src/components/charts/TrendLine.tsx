import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TrendLineProps {
  data: { date: string; value: number }[];
  label?: string;
  color?: string;
  height?: number;
}

export function TrendLineChart({ data, label, color = '#2563EB', height = 200 }: TrendLineProps) {
  if (data.length === 0) {
    return <div style={{ color: 'var(--muted)', fontSize: 13, padding: 16, textAlign: 'center' }}>No data yet</div>;
  }

  const formatted = data.map((d) => ({
    date: d.date.slice(5), // MM-DD
    value: d.value,
  }));

  return (
    <div>
      {label && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>{label}</div>}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={formatted} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="date" fontSize={11} tick={{ fill: 'var(--muted)' }} />
          <YAxis fontSize={11} tick={{ fill: 'var(--muted)' }} />
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
          />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
