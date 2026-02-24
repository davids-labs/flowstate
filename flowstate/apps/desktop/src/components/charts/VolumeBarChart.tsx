/**
 * VolumeBarChart — recharts bar chart for time/count volume.
 */
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface VolumeBarChartProps {
  bars: Array<{ period: string; volume: number }>;
  unit: 'minutes' | 'count';
  label?: string;
  height?: number;
  color?: string;
}

export function VolumeBarChart({ bars, unit, label, height = 200, color = '#2563EB' }: VolumeBarChartProps) {
  if (bars.length === 0) {
    return <div style={{ color: 'var(--muted)', fontSize: 13, padding: 16, textAlign: 'center' }}>No data yet</div>;
  }

  const totalVolume = bars.reduce((s, b) => s + b.volume, 0);
  const unitLabel = unit === 'minutes' ? `${Math.round(totalVolume)} min total` : `${totalVolume} entries total`;

  const formatted = bars.map((b) => ({
    period: b.period.length > 5 ? b.period.slice(5) : b.period,
    volume: Math.round(b.volume * 10) / 10,
  }));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        {label && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>}
        <div style={{ fontSize: 12, color: 'var(--muted)' }}>{unitLabel}</div>
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={formatted} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="period" fontSize={11} tick={{ fill: 'var(--muted)' }} />
          <YAxis fontSize={11} tick={{ fill: 'var(--muted)' }} />
          <Tooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 13 }}
            formatter={(value) => [`${value} ${unit === 'minutes' ? 'min' : 'entries'}`, 'Volume']}
          />
          <Bar dataKey="volume" fill={color} radius={[4, 4, 0, 0]} opacity={0.85} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
