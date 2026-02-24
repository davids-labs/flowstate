import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Pause, SkipForward, StopCircle } from 'lucide-react';
import { useDatabaseReady, useDatabase } from '../components/DatabaseProvider';
import { useTimerStore } from '../stores/timerStore';
import * as queries from '@flowstate/core';

function formatTime(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function SessionPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const ready = useDatabaseReady();

  const phase = useTimerStore((s) => s.phase);
  const remaining = useTimerStore((s) => s.remaining);
  const progress = useTimerStore((s) => s.progress);
  const blockIndex = useTimerStore((s) => s.blockIndex);
  const totalBlocks = useTimerStore((s) => s.totalBlocks);
  const currentBlockName = useTimerStore((s) => s.currentBlockName);
  const routineName = useTimerStore((s) => s.routineName);
  const isOverdue = useTimerStore((s) => s.isOverdue);
  const init = useTimerStore((s) => s.init);
  const play = useTimerStore((s) => s.play);
  const pause = useTimerStore((s) => s.pause);
  const resume = useTimerStore((s) => s.resume);
  const skip = useTimerStore((s) => s.skip);
  const end = useTimerStore((s) => s.end);

  const [loaded, setLoaded] = useState(false);

  let db: any = null;
  try { if (ready) db = useDatabase(); } catch { /* not ready */ }

  const loadSession = useCallback(async () => {
    if (!db || !id || loaded) return;
    try {
      const session = await queries.getSession(db, id);
      if (!session) return;

      const blocks = await queries.getRoutineBlocks(db, session.routineId);
      const timerBlocks = blocks.map((b: any) => ({
        name: b.name,
        durationMinutes: b.durationMinutes,
      }));

      if (timerBlocks.length === 0) {
        timerBlocks.push({ name: session.routineName, durationMinutes: 25 });
      }

      init(id, timerBlocks, session.routineName);
      setLoaded(true);

      // Mark session as in_progress
      await queries.updateSession(db, id, { status: 'in_progress', startedAt: new Date().toISOString() });
    } catch (err) {
      console.error('Failed to load session:', err);
    }
  }, [db, id, loaded, init]);

  useEffect(() => { loadSession(); }, [loadSession]);

  const handleEnd = async () => {
    end();
    if (db && id) {
      try {
        await queries.updateSession(db, id, { status: 'completed', endedAt: new Date().toISOString() });
      } catch { /* ignore */ }
    }
    navigate(-1);
  };

  if (!ready) return <div className="empty-state"><h3>Loading...</h3></div>;

  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference * (1 - progress);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 40 }}>
      <button onClick={() => navigate(-1)}
        style={{ alignSelf: 'flex-start', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', fontSize: 14, fontWeight: 600, marginBottom: 24 }}>
        <ArrowLeft size={16} /> Back
      </button>

      <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginBottom: 4 }}>{routineName || 'Session'}</h2>
      <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 32 }}>
        Block {blockIndex + 1} of {totalBlocks}: {currentBlockName}
      </p>

      {/* Circular progress */}
      <div style={{ position: 'relative', width: 280, height: 280, marginBottom: 32 }}>
        <svg width={280} height={280} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={140} cy={140} r={120} fill="none" stroke="var(--border)" strokeWidth={8} />
          <circle cx={140} cy={140} r={120} fill="none"
            stroke={isOverdue ? 'var(--danger)' : 'var(--accent)'}
            strokeWidth={8} strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            style={{ transition: 'stroke-dashoffset 250ms ease' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 800, color: isOverdue ? 'var(--danger)' : 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}>
            {isOverdue ? '+' : ''}{formatTime(Math.abs(remaining))}
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>
            {phase === 'idle' ? 'Ready' : phase === 'running' ? 'Running' : phase === 'paused' ? 'Paused' : phase === 'overdue' ? 'Overdue' : 'Done'}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        {phase === 'idle' && (
          <button className="btn-primary" onClick={play} style={{ padding: '12px 32px', fontSize: 16 }}>
            <Play size={20} /> Start
          </button>
        )}
        {phase === 'running' && (
          <button className="btn-primary" onClick={pause} style={{ padding: '12px 32px', fontSize: 16 }}>
            <Pause size={20} /> Pause
          </button>
        )}
        {phase === 'paused' && (
          <button className="btn-primary" onClick={resume} style={{ padding: '12px 32px', fontSize: 16 }}>
            <Play size={20} /> Resume
          </button>
        )}
        {(phase === 'running' || phase === 'paused' || phase === 'overdue') && (
          <>
            <button className="btn-secondary" onClick={skip} style={{ padding: '12px 20px' }}>
              <SkipForward size={18} /> Skip
            </button>
            <button onClick={handleEnd}
              style={{ background: 'var(--danger)', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '12px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <StopCircle size={18} /> End
            </button>
          </>
        )}
        {phase === 'completed' && (
          <button className="btn-primary" onClick={handleEnd} style={{ padding: '12px 32px', fontSize: 16 }}>
            Complete
          </button>
        )}
      </div>
    </div>
  );
}
