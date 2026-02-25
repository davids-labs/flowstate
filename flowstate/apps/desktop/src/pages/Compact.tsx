import { useTimerStore } from '../stores/timerStore';
import { Play, Pause, SkipForward, StopCircle } from 'lucide-react';

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function CompactTimerPage() {
  const phase = useTimerStore((s) => s.phase);
  const currentBlockName = useTimerStore((s) => s.currentBlockName);
  const routineName = useTimerStore((s) => s.routineName);
  const play = useTimerStore((s) => s.play);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const skip = useTimerStore((s) => s.skip);
  const end = useTimerStore((s) => s.end);
  const remaining = useTimerStore((s) => s._engine?.remaining ?? 0);
  const isOverdue = useTimerStore((s) => s._engine?.isOverdue ?? false);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      height: '100vh',
      padding: '0 24px',
      background: 'rgba(11, 15, 20, 0.9)',
      borderRadius: 12,
      color: 'white',
      userSelect: 'none',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{
          fontSize: 36,
          fontWeight: 800,
          fontVariantNumeric: 'tabular-nums',
          color: isOverdue ? '#DC2626' : 'white',
        }}>
          {isOverdue ? '+' : ''}{formatTime(Math.abs(remaining))}
        </div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', marginTop: 2 }}>
          {routineName ? `${routineName} — ` : ''}{currentBlockName || (phase === 'idle' ? 'No timer' : '')}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {phase === 'idle' && (
          <button onClick={play} style={compactBtn}><Play size={16} /></button>
        )}
        {phase === 'running' && (
          <button onClick={pause} style={compactBtn}><Pause size={16} /></button>
        )}
        {phase === 'paused' && (
          <button onClick={resume} style={compactBtn}><Play size={16} /></button>
        )}
        {(phase === 'running' || phase === 'paused' || phase === 'overdue') && (
          <>
            <button onClick={skip} style={compactBtn}><SkipForward size={16} /></button>
            <button onClick={end} style={{ ...compactBtn, background: '#DC2626' }}><StopCircle size={16} /></button>
          </>
        )}
      </div>
    </div>
  );
}

const compactBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.15)',
  border: 'none',
  borderRadius: 6,
  color: 'white',
  padding: '6px 10px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
};
