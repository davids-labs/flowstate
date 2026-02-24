interface HeatmapCalendarProps {
  data: { date: string; value: number }[];
  weeks?: number;
}

function getColor(value: number): string {
  if (value >= 100) return '#16A34A';
  if (value >= 75) return '#4ADE80';
  if (value >= 50) return '#FDE047';
  if (value >= 25) return '#FDBA74';
  if (value > 0) return '#FCA5A5';
  return 'var(--border)';
}

const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];

export function HeatmapCalendar({ data, weeks = 8 }: HeatmapCalendarProps) {
  const cellSize = 18;
  const gap = 3;

  // Build grid from data
  const dataMap = new Map(data.map((d) => [d.date, d.value]));

  // Start from now going back
  const cells: { date: string; value: number; col: number; row: number }[] = [];
  const today = new Date();

  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const offset = (weeks - 1 - w) * 7 + (6 - d);
      const date = new Date(today);
      date.setDate(today.getDate() - offset);
      const dateStr = date.toISOString().slice(0, 10);
      cells.push({
        date: dateStr,
        value: dataMap.get(dateStr) ?? 0,
        col: w,
        row: d,
      });
    }
  }

  const width = weeks * (cellSize + gap) + 30;
  const height = 7 * (cellSize + gap) + 5;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={width} height={height}>
        {/* Day labels */}
        {DAY_LABELS.map((label, i) => (
          label ? (
            <text key={i} x={0} y={i * (cellSize + gap) + cellSize - 3}
              fontSize={10} fill="var(--muted)">{label}</text>
          ) : null
        ))}

        {/* Cells */}
        {cells.map((cell) => (
          <rect key={cell.date}
            x={cell.col * (cellSize + gap) + 30}
            y={cell.row * (cellSize + gap)}
            width={cellSize}
            height={cellSize}
            rx={3}
            fill={getColor(cell.value)}
            style={{ transition: 'fill 150ms' }}
          >
            <title>{cell.date}: {cell.value}%</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}
