import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface ComplianceBarProps {
  data: { label: string; value: number; target?: number }[];
  height?: number;
}

export function ComplianceBarChart({ data, height = 200 }: ComplianceBarProps) {
  if (data.length === 0) {
    return <div style={{ color: 'var(--muted)', fontSize: 13, padding: 16, textAlign: 'center' }}>No data yet</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis dataKey="label" fontSize={11} tick={{ fill: 'var(--muted)' }} />
        <YAxis fontSize={11} tick={{ fill: 'var(--muted)' }} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
        <Tooltip
          contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
          formatter={(value) => [`${Math.round(value as number)}%`, 'Compliance']}
        />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((entry, idx) => (
            <Cell key={idx} fill={entry.value >= 80 ? '#16A34A' : entry.value >= 50 ? '#D97706' : '#DC2626'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
