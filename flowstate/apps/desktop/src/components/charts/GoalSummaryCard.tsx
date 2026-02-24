/**
 * GoalSummaryCard — neutral "Required Daily Rate" display for desktop.
 */

interface GoalSummaryCardProps {
  label: string;
  unit: string;
  startValue: number;
  targetValue: number;
  currentValue: number | null;
  requiredDailyRate: number;
  actualDailyRate: number;
  adjustedDailyRate: number | null;
  daysRemaining: number;
  progressFraction: number;
  isAhead: boolean;
  gapFromLinear: number;
}

export function GoalSummaryCard({
  label,
  unit,
  startValue,
  targetValue,
  currentValue,
  requiredDailyRate,
  actualDailyRate,
  adjustedDailyRate,
  daysRemaining,
  progressFraction,
  isAhead,
  gapFromLinear,
}: GoalSummaryCardProps) {
  const direction = targetValue > startValue ? '+' : '';
  const formatRate = (rate: number) => `${direction}${rate}${unit ? ` ${unit}` : ''}`;
  const showAdjusted = adjustedDailyRate !== null && Math.abs(adjustedDailyRate - requiredDailyRate) > 0.001;

  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 16 }}>🎯</span>
          <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{label}</span>
        </div>
        <span style={{ fontSize: 12, color: 'var(--muted)' }}>{daysRemaining}d remaining</span>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden', marginBottom: 4 }}>
        <div
          style={{
            height: '100%',
            borderRadius: 3,
            width: `${Math.round(Math.min(progressFraction, 1) * 100)}%`,
            background: isAhead ? '#16A34A' : '#2563EB',
            transition: 'width 300ms',
          }}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
        <span>{startValue}{unit ? ` ${unit}` : ''}</span>
        {currentValue !== null && <span style={{ fontWeight: 600, color: 'var(--text)' }}>Now: {currentValue}{unit ? ` ${unit}` : ''}</span>}
        <span>{targetValue}{unit ? ` ${unit}` : ''}</span>
      </div>

      {/* Metrics */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', textAlign: 'center' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Required / day</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{formatRate(requiredDailyRate)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Actual / day</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{formatRate(actualDailyRate)}</div>
        </div>
        {showAdjusted && (
          <div>
            <div style={{ fontSize: 11, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.3px' }}>Adjusted / day</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#D97706' }}>{formatRate(adjustedDailyRate!)}</div>
          </div>
        )}
      </div>

      {/* Gap */}
      {currentValue !== null && gapFromLinear !== 0 && (
        <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12, textAlign: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: isAhead ? '#16A34A' : '#DC2626' }}>
            {isAhead
              ? `Ahead by ${Math.abs(gapFromLinear)}${unit ? ` ${unit}` : ''}`
              : `Off-track by ${Math.abs(gapFromLinear)}${unit ? ` ${unit}` : ''}`}
          </span>
        </div>
      )}
    </div>
  );
}
