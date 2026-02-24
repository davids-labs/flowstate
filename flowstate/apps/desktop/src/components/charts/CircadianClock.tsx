/**
 * CircadianClock — SVG 24-hour density plot.
 */

interface CircadianClockProps {
  buckets: Array<{ hour: number; count: number; totalMinutes: number }>;
  label?: string;
  peakHour?: number;
  totalSessions?: number;
  size?: number;
}

export function CircadianClock({
  buckets,
  label,
  peakHour,
  totalSessions,
  size = 240,
}: CircadianClockProps) {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 24;
  const innerR = outerR * 0.35;
  const maxCount = Math.max(...buckets.map((b) => b.count), 1);

  const formatHour = (h: number) => {
    if (h === 0) return '12a';
    if (h < 12) return `${h}a`;
    if (h === 12) return '12p';
    return `${h - 12}p`;
  };

  const hourLabels = [0, 3, 6, 9, 12, 15, 18, 21];

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        {label && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{label}</div>}
        {totalSessions !== undefined && (
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>{totalSessions} sessions</div>
        )}
      </div>
      <svg width={size} height={size} style={{ margin: '0 auto', display: 'block' }}>
        {/* Background rings */}
        <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="var(--border)" strokeWidth={1} />
        <circle cx={cx} cy={cy} r={innerR} fill="none" stroke="var(--border)" strokeWidth={0.5} />

        {/* Hour arcs */}
        {buckets.map((b) => {
          const intensity = b.count / maxCount;
          const barR = innerR + (outerR - innerR) * intensity;
          const startAngle = (b.hour / 24) * 360 - 90;
          const endAngle = ((b.hour + 1) / 24) * 360 - 90;
          const startRad = (startAngle * Math.PI) / 180;
          const endRad = (endAngle * Math.PI) / 180;

          const x1 = cx + barR * Math.cos(startRad);
          const y1 = cy + barR * Math.sin(startRad);
          const x2 = cx + barR * Math.cos(endRad);
          const y2 = cy + barR * Math.sin(endRad);
          const ix1 = cx + innerR * Math.cos(startRad);
          const iy1 = cy + innerR * Math.sin(startRad);
          const ix2 = cx + innerR * Math.cos(endRad);
          const iy2 = cy + innerR * Math.sin(endRad);

          const d = `M ${ix1} ${iy1} L ${x1} ${y1} A ${barR} ${barR} 0 0 1 ${x2} ${y2} L ${ix2} ${iy2} A ${innerR} ${innerR} 0 0 0 ${ix1} ${iy1} Z`;

          return (
            <path
              key={b.hour}
              d={d}
              fill="#2563EB"
              opacity={intensity > 0 ? 0.2 + intensity * 0.7 : 0.05}
              style={{ transition: 'opacity 200ms' }}
            >
              <title>{formatHour(b.hour)}: {b.count} sessions, {Math.round(b.totalMinutes)} min</title>
            </path>
          );
        })}

        {/* Hour labels */}
        {hourLabels.map((h) => {
          const angle = (h / 24) * 360 - 90;
          const rad = (angle * Math.PI) / 180;
          const lx = cx + (outerR + 14) * Math.cos(rad);
          const ly = cy + (outerR + 14) * Math.sin(rad);
          return (
            <text key={h} x={lx} y={ly + 3} fontSize={10} fill="var(--muted)" textAnchor="middle">
              {formatHour(h)}
            </text>
          );
        })}
      </svg>
      {peakHour !== undefined && (
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
          Most active: {formatHour(peakHour)}
        </div>
      )}
    </div>
  );
}
