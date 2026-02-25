import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Calendar } from 'lucide-react';
import { useDatabaseReady, useDatabase } from '../components/useDatabase';
import * as queries from '@flowstate/core';

interface WeekDay {
  date: string;
  title: string;
  dayNumber?: number;
  mustDoCount: number;
  mustDoDoneCount: number;
  status: string;
}

function getWeekRange(weekId: string): { start: string; end: string } {
  // weekId format: 2026-W09
  const match = weekId.match(/^(\d{4})-W(\d{2})$/);
  if (!match) {
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay() + 1);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }

  const year = parseInt(match[1]);
  const week = parseInt(match[2]);
  // ISO week date to date calculation
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const monday = new Date(jan4);
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
  };
}

export function WeekPage() {
  const { weekId } = useParams<{ weekId: string }>();
  const navigate = useNavigate();
  const db = useDatabase();
  const ready = useDatabaseReady();
  const [days, setDays] = useState<WeekDay[]>([]);
  const [narrative, setNarrative] = useState<string>('');

  

  const loadData = useCallback(async () => {
    if (!db || !weekId) return;
    try {
      const { start, end } = getWeekRange(weekId);
      const dbDays = await queries.getWeekDayPlans(db, start, end);
      interface DBDay {
        id: string;
        date: string;
        title: string;
        dayNumber?: number;
        mustDo?: string[] | string;
        mustDoDone?: boolean[] | string;
        status: string;
      }
      setDays(((dbDays as unknown) as DBDay[]).map((d) => {
        const mustDo = typeof d.mustDo === 'string' ? JSON.parse(d.mustDo) : (d.mustDo ?? []);
        const mustDoDone = typeof d.mustDoDone === 'string' ? JSON.parse(d.mustDoDone) : (d.mustDoDone ?? []);
        return {
          date: d.date,
          title: d.title,
          dayNumber: d.dayNumber,
          mustDoCount: mustDo.length,
          mustDoDoneCount: mustDoDone.filter(Boolean).length,
          status: d.status,
        };
      }));

      // Generate narrative
      try {
        const core = await import('@flowstate/core');
        const agg = await core.getWeeklyAggregate(db, start, end);
        const narr = core.generateWeeklyNarrative(agg);
        setNarrative(narr);
      } catch { /* optional */ }
    } catch (err) {
      console.error('Failed to load week:', err);
    }
  }, [db, weekId]);

  useEffect(() => { loadData(); }, [loadData]);

  if (!ready) return <div className="empty-state"><h3>Loading...</h3></div>;

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const totalMustDo = days.reduce((s, d) => s + d.mustDoCount, 0);
  const doneMustDo = days.reduce((s, d) => s + d.mustDoDoneCount, 0);
  const compliance = totalMustDo > 0 ? Math.round((doneMustDo / totalMustDo) * 100) : 0;

  return (
    <div>
      <button onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, color: 'var(--accent)', fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
        <ArrowLeft size={16} /> Back
      </button>

      <h1 className="page-title">Week {weekId}</h1>
      <p className="page-subtitle">{days.length} days · {compliance}% compliance</p>

      {/* Narrative */}
      {narrative && (
        <div className="card" style={{ marginBottom: 16, padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)', marginBottom: 8 }}>Weekly Summary</h3>
          <p style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{narrative}</p>
        </div>
      )}

      {/* Stats */}
      <div className="card-grid">
        <div className="card countdown-card">
          <div className="countdown-count">{days.length}</div>
          <div className="countdown-label">Days</div>
        </div>
        <div className="card countdown-card">
          <div className="countdown-count" style={{ color: compliance >= 80 ? 'var(--success)' : 'var(--warning)' }}>{compliance}%</div>
          <div className="countdown-label">Compliance</div>
        </div>
        <div className="card countdown-card">
          <div className="countdown-count">{doneMustDo}/{totalMustDo}</div>
          <div className="countdown-label">Must-Dos Done</div>
        </div>
      </div>

      {/* Day list */}
      <h3 className="section-title">Days</h3>
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {days.map((day, idx) => {
          const dateObj = new Date(day.date + 'T12:00:00');
          return (
            <div key={day.date} className="day-row"
              style={{ borderBottom: idx < days.length - 1 ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
              onClick={() => navigate(`/day/${day.date}`)}>
              <div className="day-date">
                <div className="day-date-label">{DAY_NAMES[dateObj.getDay()]}</div>
                <div className="day-date-num">{dateObj.getDate()}</div>
              </div>
              <div className="day-info">
                <div className="day-title">{day.title}</div>
                <div className="day-meta">{day.mustDoDoneCount}/{day.mustDoCount} must-dos{day.dayNumber ? ` · Day ${day.dayNumber}` : ''}</div>
              </div>
              {day.status === 'completed' && (
                <span className="session-status status-completed" style={{ fontSize: 11, padding: '2px 8px' }}>Done</span>
              )}
              <Calendar size={16} style={{ color: 'var(--muted)' }} />
            </div>
          );
        })}
        {days.length === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>No days found for this week</div>
        )}
      </div>
    </div>
  );
}
